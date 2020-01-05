// dotenv fetch
require('dotenv').config();

// uuid 가져오기
const uuid4 = require('uuid4');

exports.isUndefined = obj => {
  if (typeof obj === 'undefined' && !obj) {
    return true;
  }
  return false;
};

exports.createResponse = (ctx, status, body, err = null) => {
  ctx.status = status;
  ctx.body = {
    message: err,
    data: body,
  };
};

exports.statusCode = Object.freeze({
  success: 200, // 성공 (서버에서 요청한 값 반환)
  secondSuccess: 201, // 성공 (서버에 새로운 값 작성)
  processingSuccess: 204, // 성공 (반환값이 없음)
  requestError: 400, // 실패 (서버에서 요청을 이해 못함)
  authenticationFailure: 401, // 권한필요
  authorizationFailure: 403, // 접근불가
  failure: 404, // 실패 (서버에서 요청한 값을 찾을 수 없음)
  serverError: 500, // 서버 내부에서 에러 발생
  dataBaseError: 600, // DB에서 에러 발생
});

exports.uuid = () => {
  const tokens = uuid4().split('-');
  return tokens[2] + tokens[1] + tokens[0] + tokens[3] + tokens[4];
};

exports.getUid = ctx => ctx.req.requestContext.authorizer.principalId;
