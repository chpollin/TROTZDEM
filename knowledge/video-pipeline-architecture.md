---
title: Video Pipeline Architecture
project:
  name: TROTZDEM
  repository: https://github.com/chpollin/TROTZDEM
method:
  name: Promptotyping
  url: https://dhcraft.org/Promptotyping/
status: draft
created: 2026-10-02
updated: 2026-10-02
language: en
authors: [Christopher Pollin]
generated-with: Claude Code (Claude Opus 5.5)
related: [INDEX.md]
---

# Video Pipeline Architecture

Every music video on the album page is a JavaScript program that paints each frame of the song onto a canvas as a function of time. No image or video model and no prepared footage or graphics are involved. Python prepares the material (vocal separation, lyric alignment, audio analysis) and drives the rendering, a headless browser executes the scene frame by frame, and ffmpeg encodes the frames together with the audio. The code was written by Claude Opus 5.5 in Claude Code, one agent per song. The code lives in `video/`, and [video/README.md](../video/README.md) carries the commands.

## Data flow

```
Suno playlist API ──► source/audio.wav, lyrics.txt, meta.json, cover.jpeg
        │
        ▼
vocal separation (BS-RoFormer) ──► vocals.wav, instrumental.wav
        │
        ├─► lyric alignment + free transcription (Whisper large-v3 via stable-ts)
        ├─► vocal phrase starts, tempo windows
        └─► analyze.py ──► analysis.js (loudness, onset strength, onsets, vocal loudness)
        │
        ▼
source/timing-report.md ──► timeline.js (sections and line onsets, written by the agent)
        │
        ▼
scene.js  drawScene(ctx, t)   ◄── fonts (Redaction, Space Mono)
        │
        ▼
player.html?song=<slug>&render=1 in headless Chromium (Playwright)
        │  renderFrame(t) → PNG
        ▼
ffmpeg libx264, parallel segments ──► concat ──► mux with audio ──► out/<slug>.mp4
        │
        ▼
build_album.py ──► web encode, poster frame, album.json ──► GitHub release + Pages
```

## Source material

`tools/prepare.py` reads the playlist through Suno's studio API, which answers only with a browser user agent. Audio comes from the public clip video on Suno's CDN, because MP3 and WAV downloads require a logged-in session. Title, Suno style prompt, lyrics and cover are stored in `<slug>/source/`, which is not versioned.

Suno's terms allow public and commercial use only of output downloaded through the official download on a paid plan. Replacing `source/audio.wav` with that download and rendering again is the documented route before any use beyond sharing with friends.

## Preparation

1. Vocal separation with audio-separator and the BS-RoFormer checkpoint `model_bs_roformer_ep_317_sdr_12.9755.ckpt` on the GPU, producing a vocal and an instrumental stem.
2. Forced alignment of the written lyrics against the vocal stem with stable-ts and Whisper large-v3, language German, one segment per sung line.
3. A free transcription of the same stem with word timestamps, which shows what is actually sung where Suno deviated from the written lyrics.
4. Vocal phrase starts from the loudness of the vocal stem.
5. Tempo windows fitted on the onset strength of the instrumental stem, seeded with the BPM from the Suno prompt where it names one.
6. `tools/analyze.py` writes `analysis.js` with loudness and onset strength at 50 frames per second, onset times in seconds and the loudness of the vocal stem.

All results go into `source/timing-report.md`. The aligner tends to stretch the first word of a line backwards into the preceding pause. Line onsets are therefore checked against the free transcription and the phrase starts, and where they disagree the phrase start wins.

## Timeline and scene

`timeline.js` defines `TL` (section boundaries and line onsets), `SCENE_END` and `SCENE_TITLE`. The agent writes it by hand from the timing report, so every onset is a value checked against the report.

`scene.js` exports `drawScene(ctx, t)` on a 1920×1080 canvas. The function is pure, the image depends only on `t`, the timeline and the analysis data. Randomness comes from seeded generators (mulberry32), so a frame renders identically on every run and in every parallel worker. This property is what allows frames to be rendered out of order and in parallel segments.

Each song is staged inside one interface of its own (browser window, terminal, chat, editor, chart), without real brands or product UI. Lyrics are set in Redaction, whose seven damage grades carry decay and restoration across the series, and interface text in Space Mono. Both fonts are vendored under the SIL Open Font License. The accent colour of each video is recorded in `songs.json` and taken over by the album page.

## Player and rendering

`player.html?song=<slug>` loads the song's `analysis.js`, `timeline.js` and `scene.js` and plays the scene live with audio for preview. With `&render=1` it waits for the fonts and exposes `window.renderFrame(t)`, which draws the frame and returns it as a PNG data URL, and `window.sceneReady` or `window.sceneError`.

`tools/render.py` opens this page in headless Chromium through Playwright, splits the song into frame ranges and renders them in a process pool. Each worker pipes its PNGs into ffmpeg (libx264, CRF 16, 30 fps). The segments are concatenated without re-encoding and muxed with the audio into `out/<slug>.mp4`. A page error at any frame aborts the render. `--still` renders single frames for review.

## Publishing

`tools/build_album.py` collects every song with a rendered video into `video/album.json` with title, duration, poster, accent, Suno prompt, display lyrics and the paragraph from `<slug>/making.txt`. With `--release videos` it encodes a smaller web version (CRF 28, AAC 192 kbit/s, faststart) into `web/`, which is uploaded to the GitHub release `videos` with `gh release upload`. The videos are too large for the repository, and release assets answer byte-range requests, so the browser can seek.

The album page is the repository's `index.html`, served by GitHub Pages from `main` at https://chpollin.github.io/TROTZDEM/. It is a no-build page with an ES module (`video/album.js`) and one stylesheet (`video/album.css`). Each song is addressable as `#<slug>`, the accent colour transitions between songs through a registered custom property, and lyrics and Suno prompt sit in collapsed `details` elements.

## Agentic workflow

One build agent per song receives a brief with the timing report, the song's lyrics and prompt, the existing scenes as reference, the resource limits and the delivery items (`scene.js`, `timeline.js`, `making.txt`, a poster time and an accent colour). The agent renders stills at chosen moments, inspects them as contact sheets, revises the scene and renders the full video at the end. A second agent reviewed selected drafts against the lyrics and the timing. The main session checks each delivery against the real file state, publishes it and starts the next song.

Resource limits follow from a near freeze of the workstation when several agents rendered at once and filled the memory. Since then one build agent runs at a time with two render workers, stills are rendered in batches of at most eight, contact sheets stay at 320 px per tile, and two heavy commands never run in parallel.

## Environment

Preparation runs in a separate venv `video/.venv` with CUDA torch, pinned to 2.8 because later torchaudio releases route audio I/O through TorchCodec, which breaks the separation tools on Windows. Installing stable-ts replaces CUDA torch with a CPU build, so torch is reinstalled with `--force-reinstall --no-deps` afterwards. Rendering needs Python with Playwright and Chromium plus ffmpeg on the path. `tools/serve.py` serves `video/` locally with byte ranges, which seeking in a local video requires.
