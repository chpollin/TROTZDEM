---
title: Video Method Verification
project:
  name: TROTZDEM
  repository: https://github.com/chpollin/TROTZDEM
method:
  name: Promptotyping
  url: https://dhcraft.org/Promptotyping/
status: draft
created: 2026-10-15
updated: 2026-10-15
language: en
generated-with: Codex
related: [INDEX.md, video-pipeline-architecture.md]
---

# Video Method Verification

## Scope

The maintenance run of 2026-10-15 revised the reusable `code-musikvideo` instructions against the local music, charter and advertising projects. It did not alter their scenes, accept their videos, clear rights, create remotes or publish anything. The album remains completed. The reusable method is described in [video-pipeline-architecture.md](video-pipeline-architecture.md#transfer-to-other-video-projects), the executable procedure in [SKILL.md](../skill/code-musikvideo/SKILL.md).

## Reading comparison

The main session manually replayed the saved requests against the previous and revised instructions and checked the referenced project files. This was a reading comparison, not separate agent executions or a measured productivity experiment. Inputs and expected behaviour are in [cases.json](../skill/code-musikvideo/evals/cases.json).

| Request | Previous procedure | Revised procedure |
|---|---|---|
| Preserve the text-free music treatment | Required every lyric line to appear word by word, contradicting the accepted variant | Allows a text-free treatment and separates word reading from onset evidence |
| Retain the authorised DHCraft logo and inspect the square advert | Prohibited real brands and supplied no advertising-specific crop or claim review | Routes to accepted project branding, claims, attribution and each delivery crop |
| Check the silent charter explainer with unresolved rights | Supported silence and sources, but required freely licensed images without a separate local-review state | Separates local technical review, source readings and public rights clearance |
| Render with a Python lacking Playwright | Listed packages without an executable capability check | Starts the runtime, looks for the existing environment, reports the unperformed check |
| Revise claims with an unreadable binding offer | No explicit missing-rule procedure | Holds dependent changes and continues independent inspection |
| Run without product-specific metadata enforcement | Delegation brief prohibited publication, but no general installation/publication boundary | Carries task and publication limits in ordinary instructions |

The revised procedure also replaces mandatory review-round counts with defect-based visual inspection, distinguishes source preservation from generated output, and treats remotes and local method work independently. Existing audio-analysis and rendering tools were reused without modification.

## Executed checks

Headless Microsoft Edge was started through the bundled Node Playwright library. The session rendered the existing file-based players, blocked HTTP and HTTPS requests, waited for `sceneReady`, checked page errors and decoded exported PNGs outside the browser. For each case it compared time `t`, a different time and `t` again, then compared `t` in a fresh browser context.

| Existing project and scene | Times in seconds | Same-browser repeat | Fresh-context comparison |
|---|---|---|---|
| `hidden-by-the-grapes/zweifel` | 40, 110, 40 | identical decoded pixels | identical decoded pixels |
| `urkunde-video/urkunde` | 121.5, 60, 121.5 | different decoded pixels | identical decoded pixels |
| `dhcraft-promo/frt-kurzspot` | 26, 8, 26 | identical decoded pixels | identical decoded pixels |

No page errors were observed. Resetting the canvas context did not remove the charter discrepancy. Its cause is unverified and remains a technical follow-up in ACTIVE-WORK. An initial test read pixels with browser `getImageData`, which affected the rendering comparison. That result was discarded and the comparison was repeated through the player's PNG export, decoded with Node pngjs. The table records this corrected test.

The main session inspected the resulting stills, the advert's centre-square preview and frames extracted with ffmpeg at the same times from the existing exports. The sampled compositions corresponded visually. This does not establish frame-by-frame identity across browsers or an aesthetic acceptance.

`node --check` passed for `scene.js`, `timeline.js` and `analysis.js` in each sampled scene. ffprobe confirmed landscape exports at 1920 × 1080 and the existing square advert at 1080 × 1080. Audio and video streams agreed within one 30 fps frame. The charter source is a longer silent track, which the existing 176-second export trims to its scene. The music and advert audio sources match their scene lengths within frame rounding.

## Limits and follow-up

The selected Python in the workspace bundle and the existing TROTZDEM video virtual environment both started but could not import Playwright. The browser-based frame checks used the installed Edge through Node instead. No dependencies were installed. The Python renderer, new short or full exports, audio separation and transcription were not executed. Perceptual audio sync was not listened to. Native automatic invocation of the installed skill in a new agent session remains unobserved.

The saved missing-source and metadata cases were read manually, not exercised through connector failures or a different harness. These checks support the stated instruction corrections and sampled rendering behaviour, not a general effectiveness claim. The existing video acceptance and rights gates remain in ACTIVE-WORK.

## Installation and formal checks

The existing vault `scripts/sync-skills.ps1` was invoked with this repository's `skill/` as its source, scoped to the personal `.claude/skills` and `.agents/skills` roots. A dry run preceded the copy and a second dry run reported the skill current in both roots. Byte comparisons confirmed the entrypoint, format reference and saved cases against the canonical source. Other skills were left unchanged. The vault register documents this source-specific rollout, outside the ordinary vault skill set.

The stock skill-creator `quick_validate.py` could not start because its Python lacked PyYAML. A separate Node check verified the actual two-field plain-scalar metadata, name and description constraints, balanced code fences, resource paths, JSON case structure and both installed copies. It was a check of these files, not a generic YAML parser. `git diff --check` passed. The scoped vault document check passed, and the ACTIVE-WORK UI's `build_data` function successfully parsed the updated source and completion log without writing generated UI files.
