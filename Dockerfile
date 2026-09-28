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
    tini

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/assets ./assets
COPY --from=build /app/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production \
    KES_PORT=8080 \
    KES_PATH_DATA=/config \
    # cap the node heap so it cannot starve ffmpeg/OS inside the container
    NODE_OPTIONS=--max-old-space-size=512 \
    # cap ffmpeg decode threads likewise; override per deployment without
    # rebuilding (local runs without docker are unaffected by both)
    KES_FFMPEG_THREADS=2

EXPOSE 8080

VOLUME ["/config", "/mnt/karaoke"]

ENTRYPOINT ["tini", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]