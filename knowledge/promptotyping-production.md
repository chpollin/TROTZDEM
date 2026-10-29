---
title: Promptotyping Production
project:
  name: TROTZDEM
  repository: https://github.com/chpollin/TROTZDEM
method:
  name: Promptotyping
  url: https://dhcraft.org/Promptotyping/
status: draft
created: 2026-10-29
updated: 2026-10-29
language: en
generated-with: Claude Code (Claude Opus 5.5)
related: [songwriting-guidelines.md, video-pipeline-architecture.md, handoff.md]
---

# Promptotyping Production

Treatment and production plan for the song Promptotyping, a companion to the operator's paper on Promptotyping. The operator accepted the core reading on 2026-10-29: it is intoxicating that one can now build everything oneself, and the real work is no longer building but checking, which stays with oneself. The treatment below is a plan. No recording exists yet, so every timing statement is an intention until the timing report replaces it.

## Maintained sources

[suno-lyrics.txt](../video/promptotyping/suno-lyrics.txt) carries the author wording and delivery tags. [style-prompt.txt](../video/promptotyping/style-prompt.txt) is the music direction, derived from the Lost in the Vault prompt, whose Suno persona is the intended voice. The song stages its own making as a Promptotyping workflow: preparation, exploration, a knowledge base, three chorus versions as promptotypes, two human verdicts that are written back into the knowledge base, a new session that continues from the documents, and a final validation.

The lyrics make almost no factual claims. "Kein Geld" holds for two of the paper's three cases. "Hundert gebaut, geprüft erst eins" is a marked exaggeration of the paper's finding that validation, not building, now carries the effort. The album `sources` field cites the paper.

## Creative brief

The lyrics are the research material. Every artefact in the video is built from the song's own words, which are transcribed, profiled, distilled, mapped, dated, versioned and finally validated. The lyrics are therefore never overlaid captions but the data the researcher works on.

The video is a mirror of the operator without a face. The artefacts are abstractions of his own artefact types: a correspondence map and timeline (CorrespExplorer), a facsimile viewer with transcription boxes (SZD-HTR), a work and edition graph (Klawiter-Rescue), an account book ledger (the DEPCHA and dissertation background) and a knowledge graph (a nod to Lost in the Vault). No real data, facsimile or product interface appears, which keeps the album's exclusion of real brands and avoids rights questions about archive material.

The emotional movement runs from a lonely, quiet start through a growing rush of building to a hard stop. The strongest state change is the pull-back after "Who validates this?", when hundreds of built artefacts carry a grey unvalidated mark and only one is validated by the human.

## Visual language and continuity

- A split frame. The left column holds the knowledge base (data.md, specification.md, journal.md, CLAUDE.md) as a file tree with growing lines. The right side holds the artefacts. The two halves mirror each other across a thin vertical axis, so that what is written on the left is built on the right. The axis disappears on the last line.
- Code-only line drawing in the manner of the paper's Figure 1, white lines on charcoal, with one accent for the human: the caret, red correction strokes and the validation mark. Proposed accent `#3fe0a8`, which no earlier song uses. The operator decides.
- Lyrics sung by the human are set in Redaction, machine text and interface text in Space Mono. The Redaction damage grades carry distillation: a bloated line starts at a heavy grade and restores to the regular cut as it condenses.
- A status bar with Graz, a clock running from 22:00 to 04:00, a coffee counter and a tab counter. The clock carries the addiction without explanation.
- Stable across the whole video: the left column, the human caret with its label `researcher`, the coffee cup and the status bar.

## Lyric events and visual actions

