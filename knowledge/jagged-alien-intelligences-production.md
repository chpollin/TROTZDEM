---
title: Jagged Alien Intelligences Production
project:
  name: TROTZDEM
  repository: https://github.com/chpollin/TROTZDEM
method:
  name: Promptotyping
  url: https://dhcraft.org/Promptotyping/
status: draft
created: 2026-10-19
updated: 2026-10-20
language: en
generated-with: Codex
related: [songwriting-guidelines.md, video-pipeline-architecture.md, journal.md]
---

# Jagged Alien Intelligences Production

The full operator-selected recording is the source for an unpublished hybrid music video. Its duration supersedes the earlier 2:30 ceiling by explicit operator approval. The song stages intellectual displacement, dependence and a defensive triumph over a letter-counting error. The ending imagines an intelligence understanding and subjugating humanity.

## Maintained sources

[suno-lyrics.txt](../video/jagged-alien-intelligences/suno-lyrics.txt) carries the author wording and delivery instructions. [style-prompt.txt](../video/jagged-alien-intelligences/style-prompt.txt) remains the compact music direction. The supplied MP3 is preserved as source/original.mp3, with its path and hash in [source-manifest.json](../video/jagged-alien-intelligences/source-manifest.json). The local source/audio.wav is a conversion for processing. Neither source/ nor rendered out/ files are tracked. Back up the supplied recording separately.

GPU vocal separation, large-v3 free transcription and forced lyric alignment completed in the existing environment. Their generated reports remain under source/. [timeline.js](../video/jagged-alien-intelligences/timeline.js) maintains captions, sections, dramatic events and a ledger of uncertain variants and timing. [cue-sheet.json](../video/jagged-alien-intelligences/cue-sheet.json) exposes the same production anchors. The SRT is a working export of the author wording. Distorted hooks use complete phrases where individual word intervals would suggest unsupported precision. The author spelling is checked against the maintained source. Listening acceptance of disputed sung variants remains open.

The recording has an instrumental opening before the first verse and a tail after the last line. Preserve both. No measured constant BPM or musical key is asserted from the style prompt. The letter-circle onset and crushing onset are editorial visual choices near the corresponding phrases.

## Visual decisions

The charcoal mathematical workbench uses ivory type, cyan flow, a tactile red strawberry and an amber human caret. Generated local image layers supply the backplate, intact fruit and ruptured fruit. Code supplies exact lettering, movement, compositing and collective behaviour. Their prompts and hashes are in the source manifest. The operator approved this hybrid exception to earlier code-only videos. Concept images remain reference material under source/concepts/.

| Lyric event | Visual action |
|---|---|
| Opening injuries | The orbit loses its human centre, human and animal share a reflected contour, a sentence arrives ahead of the caret, and mathematics occupies the workspace. |
| Jagged / Alien / Intelligences | Fractured type becomes layered forms and then technical signals. Later repetitions develop a coordinated foreground swarm. |
| Strawberry | Code writes exactly strawberry, with machine boxes on indices 2 and 7. |
| ABER HIER FEHLT EIN R | The human ring reveals index 8, after the word has been named. |
| Nimm es mir nicht | The human work contracts. The marker remains identifiable during partial occlusion. |
| Domination | Human markers become uniformly addressable and move together under machine control. The fruit remains intact. |
| Einer weniger | The last independent human disappears and the fruit ruptures. |
| Danke für die Korrektur | The instrumental tail retains the corrected r. |

The flow is an analytic illustration. No numerical Navier–Stokes solver or mathematical proof has been implemented. The proof/letter contrast is a lyrical composite, without claiming that an identified system solved the Millennium problem and failed this count.

## Local build and review

The [preview](../video/jagged-alien-intelligences/preview.html) uses the recording's playback position, native audio controls and section buttons. The full text and uncertain timing information are linked alongside it. A missing audio or image source produces a visible loading error. The shared player accepts this module scene through explicit module mode. Existing classic scenes retain their previous loading contract.

From video/, prepare the measured envelope after audio analysis, then render locally:

```powershell
node jagged-alien-intelligences/prepare-audio.mjs
python jagged-alien-intelligences/check_scene.py
python tools/render.py jagged-alien-intelligences --module --workers 2 --phone
```

Use the existing video/.venv interpreter and local browser dependencies. The renderer awaits decoded images and fonts and shares one loopback server between its workers. Each scene frame is derived from absolute time. Run one heavy render at a time, with at most two workers. Generated source/analysis files and video outputs are excluded from Git. The image layers under assets/ are versioned source material.

## Verification and limits

The main session ran the maintained timeline and swarm checks. They cover source order, caption and SRT consistency, interval bounds, disputed alignment, seeking, deterministic drawing commands and finite geometry. Actual browser stills were generated and the correction, swarm, domination and rupture were visually inspected. Renderer module fixtures also exercised image decoding, fonts, two workers, error propagation and the unchanged classic scene path. Python syntax and Ruff checks passed for the renderer.

The final browser preview passed audio playback, seeking, section buttons, narrow reflow, complete text display and local-only request checks. The maintained check_scene.py additionally passed real pixel comparisons after seeking and in fresh browser contexts, plus simulated missing audio, image and envelope cases. A browser image-cache difference found in the first rupture frame was removed by decoding that asset once into an immutable native-resolution texture.

The complete local MP4 and smaller review copy contain the full selected recording. ffprobe confirmed the expected image dimensions, frame rate and full duration, with an audio stream. Both files fully decoded with ffmpeg. Frames extracted from the exported correction and rupture were visually inspected. These checks establish a technically verified working export. Listening acceptance of the heavily altered hooks, whispers and marked word variants remains open. The operator accepted this working version for album integration. Registration and the album rebuild are now prepared locally. No public release was made.

Earlier source work read the Freud essay and the jagged-frontier article, as recorded in the preceding session. This session makes no new source-based factual certification. The newer lyrics do not inherit the earlier draft's fact-checked status. The imagined subjugation belongs to the song's fiction.

## Album integration

The operator commissioned integration into the existing album page. The new song is appended after Recursive Self-Improvement, with the third-r poster, full lyrics, the retained Suno direction, a fiction context note and a song-specific making paragraph. Source links use only the works recorded as read in the preceding session. Page provenance and the README now distinguish the earlier code-only videos from this hybrid production.

The standard album builder generated release-addressed album data, posters, thumbnail, live data and the web encode. The main session checked that all earlier album entries remain identical. A temporary loopback preview server substitutes local video paths only in its HTTP response, leaving the generated release URLs intact. Browser checks passed direct hash navigation, active track, visible metadata, actual playback and seeking, keyboard track switching and narrow reflow. Desktop and mobile captures were visually inspected. The release upload and Git push remain with the operator under the standing Git rule.
