# HK-018 — telemetry simulator (uses root lockfile + workspace hoisting)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
RUN npm ci --omit=dev
WORKDIR /app/apps/simulator
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
