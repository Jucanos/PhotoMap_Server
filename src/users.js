// dotenv fetch
require('dotenv').config();

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// Serverless http
const serverless = require('serverless-http');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('@koa/router');

// Koa 설정
const app = new Koa();
const router = new Router();
router.prefix('/users');

app.use(router.routes());
app.use(router.allowedMethods());

// Dynamoose 설정
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const {
  getUid,
  statusCode,
  isUndefined,
  createResponse,
} = require('./modules/util');

// Request 가져오기
const { paths, kakaoRequest } = require('./modules/kakao');

// s3 가져오기
const { deleteFolder } = require('./modules/s3_util');

// Logger 가져오기
const Logger = require('./modules/logger');

// Lambda invoke 가져오기
const { makeThumbnail } = require('./modules/lambda');

// Firebase 가져오기
const { deleteUser, deleteMap } = require('./modules/firebase');

/**
 * Route: /users
 * Method: get, delete
 */

/* 유저 정보 가져오기 */
router.get('/', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // 카카오톡 유저정보 가져오기
  const result = await kakaoRequest(ctx, paths.getInfo);

  // 파라미터 추출하기
  const uid = String(result.id);
  const nickname = result.kakao_account.profile.nickname;
  let thumbnail = result.kakao_account.profile.thumbnail_image_url;
  console.log('[Parameter]', { uid, nickname, thumbnail });

  // thumbnail이 없을시 기본값
  if (isUndefined(thumbnail)) {
    thumbnail = process.env.S3_CUSTOM_DOMAIN + 'default_user.png';
  }

  // 초기값 설정
  let userData = new DClass.User({
    uid,
    nickname,
    thumbnail,
  });

  // uid에 해당하는 user의 count
  const user = await Data.queryOne('PK')
    .eq(uid)
    .where('SK')
    .eq('INFO')
    .filter('types')
    .eq('USER')
    .exec();

  // user가 존재하지 않으면 회원등록
  if (isUndefined(user)) {
    console.log('user is not exist and register');
    const newUser = new Data(userData.json());
    await newUser.save();
  }
  // user가 존재하면 회원정보 반환
  else {
    let userDB = DClass.parseClass(user);
    userData.primary = userDB.primary;

    // nickname과 thumbnail중 하나라도 다르면
    if (!userData.equal(userDB)) {
      console.log('user data update');
      userDB.update(userData);
      await Data.update(userDB.json());
    }
  }

  createResponse(ctx, statusCode.success, userData);
});

/* 유저 삭제 */
router.delete('/', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // Auth에서 uid 가져오기
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
    const deleteMaps = await Data.query('PK')
      .eq(maps[i].PK)
      .filter('types')
      .in(['MAP', 'USER-MAP'])
      .exec();

    // 지도에 사람 혼자 남았을 때
    if (deleteMaps.count <= 2) {
      for (let i = 0; i < deleteMaps.count; i++) {
        deleteQueue.push(deleteMaps[i]);
      }

      // 스토리와 로그도 삭제
      const storyLogs = await Data.query('SK')
        .using('GSI')
        .eq(maps[i].PK)
        .exec();

      // 지도에 연결된 s3 폴더 삭제
      await deleteFolder(maps[i].PK);

      // Realtime DB에 적용
      await deleteMap(maps[i].PK);

      // 스토리와 로그들을 deleteQueue에 넣는다.
      for (let i = 0; i < storyLogs.count; i++) {
        deleteQueue.push(storyLogs[i]);
      }
    } else {
      // 지도에 연결된 유저-지도를 deleteQueue에 넣는다.
      deleteQueue.push(maps[i]);

      // 섬네일 제작
      for (let i = 0; i < deleteMaps.length; i++) {
        if (deleteMaps[i].types == 'MAP' || deleteMaps[i].SK == uid) {
          deleteMaps.splice(i, 1);
          i--;
          continue;
        }
      }
      await makeThumbnail(maps[i].PK, deleteMaps);

      // 로그
      await Logger(ctx, maps[i].PK);
    }
  }
  // 전부 delete가 될때까지 대기
  await Promise.all(deleteQueue.map(q => q.delete()));

  // Realtiem DB에 적용
  await deleteUser(uid);

  createResponse(ctx, statusCode.processingSuccess, null);
});

/**
 * Route: /users/{mid}
 * Method: patch
 */

/* 대표지도 설정하기 */
router.patch('/:id', bodyParser(), async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  const remove = ctx.request.body.remove || 'false';
  console.log('[Parameter]', { mid, remove });

  // Auth에서 uid 가져오기
  const uid = getUid(ctx);

  // 유저정보 가져오기
  const user = await Data.queryOne('PK')
    .eq(uid)
    .where('SK')
    .eq('INFO')
    .filter('types')
    .eq('USER')
    .exec();

  // 유저정보 parsing
  const userData = DClass.parseClass(user);
  console.log('before: ', { userData });

  // 대표지도 삭제 or 변경 확인
  if (remove == 'true') {
    userData.primary = null;
  } else {
    userData.primary = mid;
  }
  console.log('after: ', { userData });

  // DB에 반영
  await Data.update(userData.json());

  createResponse(ctx, statusCode.processingSuccess, null);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
