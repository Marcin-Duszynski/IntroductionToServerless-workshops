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

Add test data set to TestData folder. Download file [testData.json](https://raw.githubusercontent.com/Marcin-Duszynski/IntroductionToServerless-workshops/master/TestData/testData.json "testData.json")

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

# Bonus Step (Home work) - Application Security
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
