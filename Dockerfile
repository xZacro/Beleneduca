FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV FNI_SERVE_STATIC=true
ENV FNI_STATIC_DIR=dist
ENV FNI_API_PORT=4100

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/shared/fni/schema ./src/shared/fni/schema

EXPOSE 4100

CMD ["node", "server/api-server.mjs"]
