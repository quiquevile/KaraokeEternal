# Karaoke Eternal (quiquevile's fork)

Host awesome karaoke parties where everyone can easily find and queue songs from their phone's browser. The player is also fully browser-based with support for MP3+G, MP4 videos and WebGL visualizations. The server is self-hosted and runs on nearly everything. This fork adds library management, YouTube downloads and granular permissions on top of the original [Karaoke Eternal](https://github.com/bhj/KaraokeEternal/blob/master/README.md).

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
- This fork adds:
  - YouTube downloads straight from the app, with per-user subfolders
  - Granular per-user permissions, queue-for-others included
  - Bilingual interface (English / Español)
  - Admin library tools (retag, rename, delete) with live updates on every client
  - Ten-band equalizer and instant pitch control

Microphones are *not* required since the player itself only outputs music - this allows your audio setup to be as simple or complex as you like. See the [F.A.Q.](https://www.karaoke-eternal.com/faq/#recommended-audio-microphone-setup) for more information.

## Getting Started

Karaoke Eternal basically has 3 parts, plus administration in this fork. See [Getting Started](docs/getting-started.md) to get up and running step-by-step, or jump to the documentation for each part below:

- **[Server:](docs/server.md)** Runs on pretty much anything to serve the web app and your media files, including a Windows PC, Mac, or a dedicated server like a Raspberry Pi or Synology NAS. See [installation](docs/server.md#installation) for Docker and from-source options.
- **[App:](docs/app.md)** Fast, modern mobile web app designed for "karaoke conditions".
- **[Player:](docs/app.md#player)** Just another part of the app, but meant to run fullscreen on the system handling audio/video for a [room](docs/administration.md#rooms).
- **[Administration:](docs/administration.md)** Rooms, users and capabilities, library management, YouTube downloads and everything else that needs an admin account.
