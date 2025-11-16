# Multi-stage build for Node.js application
FROM node:20-alpine as builder

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@8.5.0 --activate && pnpm install --prod

COPY . .

# Runtime image
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app .

EXPOSE 3000

CMD ["npm", "start"]