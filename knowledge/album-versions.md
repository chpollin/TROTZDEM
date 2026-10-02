---
title: Album versions
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
related: [project.md, video-pipeline-architecture.md, journal.md]
---

# Album versions

The branch `album-versions` holds experimental variants of the album page under `versions/` that tell the album as one narrative and join video and interface more closely than the published page. The variants are local prototypes. They read all data from `video/` and change nothing the published page depends on, apart from an additional mode in `video/player.html`.

## Narrative

`versions/narrative.json` is hand-maintained and orders the songs in acts plus a coda. Each act title is a verbatim lyric line, and `from` names the song it comes from, so the page invents no text of its own. The order runs from euphoria through dependence to doubt, which follows the framing in [project.md](project.md) as an exaggeration of experiences with AI agents.

1. "Am Anfang war der Prompt" (from "HALLELUJAH, THE GOD MACHINE!") with System Prompt, I'm addicted to Claude Code, Empire of AI, HALLELUJAH, THE GOD MACHINE! and Lost in the Vault.
2. "Maschinen prompten mich" (from "Prompt Engineer!") with Good Morning Claude, Machine of Loving Grace, Ich predicte dich, Sycophancy and Prompt Engineer!
3. "Ich bin noch im Loop" (from "Bin ich noch der Expert?") with Neunundachtzig Tabs, Bin ich noch der Expert? and THE BITTER LESSON.
4. "Die Geister die ich rief" (from the remix) with The Bitter Lesson (Remix).
5. The coda "Trotzdem läuft es weiter" (from System Prompt) has no song of its own and leads back to the opening frame of System Prompt.

Prompt Engineer closes the second act because the act takes its title from that song. Each act title thereby stands in the act of its source song. Most seams between neighbouring songs already have an anchor in image or text. Empire of AI ends on an empty prompt and HALLELUJAH opens with "Am Anfang war der Prompt", and Lost in the Vault ends on "Morgen wieder" before Good Morning Claude runs through the next night. The weakest seam is the step from the bright morning that ends Good Morning Claude to the black chat of Machine of Loving Grace.

## Shared visual grammar of the videos

A read of all scenes showed that the videos already share a grammar without a shared module. Every scene fills the ground with black, uses Redaction with its damage grades and Space Mono, and keeps one accent colour with a rule of the form "this colour means this and nothing else" in its header comment. The accent always marks a signal of the system, such as the machine's work, live, an error, the reward or the limit, while the human stays achromatic in nearly every video. System Prompt is the exception, where violet marks the human hand. Read as the legend of the album, it is the one place where the human still has a colour. This reading is an inference from the code. The word "trotzdem" appears damaged in the videos of the first two acts and clean after the collapse in Prompt Engineer!

A uniform machine colour across all videos would erase the identity of several videos and was rejected. Writing this grammar into the brief for new scenes keeps future videos inside the cycle.

## Handovers in the interface

Transitions between songs live in the page. A video's length is bound to its audio, so a transition burnt into a video could only reinterpret existing frames, it would tie each video to one neighbour and break when the order changes, and it would show an orphaned element wherever the video plays alone. Every change would also require a full re-render, which the resource limits of the workstation allow only one at a time.

## Variants

### Live-Bühne (`versions/live/`)

Each scene runs live in its own same-origin iframe of `video/player.html?song=<slug>&embed`, because the scenes declare top-level constants and cannot share one page. The embed mode loads the scripts and fonts, exposes `drawAt(t)` and leaves the clock to the parent page. The clock and the sound come from a media element playing the rendered mp4 from the release, whose time 0 equals scene time 0 because `render.py` muxes the audio from the start. The parent draws only when the 30 fps frame index changes, so the browser shows the frames the renderer produced.

A scene that fails to load, throws while drawing, or whose median interval between drawn frames over a rolling window exceeds 45 ms falls back to the rendered video at the same position. The synchronous draw call cannot serve as the gate, because Chromium defers canvas raster and the call returns at once.

Within an act a song freezes on its out frame and fades to black, a caret in the style of Neunundachtzig Tabs walks in steps from the out anchor of the song to the in anchor of the next, and the next song fades in. The anchors are the `ANCHORS` map in `live.js`, taken from the layout constants of each scene. An act start shows the act title as a card instead.

### Eine Sitzung (`versions/sitzung/`)

The album is one agent session. Each song is a turn with its video and its lyrics streaming in at the cue times of `video/live/<slug>.json`. A context meter fills over the summed duration of the whole album, and a finished act collapses into one row of title links like a compaction. The coda ends the session with a restart button.

### Oberflächen (`versions/oberflaechen/`)

The album is one desktop on which every video is a window named after the interface it shows, kept in the `INTERFACES` map in `oberflaechen.js`. Windows already played stay open in a cascade per act, so the screen fills up towards the end of the album. On narrow screens the desktop degrades to a single window with the earlier ones as title-bar strips.

## Open items

- None of the variants has been heard with sound in a real browser. Headless Chrome checked loading, playback, seeking, auto-advance, keyboard use, reduced motion and phone width.
- Safari may refuse to start the next song without a fresh gesture, and the play button is then the way in.
- In the live variant the title of the next song shows while the act card is still up. In the desktop variant the act overlay covers the start of the new video for a moment.
- The provenance line in all variants reads "Videos und diese Seite reiner Code, geschrieben von Claude Opus 5.5 in Claude Code", which joins two lines of the published page and needs the operator's confirmation.
- The in anchor of the remix is the frame centre, set without reading its layout. It is used only when the remix follows another song within an act.
