// Canvas 설정
const { createCanvas, loadImage } = require('canvas');
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

// Dynamoose 설정
const Dynamoose = require('./dynamo_schema');
const Data = Dynamoose.Data;

// s3 가져오기
const { putObject } = require('./s3_util');

exports.makeThumbnail = async (mid, users) => {
  // 캔버스 지우기
  clearCanvas();
  console.log('[makeThumbnail]', { users });

  // 유저-지도에서 필요한 정보 추출
  let userModels = [];
  for (let i = 0; i < users.length; i++) {
    console.log(users[i]);
    userModels.push({
      PK: users[i].SK,
      SK: 'INFO',
    });
  }
  console.log('[makeThumbnail]', { userModels });

  // 각 유저의 정보를 다 가져오기
  const userData = await Data.batchGet(userModels);
  console.log('[makeThumbnail]', { userData });

  // 최대 4개의 이미지 로드하기
  let images = [];
  for (const i in userData) {
    if (i == 4) break;
    const thumbnail = userData[i].content.thumbnail;
    images.push(await loadImage(thumbnail));
  }
  console.log('[makeThumbnail]', { images });

  // 이미지 개수에 따라서 다른 이미지 생성
  // 1개
  if (images.length == 1) {
    drawRoundedImage(images[0], 5, 5, 190, 190, 70);
  }
  // 2개
  else if (images.length == 2) {
    drawRoundedImage(images[0], 5, 5, 120, 120, 60);
    drawRoundedImage(images[1], 75, 75, 120, 120, 60);
  }
  // 3개
  else if (images.length == 3) {
    drawRoundedImage(images[0], 50, 5, 105, 105, 50);
    drawRoundedImage(images[1], 5, 90, 105, 105, 50);
    drawRoundedImage(images[2], 90, 90, 105, 105, 50);
  }
  // 4개
  else {
    drawRoundedImage(images[0], 5, 5, 90, 90, 40);
    drawRoundedImage(images[1], 100, 5, 90, 90, 40);
    drawRoundedImage(images[2], 5, 100, 90, 90, 40);
    drawRoundedImage(images[3], 100, 100, 90, 90, 40);
  }

  // 이미지를 png로 저장
  await putObject(mid, canvas.toBuffer('image/png'));
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
