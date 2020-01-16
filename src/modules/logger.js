// Dynamoose 설정
const Dynamoose = require('./dynamo_schema');
const Data = Dynamoose.Data;

// DClass와 util 가져오기
const DClass = require('./dynamo_class');
const { statusCode, createResponse, isUndefined, getUid } = require('./util');

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

module.exports = async (ctx, mid, story = null) => {
  const url = ctx.request.url.split('/')[1];
  const method = ctx.request.method;

  const uid = getUid(ctx);

  const user = await Data.queryOne('PK')
    .eq(uid)
    .exec();

  const userData = DClass.parseClass(user);

  let data = '';
  if (url == 'maps') {
    if (method == 'POST') {
      // POST
      data = `${userData.nickname}님이 지도를 생성하셨습니다.`;
    }
    if (method == 'PATCH') {
      // PATCH
      const remove = ctx.request.body.remove;
      if (remove) {
        data = `${userData.nickname}님이 지도에서 나갔습니다.`;
      } else {
        data = `${userData.nickname}님이 지도에 초대되었습니다.`;
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
      data = `${userData.nickname}님이 \
      ${cityString[story.cityKey]} \
      지역에 스토리를 추가했습니다.`;
    } else if (method == 'PATCH') {
      // PATCH
      data = `${userData.nickname}님이 \
      ${cityString[story.cityKey]} \
      지역의 스토리「${story.title}」를 수정했습니다.`;
    } else if (method == 'DELETE') {
      // DELETE
      data = `${userData.nickname}님이 \
      ${cityString[story.cityKey]} \
      지역의 스토리「${story.title}」를 삭제했습니다.`;
    }
  }

  const logData = new DClass.Log({
    uid,
    mid,
    data,
  });
  const newLog = new Data(logData.json());
  await newLog.save();
};

/*
  로그 종류
  유저가 삭제되어 모든 지도 나감 (users/delete)
  유저가 지도 생성 (maps/post)
  유저가 지도에 추가/나감 (maps/patch)
  유저가 스토리 추가 (stories/post)
  유저가 스토리 수정 (stories/patch)
  유저가 스토리 삭제 (stories/delete)
*/
