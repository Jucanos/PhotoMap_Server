// request 가져오기
const request = require('request');

// request async/await 가져오기
const request_promise = require('request-promise-native');

const Options = {
  uri: 'https://kapi.kakao.com/',
  method: 'GET',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
  },
};

const getAuth = ctx => ctx.request.header.authorization;

exports.paths = Object.freeze({
  verify: 'v1/user/access_token_info',
  getInfo: 'v2/user/me',
});

exports.request = request;

exports.getOptions = (path, auth) => {
  let options = Options;

  options.uri += path;
  options.headers.Authorization = auth;

  return options;
};

exports.kakaoRequest = async (ctx, path) => {
  const options = this.getOptions(path, getAuth(ctx));

  const result = await request_promise(options);

  return JSON.parse(result);
};
