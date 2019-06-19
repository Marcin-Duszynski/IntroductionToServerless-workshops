# Step 0 - Init
Similar to AWS, Azure functions support limited number of the runtimes and programing languages.

[Visit this page to check what you can use on the Azure](https://docs.microsoft.com/en-us/azure/azure-functions/functions-versions)

Ok, after short theoretical part it's time to move to the action.

1. Login to [the Azure portal](https://azure.microsoft.com/pl-pl/features/azure-portal/) and type provided user name and password.
2. Type in the terminal
```
az login
```

# Step 1 - Create simple web api
1. Create your first Azure function
```
sls create --template azure-nodejs --path api --name basicAzureApi<<YourNick>>
```

2. Go to the api directory
```
code /api
```

3. Check content of the serverless.yml and handler.js

# Step 2 - Deploy api to the Azure
If you didn't finish step 1 then switch to the branch **step1-azure-basicApi**
```bash
git checkout step1-azure-basicApi
```

1. In the api directory type
```
sls deploy
```

# Step 3 - Test serverless api

1. Go to the Azure portal and open Function App site.
2. Open your function and on the right side you will find test section.
3. Select GET http method and press RUN on the bottom.

# Bonus step
If you feel that this short introduction to functions on the Azure is not enough you can do this [Azure training](https://github.com/Azure-Samples/azure-serverless-workshop-team-assistant)
