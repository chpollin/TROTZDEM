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
updated: 2026-10-20
language: en
authors: [Christopher Pollin]
generated-with: Claude Code (Claude Opus 5.5), Codex
related: [INDEX.md, project.md]
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

`tools/prepare.py` reads the playlist through Suno's studio API, which answers only with a browser user agent. Audio comes from the public clip video on Suno's CDN, because MP3 and WAV downloads require a logged-in session. Title, Suno style prompt, lyrics and cover are stored in `<slug>/source/`, which is not versioned. For a song outside the playlist, `tools/prepare_local.py <slug>` starts from `<slug>/source/audio.wav` and an optional `lyrics.txt` and runs the same preparation.

The rights situation of the Suno audio is described in [project.md](project.md).

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

Songs mix German and English. The alignment runs in German by default, so English lines are checked in short windows with Whisper set to English. Spoken lines and whispered thinking tokens are timed from the vocal loudness where Whisper fails. An offscreen canvas that draws text, such as a tile repeated across the frame, is built on first use and cached, because `scene.js` loads before the player has resolved the fonts and an early tile would carry a fallback font.

## Player and rendering

`player.html?song=<slug>` loads the song's `analysis.js`, `timeline.js` and `scene.js` and plays the scene live with audio for preview. With `&render=1` it waits for the fonts and exposes `window.renderFrame(t)`, which draws the frame and returns it as a PNG data URL, and `window.sceneReady` or `window.sceneError`.

`tools/render.py` opens this page in headless Chromium through Playwright, splits the song into frame ranges and renders them in a process pool. Each worker pipes its PNGs into ffmpeg (libx264, CRF 16, 30 fps). The segments are concatenated without re-encoding and muxed with the audio into `out/<slug>.mp4`. A page error at any frame aborts the render. `--still` renders single frames for review.

## Publishing

`tools/build_album.py` collects every song with a rendered video into `video/album.json` with title, duration, poster, accent, Suno prompt, display lyrics, the paragraph from `<slug>/making.txt` and an optional context note (`note` in `songs.json`). By default it points the page at the release `videos` and encodes a smaller web version (CRF 28, AAC 192 kbit/s, faststart) into `web/`, which is uploaded to the GitHub release `videos` with `gh release upload`. Interrupted encodes and renders are written to `*.part` files and only replace the target on success. `--local` points the page at the local renders for a preview and is never committed. It also writes a small thumbnail per song into `posters/thumbs/` for the track list, and an optional `title` in `songs.json` replaces the title from Suno. The videos are too large for the repository, and release assets answer byte-range requests, so the browser can seek.

The album page is the repository's `index.html`, served by GitHub Pages from `main` at https://chpollin.github.io/TROTZDEM/. The workflow `.github/workflows/pages.yml` publishes only the reader-facing files and leaves `knowledge/`, `CLAUDE.md`, the READMEs, `video/tools/`, Python and Node scripts and the local production preview with its working files (`preview.*`, `cue-sheet.json`, `source-manifest.json`, `style-prompt.txt`, `lyrics.srt`) out of the published tree. It is a no-build page with an ES module (`video/album.js`) and one stylesheet (`video/album.css`). Each song is addressable as `#<slug>`, the accent colour transitions between songs through a registered custom property, and lyrics and Suno prompt sit in collapsed `details` elements. For each song `build_album.py` also writes `video/live/<slug>.json` with the loudness envelope at 10 Hz and the onset of every sung line from `source/align.json`. The page loads it while the song plays, lets the background glow with the loudness, highlights the sung line, seeks when a line is clicked and offers the lines as a captions track in the player.

## Agentic workflow

One build agent per song receives a brief with the timing report, the song's lyrics and prompt, the existing scenes as reference, the resource limits and the delivery items (`scene.js`, `timeline.js`, `making.txt`, a poster time and an accent colour). The agent renders stills at chosen moments, inspects them as contact sheets, revises the scene and renders the full video at the end. A second agent reviewed selected drafts against the lyrics and the timing. The main session checks each delivery against the real file state, publishes it and starts the next song.

