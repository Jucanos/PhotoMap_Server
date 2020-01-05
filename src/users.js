// dotenv fetch
require('dotenv').config();

// Serverless http
const serverless = require('serverless-http');
const Koa = require('koa');
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
const Dynamoose = require('./modules/dynamo_schema');
const Data = Dynamoose.Data;

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const { statusCode, createResponse, isUndefined } = require('./modules/util');

/**
 * Route: /users
 * Method: delete
 */

/* 유저 삭제 */
router.delete('/', async ctx => {
  createResponse(ctx, statusCode.success, 'user delete');
});

/**
 * Route: /users/{uid}
 * Method: get
 */

/* 유저 정보 가져오기 */
router.get('/:id', async ctx => {
  createResponse(ctx, statusCode.success, 'user get');
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
