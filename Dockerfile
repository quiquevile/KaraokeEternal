# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    tini \
  && pip3 install --break-system-packages --no-cache-dir yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/assets ./assets

ENV NODE_ENV=production \
    KES_PORT=8080 \
    KES_PATH_DATA=/config

EXPOSE 8080

VOLUME ["/config", "/mnt/karaoke"]

ENTRYPOINT ["tini", "--"]
CMD ["node", "build/server/main.js"]