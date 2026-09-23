# Karaoke Eternal (quiquevile's fork)

Host awesome karaoke parties where everyone can easily find and queue songs from their phone's browser — with full library management, YouTube downloads and granular user permissions on top of the base project.

## What's new in this fork

### Library management (admin)
- Edit a song's artist and title from the library or the queue (admin only), with case cycling and artist/title swap.
- Media files are renamed automatically to match (`Artist - Title.ext`, MP3+G sidecars included); clashes are refused without changing anything.
- Delete whole songs or individual versions: the dialog lists every file with its full path, inline audio/video preview and checkboxes, plus a Delete all option with confirmation.
- Deleting removes queue entries in every room; if the playing song is deleted, playback skips ahead, and if the playing version is deleted it restarts with the new current one.
- Everything updates live on all connected clients.

### YouTube downloads
- Dedicated search tab with direct video-URL support and automatic artist/title identification.
- Each downloader gets their own subfolder named after their username.
- Downloads are refused when the song or the file already exists — no duplicates, nothing half-downloaded.
- Download notifications are private to whoever started them (admins see them all).
- Self-contained yt-dlp: it downloads and updates itself in the configured folder, picked per environment (no system Python or yt-dlp needed).

### Permissions
- Granular per-user capabilities instead of a single admin-or-not model: delete/move/restart queue songs, open the player, control playback and download from YouTube.
- Room admins and a managed account editor with roles.

### Player
- Live pitch control in semitones, kept on restart and reset on track change (disabled where unsupported).
- Replay/restart button in the top playback bar.

### Queue
- Move songs around, and delete played or currently-playing songs from the queue.

### Docker
- Ready-to-build image and compose file (`Dockerfile`, `docker-compose.yml`, `docker/entrypoint.sh`).

---

> The original Karaoke Eternal README follows below.

# Karaoke Eternal

Host awesome karaoke parties where everyone can easily find and queue songs from their phone's browser. The player is also fully browser-based with support for MP3+G, MP4 videos and WebGL visualizations. The server is self-hosted and runs on nearly everything.

[![Karaoke Eternal](/docs/assets/images/README.jpg?raw=true)](/docs/assets/images/README.jpg?raw=true)

<p align="center">
  <i>App in mobile browser (top) controlling player in desktop browser (bottom)</i>
</p>

## Features

- Plays:
  - MP3+G (MP3 with CDG lyrics; including zipped)
  - MP4 videos
  - Music-synced visualizations (with automatic lyrics background removal)
- Fast, modern mobile browser app designed for "karaoke conditions"
- Easy joining with QR codes and guest accounts
- Multiple simultaneous rooms/queues (optionally password-protected)
- Dynamic queues keep parties fair, fun and no-fuss
- Fully self-hosted
- No ads or telemetry

Microphones are *not* required since the player itself only outputs music - this allows your audio setup to be as simple or complex as you like. See the [F.A.Q.](https://www.karaoke-eternal.com/faq/#recommended-audio-microphone-setup) for more information.

## Getting Started

 Karaoke Eternal basically has 3 parts. See [Getting Started](https://www.karaoke-eternal.com/docs/getting-started/) to get up and running step-by-step, or jump to the documentation for each part below:
 
- **[Server:](https://www.karaoke-eternal.com/docs/karaoke-eternal-server/)** Runs on pretty much anything to serve the web app and your media files, including a Windows PC, Mac, or a dedicated server like a Raspberry Pi or Synology NAS.
- **[App:](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/)** Fast, modern mobile web app designed for "karaoke conditions".
- **[Player:](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/#player)** Just another part of the app, but meant to run fullscreen on the system handling audio/video for a [room](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/#rooms-admin-only)

## Installation

There are several [installation methods](https://www.karaoke-eternal.com/docs/karaoke-eternal-server/#installation) available for Karaoke Eternal Server.

## Discord & Support

Join the [Karaoke Eternal Discord Server](https://discord.gg/PgqVtFq) for general support and development chat, or just to say hi!

## Contributing & Development

Contributions are welcome! Please join the `#dev` channel of the [Discord Server](https://discord.gg/PgqVtFq) before embarking on major features; the project's scope is limited to ensure success.

Make sure you have [Node.js](https://nodejs.org/en/) v24 or later, then:

1. Fork and clone the repo
2. `npm i`
3. `npm run dev` and look for "Web server running at" for the **server URL**
