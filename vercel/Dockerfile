FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG APP_BUILD_VERSION=""
ENV APP_BUILD_VERSION=${APP_BUILD_VERSION}
ENV NEXT_PUBLIC_BUILD_VERSION=${APP_BUILD_VERSION}
ARG NEXT_PUBLIC_STREAM_ALWAYS_COMPAT_MODE=""
ENV NEXT_PUBLIC_STREAM_ALWAYS_COMPAT_MODE=${NEXT_PUBLIC_STREAM_ALWAYS_COMPAT_MODE}

COPY package*.json ./
RUN npm cache clean --force && npm install --legacy-peer-deps --include=dev

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache ffmpeg

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
