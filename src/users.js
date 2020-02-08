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
router.prefix('/users');

app.use(router.routes());
app.use(router.allowedMethods());

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// Dynamoose 설정
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const { getUid, statusCode, createResponse } = require('./modules/util');

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

  // JWT에서 uid 가져오기
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
