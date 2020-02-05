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
router.prefix('/stories');

app.use(router.routes());
app.use(router.allowedMethods());

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// s3 가져오기
const { upload, deleteObject } = require('./modules/s3_util');

// Dynamoose 설정
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const {
  statusCode,
  createResponse,
  isUndefined,
  representsDefault,
  getUid,
} = require('./modules/util');

// Logger 가져오기
const Logger = require('./modules/logger');

/**
 * Route: /stories/{mid}
 * Method: post
 */

/* 스토리 만들기 */
router.post('/:id', upload.array('img', 5), async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  const cityKey = ctx.request.body.cityKey;
  const title = ctx.request.body.title || '';
  const context = ctx.request.body.context || '';
  const files = ctx.files;
  console.log('[Parameter]', { mid, cityKey, title, context, files });

  // files 존재여부 확인
  if (isUndefined(files) || files.length == 0) {
    console.error('files are undefined');
    return createResponse(ctx, statusCode.failure, null, 'files are undefined');
  }

  // cityKey 존재여부 확인
  if (isUndefined(cityKey)) {
    for (const i in files) {
      deleteObject(files[i].key);
    }

    console.error('cityKey is undefined');
    return createResponse(
      ctx,
      statusCode.failure,
      null,
      'cityKey is undefined'
    );
  }

  // cityKey가 valid한지 확인
  if (representsDefault.indexOf(cityKey) == -1) {
    for (const i in files) {
      deleteObject(files[i].key);
    }

    console.error('cityKey is invalid');
    return createResponse(ctx, statusCode.failure, null, 'cityKey is invalid');
  }

  // map이 존재하는지 확인
  const map = await Data.queryOne('PK')
    .eq(mid)
    .where('SK')
    .eq('INFO')
    .filter('types')
    .eq('MAP')
    .exec();

  if (isUndefined(map)) {
    for (const i in files) {
      deleteObject(files[i].key);
    }

    console.error('map is not exist');
    return createResponse(ctx, statusCode.failure, null, 'map is not exist');
  }

  // Story 객체 생성
  let storyData = new DClass.Story({
    mid,
    creator: uid,
    cityKey,
    title,
    context,
  });

  // Story에 file들을 추가
  storyData.files = [];
  for (const i in files) {
    storyData.files.push(process.env.S3_CUSTOM_DOMAIN + files[i].key);
  }

  // Story 저장
  const newStory = new Data(storyData.json());
  await newStory.save();

  // 로그
  Logger(ctx, mid, storyData);

  createResponse(ctx, statusCode.success, storyData);
});

/**
 * Route: /stories/{mid}/{cityKey}
 * Method: get
 */

/* 한 지도의 cityKey에 대해서 여러개의 스토리들 가져오기 */
router.get('/:id/:key', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  const cityKey = ctx.params.key;
  // const updatedAt = ctx.query.updatedAt || 0;
  console.log('[Parameter]', { mid, cityKey });

  // 스토리 가져오기
  const storys = await Data.query('SK')
    .using('GSI')
    .eq(mid)
    .where('types')
    .eq(`STORY.${cityKey}`)
    // .filter('updatedAt')
    // .gt(updatedAt)
    .exec();
  /*
    주석친 부분은 최신만 가져오는 부분인데 스토리의 개수가 
    17000개보다 크지 않을것으로 생각되어 주석처리함
  */

  // 반환할 데이터
  let data = [];

  storys.map(story => {
    data.push(DClass.parseClass(story));
  });

  createResponse(ctx, statusCode.success, data);
});

/**
 * Route: /stories/{sid}
 * Method: get, patch, delete
 */

/* 특정 스토리 읽기 */
router.get('/:id', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  const sid = ctx.params.id;

  // sid로 스토리 가져오기
  const story = await Data.queryOne('PK')
    .eq(sid)
    .filter('types')
    .beginsWith('STORY')
    .exec();

  // 스토리가 없다면 오류
  if (isUndefined(story)) {
    console.error('Story is not exist');
    return createResponse(ctx, statusCode.failure, null, 'Story is not exist');
  }

  // 스토리 파싱하여 반환
  const storyData = DClass.parseClass(story);

  createResponse(ctx, statusCode.success, storyData);
});

/* 스토리 수정 */
router.patch('/:id', bodyParser(), async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // 파라미터 가져오기
  const sid = ctx.params.id;
  const title = ctx.request.body.title || '';
  const context = ctx.request.body.context || '';
  console.log('[Parameter]', { sid, title, context });

  // 스토리 가져오기
  const story = await Data.queryOne('PK')
    .eq(sid)
    .filter('types')
    .beginsWith('STORY')
    .exec();

  // 스토리가 존재하지 않으면 오류처리
  if (isUndefined(story)) {
    console.error('this story is not exist');
    return createResponse(
      ctx,
      statusCode.failure,
      null,
      'this story is not exist'
    );
  }

  // 스토리를 업데이트
  const storyData = DClass.parseClass(story);
  storyData.update({ title, context });
  await Data.update(storyData.json());

  // 로그
  Logger(ctx, storyData.mid, storyData);

  createResponse(ctx, statusCode.processingSuccess, null);
});

/* 스토리 삭제 */
router.delete('/:id', async ctx => {
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const sid = ctx.params.id;

  // sid에 해당하는 story 확인
  const story = await Data.queryOne('PK')
    .eq(sid)
    .filter('types')
    .beginsWith('STORY')
    .exec();

  // DB에 sid에 해당하는 스토리가 없음
  if (isUndefined(story)) {
    console.error('this story is already deleted');
    return createResponse(
      ctx,
      statusCode.failure,
      null,
      'this story is already deleted'
    );
  }

  // Story에서 Data추출
  const storyData = DClass.parseClass(story);

  // 소유권 체크
  const owner = await Data.queryOne('PK')
    .eq(storyData.mid)
    .where('SK')
    .eq(uid)
    .filter('types')
    .eq('USER-MAP')
    .exec();

  // 소유자가 아니면 삭제 불가
  if (isUndefined(owner)) {
    console.error('this story is not yours');
    return createResponse(
      ctx,
      statusCode.authorizationFailure,
      null,
      'this story is not yours'
    );
  }

  // 삭제를 기다린다.
  await story.delete();

  // s3 객체를 삭제한다.
  for (const i in storyData.files) {
    await deleteObject(storyData.files[i]);
  }

  // 로그
  Logger(ctx, storyData.mid, storyData);

  createResponse(ctx, statusCode.processingSuccess, null);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
