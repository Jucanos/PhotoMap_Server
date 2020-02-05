// Firebase Admin 설정
const admin = require('firebase-admin');
const serviceAccount = require('../../photomap-firebase-adminkey.json');

if (admin.apps.length == 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
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

  for (let i = 0; i < users.length; ) {
    condition = '';
    for (let j = 0; j < 5 && i + j < users.length; i++, j++) {
      condition += `${users[i + j].PK} in topics`;
      if (!(j == 4 || i + j == users.length - 1)) {
        condition += ' || ';
      }
    }

    message.condidion = condition;

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
