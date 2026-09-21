# Build context is the repo root (see docker-compose.yml). The image mirrors
# the monorepo layout — /app/proto, /app/services/<name> — so the same
# relative path in proto-path.ts resolves in Docker exactly as it does
# in local dev.
FROM node:20-alpine AS build
WORKDIR /app
COPY proto ./proto
COPY services/users-service ./services/users-service
WORKDIR /app/services/users-service
RUN npm install
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY proto ./proto
COPY --from=build /app/services/users-service/package*.json ./services/users-service/
WORKDIR /app/services/users-service
RUN npm install --omit=dev
COPY --from=build /app/services/users-service/dist ./dist

EXPOSE 50051 3001
CMD ["node", "dist/main.js"]
