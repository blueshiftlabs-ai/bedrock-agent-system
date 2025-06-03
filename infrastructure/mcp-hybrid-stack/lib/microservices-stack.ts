import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface MicroservicesStackProps extends cdk.StackProps {
  stage: 'dev' | 'staging' | 'prod';
  domainName?: string;
  certificateArn?: string;
  vpcId?: string;
}

interface ServiceConfig {
  name: string;
  containerPort: number;
  cpu: number;
  memory: number;
  desiredCount: number;
  path: string;
  priority: number;
  dockerfile: string;
  environment: Record<string, string>;
  secrets?: Record<string, ecs.Secret>;
  healthCheckPath: string;
  scalingConfig: {
    minCapacity: number;
    maxCapacity: number;
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
  };
}

export class MicroservicesStack extends cdk.Stack {
  public readonly serviceUrls: Record<string, cdk.CfnOutput>;
  public readonly vpc: ec2.IVpc;
  public readonly cluster: ecs.Cluster;
  public readonly namespace: servicediscovery.PrivateDnsNamespace;
  public readonly applicationLoadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: MicroservicesStackProps) {
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

    // Shared Infrastructure
    const sharedInfra = this.createSharedInfrastructure(stage);

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'McpCluster', {
      vpc: this.vpc,
      containerInsights: true,
      clusterName: `mcp-hybrid-${stage}`,
      enableFargateCapacityProviders: true,
    });

    // Service Discovery Namespace
    this.namespace = new servicediscovery.PrivateDnsNamespace(this, 'ServiceNamespace', {
      name: `mcp-hybrid-${stage}.local`,
      vpc: this.vpc,
      description: 'Service discovery namespace for MCP microservices',
    });

    // Application Load Balancer
    this.applicationLoadBalancer = new elbv2.ApplicationLoadBalancer(this, 'McpALB', {
      vpc: this.vpc,
      internetFacing: true,
      loadBalancerName: `mcp-hybrid-${stage}-alb`,
    });

    // IAM Roles
    const { executionRole, taskRole } = this.createIAMRoles(sharedInfra);

    // Service Configurations
    const serviceConfigs = this.getServiceConfigurations(stage, sharedInfra);

    // Create Fargate Services
    const services = this.createFargateServices(serviceConfigs, taskRole, executionRole, stage);

    // Create outputs
    this.serviceUrls = this.createOutputs(services, stage);

    // Add tags
    cdk.Tags.of(this).add('Project', 'MCP-Hybrid-Microservices');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  private createSharedInfrastructure(stage: string) {
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

    workflowStateTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastUpdated', type: dynamodb.AttributeType.NUMBER },
    });

    // Service Registry Table for microservices communication
    const serviceRegistryTable = new dynamodb.Table(this, 'ServiceRegistryTable', {
      tableName: `MCPServiceRegistry-${stage}`,
      partitionKey: { name: 'serviceName', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // OpenSearch Serverless Collection
    const openSearchCollection = new opensearch.CfnCollection(this, 'OpenSearchCollection', {
      name: `mcp-hybrid-${stage}`,
      type: 'VECTORSEARCH',
      description: 'Vector search for MCP hybrid server',
    });

    // Secrets
    const dbCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: `mcp-hybrid-db-credentials-${stage}`,
      description: 'Database credentials for MCP hybrid server',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'mcpuser' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    const serviceApiKeys = new secretsmanager.Secret(this, 'ServiceApiKeys', {
      secretName: `mcp-hybrid-service-keys-${stage}`,
      description: 'API keys for inter-service communication',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'masterKey',
        excludeCharacters: '"@/\\',
      },
    });

    return {
      dataBucket,
      logsBucket,
      metadataTable,
      workflowStateTable,
      serviceRegistryTable,
      openSearchCollection,
      dbCredentials,
      serviceApiKeys,
    };
  }

  private createIAMRoles(sharedInfra: any) {
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
    sharedInfra.dataBucket.grantReadWrite(taskRole);
    sharedInfra.logsBucket.grantWrite(taskRole);
    sharedInfra.metadataTable.grantReadWriteData(taskRole);
    sharedInfra.workflowStateTable.grantReadWriteData(taskRole);
    sharedInfra.serviceRegistryTable.grantReadWriteData(taskRole);
    sharedInfra.dbCredentials.grantRead(taskRole);
    sharedInfra.serviceApiKeys.grantRead(taskRole);

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
        resources: [sharedInfra.openSearchCollection.attrArn],
      })
    );

    // Service Discovery permissions
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'servicediscovery:DiscoverInstances',
          'servicediscovery:GetService',
          'servicediscovery:ListServices',
        ],
        resources: ['*'],
      })
    );

    // ECS Service permissions for inter-service communication
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecs:DescribeServices',
          'ecs:DescribeTasks',
          'ecs:ListTasks',
        ],
        resources: ['*'],
      })
    );

    return { executionRole, taskRole };
  }

  private getServiceConfigurations(stage: string, sharedInfra: any): ServiceConfig[] {
    const baseEnvironment = {
      NODE_ENV: stage,
      AWS_REGION: this.region,
      STAGE: stage,
      
      // AWS Service Configuration
      AWS_S3_BUCKET: sharedInfra.dataBucket.bucketName,
      AWS_LOGS_BUCKET: sharedInfra.logsBucket.bucketName,
      DYNAMODB_METADATA_TABLE: sharedInfra.metadataTable.tableName,
      DYNAMODB_WORKFLOW_STATE_TABLE: sharedInfra.workflowStateTable.tableName,
      DYNAMODB_SERVICE_REGISTRY_TABLE: sharedInfra.serviceRegistryTable.tableName,
      AWS_OPENSEARCH_ENDPOINT: sharedInfra.openSearchCollection.attrCollectionEndpoint,
      
      // Service Discovery
      SERVICE_DISCOVERY_NAMESPACE: `mcp-hybrid-${stage}.local`,
      
      // Application Configuration
      WORKFLOW_ENABLE_PERSISTENCE: 'true',
      TOOLS_ENABLE_CACHING: 'true',
      MCP_ENABLE_TOOL_CHAINING: 'true',
      ENABLE_FILE_LOGGING: 'true',
    };

    const baseSecrets = {
      DB_PASSWORD: ecs.Secret.fromSecretsManager(sharedInfra.dbCredentials, 'password'),
      SERVICE_API_KEY: ecs.Secret.fromSecretsManager(sharedInfra.serviceApiKeys, 'masterKey'),
    };

    return [
      {
        name: 'api-gateway',
        containerPort: 3000,
        cpu: stage === 'prod' ? 2048 : 1024,
        memory: stage === 'prod' ? 4096 : 2048,
        desiredCount: stage === 'prod' ? 3 : 2,
        path: '/api/*',
        priority: 100,
        dockerfile: 'docker/Dockerfile.gateway',
        environment: {
          ...baseEnvironment,
          PORT: '3000',
          SERVICE_TYPE: 'gateway',
          ENABLE_MCP_SERVER: 'true',
          ENABLE_API_DOCS: 'true',
        },
        secrets: baseSecrets,
        healthCheckPath: '/api/v1/health',
        scalingConfig: {
          minCapacity: stage === 'prod' ? 3 : 2,
          maxCapacity: stage === 'prod' ? 20 : 10,
          targetCpuUtilization: 70,
          targetMemoryUtilization: 80,
        },
      },
      {
        name: 'agents-service',
        containerPort: 3001,
        cpu: stage === 'prod' ? 4096 : 2048,
        memory: stage === 'prod' ? 8192 : 4096,
        desiredCount: stage === 'prod' ? 3 : 2,
        path: '/agents/*',
        priority: 200,
        dockerfile: 'docker/Dockerfile.agents',
        environment: {
          ...baseEnvironment,
          PORT: '3001',
          SERVICE_TYPE: 'agents',
          ENABLE_CODE_ANALYZER: 'true',
          ENABLE_DB_ANALYZER: 'true',
          ENABLE_KNOWLEDGE_BUILDER: 'true',
          ENABLE_DOCUMENTATION_GENERATOR: 'true',
        },
        secrets: baseSecrets,
        healthCheckPath: '/health',
        scalingConfig: {
          minCapacity: stage === 'prod' ? 2 : 1,
          maxCapacity: stage === 'prod' ? 15 : 8,
          targetCpuUtilization: 80,
          targetMemoryUtilization: 85,
        },
      },
      {
        name: 'tools-service',
        containerPort: 3002,
        cpu: stage === 'prod' ? 2048 : 1024,
        memory: stage === 'prod' ? 4096 : 2048,
        desiredCount: stage === 'prod' ? 2 : 1,
        path: '/tools/*',
        priority: 300,
        dockerfile: 'docker/Dockerfile.tools',
        environment: {
          ...baseEnvironment,
          PORT: '3002',
          SERVICE_TYPE: 'tools',
          ENABLE_CODE_ANALYSIS_TOOL: 'true',
          ENABLE_DATABASE_ANALYSIS_TOOL: 'true',
          ENABLE_DOCUMENT_RETRIEVAL_TOOL: 'true',
          ENABLE_KNOWLEDGE_GRAPH_TOOL: 'true',
        },
        secrets: baseSecrets,
        healthCheckPath: '/health',
        scalingConfig: {
          minCapacity: stage === 'prod' ? 2 : 1,
          maxCapacity: stage === 'prod' ? 10 : 5,
          targetCpuUtilization: 75,
          targetMemoryUtilization: 80,
        },
      },
      {
        name: 'workflows-service',
        containerPort: 3003,
        cpu: stage === 'prod' ? 4096 : 2048,
        memory: stage === 'prod' ? 8192 : 4096,
        desiredCount: stage === 'prod' ? 2 : 1,
        path: '/workflows/*',
        priority: 400,
        dockerfile: 'docker/Dockerfile.workflows',
        environment: {
          ...baseEnvironment,
          PORT: '3003',
          SERVICE_TYPE: 'workflows',
          ENABLE_CODE_ANALYSIS_WORKFLOW: 'true',
          ENABLE_WORKFLOW_PERSISTENCE: 'true',
          ENABLE_WORKFLOW_RECOVERY: 'true',
        },
        secrets: baseSecrets,
        healthCheckPath: '/health',
        scalingConfig: {
          minCapacity: stage === 'prod' ? 2 : 1,
          maxCapacity: stage === 'prod' ? 12 : 6,
          targetCpuUtilization: 80,
          targetMemoryUtilization: 85,
        },
      },
    ];
  }

  private createFargateServices(
    serviceConfigs: ServiceConfig[],
    taskRole: iam.Role,
    executionRole: iam.Role,
    stage: string
  ) {
    const services: Record<string, ecs.FargateService> = {};

    for (const config of serviceConfigs) {
      // Task Definition
      const taskDefinition = new ecs.FargateTaskDefinition(this, `${config.name}-TaskDef`, {
        memoryLimitMiB: config.memory,
        cpu: config.cpu,
        taskRole,
        executionRole,
        family: `mcp-${config.name}-${stage}`,
      });

      // Container Definition
      const container = taskDefinition.addContainer(`${config.name}-container`, {
        image: ecs.ContainerImage.fromAsset('../../apps/mcp-hybrid-server', {
          file: config.dockerfile,
        }),
        containerName: config.name,
        environment: config.environment,
        secrets: config.secrets,
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: config.name,
          logGroup: new logs.LogGroup(this, `${config.name}-LogGroup`, {
            logGroupName: `/ecs/mcp-hybrid-${stage}/${config.name}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        }),
        healthCheck: {
          command: [
            'CMD-SHELL',
            `curl -f http://localhost:${config.containerPort}${config.healthCheckPath} || exit 1`,
          ],
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          retries: 3,
          startPeriod: cdk.Duration.seconds(60),
        },
      });

      container.addPortMappings({
        containerPort: config.containerPort,
        protocol: ecs.Protocol.TCP,
      });

      // Service Discovery
      const serviceDiscovery = this.namespace.createService(`${config.name}-discovery`, {
        name: config.name,
        description: `Service discovery for ${config.name}`,
        healthCheckGracePeriod: cdk.Duration.seconds(120),
        healthCheckCustomConfig: {
          failureThreshold: 3,
        },
      });

      // Fargate Service
      const service = new ecs.FargateService(this, `${config.name}-Service`, {
        cluster: this.cluster,
        taskDefinition,
        desiredCount: config.desiredCount,
        serviceName: `mcp-${config.name}-${stage}`,
        assignPublicIp: false,
        cloudMapOptions: {
          cloudMapNamespace: this.namespace,
          name: config.name,
          dnsRecordType: servicediscovery.DnsRecordType.A,
        },
        enableExecuteCommand: true,
      });

      // Target Group for ALB
      const targetGroup = new elbv2.ApplicationTargetGroup(this, `${config.name}-TargetGroup`, {
        port: config.containerPort,
        protocol: elbv2.ApplicationProtocol.HTTP,
        vpc: this.vpc,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: config.healthCheckPath,
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 5,
        },
      });

      // Add targets to target group
      targetGroup.addTarget(service);

      // ALB Listener Rule
      new elbv2.ApplicationListenerRule(this, `${config.name}-ListenerRule`, {
        listener: this.getOrCreateListener(),
        priority: config.priority,
        conditions: [
          elbv2.ListenerCondition.pathPatterns([config.path]),
        ],
        action: elbv2.ListenerAction.forward([targetGroup]),
      });

      // Auto Scaling
      const scalableTarget = service.autoScaleTaskCount({
        minCapacity: config.scalingConfig.minCapacity,
        maxCapacity: config.scalingConfig.maxCapacity,
      });

      scalableTarget.scaleOnCpuUtilization(`${config.name}-CpuScaling`, {
        targetUtilizationPercent: config.scalingConfig.targetCpuUtilization,
        scaleInCooldown: cdk.Duration.minutes(5),
        scaleOutCooldown: cdk.Duration.minutes(2),
      });

      scalableTarget.scaleOnMemoryUtilization(`${config.name}-MemoryScaling`, {
        targetUtilizationPercent: config.scalingConfig.targetMemoryUtilization,
        scaleInCooldown: cdk.Duration.minutes(5),
        scaleOutCooldown: cdk.Duration.minutes(2),
      });

      services[config.name] = service;
    }

    return services;
  }

  private getOrCreateListener(): elbv2.ApplicationListener {
    return new elbv2.ApplicationListener(this, 'McpALBListener', {
      loadBalancer: this.applicationLoadBalancer,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not Found',
      }),
    });
  }

  private createOutputs(services: Record<string, ecs.FargateService>, stage: string): Record<string, cdk.CfnOutput> {
    const outputs: Record<string, cdk.CfnOutput> = {};

    // Main ALB URL
    outputs.mainUrl = new cdk.CfnOutput(this, 'MainServiceUrl', {
      value: `http://${this.applicationLoadBalancer.loadBalancerDnsName}`,
      description: 'Main Application Load Balancer URL',
    });

    // Service-specific outputs
    Object.keys(services).forEach(serviceName => {
      outputs[`${serviceName}Url`] = new cdk.CfnOutput(this, `${serviceName}ServiceUrl`, {
        value: `http://${this.applicationLoadBalancer.loadBalancerDnsName}/${serviceName.replace('-service', '')}`,
        description: `URL for ${serviceName}`,
      });
    });

    // Service Discovery Namespace
    outputs.serviceNamespace = new cdk.CfnOutput(this, 'ServiceDiscoveryNamespace', {
      value: this.namespace.namespaceName,
      description: 'Service Discovery Namespace',
    });

    return outputs;
  }
}