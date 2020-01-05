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

// util 가져오기
const { statusCode, createResponse, isUndefined } = require('./modules/util');

/**
 * Route: /maps
 * Method: get, post
 */

/* 지도 리스트 가져오기 */
router.get('/', async ctx => {
  createResponse(ctx, statusCode.success, 'map list');
});

/* 새로운 지도 생성 */
router.post('/', async ctx => {
  createResponse(ctx, statusCode.success, 'map post');
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
