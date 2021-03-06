// Dynamoose 설정
const { Data } = require('./dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./dynamo_class');
const { getUid } = require('./util');

const cityString = {
  gyeonggi: '경기도',
  gangwon: '강원도',
  chungbuk: '충청북도',
  chungnam: '충청남도',
  jeonbuk: '전라북도',
  jeonnam: '전라남도',
  gyeongbuk: '경상북도',
  gyeongnam: '경상남도',
  jeju: '제주도',
};

// FCM 가져오기
const { sendPush, atomicCounter, enrollMap, quitMap } = require('./firebase');

module.exports = async (ctx, mid, story = null) => {
  // 데이터 가공
  const urlArray = ctx.request.url.split('/');
  const url = urlArray[1];
  const method = ctx.request.method;

  // uid 가져오기
  const uid = getUid(ctx);
  console.log('[Log]', { urlArray, url, method });

  // user 정보 가져오기
  const user = await Data.queryOne('PK')
    .eq(uid)
    .exec();
  const userData = DClass.parseClass(user);

  // logId 가져오기
  const logId = await atomicCounter(mid);
  console.log({ logId });

  // url과 method로 로그메세지 가공
  let data = '';
  if (url == 'maps') {
    if (method == 'POST') {
      // POST
      if (urlArray.length == 2) {
        data = `${userData.nickname}님이 지도를 생성하셨습니다.`;

        // Realtime DB에 적용
        await enrollMap(uid, mid, logId);
      } else if (urlArray.length == 3) {
        data = `${userData.nickname}님이 ${
          cityString[story.cityKey]
        } 지역의 대표지도를 변경하셨습니다.`;
      }
    } else if (method == 'PATCH') {
      // PATCH
      const remove = ctx.request.body.remove || 'false';
      if (remove == 'true') {
        data = `${userData.nickname}님이 지도에서 나갔습니다.`;

        // Realtime DB에 적용
        await quitMap(uid, mid);
      } else {
        data = `${userData.nickname}님이 지도에 초대되었습니다.`;

        // Realtime DB에 적용
        await enrollMap(uid, mid, logId);
      }
    }
  } else if (url == 'users') {
    if (method == 'DELETE') {
      // DELETE
      data = `${userData.nickname}님이 지도에서 나갔습니다.`;
    }
  } else if (url == 'stories') {
    if (method == 'POST') {
      // POST
      data = `${userData.nickname}님이 ${
        cityString[story.cityKey]
      } 지역에 스토리를 추가했습니다.`;
    } else if (method == 'PATCH') {
      // PATCH
      data = `${userData.nickname}님이 ${
        cityString[story.cityKey]
      } 지역의 스토리「${story.title}」를 수정했습니다.`;
    } else if (method == 'DELETE') {
      // DELETE
      data = `${userData.nickname}님이 ${
        cityString[story.cityKey]
      } 지역의 스토리「${story.title}」를 삭제했습니다.`;
    }
  }
  console.log({ uid, mid, data });

  // mid에 연결된 유저-지도 가져오기
  const userMaps = await Data.query('PK')
    .eq(mid)
    .filter('types')
    .eq('USER-MAP')
    .exec();

  // 유저-지도의 시간 업데이트
  for (const userMap of userMaps) {
    await Data.update({ PK: userMap.PK, SK: userMap.SK });
  }

  // 푸시알림 보내기
  for (let i = 0; i < userMaps.length; i++) {
    // 자기 자신을 제외하고 보내기
    if (userMaps[i].SK == uid) {
      userMaps.splice(i, 1);
      break;
    }
  }
  console.log({ userMaps });
  await sendPush(userMaps, data);
};

/*
  로그 종류
  유저가 삭제되어 모든 지도 나감 (users, delete)
  유저가 지도 생성 (maps, post)
  유저가 대표지도 변경 (maps/{mid}, post)
  유저가 지도에 추가/나감 (maps/{mid}, patch)
  유저가 스토리 추가 (stories/{sid}, post)
  유저가 스토리 수정 (stories/{sid}, patch)
  유저가 스토리 삭제 (stories/{sid}, delete)
*/
