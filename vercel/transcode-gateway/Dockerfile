FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server.js ./

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["node", "server.js"]
