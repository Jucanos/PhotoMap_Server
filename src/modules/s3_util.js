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
      let folder = '/';
      if (req.url.split('/')[1] == 'maps') {
        folder = '/represents/';
      }

      cb(
        null,
        'uploads/' +
          process.env.STAGE +
          '/' +
          req.url.split('/')[2] +
          folder +
          req.body.cityKey +
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

exports.putObject = async (mid, buffer) => {
  const params = {
    Body: buffer,
    Bucket: process.env.S3_BUCKET_NAME,
    ACL: 'public-read',
    Key: `uploads/${process.env.STAGE}/${mid}/main.png`,
    Tagging: 'fieldName=image',
    CacheControl: 'max-age=0',
  };
  await s3.putObject(params).promise();
};

// 단일 객체 삭제
exports.deleteObject = async obj => {
  let params = {
    Bucket: process.env.S3_BUCKET_NAME,
  };

  if (obj.includes(process.env.S3_CUSTOM_DOMAIN))
    params.Key = obj.split(process.env.S3_CUSTOM_DOMAIN)[1];
  else params.Key = obj;

  await s3.deleteObject(params).promise();
};

// 여러 객체 삭제
exports.deleteArray = async objArray => {
  let deleteParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Delete: {
      Objects: objArray.map(obj => ({
        Key: obj.key.includes(process.env.S3_CUSTOM_DOMAIN)
          ? obj.key.split(process.env.S3_CUSTOM_DOMAIN)[1]
          : obj.key,
      })),
    },
  };

  await s3.deleteObjects(deleteParams).promise();
};

// 폴더 삭제
exports.deleteFolder = async prefix => {
  let listParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: `uploads/${process.env.STAGE}/${prefix}/`,
  };
  const data = await s3.listObjectsV2(listParams).promise();

  if (data.KeyCount == 0) return;

  let deleteParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Delete: { Objects: data.Contents.map(a => ({ Key: a.Key })) },
  };
  await s3.deleteObjects(deleteParams).promise();
};
