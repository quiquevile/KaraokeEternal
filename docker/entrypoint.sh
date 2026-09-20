#!/bin/sh
set -e

# keep yt-dlp independent from the image so it can be updated in place
# (standalone binary lives on a persistent volume, which stays writable for
# the container user, unlike a pip install in the image)
export KES_YTDL_BIN="${KES_YTDL_BIN:-${KES_PATH_DATA}/bin/yt-dlp}"

BIN_DIR="$(dirname "$KES_YTDL_BIN")"

mkdir -p "$BIN_DIR"

if [ ! -x "$KES_YTDL_BIN" ]; then
  echo "Downloading yt-dlp to $KES_YTDL_BIN..."
  curl -fL --retry 3 --retry-delay 2 -o "$KES_YTDL_BIN" \
    https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
  chmod +x "$KES_YTDL_BIN"
fi

if [ -n "${PUID:-}" ] && [ -n "${PGID:-}" ]; then
  chown -R "$PUID:$PGID" "$BIN_DIR"
fi

exec node build/server/main.js "$@"