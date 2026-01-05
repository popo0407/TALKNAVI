import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. DynamoDB Tables
    const meetingsTable = new dynamodb.Table(this, 'MeetingsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For prototype
    });

    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      partitionKey: { name: 'meetingId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE, // Enable Stream for AI trigger
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. AppSync API
    const api = new appsync.GraphqlApi(this, 'TalkNaviApi', {
      name: 'talknavi-api',
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
      xrayEnabled: true,
    });

    // 3. Data Sources & Resolvers
    const meetingsDS = api.addDynamoDbDataSource('MeetingsDS', meetingsTable);
    const messagesDS = api.addDynamoDbDataSource('MessagesDS', messagesTable);

    // Query.getMeeting
    meetingsDS.createResolver('GetMeetingResolver', {
      typeName: 'Query',
      fieldName: 'getMeeting',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        #set($result = $ctx.result)
        #if($result)
          $util.qr($result.put("meetingId", $result.id))
        #end
        $util.toJson($result)
      `),
    });

    // Query.getMessages
    messagesDS.createResolver('GetMessagesResolver', {
      typeName: 'Query',
      fieldName: 'getMessages',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbQuery(
        cdk.aws_appsync.KeyCondition.eq('meetingId', 'meetingId')
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });

    // Mutation.createMeeting
    meetingsDS.createResolver('CreateMeetingResolver', {
      typeName: 'Mutation',
      fieldName: 'createMeeting',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2017-02-28",
          "operation": "PutItem",
          "key": {
            "id": $util.dynamodb.toDynamoDBJson($util.autoId())
          },
          "attributeValues": {
            "goal": $util.dynamodb.toDynamoDBJson($ctx.args.goal),
            "rules": $util.dynamodb.toDynamoDBJson($ctx.args.rules),
            "duration": $util.dynamodb.toDynamoDBJson($ctx.args.duration),
            "startTime": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601()),
            "status": $util.dynamodb.toDynamoDBJson("IN_PROGRESS"),
            "boardContent": $util.dynamodb.toDynamoDBJson("{}")
          }
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        #set($result = $ctx.result)
        $util.qr($result.put("meetingId", $result.id))
        $util.toJson($result)
      `),
    });

    // Mutation.sendMessage
    messagesDS.createResolver('SendMessageResolver', {
      typeName: 'Mutation',
      fieldName: 'sendMessage',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2017-02-28",
          "operation": "PutItem",
          "key": {
            "meetingId": $util.dynamodb.toDynamoDBJson($ctx.args.meetingId),
            "createdAt": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
          },
          "attributeValues": {
            "messageId": $util.dynamodb.toDynamoDBJson($util.autoId()),
            "senderId": $util.dynamodb.toDynamoDBJson($ctx.args.senderId),
            "senderName": $util.dynamodb.toDynamoDBJson($ctx.args.senderName),
            "content": $util.dynamodb.toDynamoDBJson($ctx.args.content),
            "type": $util.dynamodb.toDynamoDBJson("TEXT"),
            "reactions": $util.dynamodb.toDynamoDBJson("{}")
          }
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // Mutation.updateBoard (Internal)
    meetingsDS.createResolver('UpdateBoardResolver', {
      typeName: 'Mutation',
      fieldName: 'updateBoard',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2017-02-28",
          "operation": "UpdateItem",
          "key": {
            "id": $util.dynamodb.toDynamoDBJson($ctx.args.meetingId)
          },
          "update": {
            "expression": "SET boardContent = :c",
            "expressionValues": {
              ":c": $util.dynamodb.toDynamoDBJson($ctx.args.content)
            }
          }
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        #set($result = $ctx.result)
        $util.qr($result.put("meetingId", $result.id))
        $util.toJson($result)
      `),
    });

    // Mutation.postFacilitation (Internal)
    messagesDS.createResolver('PostFacilitationResolver', {
      typeName: 'Mutation',
      fieldName: 'postFacilitation',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2017-02-28",
          "operation": "PutItem",
          "key": {
            "meetingId": $util.dynamodb.toDynamoDBJson($ctx.args.meetingId),
            "createdAt": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
          },
          "attributeValues": {
            "messageId": $util.dynamodb.toDynamoDBJson($util.autoId()),
            "senderId": $util.dynamodb.toDynamoDBJson("AI_FACILITATOR"),
            "senderName": $util.dynamodb.toDynamoDBJson("AIファシリテーター"),
            "content": $util.dynamodb.toDynamoDBJson($ctx.args.content),
            "type": $util.dynamodb.toDynamoDBJson($ctx.args.type),
            "reactions": $util.dynamodb.toDynamoDBJson("{}")
          }
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // 4. AI Facilitator Lambda
    const facilitatorFunction = new lambda.Function(this, 'FacilitatorFunction', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/dist')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60), // Bedrock can be slow
      environment: {
        MEETINGS_TABLE: meetingsTable.tableName,
        MESSAGES_TABLE: messagesTable.tableName,
        APPSYNC_API_URL: api.graphqlUrl,
        APPSYNC_API_KEY: api.apiKey!, // Use IAM in prod, API Key for prototype simplicity
        REGION: this.region,
      },
    });

    // Permissions
    meetingsTable.grantReadWriteData(facilitatorFunction);
    messagesTable.grantReadWriteData(facilitatorFunction);
    
    // Bedrock Permission
    facilitatorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*:*:foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0'], // Adjust model ID as needed
    }));

    // Trigger: DynamoDB Stream
    facilitatorFunction.addEventSource(new DynamoEventSource(messagesTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      filters: [
        lambda.FilterCriteria.filter({
          dynamodb: {
            NewImage: {
              senderId: { S: [{ "anything-but": ["AI_FACILITATOR"] }] } // Don't trigger on self
            }
          }
        })
      ]
    }));

    // 6. Frontend Hosting (S3 + CloudFront)
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // For SPA routing
        },
      ],
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/out'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // 5. Outputs
    new cdk.CfnOutput(this, 'GraphQLAPIURL', { value: api.graphqlUrl });
    new cdk.CfnOutput(this, 'GraphQLAPIKey', { value: api.apiKey! });
    new cdk.CfnOutput(this, 'Region', { value: this.region });
    new cdk.CfnOutput(this, 'WebsiteURL', { value: `https://${distribution.distributionDomainName}` });
  }
}
