import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as neptune from 'aws-cdk-lib/aws-neptune';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface NeptuneClusterProps {
  vpc: ec2.IVpc;
  stage: string;
  instanceType?: ec2.InstanceType;
  backupRetentionDays?: number;
}

export class NeptuneCluster extends Construct {
  public readonly cluster: neptune.DatabaseCluster;
  public readonly clusterEndpoint: string;
  public readonly clusterPort: string;
  public readonly clusterResourceId: string;

  constructor(scope: Construct, id: string, props: NeptuneClusterProps) {
    super(scope, id);

    const { vpc, stage } = props;

    // Create subnet group for Neptune
    const subnetGroup = new neptune.SubnetGroup(this, 'SubnetGroup', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      description: `Neptune subnet group for ${stage}`,
    });

    // Create security group for Neptune
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Security group for Neptune cluster',
      allowAllOutbound: true,
    });

    // Create parameter group
    const parameterGroup = new neptune.ParameterGroup(this, 'ParameterGroup', {
      family: neptune.ParameterGroupFamily.NEPTUNE_1_3,
      description: `Neptune parameter group for ${stage}`,
      parameters: {
        'neptune_enable_audit_log': '1',
        'neptune_query_timeout': '120000',
      },
    });

    // Create Neptune cluster
    this.cluster = new neptune.DatabaseCluster(this, 'Cluster', {
      vpc,
      instanceType: props.instanceType || ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        stage === 'prod' ? ec2.InstanceSize.MEDIUM : ec2.InstanceSize.SMALL
      ),
      dbClusterName: `mcp-hybrid-neptune-${stage}`,
      engineVersion: neptune.EngineVersion.V1_3_1_0,
      parameterGroup,
      subnetGroup,
      securityGroups: [securityGroup],
      backupRetention: cdk.Duration.days(props.backupRetentionDays || (stage === 'prod' ? 7 : 1)),
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      deletionProtection: stage === 'prod',
      cloudwatchLogsExports: [
        neptune.LogType.AUDIT,
      ],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      iamAuthentication: true,
      storageEncrypted: true,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Store cluster properties
    this.clusterEndpoint = this.cluster.clusterEndpoint.socketAddress;
    this.clusterPort = '8182';
    this.clusterResourceId = this.cluster.clusterResourceIdentifier;

    // Create read replica for production
    if (stage === 'prod') {
      new neptune.DatabaseInstance(this, 'ReadReplica', {
        cluster: this.cluster,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      });
    }

    // Allow connections from ECS tasks
    this.allowConnectionsFrom = (source: ec2.IConnectable) => {
      this.cluster.connections.allowFrom(source, ec2.Port.tcp(8182), 'Allow from ECS tasks');
    };
  }

  public allowConnectionsFrom: (source: ec2.IConnectable) => void;

  /**
   * Grant data access permissions to a role
   */
  public grantDataAccess(grantee: iam.IGrantable): void {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'neptune-db:connect',
          'neptune-db:ReadDataViaQuery',
          'neptune-db:WriteDataViaQuery',
          'neptune-db:DeleteDataViaQuery',
          'neptune-db:GetQueryStatus',
          'neptune-db:CancelQuery',
          'neptune-db:GetStreamRecords'
        ],
        resources: [
          `arn:aws:neptune-db:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.clusterResourceId}/*`
        ],
      })
    );
  }
}