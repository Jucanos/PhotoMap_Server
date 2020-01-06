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
  createResponse(ctx, statusCode.success, 'map get');
});

/* 지도에 사용자 추가/삭제 */
router.patch('/:id', bodyParser(), async ctx => {
  createResponse(ctx, statusCode.success, 'map patch');
});

/* 지도 삭제 */
router.delete('/:id', async ctx => {
  createResponse(ctx, statusCode.success, 'map delete');
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
