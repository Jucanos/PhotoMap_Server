// dotenv fetch
require('dotenv').config();

// Serverless http
const serverless = require('serverless-http');
const Koa = require('koa');
const Router = require('@koa/router');

// Koa 설정
const app = new Koa();
const router = new Router();
router.prefix('/users');

app.use(router.routes());
app.use(router.allowedMethods());

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// s3 가져오기
const { deleteFolder } = require('./modules/s3_util');

// Dynamoose 설정
const Dynamoose = require('./modules/dynamo_schema');
const Data = Dynamoose.Data;

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const {
  statusCode,
  createResponse,
  isUndefined,
  getUid,
} = require('./modules/util');

// Request 가져오기
const { paths, kakaoRequest, getDevice } = require('./modules/kakao');

/**
 * Route: /users
 * Method: get, delete
 */

/* 유저 정보 가져오기 */
router.get('/', async ctx => {
  // 카카오톡 유저정보 가져오기
  const result = await kakaoRequest(ctx, paths.getInfo);

  // 파라미터 추출하기
  const uid = result.id;
  const nickname = result.kakao_account.profile.nickname;
  const thumbnail = result.kakao_account.profile.thumbnail_image_url;

  // 초기값 설정
  let userData = new DClass.User({
    uid,
    nickname,
    thumbnail,
  });

  // uid에 해당하는 user의 count
  const user = await Data.queryOne('PK')
    .eq(uid)
    .exec();

  // user가 존재하지 않으면 회원등록
  if (isUndefined(user)) {
    const newUser = new Data(userData.json());
    await newUser.save();
  }
  // user가 존재하면 회원정보 반환
  else {
    let userDB = DClass.parseClass(user);

    // nickname과 thumbnail중 하나라도 다르면
    if (!userData.equal(userDB)) {
      userDB.update(userData);
      await Data.update(userDB.json());
    }
  }

  createResponse(ctx, statusCode.success, userData);
});

/* 유저 삭제 */
router.delete('/', async ctx => {
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

  // uid에 해당하는 user의 count
  const maps = await Data.query('SK')
    .using('GSI')
    .eq(uid)
    .exec();

  // delete promise들을 queue에 담는다.
  for (let i = 0; i < maps.count; i++) {
    // 지도에 사람없는지 체크
    const deleteMap = await Data.query('PK')
      .eq(maps[i].PK)
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
      deleteFolder(maps[i].PK);

      for (let i = 0; i < storyLogs.count; i++) {
        deleteQueue.push(storyLogs[i]);
      }
    } else {
      deleteQueue.push(maps[i]);
    }
  }
  // 전부 delete가 될때까지 대기
  await Promise.all(deleteQueue.map(q => q.delete()));

  createResponse(ctx, statusCode.processingSuccess, null);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