Rendering runs locally even though the models work in the cloud, and each render worker starts a browser and an ffmpeg process. When about eight agents rendered at once, the workstation's memory filled and it nearly froze. Since then every agent renders with at most two workers, stills in small batches and contact sheets at 320 px per tile, and starts a full render only when no other ffmpeg process is running. Several agents may write code and render stills side by side under these limits.

Whisper hallucinates on sung passages ("Thanks for watching!" where nothing is said) and fails on dialect. Lyrics appear in a video only when they are reliable, from the written lyrics or from the operator. The skill `skill/code-musikvideo/SKILL.md` condenses this workflow for other people.

## Transfer to other video projects

The transferable method binds a recoverable source to an evidenced timeline, a deterministic frame function and inspected exports. Music uses measured audio anchors, a silent explainer uses readable editorial durations, and advertising binds its claims and design to an accepted offer and brand. The executable procedure is maintained in [code-musikvideo](../skill/code-musikvideo/SKILL.md), with conditional [format guidance](../skill/code-musikvideo/references/video-formats.md), [visual direction](../skill/code-musikvideo/references/visual-direction.md), [hybrid asset preparation](../skill/code-musikvideo/references/hybrid-assets.md) and [timing/text guidance](../skill/code-musikvideo/references/timing-and-text.md). Album-specific interface staging, typography and the exclusion of real brands apply to TROTZDEM itself.

Timing evidence distinguishes measured onsets, word readings, metrical anchors and editorial decisions. Changing the audio take or cut requires renewed timing checks. Retiming data and copy belong in the timeline. Inputs and their provenance need recoverable storage even when excluded from Git, while generated measurements and exports have a regeneration path. A remote is independent of local knowledge maintenance and does not by itself establish a backup of ignored source material.

Technical checks cover executable prerequisites, script syntax, image and font readiness, frame-order independence, stream durations and inspected delivery crops. Repeat a frame after another time and in a fresh browser context. A deterministic frame test can fail even when the player loads without errors. Editorial acceptance, source-reading judgement, rights clearance and publication remain separate gates. Observed checks and limits are recorded in [video-method-verification.md](video-method-verification.md).

The skill keeps its published name and canonical source under `skill/code-musikvideo/`. The vault register links this repository as an external maintenance source. On the operator's Windows setup, distribute this directory through the existing vault `scripts/sync-skills.ps1`, passing this repository's `skill/` as `-SourceSkillRoot` and the intended personal skill roots as `-TargetSkillRoots`. Run `-DryRun` first and verify it again afterwards. This scoped rollout does not synchronise unrelated vault skills or change the album's publication state. Automatic selection must be observed in a fresh agent session separately from the file comparison.

## Environment

Preparation runs in a separate venv `video/.venv` with CUDA torch, pinned to 2.8 because later torchaudio releases route audio I/O through TorchCodec, which breaks the separation tools on Windows. Installing stable-ts replaces CUDA torch with a CPU build, so torch is reinstalled with `--force-reinstall --no-deps` afterwards. Rendering needs Python with Playwright and Chromium plus ffmpeg on the path. `tools/serve.py` serves `video/` locally with byte ranges, which seeking in a local video requires.

### Hybrid production and module scenes

Jagged Alien Intelligences extends the earlier code-only workflow with supplied or generated source image layers. Image material and exact code typography have separate roles. Its renderer uses explicit --module mode and one shared loopback server, awaiting decoded assets and fonts before exposing renderFrame. Existing classic scenes retain their loading path. The rupture image is prepared as an immutable raster source after a first-use pixel mismatch was reproduced and resolved. Its actual browser regression lives beside the scene. See [the production record](jagged-alien-intelligences-production.md).

The revised method calls for downstream captions and page cues to consume maintained timing. The older album builder still reads raw forced alignment, so it does not yet satisfy that shared-source instruction for corrected Jagged cues. Method maintenance does not silently migrate existing consumers.
