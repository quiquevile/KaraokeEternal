# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# compiled unit tests never run inside the image; drop them to keep it lean
RUN npm run build && find build -name '*.test.js' -delete

FROM node:24-alpine

RUN apk add --no-cache \
    ffmpeg \
    tini

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/assets ./assets
COPY --chmod=755 --from=build /app/docker/entrypoint.sh /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production \
    KES_PORT=8080 \
    KES_PATH_DATA=/config \
    # console-only logging: the file transport would resolve under the
    # startup (root) user and fail with EACCES after the PUID/PGID drop;
    # container logs are collected from stdout anyway (local runs without
    # docker keep file logging as before)
    KES_SERVER_LOG_LEVEL=0 \
    KES_SCANNER_LOG_LEVEL=0 \
    # cap the node heap so it cannot starve ffmpeg/OS inside the container
    NODE_OPTIONS=--max-old-space-size=512 \
    # cap ffmpeg decode threads likewise; override per deployment without
    # rebuilding (local runs without docker are unaffected by both)
    KES_FFMPEG_THREADS=2

EXPOSE 8080

VOLUME ["/config", "/mnt/karaoke"]

ENTRYPOINT ["tini", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]