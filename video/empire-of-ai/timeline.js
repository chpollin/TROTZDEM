// Section and line onsets in seconds of source/audio.wav. Each lyric line has
// parts; a part is typed from a to b while its words are sung. who: "me" is the
// singer (Redaction), "them" is the world answering or being quoted (Space Mono).
//
// Evidence. The drums lock to a 150 BPM grid through the whole song: the hits at
// 13.22 (verse 1), 44.84, 97.26, 118.84, 146.02 (cut), 157.22 (verse 3), 169.22
// and 195.64 (last loud beat) all sit on 13.22 + 0.4 k. The vocal stem carries
// heavy instrumental bleed, so silences are rare; onsets come from the forced
// alignment where it agrees with the free transcription, and from the
// transcription where the aligner stretched a first word (pre-choruses, verse 2
// start "Multi" at the drum re-entry 65.42 instead of 62.92, "Gestern" at the
// verse 3 slam). The free transcription misses verse 1, whose aligned line starts
// fall on the two-bar grid and are kept. Sung but not written: a second
// "Papers! (copy, paste)" at 123.54 and a second "Hört ihr nicht?" at 131.42.
// The outro is sung later than aligned: "New context" 195.9, "Why does nobody"
// 199.04, the interrupt on the hit at 200.48, "Die Empire of AI" 201.14,
// "niemand sagt was" 203.84 to 206.4. Audio fades out at 208.6.
const TL = {
  beat0: 13.22, beat: 0.4,
  verse1: 13.22,
  pre1: 38.8,
  chorus1: 45.22,
  echo: 62.58,
  verse2: 65.42,
  pre2: 90.9,
  chorus2: 97.62,
  bridge: 118.82,
  breakdown: 146.02,
  verse3: 157.22,
  final: 169.22,
  outro: 195.64,
  interrupt: 200.48,
  fade: 207.4,

  // spans in which every box of the empire is "typing"
  talk: [[59.06, 61.0], [112.68, 115.4], [184.68, 187.4]],
  // second "Empire of AI" of each chorus: a rollout wave through the hierarchy
  rollout: [49.96, 102.58, 174.68],

  lines: [
    { grade: 4, parts: [{ q: "Context window: 200k…", a: 7.0, b: 10.2 }, { q: " alles passt rein…", a: 11.06, b: 12.5 }] },

    { grade: 1, parts: [{ q: "Mitte Dreißig, ich hab den Workflow geknackt", a: 13.24, b: 15.6 }] },
    { grade: 1, parts: [{ q: "Neunzig K an einem Wochenende – zack", a: 16.08, b: 18.7 }] },
    { grade: 1, parts: [{ q: "Jedes Paper, jede Forschung, jeden Scheiß", a: 19.3, b: 22.1 }] },
    { grade: 1, parts: [{ q: "Claude Code schreibt's besser als ich's weiß", a: 22.56, b: 25.1 }] },
    { grade: 1, parts: [{ q: "Die Leute labern noch von R A G und kleinen Modellen", a: 25.36, b: 28.3 }] },
    { grade: 1, parts: [{ q: "Doch die Empire of AI wird uns alle fällen", a: 28.72, b: 31.3 }] },
    { grade: 1, parts: [{ q: "„Fine-tuning! Open Source!“", a: 31.48, b: 33.3, who: "them" }, { q: " – Ja, ich weiß", a: 33.76, b: 34.6 }] },
    { grade: 1, parts: [{ q: "Ich bau grad die Maschine, die uns beißt", a: 35.2, b: 37.3 }] },

    { grade: 2, parts: [{ q: "Ich zeig's euch live", a: 39.2, b: 40.1 }, { q: " (niemand schaut)", a: 40.86, b: 41.8, who: "them" }] },
    { grade: 2, parts: [{ q: "Ich schrei's euch zu", a: 42.38, b: 43.3 }, { q: " (niemand glaubt)", a: 44.06, b: 44.9, who: "them" }] },

    { grade: 3, parts: [{ q: "Empire of AI", a: 45.24, b: 46.9 }] },
    { grade: 3, parts: [{ q: "Google,", a: 47.54, b: 47.9 }, { q: " Anthropic,", a: 48.28, b: 48.62 }, { q: " OpenAI", a: 48.66, b: 49.1 }] },
    { grade: 3, parts: [{ q: "Empire of AI", a: 49.96, b: 51.6 }] },
    { grade: 3, parts: [{ q: "Neunzig K und keiner will's verstehen", a: 52.58, b: 54.5 }] },
    { grade: 3, parts: [{ q: "„Der spinnt komplett“", a: 54.88, b: 55.6, who: "them" }] },
    { grade: 3, parts: [{ q: "Empire of AI", a: 56.06, b: 57.9 }] },
    { grade: 3, parts: [{ q: "Viele reden, niemand sagt was", a: 59.06, b: 60.8 }] },
    { grade: 3, parts: [{ q: "Trotzdem mach ich's", a: 61.02, b: 62.3 }] },
    { grade: 3, dim: true, parts: [{ q: "(Trotzdem mach ich's)", a: 62.58, b: 63.9 }] },

    { grade: 2, parts: [{ q: "Multi-Agent-Flow,", a: 65.85, b: 66.9 }, { q: " Context Engineering", a: 67.08, b: 68.0 }] },
    { grade: 2, parts: [{ q: "Ich ersetz' euch alle, das ist kein Ding", a: 68.16, b: 71.5 }] },
    { grade: 2, parts: [{ q: "Die Tech-Kritiker sagen", a: 71.7, b: 72.9 }, { q: " „KI ist noch dumm“", a: 73.08, b: 74.6, who: "them" }] },
    { grade: 2, parts: [{ q: "Haben recht – und liegen trotzdem falsch herum", a: 75.02, b: 77.6 }] },
    { grade: 2, parts: [{ q: "Tweet den Proof – 47 Likes", a: 77.92, b: 80.0 }] },
    { grade: 2, parts: [{ q: "„Nur ein stochastischer Papagei“", a: 80.36, b: 83.2, who: "them" }, { q: " – right", a: 83.62, b: 84.0 }] },
    { grade: 2, parts: [{ q: "Claude debuggt meinen eignen Code", a: 84.26, b: 87.5 }] },
    { grade: 2, parts: [{ q: "Ich bin der Architekt vom eignen Tod", a: 88.18, b: 90.6 }] },

    { grade: 3, parts: [{ q: "Versteht ihr nicht?", a: 92.1, b: 93.2 }, { q: " (niemand hört)", a: 93.62, b: 94.5, who: "them" }] },
    { grade: 3, parts: [{ q: "Das ist das End!", a: 94.64, b: 96.1 }, { q: " (keinen stört's)", a: 96.24, b: 97.4, who: "them" }] },

    { grade: 4, parts: [{ q: "Empire of AI", a: 97.76, b: 99.6 }] },
    { grade: 4, parts: [{ q: "Google,", a: 99.84, b: 100.3 }, { q: " Anthropic,", a: 101.04, b: 101.45 }, { q: " OpenAI", a: 101.52, b: 102.0 }] },
    { grade: 4, parts: [{ q: "Empire of AI", a: 102.58, b: 104.4 }] },
    { grade: 4, parts: [{ q: "Sie bauen Götter, wir schauen zu dabei", a: 104.68, b: 107.0 }] },
    { grade: 4, parts: [{ q: "„Ist doch nur Hype“", a: 107.22, b: 109.1, who: "them" }] },
    { grade: 4, parts: [{ q: "Empire of AI", a: 109.46, b: 112.3 }] },
    { grade: 4, parts: [{ q: "Viele reden, niemand sagt was", a: 112.68, b: 115.2 }] },
    { grade: 4, parts: [{ q: "Trotzdem mach ich's", a: 115.87, b: 116.9 }] },
    { grade: 4, dim: true, parts: [{ q: "(Immer trotzdem)", a: 117.12, b: 118.0 }] },

    // the bridge is drawn by its own scene from TL.shouts
    { grade: 5, still: true, parts: [{ q: "Die Empire of AI…", a: 146.68, b: 149.8 }] },
    { grade: 5, still: true, parts: [{ q: "braucht nicht…", a: 151.2, b: 152.0 }] },
    { grade: 5, still: true, parts: [{ q: "perfekt zu sein…", a: 153.96, b: 155.8 }] },

    { grade: 0, parts: [{ q: "Gestern hab ich mich selbst ersetzt", a: 157.24, b: 159.5 }] },
    { grade: 0, parts: [{ q: "YAML-Files, alles vernetzt", a: 160.04, b: 162.3 }] },
    { grade: 0, parts: [{ q: "Fünf Jahre Arbeit – dreißig Sekunden", a: 163.04, b: 166.0 }] },
    { grade: 0, parts: [{ q: "Die KI hat mich längst gefunden", a: 166.44, b: 169.0 }] },

    { grade: 4, parts: [{ q: "Empire of AI", a: 169.28, b: 171.6 }] },
    { grade: 4, parts: [{ q: "Google,", a: 171.9, b: 172.4 }, { q: " Anthropic,", a: 173.02, b: 173.5 }, { q: " OpenAI", a: 173.82, b: 174.4 }] },
    { grade: 4, parts: [{ q: "Empire of AI", a: 174.68, b: 176.5 }] },
    { grade: 4, parts: [{ q: "Der Einzige, der's sieht, und trotzdem", a: 176.78, b: 179.0 }] },
    { grade: 4, parts: [{ q: "Push ich's live", a: 179.14, b: 180.9 }] },
    { grade: 4, parts: [{ q: "Empire of AI", a: 181.22, b: 184.4 }] },
    { grade: 4, parts: [{ q: "Viele reden, niemand sagt was", a: 184.68, b: 187.2 }] },
    { grade: 4, parts: [{ q: "Ich mach's trotzdem", a: 187.42, b: 188.6 }] },
    { grade: 4, dim: true, parts: [{ q: "(Immer trotzdem)", a: 188.78, b: 189.9 }] },
    { grade: 4, dim: true, parts: [{ q: "(Immer trotzdem)", a: 190.3, b: 191.6 }] },

    { grade: 5, still: true, parts: [{ q: "Die Empire of AI…", a: 201.14, b: 203.5 }] },
    { grade: 5, still: true, parts: [{ q: "…niemand sagt was", a: 203.84, b: 206.4 }] },
  ],

  // Bridge: shouted words fill the stage, the bracketed answers are keys pressed.
  shouts: [
    { q: "ICH", t: 118.82 }, { q: "ICH KANN", t: 119.54 }, { q: "ICH KANN ALLES!", t: 120.22 },
    { q: "Papers!", t: 121.22 },
    { q: "Papers!", t: 123.54 },
    { q: "Forschung!", t: 125.12 },
    { q: "ALLES!", t: 126.82 },
    { q: "HÖRT IHR NICHT?", t: 129.98 },
    { q: "HÖRT IHR NICHT?", t: 131.42, again: true },
    { q: null, t: 134.0 },
    { q: "JA, UND?", t: 136.44 },
    { q: null, t: 138.0 },
    { q: "SO WHAT?", t: 139.88 },
    { q: "NEUNZIG K!", t: 141.04 },
    { q: "EIN WEEKEND!", t: 142.85 },
  ],
  keys: [
    { q: "copy", t: 122.48 }, { q: "paste", t: 123.0 },
    { q: "copy", t: 124.02 }, { q: "paste", t: 124.61 },
    { q: "prompt", t: 125.6 }, { q: "send", t: 126.0 },
    { q: "enter", t: 128.77 }, { q: "done", t: 129.22 },
  ],
  bridgeQuotes: [
    { q: "„Es halluziniert!“", a: 134.0, b: 135.9, until: 136.44 },
    { q: "„Kein echtes Verstehen!“", a: 138.0, b: 139.5, until: 139.88 },
  ],

  prompt: [{ q: "New context:", a: 195.9, b: 197.0 }, { q: " Why does nobody", a: 199.04, b: 199.62 }],
};
const SCENE_END = 209.32;  // end of the audio
const SCENE_TITLE = "Empire of AI";
