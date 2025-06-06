-- Memory Database Initialization Script
-- Creates tables for GenAI Toolbox MCP Server

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Memory metadata table
CREATE TABLE IF NOT EXISTS memory_metadata (
    id VARCHAR(255) PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64),
    type VARCHAR(50) NOT NULL CHECK (type IN ('episodic', 'semantic', 'procedural', 'working')),
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'code')),
    agent_id VARCHAR(255),
    session_id VARCHAR(255),
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE -- For working memory TTL
);

-- Session management table
CREATE TABLE IF NOT EXISTS session_metadata (
    id VARCHAR(255) PRIMARY KEY,
    agent_id VARCHAR(255),
    context JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired'))
);

-- Agent profiles table
CREATE TABLE IF NOT EXISTS agent_profiles (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    capabilities JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Memory connections table (for explicit relationships)
CREATE TABLE IF NOT EXISTS memory_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_memory_id VARCHAR(255) REFERENCES memory_metadata(id) ON DELETE CASCADE,
    to_memory_id VARCHAR(255) REFERENCES memory_metadata(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL,
    relationship_properties JSONB DEFAULT '{}'::jsonb,
    bidirectional BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Memory statistics and analytics table
CREATE TABLE IF NOT EXISTS memory_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255),
    memory_count INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    total_content_size BIGINT DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    statistics_data JSONB DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_metadata(type);
CREATE INDEX IF NOT EXISTS idx_memory_agent_id ON memory_metadata(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_session_id ON memory_metadata(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_created_at ON memory_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_tags ON memory_metadata USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memory_metadata ON memory_metadata USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_memory_content_hash ON memory_metadata(content_hash);

CREATE INDEX IF NOT EXISTS idx_session_agent_id ON session_metadata(agent_id);
CREATE INDEX IF NOT EXISTS idx_session_status ON session_metadata(status);
CREATE INDEX IF NOT EXISTS idx_session_last_activity ON session_metadata(last_activity);

CREATE INDEX IF NOT EXISTS idx_connections_from_memory ON memory_connections(from_memory_id);
CREATE INDEX IF NOT EXISTS idx_connections_to_memory ON memory_connections(to_memory_id);
CREATE INDEX IF NOT EXISTS idx_connections_type ON memory_connections(relationship_type);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_memory_metadata_updated_at BEFORE UPDATE ON memory_metadata 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_metadata_updated_at BEFORE UPDATE ON session_metadata 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_profiles_updated_at BEFORE UPDATE ON agent_profiles 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired working memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM memory_metadata 
    WHERE type = 'working' 
    AND expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create some initial data for testing
INSERT INTO agent_profiles (id, name, description, capabilities) VALUES 
('claude-code', 'Claude Code', 'AI assistant for software development', '["coding", "analysis", "memory"]'::jsonb),
('test-agent', 'Test Agent', 'Agent for testing memory operations', '["testing", "memory"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;