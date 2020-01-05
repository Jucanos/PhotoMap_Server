// dotenv fetch
require('dotenv').config();

// Serverless http
const serverless = require('serverless-http');
const Koa = require('koa');
const KoaBody = require('koa-body');
const bodyParser = require('koa-bodyparser');
const Router = require('@koa/router');

// Koa 설정
const app = new Koa();
const router = new Router();
router.prefix('/stories');

app.use(router.routes());
app.use(router.allowedMethods());

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// util 가져오기
const { statusCode, createResponse, isUndefined } = require('./modules/util');

/**
 * Route: /stories/{mid}
 * Method: post
 */

/* 스토리 만들기 */
router.post('/:id', upload.single('img'), async ctx => {
  createResponse(ctx, statusCode.success, 'story post');
});

/**
 * Route: /stories/{mid}/{cityKey}
 * Method: get
 */

/* 한 지도의 cityKey에 대해서 여러개의 스토리들 가져오기 */
router.get('/:id/:key', async ctx => {
  createResponse(ctx, statusCode.success, 'story list');
});

/**
 * Route: /stories/{sid}
 * Method: get, patch, delete
 */

/* 특정 스토리 읽기 */
router.get('/:id', async ctx => {
  createResponse(ctx, statusCode.success, 'story get');
});

/* 스토리 수정 */
router.patch('/:id', bodyParser(), async ctx => {
  createResponse(ctx, statusCode.success, 'story patch');
});

/* 스토리 삭제 */
router.delete('/:id', async ctx => {
  createResponse(ctx, statusCode.success, 'story delete');
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
