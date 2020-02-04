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

// s3 가져오기
const { upload, deleteObject, deleteFolder } = require('./modules/s3_util');

// Dynamoose 설정
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const {
  statusCode,
  createResponse,
  representsDefault,
  isUndefined,
  getUid,
} = require('./modules/util');

// Logger 가져오기
const Logger = require('./modules/logger');

// Canvas 가져오기
const { makeThumbnail } = require('./modules/canvas');

/**
 * Route: /maps/{mid}
 * Method: get, post, put, patch, delete
 */

/* 특정 지도 정보 가져오기 */
router.get('/:id', async ctx => {
  // 파라미터 가져오기
  const mid = ctx.params.id;

  // 지도 정보 가져오기
  const maps = await Data.query('PK')
    .eq(mid)
    .filter('types')
    .in(['MAP', 'USER-MAP'])
    .exec();

  if (maps.count == 0) {
    console.error('map is not exist');
    return createResponse(ctx, statusCode.failure, null, 'map is not exist');
  }

  // 지도정보와 사용자 정보 분리
  let data = null;
  let userList = [];
  for (let i = 0; i < maps.count; i++) {
    if (maps[i].types == 'MAP') {
      data = DClass.parseClass(maps[i]);
    } else {
      userList.push({
        PK: maps[i].SK,
        SK: 'INFO',
      });
    }
  }

  // 소유자 정보 가져오기
  const owners = await Data.batchGet(userList);

  // 반환값에 소유자 정보 추가
  data.owners = [];
  for (let i in owners) {
    let user = DClass.parseClass(owners[i]);
    delete user.createdAt;
    delete user.updatedAt;
    data.owners.push(user);
  }

  // TODO: 스토리와 로그 완성 후 가져오는거 추가
  // 다른 정보 가져오기
  // const contents = await Data.query('SK')
  //   .using('GSI')
  //   .eq(mid)
  //   .exec();

  // console.log(contents);

  createResponse(ctx, statusCode.success, data);
});

/* 대표사진 설정하기 */
router.post('/:id', upload.single('img'), async ctx => {
  // 파라미터 가져오기
  const mid = ctx.params.id;
  const cityKey = ctx.request.body.cityKey;
  const file = ctx.file;
  console.log('[Parameter]', { mid, cityKey, file });

  // file 존재여부 확인
  if (isUndefined(file)) {
    console.error('file is undefined');
    return createResponse(ctx, statusCode.failure, null, 'file is undefined');
  }

  // cityKey 존재여부 확인
  if (isUndefined(cityKey)) {
    deleteObject(file.key);

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
    deleteObject(file.key);

    console.error('cityKey is invalid');
    return createResponse(ctx, statusCode.failure, null, 'cityKey is invalid');
  }

  const map = await Data.queryOne('PK')
    .eq(mid)
    .where('SK')
    .eq('INFO')
    .filter('types')
    .eq('MAP')
    .exec();

  // 지도가 존재하는지 확인
  if (isUndefined(map)) {
    deleteObject(file.key);

    console.error('map is not exist');
    return createResponse(ctx, statusCode.failure, null, 'map is not exist');
  }

  const mapData = DClass.parseClass(map);

  // 이전 이미지 삭제
  const beforeImg = mapData.represents[cityKey];
  if (beforeImg != null) {
    deleteObject(beforeImg);
  }

  // 현재 지도데이터 업데이트
  mapData.represents[cityKey] = process.env.S3_CUSTOM_DOMAIN + file.key;
  await Data.update(mapData.json());

  // 로그
  Logger(ctx, mid, { cityKey });

  createResponse(ctx, statusCode.success, mapData.represents);
});

/* 유저-지도의 이름 수정 */
router.put('/:id', bodyParser(), async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  const name = ctx.request.body.name;
  console.log('[Parameter]', { mid, name });

  if (isUndefined(name)) {
    console.error('name is required');
    return createResponse(
      ctx,
      statusCode.requestError,
      null,
      'name is required'
    );
  }

  // 유저-지도를 가져온다
  const userMap = await Data.queryOne('PK')
    .eq(mid)
    .where('SK')
    .eq(uid)
    .filter('types')
    .eq('USER-MAP')
    .exec();

  if (isUndefined(userMap)) {
    console.error('userMap is not exist');
    return createResponse(
      ctx,
      statusCode.failure,
      null,
      'userMap is not exist'
    );
  }

  // 이름을 수정한다
  let userMapData = DClass.parseClass(userMap);
  userMapData.update({ name });
  await Data.update(userMapData.json());

  createResponse(ctx, statusCode.processingSuccess, null);
});

