// dotenv fetch
require('dotenv').config();

// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// Dynamoose 설정
const { Data } = require('./modules/dynamo_schema');

// DClass와 util 가져오기
const DClass = require('./modules/dynamo_class');
const { statusCode, isUndefined } = require('./modules/util');

// Request 가져오기
const { paths, kakaoRequest } = require('./modules/kakao');

/**
 * Route: /users
 * Method: get
 */

/* 유저 정보 가져오기 */
module.exports.handler = async (ctx, context) => {
  context.basePath = process.env.BASE_PATH;
  context.callbackWaitsForEmptyEventLoop = false;

  ctx.request = {
    header: {
      authorization: ctx.headers.Authorization,
      'user-agent': ctx.headers['User-Agent'],
    },
    url: ctx.path,
    method: ctx.httpMethod,
  };
  // 함수 호출위치 로그
  console.log(ctx.request.url, ctx.request.method);

  // 카카오톡 유저정보 가져오기
  const result = await kakaoRequest(ctx, paths.getInfo);

  // 파라미터 추출하기
  const uid = String(result.id);
  const nickname = result.kakao_account.profile.nickname;
  const thumbnail = result.kakao_account.profile.thumbnail_image_url;
  console.log('[Parameter]', { uid, nickname, thumbnail });

  // 초기값 설정
  let userData = new DClass.User({
    uid,
    nickname,
    thumbnail,
  });

  // uid에 해당하는 user의 count
  const user = await Data.queryOne('PK')
    .eq(uid)
    .where('SK')
    .eq('INFO')
    .filter('types')
    .eq('USER')
    .exec();

  // user가 존재하지 않으면 회원등록
  if (isUndefined(user)) {
    console.log('user is not exist and register');
    const newUser = new Data(userData.json());
    await newUser.save();
  }
  // user가 존재하면 회원정보 반환
  else {
    let userDB = DClass.parseClass(user);

    // nickname과 thumbnail중 하나라도 다르면
    if (!userData.equal(userDB)) {
      console.log('user data update');
      userDB.update(userData);
      await Data.update(userDB.json());
    }
  }

  const response = {
    data: userData,
    message: null,
  };
  return {
    statusCode: statusCode.success,
    body: JSON.stringify(response),
  };
};
