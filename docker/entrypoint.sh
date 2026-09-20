#!/bin/sh
set -e

# the managed yt-dlp folder: the server provisions a self-contained musl
# binary there on first use, so it stays updateable in place and the image
# is completely independent of yt-dlp
export KES_YTDL_DIR="${KES_YTDL_DIR:-${KES_PATH_DATA}/bin}"

mkdir -p "$KES_YTDL_DIR"

if [ -n "${PUID:-}" ] && [ -n "${PGID:-}" ]; then
  chown -R "$PUID:$PGID" "$KES_YTDL_DIR"
fi

exec node build/server/main.js "$@"