// dotenv fetch
require('dotenv').config();

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// s3 가져오기
const { deleteFolder } = require('./modules/s3_util');

// Dynamoose 설정
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const { statusCode, getUid } = require('./modules/util');

// Request 가져오기
const { paths, kakaoRequest, getDeviceType } = require('./modules/kakao');

// Logger 가져오기
const Logger = require('./modules/logger');

// Canvas 가져오기
const { makeThumbnail } = require('./modules/canvas');

/**
 * Route: /users
 * Method: delete
 */

/* 유저 삭제 */
module.exports.handler = async (ctx, context) => {
  context.basePath = process.env.BASE_PATH;
  context.callbackWaitsForEmptyEventLoop = false;

  ctx.request = {
    header: {
      authorization: ctx.headers.Authorization,
      'user-agent': ctx.headers['User-Agent'],
    },
    url: ctx.path,
    method: ctx.httpMethod,
  };
  ctx.req = {
    requestContext: ctx.requestContext,
  };
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // uid로 User 객체 생성
  const exUserData = new DClass.User({
    uid,
  });
  const exUser = new Data(exUserData.json());

  // 삭제할 model들 queue
  let deleteQueue = [];

  // user를 삭제할 queue에 담는다.
  deleteQueue.push(exUser);

  // uid에 해당하는 user-map의 count
  const maps = await Data.query('SK')
    .using('GSI')
    .eq(uid)
    .where('types')
    .eq('USER-MAP')
    .exec();

  // delete promise들을 queue에 담는다.
  for (let i = 0; i < maps.count; i++) {
    // 지도에 사람없는지 체크
    const deleteMap = await Data.query('PK')
      .eq(maps[i].PK)
      .filter('types')
      .in(['MAP', 'USER-MAP'])
      .exec();

    if (deleteMap.count <= 2) {
      for (let i = 0; i < deleteMap.count; i++) {
        deleteQueue.push(deleteMap[i]);
      }

      // 스토리와 로그도 삭제
      const storyLogs = await Data.query('SK')
        .using('GSI')
        .eq(maps[i].PK)
        .exec();

      // 지도에 연결된 s3 폴더 삭제
      await deleteFolder(maps[i].PK);

      for (let i = 0; i < storyLogs.count; i++) {
        deleteQueue.push(storyLogs[i]);
      }
    } else {
      deleteQueue.push(maps[i]);

      // 섬네일 제작
      for (let i = 0; i < deleteMap.length; i++) {
        if (deleteMap[i].types == 'MAP' || deleteMap[i].SK == uid) {
          deleteMap.splice(i, 1);
          i--;
          continue;
        }
      }
      await makeThumbnail(maps[i].PK, deleteMap);

      // 로그
      await Logger(ctx, maps[i].PK);
    }
  }
  // 전부 delete가 될때까지 대기
  await Promise.all(deleteQueue.map(q => q.delete()));

  return {
    statusCode: statusCode.processingSuccess,
    body: null,
  };
};
