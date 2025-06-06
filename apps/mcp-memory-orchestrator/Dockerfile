FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 4100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4100/health || exit 1

# Start the application
CMD ["pnpm", "run", "start:prod"]