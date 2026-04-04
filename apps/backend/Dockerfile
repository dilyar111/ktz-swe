# Build from repository root: docker compose sets context to `.` and dockerfile to apps/backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
RUN npm ci --omit=dev
WORKDIR /app/apps/backend
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
CMD ["node", "src/server.js"]
