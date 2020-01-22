// dotenv fetch
require('dotenv').config();

// Serverless http
const serverless = require('serverless-http');
const Koa = require('koa');
const Router = require('@koa/router');

// Koa 설정
const app = new Koa();
const router = new Router();
router.prefix('/logs');

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

// Request 가져오기
const { paths, kakaoRequest, getDeviceType } = require('./modules/kakao');

/**
 * Route: /logs
 * Method: get
 */

/* 지도의 로그정보 가져오기 */
router.get('/:id', async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  const createdAt = ctx.params.createdAt || '3000-01-01T01:00:00.000Z';

  // 로그 가져오기
  const logs = await Data.query('SK')
    .using('GSI')
    .eq(mid)
    .filter('types')
    .eq('LOG')
    .descending()
    .limit(100)
    .filter('createdAt')
    .lt(createdAt)
    .exec();

  // 반환값 가공하기
  let data = [];

  for (let i = 0; i < logs.count; i++) {
    data.push(DClass.parseClass(logs[i]));
  }

  createResponse(ctx, statusCode.success, data);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
