FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --ignore-scripts --no-audit --no-fund --maxsockets=5
COPY scripts scripts
COPY apps/api apps/api
RUN npm run db:generate && npm run build -w @komek/api
RUN mkdir -p /app/.local && chown node:node /app/.local
ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && exec node apps/api/dist/server.js"]
