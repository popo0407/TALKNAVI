export const getMessages = `
  query GetMessages($meetingId: ID!) {
    getMessages(meetingId: $meetingId) {
      messageId
      senderId
      senderName
      content
      type
      createdAt
      reactions
    }
  }
`;

export const getMeeting = `
  query GetMeeting($id: ID!) {
    getMeeting(id: $id) {
      id
      goal
      rules
      boardContent
      status
    }
  }
`;

export const sendMessage = `
  mutation SendMessage($meetingId: ID!, $senderId: String!, $senderName: String!, $content: String!) {
    sendMessage(meetingId: $meetingId, senderId: $senderId, senderName: $senderName, content: $content) {
      meetingId
      messageId
      senderId
      senderName
      content
      type
      createdAt
      reactions
    }
  }
`;

export const onMessage = `
  subscription OnMessage($meetingId: ID!) {
    onMessage(meetingId: $meetingId) {
      messageId
      senderId
      senderName
      content
      type
      createdAt
      reactions
    }
  }
`;

export const onBoardUpdate = `
  subscription OnBoardUpdate($meetingId: ID!) {
    onBoardUpdate(meetingId: $meetingId) {
      boardContent
    }
  }
`;
