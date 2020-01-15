// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

// Request 가져오기
const { paths, request, getOptions } = require('./modules/kakao');

// Policy helper function
const generatePolicy = (principalId, effect, resource) => {
  const authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument = {};
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statementOne = {};
    statementOne.Action = 'execute-api:Invoke';
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

// Reusable Authorizer function, set on `authorizer` field in serverless.yml
module.exports.verify = (event, context, callback) => {
  if (!event.authorizationToken) {
    return callback('Unauthorized');
  }
  const tokenParts = event.authorizationToken.split(' ');
  const tokenValue = tokenParts[1];

  if (!(tokenParts[0].toLowerCase() === 'bearer' && tokenValue)) {
    // no auth token!
    return callback('Unauthorized');
  }

  const options = getOptions(paths.verify, event.authorizationToken);

  try {
    request(options, (err, response, body) => {
      if (err) {
        console.log('verifyError', err);
        console.log(`Token invalid. ${err}`);
        return callback('Unauthorized');
      }
      const decoded = JSON.parse(body);
      console.log('valid from customAuthorizer', decoded);

      if (process.env.KAKAO_APP_ID != decoded.appId) {
        console.log('app is wrong', decoded.appId);
        return callback('Unauthorized');
      }

      return callback(
        null,
        generatePolicy(decoded.id, 'Allow', event.methodArn)
      );
    });
  } catch (err) {
    console.log('catch error. Invalid token', err);
    return callback('Unauthorized');
  }
};
