// Dynamoose 설정
const dynamoose = require('dynamoose');
const Schema = dynamoose.Schema;

dynamoose.AWS.config.update({
  region: process.env.DYNAMODB_REGION,
});
if (process.env.IS_OFFLINE) dynamoose.local();

// Data Schema
const DataSchema = new Schema(
  {
    // id (GSI SK)
    PK: {
      type: String,
      hashKey: true,
    },
    // sort key (GSI PK)
    SK: {
      type: String,
      rangeKey: true,
      default: 'INFO',
      index: {
        global: true,
        rangeKey: 'types',
        name: 'GSI',
        project: true,
      },
    },
    // identifier
    types: {
      type: String,
      required: true,
    },
    // views
    views: {
      type: Number,
    },
    // custom Object
    content: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Notice Schema
const NoticeSchema = new Schema(
  {
    // 번호
    id: {
      type: String,
      hashKey: true,
    },
    // 제목
    title: {
      type: String,
      required: true,
    },
    // 내용
    context: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

exports.tableName = process.env.DYNAMODB_TABLE;

exports.Data = dynamoose.model(this.tableName, DataSchema, {
  update: true,
  tableName: this.tableName,
});

exports.Notice = dynamoose.model(process.env.DYNAMODB_NOTICE, NoticeSchema, {
  update: true,
  tableName: process.env.DYNAMODB_NOTICE,
});

exports.updateTimestamp = async mid => {
  const userMaps = await this.Data.query('PK')
    .eq(mid)
    .filter('types')
    .eq('USER-MAP')
    .exec();

  for (const userMap of userMaps) {
    await this.Data.update({ PK: userMap.PK, SK: userMap.SK });
  }
};
