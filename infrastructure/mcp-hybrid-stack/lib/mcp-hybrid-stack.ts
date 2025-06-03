import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface McpHybridStackProps extends cdk.StackProps {
  stage: 'dev' | 'staging' | 'prod';
  domainName?: string;
  certificateArn?: string;
  vpcId?: string;
}

export class McpHybridStack extends cdk.Stack {
  public readonly serviceUrl: cdk.CfnOutput;
  public readonly vpc: ec2.IVpc;
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: McpHybridStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // VPC
    this.vpc = props.vpcId
      ? ec2.Vpc.fromLookup(this, 'ExistingVpc', { vpcId: props.vpcId })
      : new ec2.Vpc(this, 'McpVpc', {
          maxAzs: 3,
          natGateways: stage === 'prod' ? 3 : 1,
          subnetConfiguration: [
            {
              cidrMask: 24,
              name: 'public',
              subnetType: ec2.SubnetType.PUBLIC,
            },
            {
              cidrMask: 24,
              name: 'private',
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            {
              cidrMask: 28,
              name: 'isolated',
              subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            }
          ]
        });

    // S3 Buckets
    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `mcp-hybrid-server-data-${stage}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
        }
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const logsBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `mcp-hybrid-server-logs-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          expiration: cdk.Duration.days(90),
        }
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB Tables
    const metadataTable = new dynamodb.Table(this, 'MetadataTable', {
      tableName: `MCPMetadata-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const workflowStateTable = new dynamodb.Table(this, 'WorkflowStateTable', {
      tableName: `MCPWorkflowState-${stage}`,
      partitionKey: { name: 'workflowId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSIs for querying
    workflowStateTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastUpdated', type: dynamodb.AttributeType.NUMBER },
    });

    // OpenSearch Serverless Collection
    const openSearchCollection = new opensearch.CfnCollection(this, 'OpenSearchCollection', {
      name: `mcp-hybrid-${stage}`,
      type: 'VECTORSEARCH',
      description: 'Vector search for MCP hybrid server',
    });

    // Secrets for sensitive configuration
    const dbCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: `mcp-hybrid-db-credentials-${stage}`,
      description: 'Database credentials for MCP hybrid server',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'mcpuser' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'McpCluster', {
      vpc: this.vpc,
      containerInsights: true,
      clusterName: `mcp-hybrid-${stage}`,
    });

    // Task Execution Role
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Enhanced Task Role with comprehensive permissions
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant permissions to AWS services
    dataBucket.grantReadWrite(taskRole);
    logsBucket.grantWrite(taskRole);
    metadataTable.grantReadWriteData(taskRole);
    workflowStateTable.grantReadWriteData(taskRole);
    dbCredentials.grantRead(taskRole);

    // Bedrock permissions
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:ListFoundationModels',
          'bedrock:GetFoundationModel'
        ],
        resources: ['*'],
      })
    );

    // OpenSearch permissions
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'aoss:APIAccessAll'
        ],
        resources: [openSearchCollection.attrArn],
      })
    );

    // Application Load Balanced Fargate Service
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'McpService', {
      cluster: this.cluster,
      memoryLimitMiB: stage === 'prod' ? 8192 : 4096,
      cpu: stage === 'prod' ? 4096 : 2048,
      desiredCount: stage === 'prod' ? 3 : 2,
      serviceName: `mcp-hybrid-${stage}`,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../', {
          file: 'docker/Dockerfile'
        }),
        containerName: 'mcp-hybrid-server',
        containerPort: 3000,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'mcp-hybrid',
          logRetention: logs.RetentionDays.ONE_MONTH,
        }),
        environment: {
          NODE_ENV: stage,
          AWS_REGION: this.region,
          STAGE: stage,
          PORT: '3000',
          
          // AWS Service Configuration
          AWS_S3_BUCKET: dataBucket.bucketName,
          AWS_LOGS_BUCKET: logsBucket.bucketName,
          DYNAMODB_METADATA_TABLE: metadataTable.tableName,
          DYNAMODB_WORKFLOW_STATE_TABLE: workflowStateTable.tableName,
          AWS_OPENSEARCH_ENDPOINT: openSearchCollection.attrCollectionEndpoint,
          
          // Application Configuration
          WORKFLOW_ENABLE_PERSISTENCE: 'true',
          TOOLS_ENABLE_CACHING: 'true',
          MCP_ENABLE_TOOL_CHAINING: 'true',
          ENABLE_FILE_LOGGING: 'true',
        },
        secrets: {
          DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
        },
        taskRole,
        executionRole,
      },
      publicLoadBalancer: true,
      assignPublicIp: false,
      certificate: props.certificateArn ? 
        certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn) : 
        undefined,
      domainName: props.domainName,
      domainZone: props.domainName ? 
        route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: props.domainName }) : 
        undefined,
    });

    // Health check configuration
    fargateService.targetGroup.configureHealthCheck({
      path: '/api/v1/health',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
    });

    // Auto Scaling
    const scalableTarget = fargateService.service.autoScaleTaskCount({
      minCapacity: stage === 'prod' ? 3 : 2,
      maxCapacity: stage === 'prod' ? 20 : 10,
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Custom metric scaling for API request rate
    scalableTarget.scaleOnMetric('RequestScaling', {
      metric: fargateService.loadBalancer.metricRequestCount(),
      scalingSteps: [
        { upper: 100, change: -1 },
        { lower: 500, change: +1 },
        { lower: 1000, change: +2 },
      ],
      adjustmentType: cdk.aws_applicationautoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    // Outputs
    this.serviceUrl = new cdk.CfnOutput(this, 'ServiceUrl', {
      value: props.domainName 
        ? `https://${props.domainName}`
        : `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'URL of the MCP Hybrid Server',
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: dataBucket.bucketName,
      description: 'S3 bucket for data storage',
    });

    new cdk.CfnOutput(this, 'MetadataTableName', {
      value: metadataTable.tableName,
      description: 'DynamoDB table for metadata',
    });

    new cdk.CfnOutput(this, 'WorkflowStateTableName', {
      value: workflowStateTable.tableName,
      description: 'DynamoDB table for workflow state',
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      value: openSearchCollection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'MCP-Hybrid-Server');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
