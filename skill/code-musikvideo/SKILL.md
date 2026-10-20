---
name: code-musikvideo
description: Produces and revises code-rendered music, explainer and promotional videos, including hybrid animation with supplied or generated image layers. Use for Musikvideo aus Code, Erklärvideo aus Code, Werbevideo aus Code, Code-gerenderte Videos, and retiming existing canvas videos. Covers content-led visual direction, evidenced timing and inspected exports; standalone image generation and song composition are separate tasks.
---

Produces a video whose visual actions serve its content, through recoverable sources, a maintained timeline, deterministic rendering and inspected exports. Preserve the published skill name.

## Reads

- The target project's action layer, knowledge entrypoint, source and licence records, accepted design decisions and open review notes. Resolve them from the actual target root, never from the installed skill's parent directory.
- In the reference repository chpollin/TROTZDEM, [pipeline architecture](https://github.com/chpollin/TROTZDEM/blob/main/knowledge/video-pipeline-architecture.md) for implementation and [video commands](https://github.com/chpollin/TROTZDEM/blob/main/video/README.md) for commands and environment. Find an existing checkout first. If unavailable, read those files through an available connector or browser. An installed skill does not contain the renderer.
- [Video formats](references/video-formats.md) for the commissioned format.
- [Visual direction](references/visual-direction.md) when developing or materially revising the treatment. Small timing or text corrections retain the accepted treatment.
- [Hybrid assets](references/hybrid-assets.md) when supplied or generated raster layers enter the scene.
- [Timing and text](references/timing-and-text.md) when audio, captions, subtitles or a companion player need alignment.
- In the operator's vault, where reachable, Projects/Eigenforschung/Code-gerenderte Videos/Project Overview Code-gerenderte Videos.md for cross-project decisions. Project evidence and material remain in their repositories. A current commissioned exception takes precedence over an older project overview; record its scope.

If a binding rule or required source is unreadable, hold the dependent change and continue independent inspection. Check instructions, tools, authenticated services and authorisation separately.

## Procedure

1. Establish purpose, audience, format, accepted decisions and delivery from the actual commission and material. Reuse suitable scenes and the existing toolchain. Read the player and renderer before invoking them. Layouts and loading contracts differ. A remote repository is optional for local work.
2. For a new treatment, derive a compact creative brief and observable visual actions using the visual-direction reference. Explain how the central motif changes across the video. Use the available context and reversible assumptions; ask only for an unresolved decision that materially changes the result. A revision need not restart concept development.
3. Choose code-only or hybrid production under the commissioned design. Verify generation tools separately when needed. Missing image-generation capability does not justify silently substituting a different treatment. Record source audio, text, images, fonts and brand material with origin, use and permission evidence. Preserve recoverable inputs, including generated source images. Measurements and renders may be regenerated. A local project still needs a backup.
4. Before dependent execution, actually start the required runtime. Pure concept or instruction review needs no render startup. Rendering requires a verified Python/Playwright environment, usable Chromium and ffmpeg/ffprobe. Audio analysis needs its own environment only when commissioned. Preserve working pins and use project installation instructions for missing dependencies. Do not replace models or GPU packages speculatively.
5. Prepare timing for the selected format. For songs, inspect the existing tools/prepare_local.py help before using it from the target video's actual root. Use the selected recording and approved cut. Prompt tempo, meter, duration and key are intentions. Generated measurements are regenerated from the source. Apply the timing-and-text reference to discrepancies and uncertainty.
6. Maintain source-bound text, sections, events, timing evidence and the scene duration outside the drawing logic. Use one maintained source for scene captions, subtitles, preview and companion-page cues. Verify downstream consumers use corrected timing. Preserve meaningful instrumental openings, pauses and tails in a commissioned full take.
7. Implement drawScene(ctx, t) with seeded randomness and no wall-clock or frame-history dependency. Initialise graphics after fonts and images are ready. Inspect the actual player contract for shared assets, fonts, scene offsets and module/classic loading. Use a verified image-loading path and confirm canvas export. Runtime requests to external services are unnecessary. Required local analysis and assets must fail visibly when missing, with a regeneration route where applicable.
8. Render selected stills and short segments before a full export. Include transitions, dense text, the opening, ending and delivery crops. Inspect whether visual actions express the intended relationship as well as whether they draw correctly. Revise concrete defects. Review-round counts do not establish quality. Check delivery-size readability, safe area, motion and flashes; keep large-area flashing at or below three flashes per second.
9. Check decoded-pixel repeatability before the full render, including image-state changes. Then render with at most two workers on the operator's workstation, small still batches and no competing heavy render or audio preparation. An unavailable process view is unknown and must be resolved. Delegation is optional under the current environment's instructions. Briefs name allowed writes, shared contracts, resource limits and publication scope. The coordinator checks actual files and behaviour.
10. Verify the export below. Preserve the last good output through atomic replacement or a new output name. Prepare a delivery encode without overwriting the master. Technical verification, comprehension review, aesthetic acceptance, rights clearance and publication are distinct outcomes.
11. Record durable decisions, actual checks and unresolved contributions in the existing knowledge base. If album or site integration is commissioned, use its builder, check earlier entries remain intact, verify the new entry in the actual player, and update attribution for hybrid material. Skill maintenance or local integration does not grant publication authority.

## Boundaries

- Maintain this skill at the [canonical repository source](https://github.com/chpollin/TROTZDEM/tree/main/skill/code-musikvideo), then distribute verified copies. The vault register identifies this external maintenance source, outside the ordinary vault rollout.
- Project rules override examples. TROTZDEM's interface staging, colours and exclusion of real brands belong to that album. Other projects may retain authorised brands, text-free treatments and different visual language.
- Illustrative or generated material is not evidence of a client outcome, scientific result or historical reading. Preserve those distinctions in claims and provenance.
- Read current provider and asset terms when rights clearance is commissioned. Code licensing alone does not establish rights to voices, weights, music or depicted material.
- Publishing, sending, remote creation, paid downloads and sharing changes need the corresponding authorisation. Preserve existing authorisation and act within its scope.

## Verification

Use only options confirmed by the target renderer's help. The reference module scene needs explicit module mode; classic scenes retain their existing path. Typical checks from the actual video root are:

```text
node --check <slug>/scene.js
node --check <slug>/timeline.js
python tools/render.py --help
python tools/render.py <slug> --still <chosen-seconds>
python tools/render.py jagged-alien-intelligences --module --still 69.2 160.7
python tools/render.py <slug> --from <start> --to <end> --name <new-check-name> --workers 1
ffprobe -v error -show_entries stream=codec_type,duration,width,height,r_frame_rate -show_entries format=duration -of json <export.mp4>
ffmpeg -v error -i <export.mp4> -f null -
```

Check generated analysis syntax only where that JavaScript file exists. Compare audio, scene and exported stream durations with frame/codec rounding. Inspect frames extracted from the export against corresponding stills, allowing lossy differences. Listen to a segment for sync when audio is present. If listening is unavailable, leave perceptual sync unverified. A probe or ASR result does not replace listening.

Compare ready-player PNG exports at t, another time, and t again, decoding pixels outside the browser. Compare t in a fresh context too. Include the first use of an image, altered object states and transitions between them. Investigate mismatches before accepting parallel rendering; the hybrid reference covers scaled-image cache behaviour. Inspect requested crops separately. Missing tools leave concrete checks unperformed.

For a central metaphor, try a brief comprehension review when useful. Give the viewer the clip and ask what changed or who gained control, before explaining the intended reading. Record an actual response separately from an agent's interpretation. An agent can inspect visual evidence but cannot establish audience comprehension by declaring it obvious.

[Saved cases](evals/cases.json) include transfer requests and observed failure modes. They are test inputs and expectations, not completed runs. Replay relevant cases against old and revised procedures when claiming improvement. Record whether evidence is a reading comparison, independent planning run, browser execution, listening or full export. Added instructions alone do not demonstrate better aesthetic results.

## Output

Deliver the inspected preview or export, concept and timing basis, actual checks and remaining editorial or rights questions. Distinguish inferred decisions from accepted choices. Report skill maintenance separately from video acceptance and publication.
