# Multi-stage build for Node.js application
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Runtime image
FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app .

EXPOSE 3000

CMD ["npm", "start"]