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
  // 파라미터 가져오기
  const uid = ctx.params.id;
  const nickname = ctx.query.nickname || '닉네임';
  const thumbnail =
    ctx.query.thumbnail ||
    `${process.env.CLOUDFRONT_S3_PHOTOMAP}/default_user.png`;

  // 초기값 설정
  let userData = new DClass.User({
    uid,
    nickname,
    thumbnail,
  });

  // uid에 해당하는 user의 count
  const user = await Data.queryOne('PK')
    .eq(uid)
    .exec();

  // user가 존재하지 않으면 회원등록
  if (isUndefined(user)) {
    const newUser = new Data(userData.json());
    await newUser.save();
  }
  // user가 존재하면 회원정보 반환
  else {
    let userDB = DClass.parseClass(user);

    // nickname과 thumbnail중 하나라도 다르면
    if (!userData.equal(userDB)) {
      userDB.update(userData);
      await Data.update(userDB.json());
    }
  }

  // JWT 반환
  const payload = {
    uid: userData.uid,
  };

  await new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION_TIME },
      (err, token) => {
        if (err) {
          reject(createResponse(ctx, statusCode.serverError, null, err));
        } else {
          resolve(createResponse(ctx, statusCode.success, { token }));
        }
      }
    );
  });
});

// Lambda로 내보내기
module.exports.handler = serverless(app, {
  basePath: process.env.BASE_PATH,
  callbackWaitsForEmptyEventLoop: false,
});
