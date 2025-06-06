FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN npm install -g pnpm

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/main.js"]