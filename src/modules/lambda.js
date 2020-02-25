const aws = require('aws-sdk');
const lambda = new aws.Lambda({
  region: 'ap-northeast-2', //change to your region
});

exports.makeThumbnail = async (mid, users) => {
  const result = await lambda
    .invoke({
      FunctionName: `photomap-server-${process.env.STAGE}-DrawThumbnail`,
      Payload: JSON.stringify({ mid, users }, null, 2), // pass params
    })
    .promise();
  console.log('[Capture Result]', result);
};

exports.capture = async (mid, represents) => {
  const result = await lambda
    .invoke({
      FunctionName: `photomap-server-${process.env.STAGE}-DrawMapImage`,
      Payload: JSON.stringify({ mid, represents }, null, 2), // pass params
    })
    .promise();
  console.log('[Capture Result]', result);
  const resultPayload = JSON.parse(result.Payload);
  return resultPayload.body;
};
