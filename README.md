# Serverless web application architecture
During the workshops, we will build fully serverless web application powered by AWS.
The application will allow searching a product based on query typed in the browser. The search will be powered by a 3rd party service called Algolia. To secure our data we will use AWS Cognito as an identity provider.

Final application architecture:
![App architecture](https://raw.githubusercontent.com/Marcin-Duszynski/IntroductionToServerless-workshops/master/doc/img/ServerlessAppArchitecture.png "Final application architecture")

# Preconditions
- Plase install [Visual Studio Code](https://code.visualstudio.com/ "Visual Studio Code") or other code editor of your choice.
- Install node.js (v8.10+) https://nodejs.org/en/
- Install AWS CLI https://aws.amazon.com/cli/
- Install The Serverless Framework (npm install -g serverless)
- Install Git (https://git-scm.com/downloads)

# Step 0 - Init

Login to [the AWS Console](https://signin.aws.amazon.com/oauth?redirect_uri=https%3A%2F%2Fconsole.aws.amazon.com%2Fconsole%2Fhome%3Fstate%3DhashArgs%2523%26isauthcode%3Dtrue&client_id=arn%3Aaws%3Aiam%3A%3A015428540659%3Auser%2Fhomepage&response_type=code&iam_user=true&account=kainos-gov-rd "the AWS Console") and type provided user name and password.

1. Go to **IAM**
2. Open your **username**
3. Select security credentials
4. Create **access key** (don't close it)


Configure AWS CLI
```
$ aws configure
```
example configuration:
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: eu-west-1
Default output format [None]: json
```

Befor starting please clone Git repository:
```bash
git clone https://github.com/Marcin-Duszynski/IntroductionToServerless-workshops
```

Open .zshrc (or other *rc file) and add environment variables:
```
# Serverless introduction workshops
export ALGOLIA_APP_ID=temporarilyBlank
export ALGOLIA_API_KEY_INDEX=temporarilyBlank
export ALGOLIA_API_KEY_SEARCH=temporarilyBlank
# end
```

# Step 1 - Simple search
## Our first task is to deploy web application to the S3.

Switch to the branch **step1-webApp**
```bash
git checkout step1-webApp
```

Go to folder **WebApp**

Install dependencies
```
npm install
```

Start locally
```bash
npm start
```

Open page
```
http://localhost:4444/search
```

Open file from the repository
```
globalSettings.yml
```
and change stage
```
stage: marcind2
region: eu-west-1
```

Build web application distribution
```
npm run build
```

and push it to the cloud
```
serverless deploy
```
Deployment script is using serverless-s3-sync plugin to push our site to the S3
https://www.npmjs.com/package/serverless-s3-sync

## CloudFront
Create new folder **Infrastructure**
and serverless.yml file inside

Paste the code
```yaml
service: infrastructureServerlessService

provider:
  name: aws
  runtime: nodejs8.10
  stage: ${file(../globalSettings.yml):stage}
  region: ${file(../globalSettings.yml):region}

resources:
  Resources:

    CloudFrontOriginAccessIdentity:
      Type: 'AWS::CloudFront::CloudFrontOriginAccessIdentity'
      Properties:
        CloudFrontOriginAccessIdentityConfig:
          Comment: serverlessintro-${self:provider.stage}

    WebAppCloudFrontDistribution:
      Type: AWS::CloudFront::Distribution
      Properties:
        DistributionConfig:
          Origins:
            - DomainName: kainosserverlessintro-${self:provider.stage}.s3.amazonaws.com
              Id: WebApp
              S3OriginConfig: {}
          Enabled: 'true'
          DefaultRootObject: index.html
          CustomErrorResponses:
            - ErrorCode: 404
              ResponseCode: 200
              ResponsePagePath: /index.html
          DefaultCacheBehavior:
            DefaultTTL: 2
            MaxTTL: 6
            MinTTL: 0
            AllowedMethods:
              - DELETE
              - GET
              - HEAD
              - OPTIONS
              - PATCH
              - POST
              - PUT
            ## The origin id defined above
            TargetOriginId: WebApp
            ## Defining if and how the QueryString and Cookies are forwarded to the origin which in this case is S3
            ForwardedValues:
              QueryString: 'false'
              Cookies:
                Forward: none
            ViewerProtocolPolicy: redirect-to-https
          ViewerCertificate:
            CloudFrontDefaultCertificate: 'true'
          ## Uncomment the following section in case you want to enable logging for CloudFront requests
          # Logging:
          #   IncludeCookies: 'false'
          #   Bucket: mylogs.s3.amazonaws.com
          #   Prefix: myprefix

```

This will take few minutes.
When it finish go to the AWS Console and open CloudFront service page.

We need to pass created cloud front distribution name to the app globalSettings.yml
```yaml
cloudFrontDisc: https://example123.cloudfront.net
```

## Search backend
Create folder **SearchService**
then file package.json and paste:
```yaml
{
  "name": "serverlessIntroductionBackend",
  "version": "0.0.0",
  "scripts": {
    "apply": "npx serverless deploy",
    "destroy": "npx serverless remove"
  },
  "private": true,
  "dependencies": {},
  "devDependencies": {
    "serverless-dynamodb-autoscaling": "^0.6.2",
    "serverless-iam-roles-per-function": "^1.0.1",
    "serverless-aws-documentation": "^1.1.0",
    "serverless-reqvalidator-plugin": "^1.0.2",
    "aws-sdk": "^2.276.1"
  }
}
```

### Create AWS Lambda function
Add file searchDynamoDb.js and paste:
```javascript
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
```

### Function deployment
Create file serverless.yml and paste
```yaml
service: searchServerlessService

provider:
  name: aws
  runtime: nodejs8.10
  stage: ${file(../globalSettings.yml):stage}
  region: ${file(../globalSettings.yml):region}

plugins:
  - serverless-iam-roles-per-function
  - serverless-dynamodb-autoscaling
  - serverless-aws-documentation
  - serverless-reqvalidator-plugin

functions:

  search:
    name: search-${self:provider.stage}
    handler: searchDynamoDb.handler
    memorySize: 256
    environment:
      STORE_DB_NAME: ${self:resources.Resources.ItemsStore.Properties.TableName}
    iamRoleStatements:
      - Effect: Allow
        Action:
          - dynamodb:GetItem
          - dynamodb:Scan
        Resource: arn:aws:dynamodb:*:*:table/${self:resources.Resources.ItemsStore.Properties.TableName}
    tags:
      owner: ${self:provider.stage}
    events:
      - http:
          path: /search/{query}
          method: get
          cors: 
            origins:
              - '${file(../globalSettings.yml):cloudFrontDisc}'
          integration: lambda
          reqValidatorName: searchrRequestValidator
          request:
            parameters:
              paths:
                query: true
            passThrough: NEVER
            template:
              application/json: '{ "query" : "$input.params(''query'')" }'

resources:  
  Resources:

    searchrRequestValidator:
      Type: "AWS::ApiGateway::RequestValidator"
      Properties:
        Name: 'searchrRequestValidator'
        RestApiId:
          Ref: ApiGatewayRestApi
        ValidateRequestBody: true
        ValidateRequestParameters: true

    SearchLogGroup:
      Type: AWS::Logs::LogGroup
      Properties:
        RetentionInDays: "7"

    ItemsStore:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ItemsStore-${self:provider.stage}
        AttributeDefinitions:
          - AttributeName: objectID
            AttributeType: S
        KeySchema:
          - AttributeName: objectID
            KeyType: HASH
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1

custom:
  capacities:
    - table: ItemsStore
      read:
        minimum: 1
        maximum: 20
        usage: 0.75
      write:
        minimum: 1
        maximum: 5
        usage: 0.75

```

### Deploy search function

```bash
sls deploy
```

### Update web application
Take generated search api url and paste it to the web app.
Open file WebApp/src/app/appConfig.json and change searchUrl to yours
```javascript
{
  "searchUrl": "https://dg12ptanhd.execute-api.eu-west-1.amazonaws.com/marcind2/search",
  "loginUrl": "https://example.com"
}
```

Now update search service client **/WebApp/src/app/shared/search.service.ts**
```javascript
import { ActivatedRoute } from '@angular/router';
import { Injectable } from "@angular/core";
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SearchResult } from './model/searchResult';

declare var require: any;
const appConfig = require('./../appConfig.json');
const searchUrl = appConfig.searchUrl;

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  public search (query: string): Observable<SearchResult> {
    console.log("Search started");

    if (!query.trim()) {
      return of(new SearchResult());
    }

    return this.http.get<SearchResult>(`${searchUrl}/${query}`).pipe(
      tap(items => console.debug(items)),
      catchError(this.handleError<SearchResult>('search', new SearchResult()))
    )
  }

  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => { 
      console.error(error);

      return of(result as T);
    };
  }
}
```

Now deploy it
```bash
cd WebApp
npm run build
sls deploy
```
### Adding test data
Create folder TestData
To the package.json file paste:
```yaml
{
  "name": "serverlessIntroductionTestData",
  "version": "0.0.0",
  "scripts": {
    "deploy": "node dynamodb_upload.js"
  },
  "private": true,
  "dependencies": {
    "aws-sdk": "^2.275.1"
  },
  "devDependencies": {}
}

```

Create file dynamodb_upload.js and paste:
```yaml
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
```

Change dynamoDB table name to yours:
```javascript
const params = {
  RequestItems: {
    "ItemsStore-marcind2": itemsToSend // Change table name 
  }
};
```

Add test data set. Create file testData.json and paste:
```yaml
[
  {
     "name":"Amazon - Fire TV Stick with Alexa Voice Remote - Black",
     "description":"Enjoy smart access to videos, games and apps with this Amazon Fire TV stick. Its Alexa voice remote lets you deliver hands-free commands when you want to watch television or engage with other applications. With a quad-core processor, 1GB internal memory and 8GB of storage, this portable Amazon Fire TV stick works fast for buffer-free streaming.",
     "brand":"Amazon",
     "categories":[
        "TV & Home Theater",
        "Streaming Media Players"
     ],
     "hierarchicalCategories":{
        "lvl0":"TV & Home Theater",
        "lvl1":"TV & Home Theater > Streaming Media Players"
     },
     "type":"Streaming media plyr",
     "price":39.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5477500_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5477500/pdp",
     "free_shipping":false,
     "rating":4,
     "popularity":21469,
     "objectID":"5477500",
     "_highlightResult":{
        "name":{
           "value":"Amazon - Fire TV Stick with Alexa Voice Remote - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Enjoy smart access to videos, games and apps with this Amazon Fire TV stick. Its Alexa voice remote lets you deliver hands-free commands when you want to watch television or engage with other applications. With a quad-core processor, 1GB internal memory and 8GB of storage, this portable Amazon Fire TV stick works fast for buffer-free streaming.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Amazon",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"TV & Home Theater",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Streaming Media Players",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Streaming media plyr",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Google - Chromecast - Black",
     "description":"Google Chromecast: Enjoy a world of entertainment with Google Chromecast. Just connect to your HDTV's HDMI interface and your home Wi-Fi network to get started. You can stream your favorite apps from your compatible phone, tablet or laptop, plus use your phone as a remote to search, play and pause content.",
     "brand":"Google",
     "categories":[
        "TV & Home Theater",
        "Streaming Media Players"
     ],
     "hierarchicalCategories":{
        "lvl0":"TV & Home Theater",
        "lvl1":"TV & Home Theater > Streaming Media Players"
     },
     "type":"Streaming media plyr",
     "price":35,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/4397400_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/4397400/pdp",
     "free_shipping":false,
     "rating":4,
     "popularity":21468,
     "objectID":"4397400",
     "_highlightResult":{
        "name":{
           "value":"Google - Chromecast - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Google Chromecast: Enjoy a world of entertainment with Google Chromecast. Just connect to your HDTV's HDMI interface and your home Wi-Fi network to get started. You can stream your favorite apps from your compatible phone, tablet or laptop, plus use your phone as a remote to search, play and pause content.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Google",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"TV & Home Theater",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Streaming Media Players",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Streaming media plyr",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Dell - Inspiron 15.6\" Touch-Screen Laptop - Intel Core i5 - 6GB Memory - 1TB Hard Drive - Black",
     "description":"Dell Inspiron Laptop: Get speed and performance from this 15.6-inch Dell Inspiron laptop. Supported by an Intel Core i5-5200U processor and 6GB of DDR3L RAM, this slim touch screen laptop lets you run multiple applications without lag. The 1TB hard drive in this Dell Inspiron laptop lets you store multiple music, video and document files.",
     "brand":"Dell",
     "categories":[
        "Computers & Tablets",
        "Laptops"
     ],
     "hierarchicalCategories":{
        "lvl0":"Computers & Tablets",
        "lvl1":"Computers & Tablets > Laptops"
     },
     "type":"Burst skus",
     "price":499.99,
     "price_range":"200 - 500",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5588602_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5588602/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21467,
     "objectID":"5588602",
     "_highlightResult":{
        "name":{
           "value":"Dell - Inspiron 15.6\" Touch-Screen Laptop - Intel Core i5 - 6GB Memory - 1TB Hard Drive - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Dell Inspiron Laptop: Get speed and performance from this 15.6-inch Dell Inspiron laptop. Supported by an Intel Core i5-5200U processor and 6GB of DDR3L RAM, this slim touch screen laptop lets you run multiple applications without lag. The 1TB hard drive in this Dell Inspiron laptop lets you store multiple music, video and document files.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Dell",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Computers & Tablets",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Laptops",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Burst skus",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Amazon - Echo Dot",
     "description":"Deliver your favorite playlist anywhere in your home with the Amazon Echo Dot voice-controlled device. Control most electric devices through voice activation, or schedule a ride with Uber and order a pizza. The Amazon Echo Dot voice-controlled device turns any home into a smart home with the Alexa app on a smartphone or tablet.",
     "brand":"Amazon",
     "categories":[
        "Smart Home"
     ],
     "hierarchicalCategories":{
        "lvl0":"Smart Home"
     },
     "type":"Voice assistants",
     "price":49.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5578851_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5578851/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21466,
     "objectID":"5578851",
     "_highlightResult":{
        "name":{
           "value":"Amazon - Echo Dot",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Deliver your favorite playlist anywhere in your home with the Amazon Echo Dot voice-controlled device. Control most electric devices through voice activation, or schedule a ride with Uber and order a pizza. The Amazon Echo Dot voice-controlled device turns any home into a smart home with the Alexa app on a smartphone or tablet.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Amazon",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Smart Home",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Voice assistants",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Apple - MacBook Air® (Latest Model) - 13.3\" Display - Intel Core i5 - 8GB Memory - 128GB Flash Storage - Silver",
     "description":"MacBook Air features up to 8GB of memory, a fifth-generation Intel Core processor, Thunderbolt 2, great built-in apps, and all-day battery life.1 Its thin, light, and durable enough to take everywhere you go-and powerful enough to do everything once you get there, better.",
     "brand":"Apple",
     "categories":[
        "Computers & Tablets",
        "Laptops",
        "All Laptops",
        "MacBooks"
     ],
     "hierarchicalCategories":{
        "lvl0":"Computers & Tablets",
        "lvl1":"Computers & Tablets > Laptops",
        "lvl2":"Computers & Tablets > Laptops > All Laptops",
        "lvl3":"Computers & Tablets > Laptops > All Laptops > MacBooks"
     },
     "type":"Apple",
     "price":999.99,
     "price_range":"500 - 2000",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/6443034_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/6443034/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21465,
     "objectID":"6443034",
     "_highlightResult":{
        "name":{
           "value":"Apple - MacBook Air® (Latest Model) - 13.3\" Display - Intel Core i5 - 8GB Memory - 128GB Flash Storage - Silver",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"MacBook Air features up to 8GB of memory, a fifth-generation Intel Core processor, Thunderbolt 2, great built-in apps, and all-day battery life.1 Its thin, light, and durable enough to take everywhere you go-and powerful enough to do everything once you get there, better.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Apple",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Computers & Tablets",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Laptops",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"All Laptops",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"MacBooks",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Apple",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Sharp - 50\" Class (49.5\" Diag.) - LED - 1080p - Smart - HDTV Roku TV - Black",
     "description":"Only at Best Buy  Sharp LC-50LB481U LED Roku TV: Get a TV that enjoys full Internet connectivity with this Sharp 49.5-inch smart TV. Full HD resolutions give you plenty of detail whether you're streaming content from the Internet using the integrated Roku player or watching via cable. Plenty of contrast and high-quality sound mean this Sharp 49.5-in smart TV delivers outstanding video.",
     "brand":"Sharp",
     "categories":[
        "TV & Home Theater",
        "TVs",
        "All Flat-Panel TVs"
     ],
     "hierarchicalCategories":{
        "lvl0":"TV & Home Theater",
        "lvl1":"TV & Home Theater > TVs",
        "lvl2":"TV & Home Theater > TVs > All Flat-Panel TVs"
     },
     "type":"45\"-50\"  tv's",
     "price":429.99,
     "price_range":"200 - 500",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/4863102_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/4863102/pdp",
     "free_shipping":false,
     "rating":4,
     "popularity":21464,
     "objectID":"4863102",
     "_highlightResult":{
        "name":{
           "value":"Sharp - 50\" Class (49.5\" Diag.) - LED - 1080p - Smart - HDTV Roku TV - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Only at Best Buy  Sharp LC-50LB481U LED Roku TV: Get a TV that enjoys full Internet connectivity with this Sharp 49.5-inch smart TV. Full HD resolutions give you plenty of detail whether you're streaming content from the Internet using the integrated Roku player or watching via cable. Plenty of contrast and high-quality sound mean this Sharp 49.5-in smart TV delivers outstanding video.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Sharp",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"TV & Home Theater",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"TVs",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"All Flat-Panel TVs",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"45\"-50\"  tv's",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Google - Google Home - White/Slate fabric",
     "description":"Simplify your everyday life with the Google Home, a voice-activated speaker powered by the Google Assistant. Use voice commands to enjoy music, get answers from Google and manage everyday tasks. Google Home is compatible with Android and iOS operating systems, and can control compatible smart devices such as Chromecast or Nest.",
     "brand":"Google",
     "categories":[
        "Smart Home"
     ],
     "hierarchicalCategories":{
        "lvl0":"Smart Home"
     },
     "type":"Voice assistants",
     "price":129,
     "price_range":"100 - 200",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5578849_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5578849/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21463,
     "objectID":"5578849",
     "_highlightResult":{
        "name":{
           "value":"Google - Google Home - White/Slate fabric",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Simplify your everyday life with the Google Home, a voice-activated speaker powered by the Google Assistant. Use voice commands to enjoy music, get answers from Google and manage everyday tasks. Google Home is compatible with Android and iOS operating systems, and can control compatible smart devices such as Chromecast or Nest.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Google",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Smart Home",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Voice assistants",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Apple - EarPods™ with Remote and Mic - White",
     "description":"Control media playback, adjust the volume and answer and end calls on your Apple&#174; iPod&#174;, iPhone&#174; or iPad&#174; with these Apple EarPods&#8482; MD827LL/A, which feature an in-line remote and mic for ease of use.",
     "brand":"Apple",
     "categories":[
        "Audio",
        "Headphones",
        "All Headphones"
     ],
     "hierarchicalCategories":{
        "lvl0":"Audio",
        "lvl1":"Audio > Headphones",
        "lvl2":"Audio > Headphones > All Headphones"
     },
     "type":"Earbud headphones",
     "price":29.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/6848136_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/6848136/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21462,
     "objectID":"6848136",
     "_highlightResult":{
        "name":{
           "value":"Apple - EarPods™ with Remote and Mic - White",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Control media playback, adjust the volume and answer and end calls on your Apple® iPod®, iPhone® or iPad® with these Apple EarPods™ MD827LL/A, which feature an in-line remote and mic for ease of use.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Apple",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Audio",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Headphones",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"All Headphones",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Earbud headphones",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Philips - hue A19 Smart LED Light Bulb - White Only",
     "description":"Philips hue A19 Smart LED Light Bulb: Get lighting that's as smart as you are. You can easily dim this light bulb and set timers and alarms using your smartphone or tablet. Plus, LED technology offers lasting illumination while using minimal energy.",
     "brand":"Philips",
     "categories":[
        "Smart Home",
        "Smart Lighting",
        "Smart Light Bulbs"
     ],
     "hierarchicalCategories":{
        "lvl0":"Smart Home",
        "lvl1":"Smart Home > Smart Lighting",
        "lvl2":"Smart Home > Smart Lighting > Smart Light Bulbs"
     },
     "type":"Smart lighting",
     "price":14.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/4374300_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/4374300/pdp",
     "free_shipping":false,
     "rating":4,
     "popularity":21461,
     "objectID":"4374300",
     "_highlightResult":{
        "name":{
           "value":"Philips - hue A19 Smart LED Light Bulb - White Only",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Philips hue A19 Smart LED Light Bulb: Get lighting that's as smart as you are. You can easily dim this light bulb and set timers and alarms using your smartphone or tablet. Plus, LED technology offers lasting illumination while using minimal energy.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Philips",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Smart Home",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Smart Lighting",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Smart Light Bulbs",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Smart lighting",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Zelda)",
     "description":"Zelda appears here carrying a Sheikah Slate, an important item in the Legend Zelda&#8482;: Breath of the Wild game. While her fate remains shrouded in mystery, the princess is at the core of Link's adventure in Hyrule.",
     "brand":"Nintendo",
     "categories":[
        "Video Games",
        "Toys to Life",
        "Amiibo"
     ],
     "hierarchicalCategories":{
        "lvl0":"Video Games",
        "lvl1":"Video Games > Toys to Life",
        "lvl2":"Video Games > Toys to Life > Amiibo"
     },
     "type":"Toy 2 life character",
     "price":15.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5723538_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5723538/pdp",
     "free_shipping":false,
     "rating":0,
     "popularity":21460,
     "objectID":"5723538",
     "_highlightResult":{
        "name":{
           "value":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Zelda)",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Zelda appears here carrying a Sheikah Slate, an important item in the Legend Zelda™: Breath of the Wild game. While her fate remains shrouded in mystery, the princess is at the core of Link's adventure in Hyrule.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Nintendo",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Video Games",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Toys to Life",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Amiibo",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Toy 2 life character",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Link (Archer))",
     "description":"Link&#8482; is the main character in The Legend of Zelda&#8482; games. A young boy living in Hyrule, Link is often given the task of rescuing Princess Zelda&#8482; and Hyrule from the Gerudo thief Ganondorf. Humble to the end, Link is known not merely as a hero but as a symbol of courage, strength and wisdom as well.",
     "brand":"Nintendo",
     "categories":[
        "Video Games",
        "Toys to Life",
        "Amiibo"
     ],
     "hierarchicalCategories":{
        "lvl0":"Video Games",
        "lvl1":"Video Games > Toys to Life",
        "lvl2":"Video Games > Toys to Life > Amiibo"
     },
     "type":"Toy 2 life character",
     "price":15.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5723537_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5723537/pdp",
     "free_shipping":false,
     "rating":0,
     "popularity":21459,
     "objectID":"5723537",
     "_highlightResult":{
        "name":{
           "value":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Link (Archer))",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Link™ is the main character in The Legend of Zelda™ games. A young boy living in Hyrule, Link is often given the task of rescuing Princess Zelda™ and Hyrule from the Gerudo thief Ganondorf. Humble to the end, Link is known not merely as a hero but as a symbol of courage, strength and wisdom as well.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Nintendo",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Video Games",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Toys to Life",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Amiibo",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Toy 2 life character",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Roku - Express Streaming Media Player - Black",
     "description":"Watch your favorite programs with this Roku Express streaming player. The wireless capability lets you connect to your home network to stream movies and television shows without the need for expensive cable subscriptions, while the included remote lets you control the device from anywhere within range. This Roku Express streaming player turns every TV into a smart TV.",
     "brand":"Roku",
     "categories":[
        "TV & Home Theater",
        "Streaming Media Players"
     ],
     "hierarchicalCategories":{
        "lvl0":"TV & Home Theater",
        "lvl1":"TV & Home Theater > Streaming Media Players"
     },
     "type":"Streaming media plyr",
     "price":29.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5513500_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5513500/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21458,
     "objectID":"5513500",
     "_highlightResult":{
        "name":{
           "value":"Roku - Express Streaming Media Player - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Watch your favorite programs with this Roku Express streaming player. The wireless capability lets you connect to your home network to stream movies and television shows without the need for expensive cable subscriptions, while the included remote lets you control the device from anywhere within range. This Roku Express streaming player turns every TV into a smart TV.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Roku",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"TV & Home Theater",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Streaming Media Players",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Streaming media plyr",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Link (Rider))",
     "description":"Link&#8482; is the main character in The Legend of Zelda&#8482; games. A young boy living in Hyrule, Link is often given the task of rescuing Princess Zelda&#8482; and Hyrule from the Gerudo thief Ganondorf. Humble to the end, Link is known not merely as a hero but as a symbol of courage, strength and wisdom as well.",
     "brand":"Nintendo",
     "categories":[
        "Video Games",
        "Toys to Life",
        "Amiibo"
     ],
     "hierarchicalCategories":{
        "lvl0":"Video Games",
        "lvl1":"Video Games > Toys to Life",
        "lvl2":"Video Games > Toys to Life > Amiibo"
     },
     "type":"Toy 2 life character",
     "price":15.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5723529_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5723529/pdp",
     "free_shipping":false,
     "rating":0,
     "popularity":21457,
     "objectID":"5723529",
     "_highlightResult":{
        "name":{
           "value":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Link (Rider))",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Link™ is the main character in The Legend of Zelda™ games. A young boy living in Hyrule, Link is often given the task of rescuing Princess Zelda™ and Hyrule from the Gerudo thief Ganondorf. Humble to the end, Link is known not merely as a hero but as a symbol of courage, strength and wisdom as well.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Nintendo",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Video Games",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Toys to Life",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Amiibo",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Toy 2 life character",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Rocketfish™ - Tilting TV Wall Mount for Most 32\"-70\" TVs - Black",
     "description":"Mount your flat-panel TV to the wall easily with this tilting mount that features a locking mechanism for secure installation and a fingertip tilt that allows for smooth movement and optimal viewing.",
     "brand":"Rocketfish™",
     "categories":[
        "TV & Home Theater",
        "TV Mounts"
     ],
     "hierarchicalCategories":{
        "lvl0":"TV & Home Theater",
        "lvl1":"TV & Home Theater > TV Mounts"
     },
     "type":"Tv mounts",
     "price":99.99,
     "price_range":"50 - 100",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/9881868_rb.jpg",
     "url":"https://api.bestbuy.com/click/-/9881868/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21456,
     "objectID":"9881868",
     "_highlightResult":{
        "name":{
           "value":"Rocketfish™ - Tilting TV Wall Mount for Most 32\"-70\" TVs - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Mount your flat-panel TV to the wall easily with this tilting mount that features a locking mechanism for secure installation and a fingertip tilt that allows for smooth movement and optimal viewing.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Rocketfish™",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"TV & Home Theater",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"TV Mounts",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Tv mounts",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Guardian)",
     "description":"Forget everything you know about The Legend of Zelda games. Step into a world of discovery, exploration and adventure in The Legend of Zelda: Breath of the Wild, a boundary-breaking new game in the acclaimed series.",
     "brand":"Nintendo",
     "categories":[
        "Video Games",
        "Toys to Life",
        "Amiibo"
     ],
     "hierarchicalCategories":{
        "lvl0":"Video Games",
        "lvl1":"Video Games > Toys to Life",
        "lvl2":"Video Games > Toys to Life > Amiibo"
     },
     "type":"Toy 2 life character",
     "price":19.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5723700_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5723700/pdp",
     "free_shipping":false,
     "rating":0,
     "popularity":21455,
     "objectID":"5723700",
     "_highlightResult":{
        "name":{
           "value":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Guardian)",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Forget everything you know about The Legend of Zelda games. Step into a world of discovery, exploration and adventure in The Legend of Zelda: Breath of the Wild, a boundary-breaking new game in the acclaimed series.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Nintendo",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Video Games",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Toys to Life",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Amiibo",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Toy 2 life character",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"LG - Ultra Slim 8x Max. DVD Write Speed External USB DVD±RW/CD-RW Drive - Black",
     "description":"Create archives of your favorite media with ease using this LG Ultra Slim SP80NB60 external DVD&#177;RW/CD-RW Drive, which offers up to 8x DVD&#177;R write speeds. Jamless play skips damaged parts of the disc to ensure smooth, uninterrupted playback.",
     "brand":"LG",
     "categories":[
        "Computers & Tablets",
        "Optical Drives",
        "External DVD Drives"
     ],
     "hierarchicalCategories":{
        "lvl0":"Computers & Tablets",
        "lvl1":"Computers & Tablets > Optical Drives",
        "lvl2":"Computers & Tablets > Optical Drives > External DVD Drives"
     },
     "type":"External",
     "price":39.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5407064_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5407064/pdp",
     "free_shipping":false,
     "rating":4,
     "popularity":21454,
     "objectID":"5407064",
     "_highlightResult":{
        "name":{
           "value":"LG - Ultra Slim 8x Max. DVD Write Speed External USB DVD±RW/CD-RW Drive - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Create archives of your favorite media with ease using this LG Ultra Slim SP80NB60 external DVD±RW/CD-RW Drive, which offers up to 8x DVD±R write speeds. Jamless play skips damaged parts of the disc to ensure smooth, uninterrupted playback.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"LG",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Computers & Tablets",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Optical Drives",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"External DVD Drives",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"External",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Sony - BDP-S3700 - Streaming Wi-Fi Built-In Blu-ray Player - Black",
     "description":"Enjoy fast, high-definition media streaming with this Sony Blu-ray disk player optimized with built-in Wi-Fi for smooth video performance. Use your mobile device to remotely control the player, and view the convenient side-bar app for program information. Brilliant color and high-quality details add to watching enjoyment with this Sony Blu-ray disk player.",
     "brand":"Sony",
     "categories":[
        "TV & Home Theater",
        "Streaming Media Players"
     ],
     "hierarchicalCategories":{
        "lvl0":"TV & Home Theater",
        "lvl1":"TV & Home Theater > Streaming Media Players"
     },
     "type":"Blu-ray",
     "price":89.99,
     "price_range":"50 - 100",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/4743301_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/4743301/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21453,
     "objectID":"4743301",
     "_highlightResult":{
        "name":{
           "value":"Sony - BDP-S3700 - Streaming Wi-Fi Built-In Blu-ray Player - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Enjoy fast, high-definition media streaming with this Sony Blu-ray disk player optimized with built-in Wi-Fi for smooth video performance. Use your mobile device to remotely control the player, and view the convenient side-bar app for program information. Brilliant color and high-quality details add to watching enjoyment with this Sony Blu-ray disk player.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Sony",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"TV & Home Theater",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Streaming Media Players",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Blu-ray",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Insignia™ - 55\" Class - (54.6\" Diag.) - LED - 1080p - HDTV - Black",
     "description":"Experience cinema-like viewing from the comfort of your living room with this 55-inch Insignia LED television. It displays Blu-ray and high-definition movies in full 1080p resolution with stunning HD detail. Use the three HDMI inputs to create a home theater experience with this Insignia LED TV and your other audio and video devices.",
     "brand":"Insignia™",
     "categories":[
        "TV & Home Theater",
        "TVs",
        "All Flat-Panel TVs"
     ],
     "hierarchicalCategories":{
        "lvl0":"TV & Home Theater",
        "lvl1":"TV & Home Theater > TVs",
        "lvl2":"TV & Home Theater > TVs > All Flat-Panel TVs"
     },
     "type":"51\"-60\" tv's",
     "price":379.99,
     "price_range":"200 - 500",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/4806800_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/4806800/pdp",
     "free_shipping":false,
     "rating":4,
     "popularity":21452,
     "objectID":"4806800",
     "_highlightResult":{
        "name":{
           "value":"Insignia™ - 55\" Class - (54.6\" Diag.) - LED - 1080p - HDTV - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"Experience cinema-like viewing from the comfort of your living room with this 55-inch Insignia LED television. It displays Blu-ray and high-definition movies in full 1080p resolution with stunning HD detail. Use the three HDMI inputs to create a home theater experience with this Insignia LED TV and your other audio and video devices.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Insignia™",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"TV & Home Theater",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"TVs",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"All Flat-Panel TVs",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"51\"-60\" tv's",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"HP - 15.6\" Laptop - AMD A6-Series - 4GB Memory - 500GB Hard Drive - Black",
     "description":"HP Laptop: Experience high-powered computing on the go with this HP notebook. Store your favorite videos or music on the 500GB hard drive, and watch HD movies displayed via its AMD Radeon R4 graphics card. The AMD quad-core A6 processor and 4GB of RAM in this HP notebook let it handle your heaviest multitasking workloads.",
     "brand":"HP",
     "categories":[
        "Computers & Tablets",
        "Laptops"
     ],
     "hierarchicalCategories":{
        "lvl0":"Computers & Tablets",
        "lvl1":"Computers & Tablets > Laptops"
     },
     "type":"Burst skus",
     "price":259.99,
     "price_range":"200 - 500",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5606300_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5606300/pdp",
     "free_shipping":true,
     "rating":4,
     "popularity":21451,
     "objectID":"5606300",
     "_highlightResult":{
        "name":{
           "value":"HP - 15.6\" Laptop - AMD A6-Series - 4GB Memory - 500GB Hard Drive - Black",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"HP Laptop: Experience high-powered computing on the go with this HP notebook. Store your favorite videos or music on the 500GB hard drive, and watch HD movies displayed via its AMD Radeon R4 graphics card. The AMD quad-core A6 processor and 4GB of RAM in this HP notebook let it handle your heaviest multitasking workloads.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"HP",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Computers & Tablets",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Laptops",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Burst skus",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  },
  {
     "name":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Bokoblin)",
     "description":"These creatures have appeared in many games in the Legend of Zelda series, but never have they been more dangerous and resourceful. This amiibo features a standard red Bokoblin carrying a rudimentary Boko Club, but many nastier varieties lurk in the wilds of Hyrule.",
     "brand":"Nintendo",
     "categories":[
        "Video Games",
        "Toys to Life",
        "Amiibo"
     ],
     "hierarchicalCategories":{
        "lvl0":"Video Games",
        "lvl1":"Video Games > Toys to Life",
        "lvl2":"Video Games > Toys to Life > Amiibo"
     },
     "type":"Toy 2 life character",
     "price":15.99,
     "price_range":"1 - 50",
     "image":"https://cdn-demo.algolia.com/bestbuy-0118/5723548_sb.jpg",
     "url":"https://api.bestbuy.com/click/-/5723548/pdp",
     "free_shipping":false,
     "rating":0,
     "popularity":21450,
     "objectID":"5723548",
     "_highlightResult":{
        "name":{
           "value":"Nintendo - amiibo Figure (The Legend of Zelda: Breath of the Wild Series Bokoblin)",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "description":{
           "value":"These creatures have appeared in many games in the Legend of Zelda series, but never have they been more dangerous and resourceful. This amiibo features a standard red Bokoblin carrying a rudimentary Boko Club, but many nastier varieties lurk in the wilds of Hyrule.",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "brand":{
           "value":"Nintendo",
           "matchLevel":"none",
           "matchedWords":[

           ]
        },
        "categories":[
           {
              "value":"Video Games",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Toys to Life",
              "matchLevel":"none",
              "matchedWords":[

              ]
           },
           {
              "value":"Amiibo",
              "matchLevel":"none",
              "matchedWords":[

              ]
           }
        ],
        "type":{
           "value":"Toy 2 life character",
           "matchLevel":"none",
           "matchedWords":[

           ]
        }
     }
  }
]
```

Deploy test data
```bash
npm run deploy
```

### Test web app
Go to the cloudfront dist url and check if search is working by typing **Amazon**

# Step 2 - Advanced search using Algolia
Go to the SearchService folder and install algoliasearch npm package
```javascript
npm install algoliasearch
```

Create file **index.js** and paste
```javascript
const algoliasearch = require('algoliasearch');

const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);

exports.handler = async (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    const itemsToIndex = [];
    
    event.Records.forEach((record) => {
        console.log({
            msg: 'Processing item',
            item: record.dynamodb.Keys,
            eventName: record.eventName
        });

        let item;

        if (record.eventName == 'REMOVE') {
            item = {
                action: 'deleteObject',
                indexName: process.env.ALGOLIA_INDEX_NAME,
                body: {
                    objectID: record.dynamodb.Keys.objectID.S,
                }
            }
        } else {
            const recordImage = record.dynamodb.NewImage;

            item = {
                action: 'addObject',
                indexName: process.env.ALGOLIA_INDEX_NAME,
                body: {
                    name: recordImage.name.S,
                    description: recordImage.description.S,
                    categories: JSON.parse(recordImage.categories.S),
                    brand: recordImage.brand.S,
                    image: recordImage.image.S,
                    objectID: recordImage.objectID.S,
                }
            }
        }

        itemsToIndex.push(item);
    });

    try {
        const indexingResult = await client.batch(itemsToIndex);

        callback(null, {
            message: 'Indexed successfully',
            result: indexingResult,
        });
    } catch (error) {
        callback(error);
    }
};

```

Create file **searchAlgolia.js** and paste:
```javascript
const algoliasearch = require('algoliasearch');

const index = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY)
                .initIndex(process.env.ALGOLIA_INDEX_NAME);

exports.handler = async (event, context, callback) => {
  try {
    const searchResult = await index.search({
                                      query: event.query,
                                    });
    callback(null, searchResult);
  } catch (error) {
    callback(error);
  }
}
```

## Update serverless.yml
Add global parameters
```javascript
provider:
  ...
  environment:
    ALGOLIA_APP_ID: ${env:ALGOLIA_APP_ID}
    ALGOLIA_INDEX_NAME: ServerlessIntro
```

Update functions list
```javascript
functions:

  index:
    name: index-${self:provider.stage}
    handler: index.handler
    memorySize: 128
    environment:
      ALGOLIA_API_KEY: ${env:ALGOLIA_API_KEY_INDEX}
    iamRoleStatements:
      - Effect: Allow
        Action:
          - "dynamodb:GetRecords"
          - "dynamodb:GetShardIterator"
          - "dynamodb:DescribeStream"
          - "dynamodb:ListStreams"
        Resource: arn:aws:dynamodb:*:*:table/${self:resources.Resources.ItemsStore.Properties.TableName}/stream/*
    tags:
      owner: ${self:provider.stage}
    events:
      - stream:
          type: dynamodb
          batchSize: 100
          arn:
            Fn::GetAtt:
              - ItemsStore
              - StreamArn

  search:
    name: search-${self:provider.stage}
    handler: searchAlgolia.handler
    memorySize: 256
    environment:
      STORE_DB_NAME: ${self:resources.Resources.ItemsStore.Properties.TableName}
      ALGOLIA_API_KEY: ${env:ALGOLIA_API_KEY_SEARCH
    iamRoleStatements: #This should be removed
      - Effect: Allow
        Action:
          - dynamodb:GetItem
          - dynamodb:Scan
        Resource: arn:aws:dynamodb:*:*:table/${self:resources.Resources.ItemsStore.Properties.TableName}
    tags:
      owner: ${self:provider.stage}
    events:
      - http:
          path: /search/{query}
          method: get
          cors: 
            origins:
              - '${file(../globalSettings.yml):cloudFrontDisc}'
          integration: lambda
          reqValidatorName: searchrRequestValidator
          request:
            parameters:
              paths:
                query: true
            passThrough: NEVER
            template:
              application/json: '{ "query" : "$input.params(''query'')" }'
```

## Update npm dependencies
package.json
```javascript
"dependencies": {
    "algoliasearch": "^3.29.0",
    "jsonwebtoken": "^8.3.0",
    "jwk-to-pem": "^2.0.0",
    "request": "^2.87.0"
  }
```

## Deploy
Go to SearchService folder and execute
```javascript
sls deploy
```

# Step 3 - Login (homework)
## Create Login service
Create LoginService folder and serverless.yml inside. Then paste:
```javascript
service: LoginServerlessService

provider:
  name: aws
  runtime: nodejs8.10
  stage: ${file(../globalSettings.yml):stage}
  region: ${file(../globalSettings.yml):region}

resources:  
  Resources:
    UserPool:
      Type: AWS::Cognito::UserPool
      Properties:
        AdminCreateUserConfig:
          AllowAdminCreateUserOnly: false
        UserPoolName: serverlessIntroUserPool-${self:provider.stage}
        AutoVerifiedAttributes:
          - 'email'
        Schema:
          - AttributeDataType: 'String'
            Name: email
            Required: false

    UserPoolClient:
      Type: "AWS::Cognito::UserPoolClient"
      Properties:
        ClientName: serverlessIntroUserPoolClient-${self:provider.stage}
        GenerateSecret: false
        UserPoolId:
          Ref: UserPool

```

Create file package.json and paste:
```javascript
{
  "name": "serverlessIntroductionBackend",
  "version": "0.0.0",
  "scripts": {
    "apply": "npx serverless deploy",
    "destroy": "npx serverless remove"
  },
  "private": true,
  "dependencies": {
  },
  "devDependencies": {
  }

```

Now you need to open AWS Console and then Cognito service page.
We need to configure Cognito User pool app integration:
- App client settings (Callback URL)
- Domain name

## Update SearchService
Update serverless.yml
```javascript
 - http:
          path: /search/{query}
          method: get
          authorizer:
            arn: ${file(../globalSettings.yml):cognitoUserPoolArn}
            claims:
              - email
              - openid
```

Update WebApp/src/app/appConfig.json and add loginUrl.

example:
```javascript
"loginUrl": "https://kainos-marcind2.auth.eu-west-1.amazoncognito.com/login?response_type=token&client_id=4tmven2q3as7rbk7hfi51nc6jp&redirect_uri=https://d3hmxde60sm12x.cloudfront.net/search/"
```

Update WebApp/src/app/shared/search.service.ts
```javascript
import { ActivatedRoute } from '@angular/router';
import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SearchResult } from './model/searchResult';

declare var require: any;
const appConfig = require('./../appConfig.json');
const searchUrl = appConfig.searchUrl;

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  public search (query: string): Observable<SearchResult> {
    console.log("Search started");

    if (!query.trim()) {
      return of(new SearchResult());
    }
  
    console.log(JSON.stringify({
      msg: 'token',
      value: localStorage.getItem('token'),
    }));

    const httpOptions = {
      headers: new HttpHeaders({
        'Authorization': localStorage.getItem('token'),
      })
    };

    return this.http.get<SearchResult>(`${searchUrl}/${query}`, httpOptions).pipe(
      tap(items => console.debug(items)),
      catchError(this.handleError<SearchResult>('search', new SearchResult()))
    )
  }

  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => { 
      console.error(error);

      return of(result as T);
    };
  }
}
```

Update WebApp/src/app/app.routes.ts
```javascript
import { RouterModule, Routes } from "@angular/router";
import { ModuleWithProviders } from "@angular/core";
import { LogoutComponent } from "./logout/logout.component";
import { SearchComponent } from './search/search.component';
import { CanActivateLogged } from './shared/routing/canActivateLogged';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LogoutComponent },
  { path: 'logout', component: LogoutComponent },
  { path: 'search', component: SearchComponent, canActivate: [CanActivateLogged] },
];

export const routing: ModuleWithProviders = RouterModule.forRoot(routes);

```

Add Cognito user pool ARN to the globalSettings.yml file
```javascript
cognitoUserPoolArn: arn:aws:cognito-idp:eu-west-1:123123123123:userpool/eu-west-1_9eylCnwuA
```