/* 지도에 사용자 추가/삭제 */
router.patch('/:id', bodyParser(), async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const mid = ctx.params.id;
  const remove = ctx.request.body.remove || 'false';
  console.log('[Parameter]', { mid, remove });

  // 지도 정보와 소유자 정보 가져오기
  const maps = await Data.query('PK')
    .eq(mid)
    .filter('types')
    .in(['MAP', 'USER-MAP'])
    .exec();

  console.log({ maps });

  if (maps.count == 0) {
    console.error('map is not exist');
    return createResponse(ctx, statusCode.failure, null, 'map is not exist');
  }

  // 소유자 삭제 & 지도의 유지자가 없는경우 지도도 삭제
  if (maps.count <= 2 && remove == 'true') {
    let deleteQueue = [];
    for (let i = 0; i < maps.count; i++) {
      deleteQueue.push(maps[i]);
    }

    // 스토리와 로그도 삭제
    const storyLogs = await Data.query('SK')
      .using('GSI')
      .eq(mid)
      .exec();

    // 지도 삭제시 연결된 S3의 지도폴더도 삭제 필요
    deleteFolder(mid);

    for (let i = 0; i < storyLogs.count; i++) {
      deleteQueue.push(storyLogs[i]);
    }

    // 삭제를 기다린다.
    await Promise.all(deleteQueue.map(q => q.delete()));
  } else {
    let name = '새 지도';
    for (let i = 0; i < maps.count; i++) {
      if (maps[i].types == 'MAP') {
        name = maps[i].content.name;
      }
      if (maps[i].types == 'USER-MAP' && remove == 'false') {
        if (uid == maps[i].SK) {
          console.error('you already enrolled in this map');
          return createResponse(
            ctx,
            statusCode.failure,
            null,
            'you already enrolled in this map'
          );
        }
      }
    }
    console.log({ name });

    // 지도-유저 생성
    const userMapData = new DClass.UserMap({
      mid,
      name,
      uid,
    });
    const newUserMap = new Data(userMapData.json());

    // 사용자 삭제
    if (remove == 'true') {
      await newUserMap.delete();
    }
    //사용자 추가
    else {
      await newUserMap.save();
    }

    // 섬네일 제작
    for (const i in maps) {
      if (maps[i].types == 'MAP') {
        maps.splice(i, 1);
        break;
      }
    }
    await makeThumbnail(mid, maps);
  }

  // 로그
  Logger(ctx, mid);

  createResponse(ctx, statusCode.processingSuccess, null);
});

/* 지도 삭제 */
router.delete('/:id', async ctx => {
  // JWT에서 uid 가져오기
  const uid = getUid(ctx);

  // 파라미터 가져오기
  const mid = ctx.params.id;

  // mid에 해당하는 map의 count
  const maps = await Data.query('PK')
    .eq(mid)
    .filter('types')
    .in(['MAP', 'USER-MAP'])
    .exec();

  // DB에 mid에 해당하는 지도가 없음
  if (maps.count == 0) {
    console.error('this map is already deleted');
    return createResponse(
      ctx,
      statusCode.failure,
      null,
      'this map is already deleted'
    );
  }

  // 가져온 document에서 map만 뽑아낸다.
  let deleteQueue = [];
  let isOwner = false;
  for (let i = 0; i < maps.count; i++) {
    deleteQueue.push(maps[i]);

    // 삭제하려는 소유자가 지도에 소속되어있는지 확인
    if (maps[i].SK == uid) isOwner = true;
  }

  // 소유자가 아니면 삭제 불가
  if (!isOwner) {
    console.error('this map is not yours');
    return createResponse(
      ctx,
      statusCode.authorizationFailure,
      null,
      'this map is not yours'
    );
  }

  // 스토리와 로그도 삭제
  const storyLogs = await Data.query('SK')
    .using('GSI')
    .eq(mid)
    .exec();

  for (let i = 0; i < storyLogs.count; i++) {
    deleteQueue.push(storyLogs[i]);
  }

  // 삭제를 기다린다.
  await Promise.all(deleteQueue.map(q => q.delete()));

  // s3 폴더 삭제
  deleteFolder(mid);

  createResponse(ctx, statusCode.processingSuccess, null);
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
