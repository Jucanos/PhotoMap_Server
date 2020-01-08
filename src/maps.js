// dotenv fetch
require('dotenv').config();

// Serverless http
const serverless = require('serverless-http');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('@koa/router');

// Koa 설정
const app = new Koa();
const router = new Router();
router.prefix('/maps');

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

/**
 * Route: /maps
 * Method: get, post
 */

/* 지도 리스트 가져오기 */
router.get('/', async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // uid에 해당하는 user의 count
  const maps = await Data.query('SK')
    .using('GSI')
    .eq(uid)
    .exec();

  // 지도-유저에서 mid들을 뽑아서 넣는다.
  let mapData = [];
  for (let i = 0; i < maps.count; i++) {
    const relation = DClass.parseClass(maps[i]);
    mapData.push(relation.mid);
  }

  createResponse(ctx, statusCode.success, mapData);
});

/* 새로운 지도 생성 */
router.post('/', async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 새로운 지도 생성
  const mapData = new DClass.Map();
  const newMap = new Data(mapData.json());
  await newMap.save();

  // 지도-유저 연결
  const userMapData = new DClass.UserMap({
    mid: mapData.mid,
    uid,
  });

  const newUserMap = new Data(userMapData.json());
  await newUserMap.save();

  createResponse(ctx, statusCode.success, mapData);
});

/**
 * Route: /maps/{mid}
 * Method: get, patch, delete
 */

/* 특정 지도 정보 가져오기 */
router.get('/:id', async ctx => {
  // 파라미터 가져오기
  const mid = ctx.params.id;

  // 지도 정보 가져오기
  const maps = await Data.queryOne('PK')
    .eq(mid)
    .where('SK')
    .eq('INFO')
    .exec();

  if (isUndefined(maps)) {
    return createResponse(ctx, statusCode.failure, null, 'map is not exist');
  }

  let data = DClass.parseClass(maps);

  // TODO: 스토리와 로그 완성 후 가져오는거 추가
  // 다른 정보 가져오기
  // const contents = await Data.query('SK')
  //   .using('GSI')
  //   .eq(mid)
  //   .exec();

  // console.log(contents);

  createResponse(ctx, statusCode.success, data);
});

/* 지도에 사용자 추가/삭제 */
router.patch('/:id', bodyParser(), async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  const remove = ctx.request.body.remove || false;

  // 지도 정보 가져오기
  const maps = await Data.query('PK')
    .eq(mid)
    .exec();

  if (isUndefined(maps)) {
    return createResponse(ctx, statusCode.failure, null, 'map is not exist');
  }

  // 지도-유저 생성
  const userMapData = new DClass.UserMap({
    mid,
    uid,
  });
  const newUserMap = new Data(userMapData.json());

  // 소유자 삭제 & 지도의 유지자가 없는경우 지도도 삭제
  if (maps.count <= 2 && remove) {
    let deleteQueue = [];
    for (let i = 0; i < maps.count; i++) {
      deleteQueue.push(maps[i]);
    }

    // 스토리와 로그도 삭제
    const storyLogs = await Data.query('SK')
      .using('GSI')
      .eq(mid)
      .exec();

    // TODO: 지도 삭제시 연결된 S3의 지도폴더도 삭제 필요
    deleteFolder(mid);

    for (let i = 0; i < storyLogs.count; i++) {
      deleteQueue.push(storyLogs[i]);
    }

    // 삭제를 기다린다.
    await Promise.all(deleteQueue.map(q => q.delete()));
  } else {
    // 사용자 삭제
    if (remove) {
      await newUserMap.delete();
    }
    //사용자 추가
    else {
      await newUserMap.save();
    }
  }

  createResponse(ctx, statusCode.processingSuccess, null);
});

/* 지도 삭제 */
router.delete('/:id', async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const mid = ctx.params.id;

  // mid에 해당하는 map의 count
  const maps = await Data.query('PK')
    .eq(mid)
    .exec();

  // DB에 mid에 해당하는 지도가 없음
  if (maps.count == 0) {
    return createResponse(
      ctx,
      statusCode.failure,
      null,
      'this map is already deleted'
    );
  }

  // 가져온 document에서 map만 뽑아낸다.
  let deleteQueue = [];
  let isOwner = false;
  for (let i = 0; i < maps.count; i++) {
    deleteQueue.push(maps[i]);

    // 삭제하려는 소유자가 지도에 소속되어있는지 확인
    if (maps[i].SK == uid) isOwner = true;
  }

  // 소유자가 아니면 삭제 불가
  if (!isOwner) {
    return createResponse(
      ctx,
      statusCode.authorizationFailure,
      null,
      'this map is not yours'
    );
  }

  // 스토리와 로그도 삭제
  const storyLogs = await Data.query('SK')
    .using('GSI')
    .eq(mid)
    .exec();

  for (let i = 0; i < storyLogs.count; i++) {
    deleteQueue.push(storyLogs[i]);
  }

  // 삭제를 기다린다.
  await Promise.all(deleteQueue.map(q => q.delete()));

  // s3 폴더 삭제
  deleteFolder(mid);

  createResponse(ctx, statusCode.processingSuccess, null);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
