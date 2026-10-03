---
title: Songwriting Guidelines
project:
  name: TROTZDEM
  repository: https://github.com/chpollin/TROTZDEM
method:
  name: Promptotyping
  url: https://dhcraft.org/Promptotyping/
status: draft
created: 2026-10-03
updated: 2026-10-03
language: en
authors: [Christopher Pollin]
generated-with: Claude Code (Claude Opus 5.5)
related: [project.md, video-pipeline-architecture.md]
---

# Songwriting Guidelines

New songs for TROTZDEM are written so that they sound like the album and hold up factually. The rules below were derived from an analysis of the lyrics and Suno prompts of the first album songs and from the work on Agent Swarm, Situational Awareness and Recursive Self-Improvement in October 2026. How a finished song becomes a video is described in [video-pipeline-architecture.md](video-pipeline-architecture.md).

## Fact checking

Every claim a song makes about AI research or a documented incident is checked against primary sources that were read in full, and the song cites them in the `sources` field of `video/songs.json`. A source that could not be read completely is not cited. A line may exaggerate, but it may not state something false, and a fictional escalation is named as fiction in the context `note`. The checking happens before the lyrics are final, yet the lyrics are written as a song first. One strong image and two or three findings carry a song, and the remaining evidence belongs in the sources field. A song that works through one finding per line reads like a lecture.

## Language

German is the human, the feeling and the explanation. English is the machine, the lab and every technical term. Technical terms always stay English (helpful, honest, harmless, Chain of Thought, Sandbagging, Steering, Free Tier, Grader). A frequent device places the English term on its own line and lets the German line after it say what it means. Rhymes may cross the language border (Thought with fort, Run with kann, disclaim with Reim).

## Lyrics

The album's lyrics share these features, and new songs keep them.

- One insistent line that returns through the song and breaks or turns at the end.
- Simple end rhymes that may stumble, mostly in four-line stanzas with lines of similar length, because even lines let Suno place the melody cleanly.
- The machine speaking in its own register, with system messages, assistant phrases and, for reasoning models, the frame "Thinking…" and "Thought for N seconds" around terse English thinking tokens.
- Outbursts in capitals or screams instead of uniformly smooth lines.
- A collapse at the end, with broken-off words and a small quiet last line.
- Abbreviations spelled as Suno should pronounce them, such as "A P I".
- One self-ironic line, so that a song is not only heavy.
- A structure that enacts the subject where possible, such as a song that rewrites itself version by version or a hook that changes from one voice to many.

Titles are short, mostly English, and often quote a technical term or a known text verbatim. The title is usually also the hook.

## Suno prompt

The style prompt is compact. The voice comes first, then the genre core of the album, then one or two terms that sharpen the song's subject, then meter and tempo. Adjectives such as "melodic", "clean" or "catchy" pull Suno towards pop and are avoided. The exclude field lists pop, clean vocals, polished and autotune. A Suno persona made from an album song keeps the singer's voice more reliably than any description. Choosing a persona overwrites the style field, which is then filled again.

Lyrics carry bracket tags for structure and delivery (`[Verse]`, `[Chorus]`, `[Spoken]`, `[Whispered]`, `[Scream]`, `[Strained]`, `[Break]`). Other voices are described inside the bracket, for example a clinical female voice for an evaluation prompt. Suno renders such voice descriptions only approximately, so a video never relies on audibly distinct voices. Tempo and meter in the prompt are a wish, and the measured values in the timing report decide what a video shows.

## Audio

Videos use the official download of a paid plan, as [project.md](project.md) requires for public use. WAV is preferred because vocal separation works more cleanly on lossless audio. An MP3 download is converted to `source/audio.wav` before `prepare_local.py`.
