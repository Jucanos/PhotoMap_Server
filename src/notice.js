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
 * Route: /notice
 * Method: get
 */

/* 공지사항 가져오기 */
router.get('/', async ctx => {
  createResponse(ctx, statusCode.success, 'notice get');
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
