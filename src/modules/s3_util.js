// AWS xray 연결
const awsXRay = require('aws-xray-sdk');
const awsSdk = awsXRay.captureAWS(require('aws-sdk'));

const s3 = new awsSdk.S3();

// multer 가져오기
const multer = require('@koa/multer');
const multerS3 = require('multer-s3');
const fs = require('fs'); // 설치 x
const path = require('path'); // 설치 x

// 업로드 모듈
exports.upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    acl: 'public-read',
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      cb(
        null,
        'uploads/' +
          req.url.split('/')[2] +
          '/' +
          Date.now().toString() +
          file.originalname
      );
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

exports.putObject = async (ctx, tag) => {
  const mid = ctx.req.url.split('/')[2];
  const file = ctx.request.files[tag];
  const now = Date.now().toString();
  const buffer = Buffer.from(file.path, 'base64');

  const params = {
    Body: buffer,
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `uploads/${mid}/${now}${file.name}`,
    Tagging: 'fieldName=image',
  };
  await s3.putObject(params).promise();
};

// 단일 객체 삭제
exports.deleteObject = async obj => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: obj.split(process.env.S3_CUSTOM_DOMAIN)[1],
  };

  await s3.deleteObject(params).promise();
};

// 폴더 삭제
exports.deleteFolder = async prefix => {
  let listParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: `uploads/${prefix}/`,
  };
  const data = await s3.listObjectsV2(listParams).promise();

  let deleteParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Delete: { Objects: data.Contents.map(a => ({ Key: a.Key })) },
  };
  await s3.deleteObjects(deleteParams).promise();
};
