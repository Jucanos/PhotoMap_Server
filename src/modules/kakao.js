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

exports.kakaoRequest = async (ctx, path, form = {}) => {
  let options = null;

  // AdminKey가 필요한 경우인지 확인
  if (path[2]) options = this.getOptions(path, adminKey);
  else options = this.getOptions(path, getAuth(ctx));

  // Method가 GET이면 query 생성
  if (path[0] == 'GET') {
    let query = '?';
    const keys = Object.keys(form);
    for (let i = 0; i < keys.length; i++) {
      query += keys[i] + '=' + form[keys[i]];
      if (i != keys.length - 1) query += '&';
    }
    options.uri += query;
  }
  // 그 외의 Method의 경우 form으로 적용
  else options.form = form;
  console.log('[kakaoRequest]', { options });

  // 카카오 API 결과 받아오기
  const result = await request_promise(options);
  console.log('[kakaoRequest]', { result });

  return JSON.parse(result);
};
