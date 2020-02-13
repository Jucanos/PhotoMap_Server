// dotenv fetch
require('dotenv').config();

// Serverless http
const serverless = require('serverless-http');
const Koa = require('koa');
const Router = require('@koa/router');

// Koa 설정
const app = new Koa();
const router = new Router();
router.prefix('/notice');

app.use(router.routes());
app.use(router.allowedMethods());

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// Dynamoose 설정
const { Notice } = require('./modules/dynamo_schema');

// util 가져오기
const { uuid, statusCode, createResponse } = require('./modules/util');

/**
 * Route: /notice
 * Method: get
 */

/* 공지사항 가져오기 */
router.get('/', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // 공지사항 가져오기
  const notices = await Notice.scan().exec();
  console.log({ notices });

  // 반환값 뽑아내기
  let data = [];
  for (let i = 0; i < notices.count; i++) {
    data.push(notices[i].originalItem());
  }

  createResponse(ctx, statusCode.success, data);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
