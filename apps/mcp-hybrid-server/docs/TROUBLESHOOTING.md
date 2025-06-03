# Troubleshooting Guide

## Table of Contents
- [Overview](#overview)
- [Common Issues](#common-issues)
- [Diagnostic Tools](#diagnostic-tools)
- [Configuration Issues](#configuration-issues)
- [Performance Issues](#performance-issues)
- [Network and Connectivity](#network-and-connectivity)
- [AWS Service Issues](#aws-service-issues)
- [MCP Protocol Issues](#mcp-protocol-issues)
- [Application Errors](#application-errors)
- [Monitoring and Debugging](#monitoring-and-debugging)
- [Recovery Procedures](#recovery-procedures)
- [Support and Escalation](#support-and-escalation)

## Overview

This guide provides systematic troubleshooting procedures for the Bedrock Agent System. It covers common issues, diagnostic techniques, and resolution steps for various components and scenarios.

### Quick Diagnostic Checklist

Before diving into specific issues, run this quick diagnostic:

```bash
# 1. Check overall health
curl -f http://localhost:3000/api/v1/health

# 2. Check MCP status
curl -f http://localhost:3000/api/v1/health/mcp

# 3. Check logs
docker logs mcp-hybrid-server --tail 50

# 4. Check resource usage
docker stats mcp-hybrid-server

# 5. Check AWS connectivity
aws sts get-caller-identity
```

## Common Issues

### Issue: Application Won't Start

#### Symptoms
- Container exits immediately
- "Module not found" errors
- Port binding failures

#### Diagnosis
```bash
# Check container logs
docker logs mcp-hybrid-server

# Check port availability
netstat -tulpn | grep :3000
lsof -i :3000

# Verify environment variables
docker exec mcp-hybrid-server env | grep -E "(NODE_ENV|AWS_|MCP_)"
```

#### Solutions

1. **Missing Dependencies:**
```bash
# Rebuild with clean install
docker build --no-cache -t mcp-hybrid-server .
```

2. **Port Conflicts:**
```bash
# Change port in environment
export PORT=3001
# Or kill conflicting process
sudo kill $(lsof -ti:3000)
```

3. **Invalid Configuration:**
```bash
# Validate environment file
cat .env | grep -v "^#" | grep -v "^$"
# Check for missing required variables
./scripts/validate-config.sh
```

### Issue: AWS Service Connection Failures

#### Symptoms
- "Unable to locate credentials" errors
- AWS API timeouts
- DynamoDB/S3 access denied

#### Diagnosis
```bash
# Test AWS credentials
aws sts get-caller-identity
aws configure list

# Test specific services
aws dynamodb list-tables
aws s3 ls
aws bedrock list-foundation-models

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
  --action-names dynamodb:GetItem,s3:GetObject,bedrock:InvokeModel \
  --resource-arns "*"
```

#### Solutions

1. **Credential Issues:**
```bash
# Configure AWS credentials
aws configure
# Or use environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_REGION=us-east-1
```

2. **IAM Permission Issues:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

3. **Network Connectivity:**
```bash
# Test AWS endpoints
curl -I https://dynamodb.us-east-1.amazonaws.com
curl -I https://s3.us-east-1.amazonaws.com
```

### Issue: MCP Connection Problems

#### Symptoms
- MCP clients can't connect
- "Connection refused" errors
- MCP server not responding

#### Diagnosis
```bash
# Check MCP server status
curl http://localhost:3000/api/v1/health/mcp

# Test MCP endpoint directly
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# Check MCP client connections
curl http://localhost:3000/api/v1/health/mcp/connections

# Validate MCP configuration
./scripts/mcp-config.sh validate
```

#### Solutions

1. **MCP Server Not Running:**
```bash
# Check MCP server configuration
cat .env | grep MCP_SERVER
# Enable MCP server
export MCP_SERVER_ENABLED=true
```

2. **Connection Configuration Issues:**
```bash
# Reset MCP configuration
./scripts/mcp-config.sh init
# Add test server
./scripts/mcp-config.sh add filesystem "Test FS"
```

3. **Network Issues:**
```bash
# Check firewall rules
sudo ufw status
# Test internal connectivity
telnet localhost 3000
```

### Issue: High Memory Usage

#### Symptoms
- Container OOM kills
- Slow response times
- Memory usage constantly increasing

#### Diagnosis
```bash
# Monitor memory usage
docker stats mcp-hybrid-server

# Check heap dumps
docker exec mcp-hybrid-server ls -la /tmp/*.heapsnapshot

# Analyze memory usage
docker exec mcp-hybrid-server cat /proc/meminfo
docker exec mcp-hybrid-server ps aux --sort=-%mem | head
```

#### Solutions

1. **Memory Leaks:**
```bash
# Generate heap dump
docker exec mcp-hybrid-server kill -USR2 $(docker exec mcp-hybrid-server pgrep node)
# Analyze with tools like clinic.js or node --inspect
```

2. **Increase Memory Limits:**
```yaml
# docker-compose.yml
services:
  mcp-hybrid-server:
    deploy:
      resources:
        limits:
          memory: 4G
```

3. **Optimize Configuration:**
```bash
# Reduce cache sizes
export MCP_TOOLS_CACHE_TIMEOUT=60000  # 1 minute instead of 5
export MEMORY_DEFAULT_MAX_RESULTS=5   # Reduce from 10
```

### Issue: Workflow Execution Failures

#### Symptoms
- Workflows stuck in "running" state
- Agent execution timeouts
- Tool execution failures

#### Diagnosis
```bash
# Check workflow status
curl http://localhost:3000/api/v1/workflows

# Get specific workflow details
curl http://localhost:3000/api/v1/workflows/{workflow-id}

# Check tool metrics
curl http://localhost:3000/api/v1/tools/code_analysis/metrics

# Examine logs for specific workflow
docker logs mcp-hybrid-server 2>&1 | grep "workflow_123"
```

#### Solutions

1. **Timeout Issues:**
```bash
# Increase timeouts
export WORKFLOW_MAX_EXECUTION_TIME=7200000  # 2 hours
export MCP_MAX_TOOL_EXECUTION_TIME=600000   # 10 minutes
```

2. **Resource Constraints:**
```bash
# Check available resources
free -h
df -h
# Reduce concurrent executions
export TOOLS_MAX_CONCURRENT=5
```

3. **State Recovery:**
```bash
# Resume failed workflow
curl -X POST http://localhost:3000/api/v1/workflows/{workflow-id}/resume
```

## Diagnostic Tools

### Health Check Endpoints

```bash
# Basic health check
curl http://localhost:3000/api/v1/health

# Detailed health information
curl http://localhost:3000/api/v1/health/detailed

# Component-specific health
curl http://localhost:3000/api/v1/health/database
curl http://localhost:3000/api/v1/health/bedrock
curl http://localhost:3000/api/v1/health/memory
```

### Log Analysis

#### Application Logs
```bash
# Real-time logs
docker logs -f mcp-hybrid-server

# Filtered logs
docker logs mcp-hybrid-server 2>&1 | grep ERROR
docker logs mcp-hybrid-server 2>&1 | grep -i "workflow"

# Log levels
docker logs mcp-hybrid-server 2>&1 | grep -E "(ERROR|WARN|INFO)"

# Structured log analysis
docker logs mcp-hybrid-server 2>&1 | jq 'select(.level == "error")'
```

#### AWS CloudWatch Logs
```bash
# Query CloudWatch logs
aws logs start-query \
  --log-group-name "/ecs/mcp-hybrid-server-prod" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string '
    fields @timestamp, @message, level
    | filter level = "ERROR"
    | sort @timestamp desc
    | limit 20
  '

# Get query results
aws logs get-query-results --query-id <query-id>
```

### Performance Monitoring

#### Resource Usage
```bash
# CPU and memory usage
docker stats mcp-hybrid-server --no-stream

# Detailed process information
docker exec mcp-hybrid-server ps aux
docker exec mcp-hybrid-server top -n 1

# Disk usage
docker exec mcp-hybrid-server df -h
docker system df
```

#### Application Metrics
```bash
# Tool execution metrics
curl http://localhost:3000/api/v1/tools/metrics

# Workflow statistics
curl http://localhost:3000/api/v1/workflows/statistics

# Memory usage statistics
curl http://localhost:3000/api/v1/memory/statistics
```

### Network Diagnostics

```bash
# Test connectivity
curl -I http://localhost:3000/api/v1/health
wget --spider http://localhost:3000/api/v1/health

# Check open ports
netstat -tulpn | grep 3000
ss -tulpn | grep 3000

# DNS resolution
nslookup dynamodb.us-east-1.amazonaws.com
dig s3.amazonaws.com

# Network latency
ping -c 4 dynamodb.us-east-1.amazonaws.com
```

## Configuration Issues

### Environment Variable Problems

#### Missing Required Variables
```bash
#!/bin/bash
# scripts/check-env-vars.sh

REQUIRED_VARS=(
  "NODE_ENV"
  "AWS_REGION"
  "DYNAMODB_METADATA_TABLE"
  "DYNAMODB_WORKFLOW_STATE_TABLE"
  "AWS_S3_BUCKET"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: Missing required environment variable: $var"
    exit 1
  fi
done

echo "All required environment variables are set"
```

#### Invalid Configuration Values
```bash
# Validate configuration format
./scripts/validate-config.sh

# Check specific values
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "ERROR: Invalid PORT value: $PORT"
fi

if [[ ! "$AWS_REGION" =~ ^[a-z0-9-]+$ ]]; then
  echo "ERROR: Invalid AWS_REGION format: $AWS_REGION"
fi
```

### MCP Configuration Issues

#### Server Configuration
```bash
# Validate MCP server config
cat .env | grep MCP_SERVER

# Test MCP endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

#### Client Configuration
```bash
# Validate MCP client config file
cat .mcp/servers.json | jq '.'

# Test MCP client connections
./scripts/mcp-config.sh test filesystem-123456
```

## Performance Issues

### Slow Response Times

#### Diagnosis
```bash
# Measure response times
time curl -s http://localhost:3000/api/v1/health > /dev/null

# Profile specific endpoints
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3000/api/v1/tools

# Check database performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name SuccessfulRequestLatency \
  --dimensions Name=TableName,Value=MCPMetadata-prod \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

#### Solutions

1. **Enable Caching:**
```bash
export MCP_TOOLS_ENABLE_CACHING=true
export TOOLS_CACHE_TIMEOUT=300000  # 5 minutes
```

2. **Optimize Database Queries:**
```bash
# Check DynamoDB throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=MCPMetadata-prod
```

3. **Scale Resources:**
```bash
# Increase container resources
docker update --memory=4g --cpus=2 mcp-hybrid-server
```

### High CPU Usage

#### Diagnosis
```bash
# Monitor CPU usage
docker stats mcp-hybrid-server

# Profile CPU usage
docker exec mcp-hybrid-server cat /proc/loadavg
docker exec mcp-hybrid-server vmstat 1 5

# Check for CPU-intensive processes
docker exec mcp-hybrid-server ps aux --sort=-%cpu | head
```

#### Solutions

1. **Reduce Concurrent Operations:**
```bash
export TOOLS_MAX_CONCURRENT=5
export WORKFLOW_MAX_EXECUTION_TIME=300000
```

2. **Optimize Algorithms:**
- Review tool implementations for efficiency
- Implement result caching
- Use streaming where possible

### Memory Issues

#### Diagnosis
```bash
# Memory usage analysis
docker exec mcp-hybrid-server cat /proc/meminfo
docker exec mcp-hybrid-server free -h

# Check for memory leaks
docker stats mcp-hybrid-server --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

#### Solutions

1. **Increase Memory Limits:**
```yaml
# docker-compose.yml
deploy:
  resources:
    limits:
      memory: 8G
```

2. **Optimize Memory Usage:**
```bash
# Enable garbage collection logging
export NODE_OPTIONS="--max-old-space-size=4096 --gc-stats"
```

## Network and Connectivity

### Connection Timeouts

#### AWS Service Timeouts
```bash
# Test AWS service connectivity
aws dynamodb describe-table --table-name MCPMetadata-prod
aws s3 ls s3://your-bucket-name
aws bedrock list-foundation-models

# Check network latency
ping -c 10 dynamodb.us-east-1.amazonaws.com
```

#### Solutions
```bash
# Increase timeouts
export AWS_CLI_READ_TIMEOUT=120
export AWS_CLI_CONNECT_TIMEOUT=60

# Configure retries
export AWS_MAX_ATTEMPTS=3
```

### DNS Resolution Issues

#### Diagnosis
```bash
# Test DNS resolution
nslookup dynamodb.us-east-1.amazonaws.com
dig @8.8.8.8 s3.amazonaws.com

# Check DNS configuration
cat /etc/resolv.conf
```

#### Solutions
```bash
# Use alternative DNS servers
echo "nameserver 8.8.8.8" >> /etc/resolv.conf
echo "nameserver 1.1.1.1" >> /etc/resolv.conf
```

### Firewall Issues

#### Diagnosis
```bash
# Check firewall status
sudo ufw status
sudo iptables -L

# Test port accessibility
telnet localhost 3000
nc -zv localhost 3000
```

#### Solutions
```bash
# Open required ports
sudo ufw allow 3000/tcp
sudo ufw allow out 443/tcp  # HTTPS to AWS
sudo ufw allow out 80/tcp   # HTTP
```

## AWS Service Issues

### DynamoDB Issues

#### Throttling
```bash
# Check throttling metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=MCPMetadata-prod \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

#### Solutions
```bash
# Increase capacity
aws dynamodb update-table \
  --table-name MCPMetadata-prod \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100

# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/MCPMetadata-prod \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 \
  --max-capacity 1000
```

### S3 Issues

#### Access Denied
```bash
# Test S3 access
aws s3 ls s3://your-bucket-name
aws s3api head-bucket --bucket your-bucket-name

# Check bucket policy
aws s3api get-bucket-policy --bucket your-bucket-name
```

#### Solutions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::ACCOUNT:role/mcp-task-role"},
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### Bedrock Issues

#### Model Access
```bash
# List available models
aws bedrock list-foundation-models

# Test model access
aws bedrock invoke-model \
  --model-id anthropic.claude-3-sonnet-20240229-v1:0 \
  --content-type application/json \
  --body '{"prompt": "Hello", "max_tokens": 10}' \
  /tmp/response.json
```

#### Solutions
```bash
# Request model access in AWS Console
# Check service quotas
aws service-quotas get-service-quota \
  --service-code bedrock \
  --quota-code L-12345678
```

## MCP Protocol Issues

### Connection Problems

#### Client Connection Failures
```bash
# Test MCP server endpoint
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'

# Validate MCP message format
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | \
  jq '.' > /dev/null && echo "Valid JSON" || echo "Invalid JSON"
```

#### Server Response Issues
```bash
# Check MCP server logs
docker logs mcp-hybrid-server 2>&1 | grep -i mcp

# Validate server responses
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.'
```

### Protocol Version Mismatch

#### Diagnosis
```bash
# Check supported protocol version
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}' | \
  jq '.result.protocolVersion'
```

#### Solutions
```bash
# Update protocol version
export MCP_PROTOCOL_VERSION=2024-11-05

# Check client compatibility
./scripts/mcp-config.sh validate
```

## Application Errors

### Tool Execution Failures

#### Diagnosis
```bash
# Check tool registry
curl http://localhost:3000/api/v1/tools

# Test specific tool
curl -X POST http://localhost:3000/api/v1/tools/code_analysis/execute \
  -H "Content-Type: application/json" \
  -d '{"parameters":{"filePath":"/tmp/test.js"}}'

# Check tool metrics
curl http://localhost:3000/api/v1/tools/code_analysis/metrics
```

#### Solutions
```bash
# Reset tool registry
docker restart mcp-hybrid-server

# Check tool dependencies
docker exec mcp-hybrid-server npm list
```

### Agent Failures

#### Diagnosis
```bash
# Check agent status
curl http://localhost:3000/api/v1/agents/code-analyzer/status

# Test agent execution
curl -X POST http://localhost:3000/api/v1/agents/code-analyzer/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test prompt","context":{}}'
```

#### Solutions
```bash
# Check Bedrock connectivity
aws bedrock list-foundation-models

# Verify model access
export AWS_BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

### Workflow State Issues

#### Corrupted State
```bash
# Check workflow state
aws dynamodb get-item \
  --table-name MCPWorkflowState-prod \
  --key '{"workflowId":{"S":"workflow_123"}}'

# List stuck workflows
curl http://localhost:3000/api/v1/workflows?status=running
```

#### Solutions
```bash
# Reset workflow state
aws dynamodb delete-item \
  --table-name MCPWorkflowState-prod \
  --key '{"workflowId":{"S":"workflow_123"}}'

# Cancel stuck workflows
curl -X DELETE http://localhost:3000/api/v1/workflows/workflow_123
```

## Monitoring and Debugging

### Enable Debug Logging

```bash
# Application debug mode
export LOG_LEVEL=debug
export MCP_ENABLE_LOGGING=true
export MCP_LOG_LEVEL=debug

# Node.js debugging
export NODE_OPTIONS="--inspect=0.0.0.0:9229"

# Restart with debug flags
docker run --rm -p 3000:3000 -p 9229:9229 \
  -e LOG_LEVEL=debug \
  -e NODE_OPTIONS="--inspect=0.0.0.0:9229" \
  mcp-hybrid-server
```

### Performance Profiling

```bash
# CPU profiling
docker exec mcp-hybrid-server node --prof app.js

# Memory profiling
docker exec mcp-hybrid-server node --inspect --max-old-space-size=4096 app.js

# Heap snapshots
docker exec mcp-hybrid-server kill -USR2 $(pgrep node)
```

### Real-time Monitoring

```bash
# Monitor logs in real-time
docker logs -f mcp-hybrid-server | grep -E "(ERROR|WARN)"

# Monitor resource usage
watch -n 1 'docker stats mcp-hybrid-server --no-stream'

# Monitor API responses
watch -n 5 'curl -s -w "%{http_code} %{time_total}\n" -o /dev/null http://localhost:3000/api/v1/health'
```

## Recovery Procedures

### Service Recovery

#### Graceful Restart
```bash
# Graceful shutdown
docker kill --signal=SIGTERM mcp-hybrid-server
sleep 30
docker start mcp-hybrid-server
```

#### Force Restart
```bash
# Force restart
docker restart mcp-hybrid-server

# Verify startup
curl -f http://localhost:3000/api/v1/health
```

### Data Recovery

#### Backup Restoration
```bash
# Restore DynamoDB from backup
aws dynamodb restore-table-from-backup \
  --target-table-name MCPMetadata-prod-restored \
  --backup-arn arn:aws:dynamodb:us-east-1:123456789012:table/MCPMetadata-prod/backup/01234567890123-abcdefgh

# Restore S3 from versioning
aws s3api restore-object \
  --bucket your-bucket-name \
  --key path/to/file \
  --version-id version-id
```

#### Configuration Recovery
```bash
# Restore from git
git checkout HEAD -- .env
git checkout HEAD -- .mcp/servers.json

# Regenerate configuration
./scripts/setup-local-dev.sh
./scripts/mcp-config.sh init
```

### Disaster Recovery

#### Secondary Region Failover
```bash
# Switch to secondary region
export AWS_REGION=us-west-2
export DYNAMODB_METADATA_TABLE=MCPMetadata-prod-west
export AWS_S3_BUCKET=mcp-hybrid-server-data-prod-west

# Update DNS records
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://failover-change-batch.json
```

## Support and Escalation

### Information to Collect

Before contacting support, gather:

1. **System Information:**
```bash
# System info
uname -a
docker version
cat /etc/os-release

# Application info
docker images | grep mcp-hybrid-server
docker inspect mcp-hybrid-server | jq '.[0].Config.Env'
```

2. **Error Information:**
```bash
# Recent logs
docker logs --tail 200 mcp-hybrid-server > logs.txt

# Configuration
cat .env > config.txt
cat .mcp/servers.json > mcp-config.txt
```

3. **Performance Data:**
```bash
# Resource usage
docker stats --no-stream mcp-hybrid-server > stats.txt

# Health status
curl http://localhost:3000/api/v1/health > health.json
curl http://localhost:3000/api/v1/health/mcp > mcp-health.json
```

### Support Levels

#### Level 1: Self-Service
- Check this troubleshooting guide
- Review application logs
- Verify configuration
- Test with minimal setup

#### Level 2: Community Support
- GitHub Issues
- Community forums
- Documentation feedback

#### Level 3: Professional Support
- Priority support channel
- Direct contact with development team
- Custom configuration assistance
- Performance optimization guidance

### Escalation Criteria

Escalate to higher support levels when:

1. **Critical System Down:**
   - Application completely unavailable
   - Data loss or corruption
   - Security incidents

2. **Performance Issues:**
   - Response times > 30 seconds
   - Memory usage > 8GB
   - Error rate > 5%

3. **Integration Problems:**
   - AWS service connectivity failures
   - MCP protocol issues
   - Tool execution failures

### Emergency Contacts

```bash
# Emergency procedures
./scripts/emergency-shutdown.sh
./scripts/emergency-backup.sh
./scripts/emergency-notification.sh
```

This troubleshooting guide provides comprehensive procedures for diagnosing and resolving issues in the Bedrock Agent System. Regular maintenance and monitoring help prevent many issues from occurring.