---
name: code-musikvideo
description: Produces and revises code-rendered music, explainer and promotional videos from source material and an evidenced timeline. Triggers on "Musikvideo aus Code", "Erklärvideo aus Code", "Werbevideo aus Code", "Code-gerenderte Videos" and retiming an existing canvas video. Frames are drawn by code, without an image or video generation model.
---

Produces a video through source preparation, an evidenced timeline, a deterministic frame function and inspected exports.

## Reads

- The target project's action layer, knowledge entrypoint, source and licence records, accepted design decisions and open review notes. Resolve them from the actual target root, never from the installed skill's parent directory.
- In the reference repository `chpollin/TROTZDEM`, `knowledge/video-pipeline-architecture.md` for the implementation and method, and `video/README.md` for its commands and environment. Find an existing checkout before acquiring another copy. If it is unavailable, read the corresponding repository files through an available connector or browser. An installed skill alone does not contain the renderer.
- [Video formats](references/video-formats.md) for the commissioned music, explainer or promotional format.
- In the operator's vault, where reachable, `Projects/Eigenforschung/Code-gerenderte Videos/Project Overview Code-gerenderte Videos.md` for cross-project decisions. Project evidence and material remain in their own repositories.

If a binding project rule or required source cannot be read, hold the dependent change and report it. Continue independent inspection. Check tools, authenticated services and authorisation separately from instructions.

## Procedure

1. Establish the purpose, audience, format, source basis and requested delivery. Reuse an existing scene and toolchain where suitable. Read the chosen player and renderer before copying or invoking them. Projects use both `video/<slug>/` and root-level `<slug>/` layouts, and players differ in image preloading and support for shared scenes. A remote repository is optional for local production and knowledge maintenance.
2. Check the runtime by actually starting it. Rendering needs Python with Playwright, a usable Chromium and ffmpeg/ffprobe. Audio separation and transcription need their own verified environment only when the task calls for them. Preserve working project pins, and use its installation instructions if a dependency is missing. Do not install or replace models or GPU packages speculatively.
3. Record where source audio, supplied text, scans, fonts and brand assets came from, their intended use and the available permission evidence. Source inputs are not reproducible build outputs. Keep them and their provenance recoverable, even when excluded from Git. Generated stems, measurements and renders may be ignored where the inputs and regeneration path are preserved. Keeping a project local is independent of whether it has a backup.
4. Prepare the timing basis for the selected format. For a song, the reference command is `python tools/prepare_local.py <slug>` from the directory containing `tools/` and `<slug>/`, in the verified audio environment. Inspect its help before passing optional flags. It writes the timing report, stems and analysis data. Generated measurements are regenerated rather than edited to fit an imagined rhythm. Song prompts and requested tempos are not measurements.
5. Resolve discrepancies before presenting them as source content. Whisper can invent text during silence and fail on dialect. Forced alignment can pull a first word into the preceding pause or lose repeated choruses. Compare supplied lyrics, free transcription, vocal phrase starts and the actual audio. A vocal rise supports an onset, not a word reading or a metrical downbeat. Unresolved words remain absent or explicitly uncertain, and can be presented as short excerpts for human judgement. Measure musical anchors on the actual selected take. Replacing or cutting audio requires renewed timing checks.
6. Write `timeline.js` with section boundaries, editorial copy, source-bound text, timing evidence, `SCENE_END` and the title where the player supports it. Keep retiming data and copy outside the drawing logic. Distinguish measured anchors from editorial durations, reading-time decisions and inferred readings. Choose a coherent visual concept under the project's actual design decisions. A text-free video is valid, and synchronised word-by-word lyrics are an option when commissioned.
7. Implement `drawScene(ctx, t)` with seeded randomness and no dependence on wall-clock time or previously drawn frames. Initialise reusable graphics only after fonts and images are ready. Check the actual player contract for `SCENE_FONT_FACES`, `SCENE_IMAGES`, shared assets and `SCENE_FROM` before using them. Keep assets local, with their licences. For file-based rendering, use the project's verified image-loading path, such as a data URI, and confirm canvas export succeeds. Runtime network requests are not needed.
8. Render selected stills and short segments. Include text-dense moments, section transitions, the opening, the close and intended crops. Inspect the images and revise concrete defects until resolved or explicitly reported. Do not substitute a fixed number of review rounds for inspection. Check readability at the delivery size and safe area, restrained motion and flashes. Keep large-area flashing at or below three flashes per second.
9. Render a full export only when the source, timing and sampled frames are ready. Use at most two workers on the operator's workstation, stills in small batches and no simultaneous heavy audio preparation. Before a full render, check whether another ffmpeg render is active. An unavailable process view means unknown, so resolve it before starting another heavy job. A delegated brief names write paths and resource limits, and the coordinating session checks the real delivery. Delegation is optional and follows the current environment's instructions.
10. Verify the export using the checks below. Preserve the previous good render on failure. If the existing renderer lacks atomic replacement for the requested output, render to a new name and replace only after success. Prepare a delivery encode without overwriting the master. Technical verification, editorial or aesthetic acceptance, rights clearance and publication are separate outcomes.
11. Write the production note and durable method corrections in the project's existing knowledge base. Record source and output paths, checks actually performed, unresolved issues and the precise next human contribution. Installing or improving this skill does not accept a video or authorise its publication.

