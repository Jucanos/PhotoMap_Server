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
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const { statusCode, createResponse, getUid } = require('./modules/util');

// Logger 가져오기
const Logger = require('./modules/logger');

// Canvas 가져오기
const { makeThumbnail } = require('./modules/canvas');

/**
 * Route: /maps
 * Method: get, post
 */

/* 지도 리스트 가져오기 */
router.get('/', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // uid에 해당하는 user의 count
  const maps = await Data.query('SK')
    .using('GSI')
    .eq(uid)
    .where('types')
    .eq('USER-MAP')
    .exec();

  // 지도-유저에서 mid들을 뽑아서 넣는다.
  let mapData = [];
  for (let i = 0; i < maps.count; i++) {
    const relation = DClass.parseClass(maps[i]);
    mapData.push({
      mid: relation.mid,
      name: relation.name,
    });
  }

  createResponse(ctx, statusCode.success, mapData);
});

/* 새로운 지도 생성 */
router.post('/', bodyParser(), async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const name = ctx.request.body.name || '새 지도';
  console.log('[Parameter]', { uid, name });

  // 새로운 지도 생성
  const mapData = new DClass.Map({ name });
  const newMap = new Data(mapData.json());
  await newMap.save();

  // 지도-유저 연결
  const userMapData = new DClass.UserMap({
    mid: mapData.mid,
    uid,
    name,
  });

  const newUserMap = new Data(userMapData.json());
  await newUserMap.save();

  // 섬네일 제작
  await makeThumbnail(mapData.mid, [newUserMap]);

  // 로그
  Logger(ctx, mapData.mid);

  createResponse(ctx, statusCode.success, mapData);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
