// request 가져오기
const request = require('request');

// request async/await 가져오기
const request_promise = require('request-promise-native');

const Options = {
  uri: 'https://kapi.kakao.com/',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
  },
};

const getAuth = ctx => ctx.request.header.authorization;

const adminKey = `KakaoAK ${process.env.KAKAO_ADMIN_KEY}`;

exports.paths = Object.freeze({
  verify: ['GET', 'v1/user/access_token_info'],
  getInfo: ['GET', 'v2/user/me'],
  registerPushToken: ['POST', 'v1/push/register'],
});

exports.request = request;

exports.getDevice = ctx => {
  const user = ctx.request.header['user-agent'].toLowerCase();

  if (user.includes('postman')) {
    return null;
  }

  if (user.includes('okhttp')) {
    return 'gcm';
  }

  // TODO: IOS에 맞는 agent타입으로 변경해야함
  if (user.includes('ios')) {
    return 'apns';
  }
};

exports.getOptions = (path, auth) => {
  let options = Options;

  options.method = path[0];
  options.uri += path[1];
  options.headers.Authorization = auth;

  return options;
};

exports.kakaoRequest = async (ctx, path, form = {}, admin = false) => {
  let options = null;

  if (admin) options = this.getOptions(path, adminKey);
  else options = this.getOptions(path, getAuth(ctx));

  options.form = form;

  const result = await request_promise(options);

  return JSON.parse(result);
};
