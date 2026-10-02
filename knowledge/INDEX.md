---
title: Index
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
---

# Index

TROTZDEM is an experiment with generative AI, an album of songs generated with Suno, with lyrics by Claude Opus, and a series of music videos rendered entirely from code, published at https://chpollin.github.io/TROTZDEM/. The action layer is `CLAUDE.md` in the repository root.

## Documents

- [video-pipeline-architecture.md](video-pipeline-architecture.md) describes how the videos are produced, from the Suno source through vocal separation, lyric alignment and audio analysis to the canvas scenes, the frame renderer, the album page and the agentic build workflow.
- [handoff.md](handoff.md) holds the open items waiting for a decision or for integration.
- [journal.md](journal.md) records what changed and what was decided per session.

## Terms

Scene

The JavaScript program `video/<slug>/scene.js` that draws one video as `drawScene(ctx, t)`.

Timing report

`video/<slug>/source/timing-report.md`, the generated comparison of aligned lyrics, free transcription, vocal phrase starts, tempo and loudness from which the timeline is written.

Build agent

The coding agent that writes, reviews and renders the scene of one song.
