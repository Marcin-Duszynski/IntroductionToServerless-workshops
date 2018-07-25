const AWS = require('aws-sdk');
const util = require('util');

const documentClient = new AWS.DynamoDB.DocumentClient();
documentClient.scanAsync = util.promisify(documentClient.scan);

exports.handler = async (event, context, callback) => {
  try {
    const params = {
      TableName: process.env.STORE_DB_NAME,
      FilterExpression: 'contains (description, :testToSearch)',
      ExpressionAttributeValues: {
        ':testToSearch': event.query,
      }
    }

    const scanResult = await documentClient.scanAsync(params);

    callback(null, {
      hits: scanResult.Items,
      nbHits: scanResult.Count,
      query: event.query,
    });
  } catch (error) {
    console.error(error);

    callback(new Error('[500] Search function error'));
  }
}