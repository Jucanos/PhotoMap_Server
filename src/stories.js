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

// s3 가져오기
const { upload, deleteObject } = require('./modules/s3_util');

// Dynamoose 설정
const Dynamoose = require('./modules/dynamo_schema');
const Data = Dynamoose.Data;

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const {
  statusCode,
  createResponse,
  isUndefined,
  representsDefault,
  getUid,
} = require('./modules/util');

/**
 * Route: /stories/{mid}
 * Method: post
 */

/* 스토리 만들기 */
router.post('/:id', upload.single('img'), async ctx => {
  // 파라미터 가져오기
  const mid = ctx.params.id;
  const cityKey = ctx.request.body.cityKey;
  const title = ctx.request.body.title || '';
  const context = ctx.request.body.context || '';
  const file = ctx.file;

  console.log(file);

  // cityKey 존재여부 확인
  if (isUndefined(cityKey)) {
    return createResponse(
      ctx,
      statusCode.failure,
      null,
      'cityKey is undefined'
    );
  }

  // file 존재여부 확인
  if (isUndefined(file)) {
    return createResponse(ctx, statusCode.failure, null, 'file is undefined');
  }

  // cityKey가 valid한지 확인
  if (representsDefault.indexOf(cityKey) == -1) {
    return createResponse(ctx, statusCode.failure, null, 'cityKey is invalid');
  }

  // Story 객체 생성
  const storyData = new DClass.Story({
    mid,
    cityKey,
    title,
    context,
    file: process.env.S3_CUSTOM_DOMAIN + file.key,
  });

  // Story 저장
  const newStory = new Data(storyData.json());
  await newStory.save();

  createResponse(ctx, statusCode.success, storyData);
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
