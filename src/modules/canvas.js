// Canvas 설정
const { createCanvas, loadImage } = require('canvas');
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

// Dynamoose 설정
const Dynamoose = require('./dynamo_schema');
const Data = Dynamoose.Data;

// DClass와 util 가져오기
const DClass = require('./dynamo_class');
const {
  statusCode,
  createResponse,
  isUndefined,
  representsDefault,
  getUid,
} = require('./util');

// s3 가져오기
const { putObject } = require('./s3_util');

exports.makeThumbnail = async (mid, users) => {
  clearCanvas();

  console.log(users);

  let userModels = [];
  for (let i = 0; i < users.length; i++) {
    console.log(users[i]);
    userModels.push({
      PK: users[i].SK,
      SK: 'INFO',
    });
  }
  console.log(userModels);

  const userData = await Data.batchGet(userModels);
  console.log(userData);

  let images = [];
  for (const i in userData) {
    const thumbnail = userData[i].content.thumbnail;
    images.push(await loadImage(thumbnail));
  }
  console.log(images);

  if (images.length == 1) {
    // 1개
    drawRoundedImage(images[0], 5, 5, 190, 190, 70);
  } else if (images.length == 2) {
    // 2개
    drawRoundedImage(images[0], 5, 5, 120, 120, 60);
    drawRoundedImage(images[1], 75, 75, 120, 120, 60);
  } else if (images.length == 3) {
    // 3개
    drawRoundedImage(images[0], 50, 5, 105, 105, 50);
    drawRoundedImage(images[1], 5, 90, 105, 105, 50);
    drawRoundedImage(images[2], 90, 90, 105, 105, 50);
  } else {
    // 40
    drawRoundedImage(images[0], 5, 5, 90, 90, 40);
    drawRoundedImage(images[1], 100, 5, 90, 90, 40);
    drawRoundedImage(images[2], 5, 100, 90, 90, 40);
    drawRoundedImage(images[3], 100, 100, 90, 90, 40);
  }
  putObject(mid, canvas.toBuffer('image/png'));
};

const clearCanvas = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
};

function drawRoundedImage(img, x, y, width, height, radius) {
  ctx.save();
  roundedImage(x, y, width, height, radius);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.clip();
  ctx.drawImage(img, x, y, width, height);
  ctx.restore();
}

function roundedImage(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
