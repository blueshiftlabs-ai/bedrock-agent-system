#!/bin/bash

# Setup script for local Gremlin Server development
# This creates a local Gremlin Server instance for Neptune development

echo "🔗 Setting up local Gremlin Server for Neptune development..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed. Please install Docker first."
    exit 1
fi

# Configuration
GREMLIN_VERSION="3.7.0"
CONTAINER_NAME="mcp-memory-gremlin"
GREMLIN_PORT=8182

# Stop and remove existing container if it exists
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "🛑 Stopping existing Gremlin container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# Create Docker network if it doesn't exist
if ! docker network ls | grep -q "mcp-network"; then
    echo "🌐 Creating Docker network..."
    docker network create mcp-network
fi

# Create Gremlin configuration directory
GREMLIN_CONFIG_DIR="./gremlin-config"
mkdir -p $GREMLIN_CONFIG_DIR

# Create custom Gremlin server configuration
cat > $GREMLIN_CONFIG_DIR/gremlin-server.yaml << EOF
host: 0.0.0.0
port: 8182
channelizer: org.apache.tinkerpop.gremlin.server.channel.WebSocketChannelizer
graphs: {
  graph: conf/neptune-inmemory.properties
}
scriptEngines: {
  gremlin-groovy: {
    plugins: { 
      org.apache.tinkerpop.gremlin.server.jsr223.GremlinServerGremlinPlugin: {},
      org.apache.tinkerpop.gremlin.tinkergraph.jsr223.TinkerGraphGremlinPlugin: {},
      org.apache.tinkerpop.gremlin.jsr223.ImportGremlinPlugin: {
        classImports: [java.lang.Math],
        methodImports: [java.lang.Math#*]
      },
      org.apache.tinkerpop.gremlin.jsr223.ScriptFileGremlinPlugin: {
        files: [scripts/empty-sample.groovy]
      }
    }
  }
}
serializers:
  - { className: org.apache.tinkerpop.gremlin.driver.ser.GraphSONMessageSerializerV3d0, config: { ioRegistries: [org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerIoRegistryV3d0] }}
  - { className: org.apache.tinkerpop.gremlin.driver.ser.GraphBinaryMessageSerializerV1 }
processors:
  - { className: org.apache.tinkerpop.gremlin.server.op.session.SessionOpProcessor, config: { sessionTimeout: 28800000 }}
  - { className: org.apache.tinkerpop.gremlin.server.op.standard.StandardOpProcessor, config: {}}
metrics: {
  consoleReporter: {enabled: true, interval: 180000},
  csvReporter: {enabled: true, interval: 180000, fileName: /tmp/gremlin-server-metrics.csv},
  jmxReporter: {enabled: true},
  slf4jReporter: {enabled: true, interval: 180000},
  gangliaReporter: {enabled: false, interval: 180000, addressingMode: MULTICAST},
  graphiteReporter: {enabled: false, interval: 180000}
}
maxInitialLineLength: 4096
maxHeaderSize: 8192
maxChunkSize: 8192
maxContentLength: 65536
maxAccumulationBufferComponents: 1024
resultIterationBatchSize: 64
writeBufferLowWaterMark: 32768
writeBufferHighWaterMark: 65536
ssl: {
  enabled: false
}
EOF

# Create Neptune-like graph configuration
cat > $GREMLIN_CONFIG_DIR/neptune-inmemory.properties << EOF
gremlin.graph=org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
gremlin.tinkergraph.vertexIdManager=LONG
gremlin.tinkergraph.edgeIdManager=LONG
gremlin.tinkergraph.vertexPropertyIdManager=LONG
EOF

# Create initialization script
cat > $GREMLIN_CONFIG_DIR/empty-sample.groovy << EOF
// Memory Graph Schema Initialization
// This script runs when Gremlin Server starts

// Create some sample schema (optional for TinkerGraph)
// TinkerGraph is schemaless, but we can add sample data for testing

// Sample memory node
// graph.addVertex(T.label, "Memory", "memory_id", "test_memory_1", "type", "semantic")

// Log initialization
println "Memory Graph Schema Initialized"
EOF

# Start Gremlin Server container
echo "🚀 Starting Gremlin Server container..."
docker run -d \
  --name $CONTAINER_NAME \
  --network mcp-network \
  -p $GREMLIN_PORT:8182 \
  -v "$(pwd)/$GREMLIN_CONFIG_DIR:/opt/gremlin-server/conf/custom" \
  -e GREMLIN_YAML=/opt/gremlin-server/conf/custom/gremlin-server.yaml \
  tinkerpop/gremlin-server:$GREMLIN_VERSION

# Wait for Gremlin Server to be ready
echo "⏳ Waiting for Gremlin Server to be ready..."
sleep 15

# Check if Gremlin Server is running
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker logs $CONTAINER_NAME 2>&1 | grep -q "Gremlin Server configured with"; then
        echo "✅ Gremlin Server is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "⏳ Waiting for Gremlin Server to start... (attempt $attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Gremlin Server failed to start. Check Docker logs:"
    echo "docker logs $CONTAINER_NAME"
    exit 1
fi

# Test the connection
echo ""
echo "🧪 Testing Gremlin connection..."
if command -v curl &> /dev/null; then
    # Test WebSocket connection (this will fail with curl, but shows the port is open)
    if curl -s --connect-timeout 5 http://localhost:$GREMLIN_PORT > /dev/null; then
        echo "✅ Gremlin Server port is accessible"
    else
        echo "⚠️  Could not test connection with curl (normal for WebSocket)"
    fi
fi

echo ""
echo ""
echo "✅ Gremlin Server setup complete!"
echo ""
echo "📝 Connection details:"
echo "  - Gremlin Server URL: ws://localhost:$GREMLIN_PORT/gremlin"
echo "  - Container name: $CONTAINER_NAME"
echo "  - Configuration: $GREMLIN_CONFIG_DIR/"
echo ""
echo "🛠️  Useful commands:"
echo "  - View logs: docker logs -f $CONTAINER_NAME"
echo "  - Stop Gremlin: docker stop $CONTAINER_NAME"
echo "  - Start Gremlin: docker start $CONTAINER_NAME"
echo "  - Remove Gremlin: docker rm $CONTAINER_NAME"
echo ""
echo "🔍 Test with Gremlin Console:"
echo "  docker exec -it $CONTAINER_NAME bin/gremlin.sh"
echo "  :remote connect tinkerpop.server conf/remote.yaml"
echo "  :remote console"
echo "  g.V().count()"
echo ""
echo "🌐 Memory Server Environment Variable:"
echo "  NEPTUNE_ENDPOINT=ws://localhost:$GREMLIN_PORT/gremlin"
echo ""