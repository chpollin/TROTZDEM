---
title: Project
project:
  name: TROTZDEM
  repository: https://github.com/chpollin/TROTZDEM
method:
  name: Promptotyping
  url: https://dhcraft.org/Promptotyping/
status: draft
created: 2026-10-02
updated: 2026-10-03
language: en
authors: [Christopher Pollin]
generated-with: Claude Code (Claude Opus 5.5)
related: [INDEX.md, video-pipeline-architecture.md]
---

# Project

TROTZDEM is an experiment with generative and agentic AI. It consists of an album of AI-generated songs from the last two years, a music video for each song that is rendered entirely from code, and an album page at https://chpollin.github.io/TROTZDEM/. The experiment shows how far current models carry a creative production when the operator only prompts, selects and decides. How the videos are produced is described in [video-pipeline-architecture.md](video-pipeline-architecture.md).

## Framing

The operator decided on 2026-10-02 that the project is presented as an experiment and never as personal songs. The songs deliberately exaggerate experiences of working with AI agents, such as exhaustion, dependence and self-doubt, as commentary. Readers should not take them as statements about the author's state of mind. Every public text (page, README, posts) follows this framing.

The page states exactly what is AI-generated.

- Music by Suno, model v5.
- Lyrics by Claude Opus, from the operator's prompts and reflections and supplemented by deep-research results. Selection, assembly and prompting are the operator's.
- Videos and website by Claude Opus 5.5 in Claude Code. Every video is a program, without any image or video model. The page links each video's `scene.js`.
- The work was done with context and agentic engineering and is at the same time entirely vibe coded.

## Context notes and warnings

The videos carry no content warnings, help cards or end cards. The operator removed them because the songs are not meant as suicidal content.

A song whose text is deliberately provocative gets a short context note on the page, held as `note` in `video/songs.json` and shown above the paragraph on how the video is made. "The Bitter Lesson" carries one, because its AI-generated lyrics exaggerate the thesis of Sutton's essay (2019) into lines such as "COMPUTE SCHLÄGT JEDEN MENSCHEN".

## Sources

A song that draws on research or a documented incident lists the works it relies on in the `sources` field of `video/songs.json`, and the page shows them under the video. Only works read in full are listed. How songs are checked is described in [songwriting-guidelines.md](songwriting-guidelines.md).

## Material and rights

The songs come from the Suno playlist "chrisi-trotzdem", https://suno.com/playlist/6c2e6236-5308-4e05-ba6b-97db23604473. Suno's terms allow public and commercial use only of audio downloaded through the official download on a paid plan. The first album videos use the audio of the public clip videos, while the songs added from October 2026 on use the official download. For the older songs, replacing `source/audio.wav` with the official download and rendering again is the route before use beyond sharing with friends.

Code is MIT licensed, text and documentation CC BY 4.0. The vendored fonts keep the SIL Open Font License. The songs, their audio and lyrics are not covered.

## Sharing

The page is shared with friends and announced on social media. For people who want to try it themselves, the page offers the Claude Code skill `skill/code-musikvideo/SKILL.md` for download together with a start prompt. The skill uses `video/tools/prepare_local.py` for songs outside the Suno playlist.

The same pipeline produced the videos for "weil ich schon an mir selbst zweifle" by hidden by the grapes in a separate local repository, `hidden-by-the-grapes`, in several variations (chalk without text, chalk with handwritten lyrics, kinetic typography, linocut).
