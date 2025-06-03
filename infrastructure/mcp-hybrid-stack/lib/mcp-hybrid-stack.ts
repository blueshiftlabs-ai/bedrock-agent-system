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
import { ParameterStoreManager } from '../constructs/parameter-store-manager';
import { NeptuneCluster } from '../constructs/neptune-cluster';

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
  public readonly parameterStore: ParameterStoreManager;

  constructor(scope: Construct, id: string, props: McpHybridStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Initialize Parameter Store Manager
    this.parameterStore = new ParameterStoreManager(this, 'ParameterStore', {
      stage,
      prefix: '/mcp-hybrid',
    });

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

    // Store VPC configuration in Parameter Store
    this.parameterStore.addParameters([
      {
        path: 'vpc/id',
        value: this.vpc.vpcId,
        description: 'VPC ID for MCP Hybrid Server',
      },
      {
        path: 'vpc/cidr',
        value: this.vpc.vpcCidrBlock,
        description: 'VPC CIDR block',
      },
    ]);

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

    // Store S3 bucket configurations
    this.parameterStore.addParameters([
      {
        path: 's3/data-bucket/name',
        value: dataBucket.bucketName,
        description: 'S3 bucket name for data storage',
      },
      {
        path: 's3/data-bucket/arn',
        value: dataBucket.bucketArn,
        description: 'S3 bucket ARN for data storage',
      },
      {
        path: 's3/logs-bucket/name',
        value: logsBucket.bucketName,
        description: 'S3 bucket name for logs',
      },
      {
        path: 's3/logs-bucket/arn',
        value: logsBucket.bucketArn,
        description: 'S3 bucket ARN for logs',
      },
    ]);

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

    // Store DynamoDB configurations
    this.parameterStore.addParameters([
      {
        path: 'dynamodb/metadata-table/name',
        value: metadataTable.tableName,
        description: 'DynamoDB table name for metadata',
      },
      {
        path: 'dynamodb/metadata-table/arn',
        value: metadataTable.tableArn,
        description: 'DynamoDB table ARN for metadata',
      },
      {
        path: 'dynamodb/workflow-state-table/name',
        value: workflowStateTable.tableName,
        description: 'DynamoDB table name for workflow state',
      },
      {
        path: 'dynamodb/workflow-state-table/arn',
        value: workflowStateTable.tableArn,
        description: 'DynamoDB table ARN for workflow state',
      },
      {
        path: 'dynamodb/workflow-state-table/status-index',
        value: 'StatusIndex',
        description: 'GSI name for status queries',
      },
    ]);

    // OpenSearch Serverless Collection
    const openSearchCollection = new opensearch.CfnCollection(this, 'OpenSearchCollection', {
      name: `mcp-hybrid-${stage}`,
      type: 'VECTORSEARCH',
      description: 'Vector search for MCP hybrid server',
    });

    // Store OpenSearch configuration
    this.parameterStore.addParameters([
      {
        path: 'opensearch/collection/name',
        value: openSearchCollection.name,
        description: 'OpenSearch collection name',
      },
      {
        path: 'opensearch/collection/endpoint',
        value: openSearchCollection.attrCollectionEndpoint,
        description: 'OpenSearch collection endpoint',
      },
      {
        path: 'opensearch/collection/arn',
        value: openSearchCollection.attrArn,
        description: 'OpenSearch collection ARN',
      },
    ]);

    // Neptune Cluster
    const neptuneCluster = new NeptuneCluster(this, 'NeptuneCluster', {
      vpc: this.vpc,
      stage,
    });

    // Store Neptune configuration
    this.parameterStore.addParameters([
      {
        path: 'neptune/cluster/endpoint',
        value: neptuneCluster.clusterEndpoint,
        description: 'Neptune cluster endpoint',
      },
      {
        path: 'neptune/cluster/port',
        value: neptuneCluster.clusterPort,
        description: 'Neptune cluster port',
      },
      {
        path: 'neptune/cluster/resource-id',
        value: neptuneCluster.clusterResourceId,
        description: 'Neptune cluster resource identifier',
      },
    ]);

    // Secrets for sensitive configuration
    const dbCredentials = this.parameterStore.addSecret({
      name: 'database/credentials',
      description: 'Database credentials for MCP hybrid server',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'mcpuser' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    // API Keys and other secrets
    const apiKeys = this.parameterStore.addSecret({
      name: 'api/keys',
      description: 'API keys for external services',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          openai: '',
          anthropic: '',
        }),
        generateStringKey: 'internal',
        excludeCharacters: '"@/\\',
      },
    });

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'McpCluster', {
      vpc: this.vpc,
      containerInsights: true,
      clusterName: `mcp-hybrid-${stage}`,
    });

    // Store ECS configuration
    this.parameterStore.addParameters([
      {
        path: 'ecs/cluster/name',
        value: this.cluster.clusterName,
        description: 'ECS cluster name',
      },
      {
        path: 'ecs/cluster/arn',
        value: this.cluster.clusterArn,
        description: 'ECS cluster ARN',
      },
    ]);

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
    neptuneCluster.grantDataAccess(taskRole);
    
    // Grant Parameter Store and Secrets Manager access
    this.parameterStore.grantRead(taskRole);

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

    // Store IAM role configurations
    this.parameterStore.addParameters([
      {
        path: 'iam/task-role/arn',
        value: taskRole.roleArn,
        description: 'ECS task role ARN',
      },
      {
        path: 'iam/task-role/name',
        value: taskRole.roleName,
        description: 'ECS task role name',
      },
      {
        path: 'iam/execution-role/arn',
        value: executionRole.roleArn,
        description: 'ECS execution role ARN',
      },
    ]);

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
          
          // Parameter Store Configuration
          PARAMETER_STORE_PREFIX: `/mcp-hybrid/${stage}`,
          
          // Application Configuration
          WORKFLOW_ENABLE_PERSISTENCE: 'true',
          TOOLS_ENABLE_CACHING: 'true',
          MCP_ENABLE_TOOL_CHAINING: 'true',
          ENABLE_FILE_LOGGING: 'true',
        },
        secrets: {
          // Secrets will be loaded from Secrets Manager at runtime
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

    // Allow Neptune connections
    neptuneCluster.allowConnectionsFrom(fargateService.service);

    // Store ECS service configuration
    this.parameterStore.addParameters([
      {
        path: 'ecs/service/name',
        value: fargateService.service.serviceName,
        description: 'ECS service name',
      },
      {
        path: 'ecs/service/arn',
        value: fargateService.service.serviceArn,
        description: 'ECS service ARN',
      },
      {
        path: 'alb/dns-name',
        value: fargateService.loadBalancer.loadBalancerDnsName,
        description: 'Application Load Balancer DNS name',
      },
      {
        path: 'alb/arn',
        value: fargateService.loadBalancer.loadBalancerArn,
        description: 'Application Load Balancer ARN',
      },
      {
        path: 'alb/url',
        value: props.domainName 
          ? `https://${props.domainName}`
          : `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
        description: 'Application URL',
      },
    ]);

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

    // Store auto-scaling configuration
    this.parameterStore.addParameters([
      {
        path: 'autoscaling/min-capacity',
        value: (stage === 'prod' ? 3 : 2).toString(),
        description: 'Minimum number of tasks',
      },
      {
        path: 'autoscaling/max-capacity',
        value: (stage === 'prod' ? 20 : 10).toString(),
        description: 'Maximum number of tasks',
      },
      {
        path: 'autoscaling/cpu-target',
        value: '70',
        description: 'Target CPU utilization percentage',
      },
      {
        path: 'autoscaling/memory-target',
        value: '80',
        description: 'Target memory utilization percentage',
      },
    ]);

    // Export parameter manifest
    this.parameterStore.exportManifest();

    // Create outputs for all parameters and secrets
    this.parameterStore.createOutputs();

    // Legacy outputs for backward compatibility
    this.serviceUrl = new cdk.CfnOutput(this, 'ServiceUrl', {
      value: props.domainName 
        ? `https://${props.domainName}`
        : `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'URL of the MCP Hybrid Server',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'MCP-Hybrid-Server');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}