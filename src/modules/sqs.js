// dotenv fetch
require('dotenv').config();

const aws = require('aws-sdk');
const sqs = new aws.SQS();

exports.makeThumbnail = async (mid, users = null) => {
  const params = {
    QueueUrl: process.env.QUEUE_URL,
    MessageGroupId: mid,
    MessageBody: JSON.stringify({ mid, users }),
  };

  console.log('[SQS makeThumbnail]', params);
  await sqs.sendMessage(params).promise();
};
