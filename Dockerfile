# multistage Dockerfile for Basma app with system ffmpeg installed

# Stage 1: build
FROM node:18-bullseye AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: production image
FROM node:18-bullseye-slim

# Install system ffmpeg
RUN apt-get update && apt-get install -y ffmpeg ca-certificates --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production

# Copy build artifacts
COPY --from=builder /usr/src/app/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server.cjs"]
