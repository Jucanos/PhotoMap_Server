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
router.prefix('/push');

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
const { paths, kakaoRequest, getDevice } = require('./modules/kakao');

/**
 * Route: /push
 * Method: post, delete
 */

/* 푸시 토큰 등록하기 */
router.post('/', bodyParser(), async ctx => {
  // JWT에서 uid 가져오기
  const uuid = getUid(ctx);

  // 파라미터 가져오기
  const push_token = ctx.query.pushToken;
  const device_id = ctx.query.deviceId;

  // pushToken 존재여부 확인
  if (isUndefined(push_token)) {
    return createResponse(
      ctx,
      statusCode.requestError,
      null,
      'push token is required'
    );
  }

  // deviceId 존재여부 확인
  if (isUndefined(device_id)) {
    return createResponse(
      ctx,
      statusCode.requestError,
      null,
      'device id is required'
    );
  }

  // pushToken 등록
  const push_type = getDevice(ctx);

  if (push_type != null) {
    await kakaoRequest(ctx, paths.registerPushToken, {
      uuid,
      device_id,
      push_type,
      push_token,
    });
  }

  createResponse(ctx, statusCode.processingSuccess, null);
});

/* 푸시 토큰 삭제하기 */
router.delete('/', bodyParser(), async ctx => {
  createResponse(ctx, statusCode.processingSuccess, null);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