| Lyric | Intended reading | Visible action |
|---|---|---|
| Intro a cappella | Preparation, nothing but an idea | An empty file `idee.md`. The caret types the sung lines syllable by syllable and corrects one typo live. A drawn coffee cup. 22:00 |
| Reading source material | Material arrives | The intro lines become handwriting on an abstract facsimile, transcription boxes settle over them and read them back as text |
| Thinking, exploring | Exploration of the material | A histogram over the lyrics with axis labels taken from the line: one voice, German, angry, tired |
| Roll-call | Distillation creates the knowledge base | Each file appears in the left column on its beat, and its sung German line is written as its first line |
| Version one | First promptotype | An 8-bit map. "Prompto", "Typing", "Developer", "Not required", "Output generated" sit as place names beside letter dots |
| Nein | Scholarly validation rejects it | Freeze. A red handwritten correction stroke crosses the map, which turns grey |
| Du singst mein Lied, doch du kennst mich nicht | Criticism becomes knowledge | The line lands in journal.md with a timestamp |
| Ich destillier, ich koch es ein | Distillation | Each line appears first as an inflated paragraph. Words drop out while it is sung until only the sung line remains, restoring from a damaged to the regular Redaction grade |
| Version two | Second promptotype, the rush begins | The map rebuilds cleanly, a timeline with the chorus lines as dated events (22:47 PROMPTOTYPING) appears beside it, and the caret starts a third artefact before the second is finished |
| Fast. Aber lauter. Und wo ist meine Wut? | Second verdict | The chorus type literally grows, then turns red and jagged. specification.md receives a line |
| Context window full. New session. | The agent forgets | The right half is cleared like a terminal clear. The left column stays |
| Du liest es, Wort für Wort | Context engineering | Single words travel as points of light from the files to the right and rebuild the artefacts in seconds |
| Ich nenn es Promptotyping, damit es nach Methode klingt | Self-irony | The line is typeset as the title page of a paper, with serif title, abstract block and a footnote. A still moment. 02:30, coffee 6 |
| Version three, MARKDOWN | The rush | Giant `#` headings strike on the shouts. A commit log scrolls, every commit message a lyric fragment, every commit spawning an artefact. Windows tile, the clock races, the counters spin. Every artefact carries a small grey dot |
| Final chorus | The refrain as a structure | The chorus words become nodes of a network whose edges connect the repetitions |
| Develo— | Hard stop | The word splits into tokens. `Develo` appears, the next token is missing, everything freezes |
| Who validates this? | The real problem | Pull-back across hundreds of artefacts, all with grey dots, and one line: `validated: 0` |
| Ich | Validation stays with the human | The word is typed into a terminal prompt and confirmed with Enter. One artefact receives the accent dot. `validated: 1` |
| Reprise | Return to the start | Back in `idee.md`, shown as a diff against the intro. "kein Lied" struck in red, "ein Lied" in green, the third line replaced by "Hundert gebaut, geprüft erst eins". 04:00 |
| Ich bin jetzt selber einer | The mirror closes | The line becomes the author line of a commit, the caret label changes from `researcher` to `researcher \| developer`, and the mirror axis disappears |

## Production steps

1. The operator generates the song in Suno with the Lost in the Vault persona, re-enters the style after choosing the persona and downloads the chosen take officially, preferably as WAV, to `video/promptotyping/source/audio.wav`. The take is backed up outside the repository.
2. `tools/prepare_local.py promptotyping` with the lyrics separates the vocals, aligns the lyrics and measures tempo and loudness. The many spoken lines and hard stops are timed from vocal loudness where Whisper fails. The timing report is the evidence for every onset.
3. `timeline.js` holds sections, line onsets and the editorial events of the table above, including the verdict freezes, the clear, the pull-back and the counter values. Scene captions, subtitles and page cues read this one source.
4. Keyframes for review before the full scene: the roll-call, the peak of the rush, the pull-back with `validated: 0` and the final diff. The operator accepts the look and the reading at these frames.
5. `scene.js` as a classic code-only scene with `drawScene(ctx, t)`, seeded randomness and cached text tiles. Artefact types are drawn as reusable functions, because the rush needs many instances.
6. Checks as for Jagged Alien Intelligences: timeline and caption consistency, deterministic frames after seeking and in a fresh browser context, readable lyrics at the phone crop, no large-area flashing above three per second during the rush.
7. Stills and short segments, then a full render with at most two workers and no competing render.
8. The operator accepts the video. Album integration through `tools/build_album.py` with poster time, accent, `making.txt`, the paper as source and a context note. Release upload and push remain with the operator.

## Open decisions and risks

- Suno renders arrangement and voice tags only approximately. The build-up from a cappella, the stiff first chorus and the hard stops may need several generations. The video carries the build-up through the version counter and the growing knowledge base regardless of how exactly Suno follows.
- The many short spoken lines are the hardest timing case. Where alignment fails, onsets come from loudness and are marked as editorial in the timeline.
- Text density during the rush must stay readable at phone size. The rush may show fragments, but every sung line must be legible somewhere at its onset.
- The paper title page is a mirror of the operator's real paper. Whether it shows the real title and name or a stylised version is the operator's decision.
- The album already has a song about addiction to the coding tool. This video shows addiction to building artefacts and borrows only the tab counter from that earlier staging.
