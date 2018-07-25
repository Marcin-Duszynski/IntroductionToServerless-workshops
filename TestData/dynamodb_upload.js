const fs = require('fs');
const AWS = require('aws-sdk');
AWS.config.update({region: 'eu-west-1'});
const dynamoDb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

console.log('Loading test data from testData.json file');
const testData = JSON.parse(fs.readFileSync('testData.json', 'utf8'));
const itemsToSend = [];

testData.forEach(item => {
  itemsToSend.push({
    PutRequest: {
      Item: {
        "objectID": { "S": item.objectID },
        "name": { "S": item.name },
        "description": { "S": item.description },
        "brand": { "S": item.brand },
        "categories": { "S": JSON.stringify(item.categories) },
        "image": { "S": item.image },
      }
    }
  })
});

const params = {
  RequestItems: {
    "ItemsStore-marcind2": itemsToSend // Change table name 
  }
};

console.log('Sending items to DynamoDB table');

dynamoDb.batchWriteItem(params, (err, data) => {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data);
  }
});