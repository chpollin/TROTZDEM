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
updated: 2026-10-20
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


## Content-led hybrid revision, 2026-10-20

The operator commissioned skill optimisation after the Jagged Alien Intelligences production. The revision keeps the published name and the canonical repository source. It adds conditional references for [visual direction](../skill/code-musikvideo/references/visual-direction.md), [hybrid assets](../skill/code-musikvideo/references/hybrid-assets.md) and [timing and text](../skill/code-musikvideo/references/timing-and-text.md). Format guidance retains text-free music, source-led explanation and authorised brand treatments. The source convention's earlier code-only framing is superseded for commissioned hybrid production. No vault instruction or overview was changed.

The principal additions concern observable visual actions, continuity through a state change, exact lettering in controlled layers, source-asset identity and a maintained timing source across consumers. Runtime startup is conditional on dependent execution. The procedure does not require a new concept interview for a bounded revision or impose a particular motif or aesthetic.

### Independent planning comparison

A read-only agent received the previous and revised skill folders, realistic requests and raw constraints. The expected results in evals/cases.json and the main session's reports were withheld. It read both skills and their references and produced next-action plans without generation, rendering, listening or publication. The main session read its response and checked the cited instructions in the actual revised files.

| Request | Previous procedure | Revised procedure |
|---|---|---|
| Hybrid fruit imagery with exact lettering and changing control | Supported source preservation and coherent design, but its discovery description excluded image generation | Separates image material from exact typography, preserves object identity and specifies observable agency changes |
| Companion page with corrected hook timing and an approved full take | Needed an additional inference to avoid raw-alignment reuse | Routes consumers through maintained timing and preserves the approved full recording |
| Final transition of an accepted quiet text-free paper-cut treatment | Text-free treatment was supported, while revision scope relied on the commission | Explicitly preserves accepted direction for bounded changes |
| Identical drawing commands with differing rupture pixels | Detected the mismatch through pixel checks | Also directs inspection of first image use, scaled crops and a verified immutable-source remedy |

The reviewer found an unconditional runtime startup instruction and a missing concrete module invocation. Both were corrected. Repository reference links now support the stated browser/connector fallback. The reviewer found no conflict between optional hybrid imagery, text-free work and project-specific design. These are planning-level observations. They establish neither measured productivity nor improved audience response or aesthetics.

### Executed checks

The stock skill-creator quick validator ran with the existing video environment and PyYAML and accepted the revised metadata. Renderer help confirmed module mode and the example options. Saved case JSON and local reference links were checked. The existing check_scene.py was rerun successfully against the actual Jagged scene, testing decoded-pixel repeatability after seeking and in fresh contexts, plus visible dependency failures with retained lyrics. This rerun verifies the technical examples; it does not demonstrate that a fresh agent built a better video with the revised instructions.

The main session also compared the original saved cases by reading. Their text-free, authorised-brand, silent-source, missing-runtime, unreadable-rule and publication-boundary expectations remain supported. This was not a new behavioural execution of those projects.

### Remaining implementation distinction

The current album builder still derives companion cues from raw alignment independently of the corrected Jagged timeline. The new skill exposes that divergence as a downstream check. This maintenance commission changes the method and its tests, not the album builder or accepted video. Perceptual listening and audience comprehension remain separate from technical checks.

### Verified local rollout

The existing sync-skills.ps1 was run with this repository's skill/ as SourceSkillRoot and the personal .claude/skills and .agents/skills roots as targets. Its initial dry run identified only code-musikvideo for copying. The scoped copy succeeded and the second dry run reported it current in both roots. Independent SHA-256 comparisons of every skill file matched the canonical source, including the added references and saved cases. Other installed skills were retained. Native automatic selection of the revised discovery text in a fresh session was not exercised. No push, release upload or video publication was performed.