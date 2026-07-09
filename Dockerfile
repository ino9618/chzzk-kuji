# chzzk-kuji — CHZZK donation-linked ichiban-kuji board
# Works on Render/Railway/Fly or any Docker host. All state lives in the
# Postgres pointed to by DATABASE_URL (e.g. Supabase), so the container is
# fully stateless — no volume needed.

FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
