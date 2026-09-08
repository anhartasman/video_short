# Video Shorts

A YouTube Shorts-style local video streaming web app, plus a utility to copy or move videos between folders.

---

## Features

- **Web Player** — Browse your local videos in a gallery, click to watch in a vertical shorts-style player
- **Playback modes** — Toggle between Continue, Repeat, and Shuffle
- **Video Copier** — Copy or move videos from one folder to another with optional size filtering

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your paths:

```bash
cp .env.example .env
```

```env
# Web player
SHORTS_PATH=./videos
PORT=3000

# Video copier / mover
ORIGIN_PATH=./source
DESTINATION_PATH=./destination
MAX_SIZE_MB=500
```

Both relative and absolute paths are supported.

---

## Commands

| Command | Description |
|---|---|
| `npm start` | Start the web player |
| `npm run copier` | Copy videos (originals kept) |
| `npm run move` | Move videos (deleted from origin after transfer) |

---

## Usage

### Web Player

```bash
npm start
```

Opens the app at `http://localhost:3000`.

**Gallery**
- All videos in `SHORTS_PATH` are shown as a grid of thumbnails
- Hover a card to preview, click to open the player

**Player controls**

| Action | How |
|---|---|
| Play / Pause | Click the video, or `Space` |
| Next video | `↓` / `→` arrow key, or ↓ button |
| Previous video | `↑` / `←` arrow key, or ↑ button |
| Cycle playback mode | Click the mode button (top right), or `M` |
| Seek | Drag the progress bar |
| Back to gallery | Click `← Gallery` or press `Esc` |

**Playback modes**

| Mode | Behavior |
|---|---|
| ▶ Continue | Plays the next video when current ends |
| 🔁 Repeat | Loops the current video |
| 🔀 Shuffle | Picks a random video when current ends |

---

### Video Copier / Mover

```bash
npm run copier   # copy — originals are kept
npm run move     # move — originals are deleted after transfer
```

Both commands read `ORIGIN_PATH`, `DESTINATION_PATH`, and optionally `MAX_SIZE_MB` from `.env`.

1. Scans the origin folder for video files
2. Shows a summary — mode, how many videos, total size, how many will be skipped
3. Asks for confirmation before proceeding
4. Shows a live progress bar as files are transferred

If `MAX_SIZE_MB` is set, files larger than that limit are skipped. Leave it empty to transfer all videos.

> **Note:** `npm run move` uses a fast atomic rename when origin and destination are on the same drive, and falls back to copy + delete automatically when moving across drives.

---

## Supported formats

`.mp4` `.mov` `.avi` `.mkv` `.wmv` `.flv` `.webm` `.m4v` `.mpeg` `.mpg`
