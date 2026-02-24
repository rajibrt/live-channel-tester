FROM node:20-alpine AS deps
WORKDIR /app/vercel
COPY vercel/package.json vercel/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app/vercel
COPY --from=deps /app/vercel/node_modules ./node_modules
COPY vercel/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/vercel

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/vercel/package.json ./package.json
COPY --from=builder /app/vercel/package-lock.json ./package-lock.json
RUN npm ci --omit=dev

COPY --from=builder /app/vercel/.next ./.next
COPY --from=builder /app/vercel/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
