---
title: Journal
project:
  name: TROTZDEM
  repository: https://github.com/chpollin/TROTZDEM
method:
  name: Promptotyping
  url: https://dhcraft.org/Promptotyping/
status: active
created: 2026-10-02
updated: 2026-10-02
language: en
authors: [Christopher Pollin]
generated-with: Claude Code (Claude Opus 5.5)
---

# Journal

## 2026-10-02

The music videos were built from the Suno playlist "chrisi-trotzdem". The pipeline separates the vocals, aligns the lyrics with Whisper, measures tempo and loudness, and renders a canvas scene per song in a headless browser, described in [video-pipeline-architecture.md](video-pipeline-architecture.md). One build agent writes each scene, the main session checks and publishes it.

Running several render agents in parallel filled the workstation's memory and nearly froze it. Since then one build agent runs at a time with two render workers.

The operator removed the help card with crisis contacts from the end of the first video, because the songs are not meant as suicidal content. No video carries content warnings or end cards.

The album page moved from `video/index.html` to the repository root and is published with GitHub Pages at https://chpollin.github.io/TROTZDEM/. The former chat-style album site stays as `chat.html`, and `video/index.html` redirects. The videos are web encodes attached to the release `videos`, because they are too large for the repository and release assets support seeking.

The page labels the project as an experiment with generative AI and the songs as AI-generated (music by Suno, lyrics by Claude Opus, prompted and assembled by the operator with deep-research input) and the videos and site as written by Claude Opus 5.5 in Claude Code, built with context and agentic engineering and entirely vibe coded. It states that every video is code and links each video's `scene.js`. Lyrics and Suno prompt are folded away, and the accent colour follows the playing video.

Later the same day the operator decided to frame TROTZDEM as an experiment with generative AI and never as personal songs, so that readers do not take the exaggerated texts as statements about the author. The header of the page now states exactly what is AI-generated, music by Suno, lyrics by Claude Opus and videos as code by Claude Opus 5.5. "The Bitter Lesson" was removed and restored within minutes, now with a context note on its deliberately provocative text, which introduced the `note` field in `songs.json`. The page offers the skill `skill/code-musikvideo/SKILL.md` for download with a start prompt, served unprocessed through `.nojekyll`, and `video/tools/prepare_local.py` prepares songs outside the playlist. The framing rules moved into [project.md](project.md). "Bin ich noch der Expert?" went online. The same pipeline produced variations of a song by hidden by the grapes in a separate repository, where Whisper failed on the Styrian dialect until the band's lyrics arrived.

An audit of the repository led to a round of optimisation without re-rendering any video. `render.py` now defaults to two workers as the resource rule demands, keeps segments per output name and stops at the first failed segment. Renders, web encodes and downloads write to `*.part` files, so an interrupted run no longer leaves a truncated file that later runs would trust. `build_album.py` writes release URLs by default, takes a `title` override from `songs.json` and generates small track list thumbnails. Two scene caches whose result depended on which frame a worker rendered first now depend only on their key, and dead scene code is gone. The preview player falls back to the release audio where `source/` is missing. The archived chat page loads no font CDN and its images shrank to WebP sized for display.
