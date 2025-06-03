#!/bin/bash

echo "Setting up MCP Dashboard..."

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local from example..."
    cp .env.local.example .env.local
    echo "Please edit .env.local and add your OpenAI API key and MCP server URL"
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local and configure your environment variables"
echo "2. Make sure your MCP hybrid server is running"
echo "3. Run 'pnpm dev' to start the dashboard"
echo ""
echo "The dashboard will be available at http://localhost:3000"