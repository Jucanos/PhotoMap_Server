// request 가져오기
const request = require('request');

// request async/await 가져오기
const request_promise = require('request-promise-native');

const getAuth = ctx => ctx.request.header.authorization;

const adminKey = `KakaoAK ${process.env.KAKAO_ADMIN_KEY}`;

/**
 * [0]: Method 종류
 * [1]: URL
 * [2]: AdminKey 사용 여부
 */
exports.paths = Object.freeze({
  verify: ['GET', '/v1/user/access_token_info', false],
  getInfo: ['GET', '/v2/user/me', false],
  registerPushToken: ['POST', '/v1/push/register', true],
  deregisterPushToken: ['POST', '/v1/push/deregister', true],
  searchPushToken: ['GET', '/v1/push/tokens', true],
});

exports.request = request;

exports.getOptions = (path, auth) => ({
  uri: 'https://kapi.kakao.com' + path[1],
  method: path[0],
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    Authorization: auth,
  },
});

exports.getDeviceType = ctx => {
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

exports.kakaoRequest = async (ctx, path, form = {}) => {
  let options = null;

  if (path[2]) options = this.getOptions(path, adminKey);
  else options = this.getOptions(path, getAuth(ctx));

  if (path[0] == 'GET') {
    let query = '?';
    const keys = Object.keys(form);
    for (let i = 0; i < keys.length; i++) {
      query += keys[i] + '=' + form[keys[i]];
      if (i != keys.length - 1) query += '&';
    }
    options.uri += query;
  } else options.form = form;
  console.log(options);

  const result = await request_promise(options);
  console.log(result);

  return JSON.parse(result);
};
