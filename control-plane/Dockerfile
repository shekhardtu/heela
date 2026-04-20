FROM node:22-alpine AS build
WORKDIR /app

# Install deps first for better layer caching.
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm ci --omit=dev || npm install --omit=dev
RUN npm install --no-save typescript @nestjs/cli

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npx nest build

# ── Runtime image ────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Non-root user for the runtime
RUN addgroup -S hee && adduser -S hee -G hee

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

USER hee
EXPOSE 5301

CMD ["node", "dist/main.js"]
