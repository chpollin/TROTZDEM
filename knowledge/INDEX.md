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

TROTZDEM is an experiment with generative AI, an album of songs generated with Suno, with lyrics by Claude Opus, and a series of music videos rendered entirely from code, published at https://chpollin.github.io/TROTZDEM/. The skill for building such a video from one's own song is `skill/code-musikvideo/SKILL.md`. The action layer is `CLAUDE.md` in the repository root.

## Documents

- [project.md](project.md) describes what the project is, how it is framed as an experiment, what the page labels as AI-generated, the rules on context notes and warnings, and the rights situation.
- [video-pipeline-architecture.md](video-pipeline-architecture.md) describes how the videos are produced, from the Suno source through vocal separation, lyric alignment and audio analysis to the canvas scenes, the frame renderer, the album page and the agentic build workflow.
- [album-versions.md](album-versions.md) describes the experimental page variants on the branch `album-versions`, the album narrative in acts, the visual grammar the videos share and why transitions live in the interface.
- [handoff.md](handoff.md) holds the open items waiting for a decision or for integration.
- [journal.md](journal.md) records what changed and what was decided per session.

## Terms

Scene

The JavaScript program `video/<slug>/scene.js` that draws one video as `drawScene(ctx, t)`.

Timing report

`video/<slug>/source/timing-report.md`, the generated comparison of aligned lyrics, free transcription, vocal phrase starts, tempo and loudness from which the timeline is written.

Build agent

The coding agent that writes, reviews and renders the scene of one song.
