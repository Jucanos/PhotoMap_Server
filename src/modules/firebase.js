// Firebase Admin 설정
const admin = require('firebase-admin');

// util 가져오기
const { isUndefined } = require('./util');

// init을 한번만 하도록 설정
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
    databaseURL: 'https://photomap-22e48.firebaseio.com/',
  });
}

// Realtime Database 가져오기
const db = admin.database();

// 푸시알림 보내기
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
    const pushResult = await admin.messaging().send(message);
    console.log(pushResult);
  }
};

// 원자성 증가
exports.atomicCounter = async mid => {
  // 지도의 reference 가져오기
  const ref = db.ref(`${process.env.STAGE}/maps/${mid}/logNumber`);

  // value를 1 원자성 증가
  const result = await ref.transaction(current_value => {
    return (current_value || 0) + 1;
  });
  console.log(result);

  // 변경된 value를 반환
  return result.snapshot.val();
};

// 사용자 추가/삭제시 userNumber 변경
exports.addUserNumber = async mid => {
  console.log('[addUserNumber]', { mid });

  // 지도 reference 가져오기
  const ref = db.ref(`${process.env.STAGE}/maps/${mid}/userNumber`);

  // value를 1 원자성 증가
  const result = await ref.transaction(current_value => {
    return (current_value || 0) + 1;
  });
  console.log(result);
};

// 사용자 추가시 viewd logNumber 초기화
exports.enrollMap = async (uid, mid, value = 0) => {
  console.log('[enrollMap]', { uid, mid, value });

  // 사용자의 지도 reference 가져오기
  const ref = db.ref(`${process.env.STAGE}/users/${uid}/${mid}`);
  await ref.set(value);
};

// 지도에서 사용자 나갈시 users/{uid}/{mid} 삭제
exports.quitMap = async (uid, mid) => {
  console.log('[quitMap]', { uid, mid });

  // 사용자의 지도 reference 가져오기
  const ref = db.ref(`${process.env.STAGE}/users/${uid}/${mid}`);

  await ref.remove();
};

// 사용자 삭제시 users/{uid} 삭제
exports.deleteUser = async uid => {
  console.log('[deleteUser]', { uid });

  // 사용자의 지도 reference 가져오기
  const ref = db.ref(`${process.env.STAGE}/users/${uid}`);

  await ref.remove();
};

// 지도 삭제시 maps/{mid} 삭제
exports.deleteMap = async (mid, users) => {
  console.log('[deleteMap]', { mid, users });

  // 사용자의 지도 reference 가져오기
  const ref = db.ref(`${process.env.STAGE}/maps/${mid}`);

  if (!isUndefined(users)) {
    console.log({ users });
    for (const user of users) {
      if (user.types == 'USER-MAP') {
        const userRef = db.ref(`${process.env.STAGE}/users/${user.SK}/${mid}`);
        await userRef.remove();
      }
    }
  }

  await ref.remove();
};
