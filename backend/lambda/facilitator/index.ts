import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({ region: process.env.REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.REGION });

const MEETINGS_TABLE = process.env.MEETINGS_TABLE!;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE!;
const APPSYNC_API_URL = process.env.APPSYNC_API_URL!;
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY!;

export const handler = async (event: DynamoDBStreamEvent) => {
  console.log('Event:', JSON.stringify(event));

  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue;

    const newImage = unmarshall(record.dynamodb?.NewImage as any);
    const meetingId = newImage.meetingId;
    const content = newImage.content;
    const senderName = newImage.senderName;

    console.log(`Processing message from ${senderName}: ${content}`);

    // 1. Fetch Meeting Context
    const meetingData = await ddb.send(new GetItemCommand({
      TableName: MEETINGS_TABLE,
      Key: { id: { S: meetingId } }
    }));

    if (!meetingData.Item) {
      console.error('Meeting not found');
      continue;
    }
    const meeting = unmarshall(meetingData.Item);

    // 2. Fetch Recent History (Last 10 messages)
    const historyData = await ddb.send(new QueryCommand({
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: 'meetingId = :mid',
      ExpressionAttributeValues: { ':mid': { S: meetingId } },
      Limit: 10,
      ScanIndexForward: false // Get latest first
    }));
    
    const history = historyData.Items?.map(item => unmarshall(item)).reverse() || [];

    // 3. Construct Prompt
    const prompt = `
    あなたは会議のAIファシリテーターです。以下の情報を元に、会議の状況を分析し、必要に応じて介入してください。
    全ての出力（思考プロセス、板書内容、発言メッセージ）は必ず日本語で行ってください。

    会議のゴール: ${meeting.goal}
    ルール: ${JSON.stringify(meeting.rules)}
    現在の板書状態: ${meeting.boardContent}
    
    直近のチャット履歴:
    ${history.map(m => `${m.senderName}: ${m.content}`).join('\n')}
    
    タスク:
    1. 会話を分析し、議論の進展を確認してください。
    2. 「板書（Board）」を更新してください（議論の要約、出た意見、決定事項など）。
    3. 議論を円滑に進めるために介入が必要な場合（質問、要約の提示、次の議題への誘導など）は、提案（Proposal）を作成してください。不要な場合は null にしてください。
    
    出力は以下のJSON形式のみで行ってください。余計な解説は不要です。
    {
      "thought_process": "分析内容と介入の判断理由（日本語）",
      "board_update": { 
        "agenda_status": "現在の進行状況", 
        "opinions": ["意見1", "意見2"], 
        "decisions": ["決定事項1"] 
      },
      "facilitation_action": { 
        "type": "PROPOSAL" または null, 
        "message": "参加者へのメッセージ（日本語）" 
      }
    }
    `;

    // 4. Call Bedrock
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: [
        { role: "user", content: prompt }
      ]
    });

    try {
      const command = new InvokeModelCommand({
        modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: body
      });

      const response = await bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const aiOutput = JSON.parse(responseBody.content[0].text);

      console.log('AI Output:', aiOutput);

      // 5. Execute Actions via AppSync (GraphQL Mutation)
      
      // Update Board
      if (aiOutput.board_update) {
        await callAppSync(`
          mutation UpdateBoard($meetingId: ID!, $content: String!) {
            updateBoard(meetingId: $meetingId, content: $content) {
              id
              meetingId
              boardContent
            }
          }
        `, {
          meetingId: meetingId,
          content: JSON.stringify(aiOutput.board_update)
        });
      }

      // Post Facilitation Message
      if (aiOutput.facilitation_action && aiOutput.facilitation_action.type === 'PROPOSAL') {
        await callAppSync(`
          mutation PostFacilitation($meetingId: ID!, $content: String!, $type: String!) {
            postFacilitation(meetingId: $meetingId, content: $content, type: $type) {
              meetingId
              messageId
              senderId
              senderName
              content
              type
              createdAt
            }
          }
        `, {
          meetingId: meetingId,
          content: aiOutput.facilitation_action.message,
          type: 'PROPOSAL'
        });
      }

    } catch (error) {
      console.error('Error invoking Bedrock or AppSync:', error);
    }
  }
};

async function callAppSync(query: string, variables: any) {
  const response = await fetch(APPSYNC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APPSYNC_API_KEY
    },
    body: JSON.stringify({ query, variables })
  });
  
  const json = await response.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}
