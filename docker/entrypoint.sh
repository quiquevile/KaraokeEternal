#!/bin/sh
set -e

# keep yt-dlp independent from the image so it can be updated in place:
# a musl standalone binary (embeds its own Python) lives on a persistent
# volume, writable for the container user, unlike a pip install in the image
export KES_YTDL_BIN="${KES_YTDL_BIN:-${KES_PATH_DATA}/bin/yt-dlp}"

BIN_DIR="$(dirname "$KES_YTDL_BIN")"

mkdir -p "$BIN_DIR"

if [ ! -x "$KES_YTDL_BIN" ]; then
  case "$(uname -m)" in
    aarch64|arm64) ASSET="yt-dlp_musllinux_aarch64" ;;
    x86_64|amd64)  ASSET="yt-dlp_musllinux" ;;
    *)
      echo "Unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac

  echo "Downloading yt-dlp ($ASSET) to $KES_YTDL_BIN..."
  curl -fL --retry 3 --retry-delay 2 -o "$KES_YTDL_BIN" \
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$ASSET"
  chmod +x "$KES_YTDL_BIN"
fi

if [ -n "${PUID:-}" ] && [ -n "${PGID:-}" ]; then
  chown -R "$PUID:$PGID" "$BIN_DIR"
fi

exec node build/server/main.js "$@"