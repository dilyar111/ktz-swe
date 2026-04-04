# HK-018 — production preview build (nginx). API/WebSocket URLs are baked at build time for the browser (localhost).
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
RUN npm ci
ARG VITE_API_URL=http://localhost:5000
ARG VITE_WS_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build -w @ktz/frontend

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