## Boundaries

- Edit the maintained source at `chpollin/TROTZDEM/skill/code-musikvideo/`, then distribute verified copies. The operator's vault register identifies this external maintenance source, outside the ordinary vault skill rollout. Keep the published skill name for compatibility.
- Project rules override generic advice. TROTZDEM's restriction on real brands and product interfaces is an album design decision. Other projects may use their authorised brand assets and documented interface material.
- Generated or anonymised examples are not evidence of a real client outcome. Do not invent words, measurements, source readings or permission grants.
- Read the current provider and asset terms when rights clearance is actually commissioned. Model-code licensing alone does not establish rights to voices, model weights, music, scans or depicted material. Preserve unresolved rights questions, and do not derive publication permission from a successful render.
- Do not publish, send, create remote repositories, download paid assets or change sharing settings without the corresponding authorisation. A local export and a local skill installation do not authorise any of these actions.

## Verification

Run from the target video's actual root, adapting only the paths to its existing layout.

```text
node --check <slug>/scene.js
node --check <slug>/timeline.js
node --check <slug>/analysis.js
python tools/render.py --help
python tools/render.py <slug> --still <chosen-seconds>
python tools/render.py <slug> --from <start> --to <end> --name <new-check-name> --workers 1
ffprobe -v error -show_entries stream=codec_type,duration,width,height,r_frame_rate -show_entries format=duration -of json <export.mp4>
```

Only invoke options confirmed by that renderer's help. Compare audio, scene and exported stream durations, allowing for frame and codec rounding rather than demanding numerical equality. Inspect representative frames extracted from the export against the standalone stills at corresponding frame times, allowing lossy encoding differences. Listen to a segment for sync when audio is present. A probe does not establish perceptual sync.

Compare PNG exports from the ready player at `t`, another time, and `t` again, decoding their pixels outside the browser so the check does not introduce additional canvas readback behaviour. Compare `t` in a fresh browser context as well. A mismatch identifies state-dependent rendering and must be resolved or reported. Inspect the requested crops separately. Missing tools or material leave those checks explicitly unperformed.

[Saved cases](evals/cases.json) cover observed transfer errors and missing prerequisites. They are inputs with expected behaviour, not evidence of execution. Replay the relevant cases against both procedures when claiming a behavioural improvement, and retain the actual decisions and rendered evidence in the project verification record. A reading replay, static code check, browser execution and full export each establish different things.

## Output

Deliver the inspected preview or export paths, a concise account of the concept and timing basis, actual checks and their limits, and unresolved editorial and rights questions. Report method maintenance separately from the acceptance and publication state of each video.
