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
  // 공지사항 가져오기
  const notices = await Notice.scan().exec();

  console.log(notices);

  // 반환값 뽑아내기
  let data = [];
  for (let i = 0; i < notices.count; i++) {
    data.push(notices[i].originalItem());
  }

  createResponse(ctx, statusCode.success, data);
});

/* (테스트용) 공지사항 만들기 */
router.post('/', bodyParser(), async ctx => {
  // 파라미터 가져오기
  const title = ctx.request.body.title || '제목';
  const context = ctx.request.body.context || '내용';

  await Notice.create({
    id: uuid(),
    title,
    context,
  });

  createResponse(ctx, statusCode.processingSuccess, null);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
