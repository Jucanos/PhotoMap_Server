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
        rangeKey: 'PK',
        name: 'GSI',
        project: true,
      },
    },
    // identifier
    type: {
      type: String,
      required: true,
    },
    content: {
      type: Object,
      default: {},
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
