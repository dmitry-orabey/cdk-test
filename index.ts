import apigateway = require("@aws-cdk/aws-apigateway");
import dynamodb = require("@aws-cdk/aws-dynamodb");
import lambda = require("@aws-cdk/aws-lambda");
// import ses = require("@aws-cdk/aws-ses");
import iam = require("@aws-cdk/aws-iam");
import cdk = require("@aws-cdk/core");

export class ApiLambdaDynamoDBStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);

    const dynamoTable = new dynamodb.Table(this, "ContactForm", {
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      tableName: "ContactForm",

      // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
      // the new table, and it will remain in your account until manually deleted. By setting the policy to
      // DESTROY, cdk destroy will delete the table (even if it has data in it)
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    const lambdaHandler = new lambda.Function(this, "contactFormFunction", {
      code: new lambda.AssetCode("src"),
      handler: "create.handler",
      runtime: lambda.Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "id",
      },
    });

    dynamoTable.grantReadWriteData(lambdaHandler);

    const SESpolicy = new iam.PolicyStatement({ effect: iam.Effect.ALLOW });
    SESpolicy.addActions("ses:SendEmail");
    SESpolicy.addResources("*");
    lambdaHandler.addToRolePolicy(SESpolicy);

    const api = new apigateway.RestApi(this, "contactFormApi", {
      restApiName: "Contact Form Service",
    });

    const formApi = api.root.addResource("handleContanctForm");

    const lambdaHandlerIntegration = new apigateway.LambdaIntegration(
      lambdaHandler
    );
    formApi.addMethod("POST", lambdaHandlerIntegration);
    addCorsOptions(formApi);
  }
}

export function addCorsOptions(apiResource: apigateway.IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}

const app = new cdk.App();
new ApiLambdaDynamoDBStack(app, "ApiLambdaDynamoDBStack");
app.synth();
