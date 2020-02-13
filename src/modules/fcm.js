// Firebase Admin 설정
const admin = require('firebase-admin');

if (admin.apps.length == 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gi, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    }),
    databaseURL: 'https://photomap-ba430.firebaseio.com',
  });
}

exports.sendPush = async (users, body = '본문') => {
  let condition = '';
  let message = {
    notification: {
      title: '포토맵',
      body,
      //image: '이미지 주소'
      // animated gif는 ios에서만 작동
      // 안드로이드는 1mb의 사이즈 제한
    },
  };

  // 최대 5명의 유저씩 끊어서 푸시알림 보내기
  for (let i = 0; i < users.length; ) {
    // 1~5명의 유저id에 대해서 조건문 생성
    condition = '';
    for (let j = 0; j < 5 && i < users.length; i++, j++) {
      condition += `'${users[i].SK}' in topics`;
      if (!(j == 4 || i == users.length - 1)) {
        condition += ' || ';
      }
    }

    message.condition = condition;
    console.log('[FCM Push]', message);

    // 푸시알림 보내기
    admin
      .messaging()
      .send(message)
      .then(response => {
        // Response is a message ID string.
        console.log('Successfully sent message:', response);
      })
      .catch(error => {
        console.log('Error sending message:', error);
      });
  }
};
