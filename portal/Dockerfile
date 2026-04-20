FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install --omit=optional

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S hee && adduser -S hee -G hee

# Next.js `output: "standalone"` bundles only what's needed.
COPY --from=build --chown=hee:hee /app/.next/standalone ./
COPY --from=build --chown=hee:hee /app/.next/static ./.next/static
COPY --from=build --chown=hee:hee /app/public ./public

USER hee
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
