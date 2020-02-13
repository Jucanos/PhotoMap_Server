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
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const { statusCode, createResponse, numberPad } = require('./modules/util');

/**
 * Route: /logs
 * Method: get
 */

/* 지도의 로그정보 가져오기 */
router.get('/:id', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  //const createdAt = ctx.query.createdAt || '3000-01-01T01:00:00.000Z';
  const logId = ctx.query.logId || '9999999999';
  console.log('[Parameter]', { mid, logId });

  // 로그 가져오기
  const logs = await Data.query('SK')
    .using('GSI')
    .eq(mid)
    .where('types')
    .lt(`LOG.${numberPad(logId, 10)}`)
    .descending()
    .limit(100)
    .exec();
  console.log({ logs });

  // 반환값 가공하기
  let data = [];

  for (let i = 0; i < logs.count; i++) {
    data.push(DClass.parseClass(logs[i]));
    delete data[i].lid;
    delete data[i].mid;
    delete data[i].updatedAt;
  }

  createResponse(ctx, statusCode.success, data);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
