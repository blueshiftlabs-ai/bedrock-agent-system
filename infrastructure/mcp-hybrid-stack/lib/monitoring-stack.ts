import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  stage: 'dev' | 'staging' | 'prod';
  clusterName: string;
  alertEmail?: string;
  slackWebhookUrl?: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { stage, clusterName, alertEmail, slackWebhookUrl } = props;

    // SNS Topic for alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `mcp-microservices-alerts-${stage}`,
      displayName: `MCP Microservices Alerts - ${stage}`,
    });

    // Email subscription if provided
    if (alertEmail) {
      alertTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));
    }

    // Service names
    const services = ['api-gateway', 'agents-service', 'tools-service', 'workflows-service'];

    // Create CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'ServicesDashboard', {
      dashboardName: `MCP-Microservices-${stage}`,
    });

    // Service-specific monitoring
    services.forEach(serviceName => {
      const serviceDisplayName = serviceName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // CPU Utilization Widget
      const cpuWidget = new cloudwatch.GraphWidget({
        title: `${serviceDisplayName} - CPU Utilization`,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              ServiceName: `mcp-${serviceName}-${stage}`,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      });

      // Memory Utilization Widget
      const memoryWidget = new cloudwatch.GraphWidget({
        title: `${serviceDisplayName} - Memory Utilization`,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
              ServiceName: `mcp-${serviceName}-${stage}`,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      });

      // Task Count Widget
      const taskCountWidget = new cloudwatch.GraphWidget({
        title: `${serviceDisplayName} - Running Tasks`,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ServiceName: `mcp-${serviceName}-${stage}`,
              ClusterName: clusterName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      });

      // Add widgets to dashboard
      dashboard.addWidgets(cpuWidget, memoryWidget, taskCountWidget);

      // CPU Alarm
      const cpuAlarm = new cloudwatch.Alarm(this, `${serviceName}-HighCPU`, {
        alarmName: `${serviceName}-${stage}-HighCPU`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ServiceName: `mcp-${serviceName}-${stage}`,
            ClusterName: clusterName,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: stage === 'prod' ? 80 : 90,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `High CPU utilization for ${serviceDisplayName} service`,
      });

      // Memory Alarm
      const memoryAlarm = new cloudwatch.Alarm(this, `${serviceName}-HighMemory`, {
        alarmName: `${serviceName}-${stage}-HighMemory`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'MemoryUtilization',
          dimensionsMap: {
            ServiceName: `mcp-${serviceName}-${stage}`,
            ClusterName: clusterName,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: stage === 'prod' ? 85 : 95,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `High memory utilization for ${serviceDisplayName} service`,
      });

      // Service Down Alarm
      const serviceDownAlarm = new cloudwatch.Alarm(this, `${serviceName}-ServiceDown`, {
        alarmName: `${serviceName}-${stage}-ServiceDown`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'RunningTaskCount',
          dimensionsMap: {
            ServiceName: `mcp-${serviceName}-${stage}`,
            ClusterName: clusterName,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(1),
        }),
        threshold: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
        alarmDescription: `${serviceDisplayName} service has no running tasks`,
      });

      // Add alarms to SNS topic
      cpuAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));
      memoryAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));
      serviceDownAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));
    });

    // Application Load Balancer monitoring
    const albRequestsWidget = new cloudwatch.GraphWidget({
      title: 'Load Balancer - Request Count',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'RequestCount',
          dimensionsMap: {
            LoadBalancer: `app/mcp-hybrid-${stage}-alb/*`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
      height: 6,
    });

    const albLatencyWidget = new cloudwatch.GraphWidget({
      title: 'Load Balancer - Response Time',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'TargetResponseTime',
          dimensionsMap: {
            LoadBalancer: `app/mcp-hybrid-${stage}-alb/*`,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
      height: 6,
    });

    const albErrorsWidget = new cloudwatch.GraphWidget({
      title: 'Load Balancer - HTTP 5xx Errors',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HTTPCode_ELB_5XX_Count',
          dimensionsMap: {
            LoadBalancer: `app/mcp-hybrid-${stage}-alb/*`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
      height: 6,
    });

    dashboard.addWidgets(albRequestsWidget, albLatencyWidget, albErrorsWidget);

    // High error rate alarm
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRate', {
      alarmName: `mcp-microservices-${stage}-HighErrorRate`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_ELB_5XX_Count',
        dimensionsMap: {
          LoadBalancer: `app/mcp-hybrid-${stage}-alb/*`,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: stage === 'prod' ? 10 : 50,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'High 5xx error rate on the load balancer',
    });

    highErrorRateAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

    // Slack notification Lambda (if webhook URL provided)
    if (slackWebhookUrl) {
      const slackNotifier = new lambda.Function(this, 'SlackNotifier', {
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: 'index.handler',
        functionName: `mcp-slack-notifier-${stage}`,
        environment: {
          SLACK_WEBHOOK_URL: slackWebhookUrl,
          STAGE: stage,
        },
        code: lambda.Code.fromInline(`
import json
import urllib3
import os

def handler(event, context):
    webhook_url = os.environ['SLACK_WEBHOOK_URL']
    stage = os.environ['STAGE']
    
    http = urllib3.PoolManager()
    
    # Parse SNS message
    message = json.loads(event['Records'][0]['Sns']['Message'])
    alarm_name = message['AlarmName']
    new_state = message['NewStateValue']
    reason = message['NewStateReason']
    
    # Format Slack message
    color = "danger" if new_state == "ALARM" else "good"
    text = f"🚨 {alarm_name} is in {new_state} state\\n{reason}"
    
    slack_message = {
        "attachments": [
            {
                "color": color,
                "title": f"MCP Microservices Alert - {stage.upper()}",
                "text": text,
                "fields": [
                    {
                        "title": "Alarm",
                        "value": alarm_name,
                        "short": True
                    },
                    {
                        "title": "State",
                        "value": new_state,
                        "short": True
                    }
                ]
            }
        ]
    }
    
    response = http.request(
        'POST',
        webhook_url,
        body=json.dumps(slack_message).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    return {
        'statusCode': 200,
        'body': 'Notification sent'
    }
        `),
      });

      // Subscribe Lambda to SNS topic
      alertTopic.addSubscription(new subscriptions.LambdaSubscription(slackNotifier));
    }

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS Topic ARN for alerts',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'MCP-Hybrid-Microservices');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Component', 'Monitoring');
  }
}