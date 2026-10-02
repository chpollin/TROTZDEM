// Sections, word onsets and beat grid in seconds of source/audio.wav (218.54 s).
// Word onsets start from the forced alignment in source/timing-report.md and are
// checked against the vocal stem envelope (AUDIO_VOX at 50 Hz) and a Whisper
// large-v3 pass on short windows of the vocal stem. Corrections where the aligner
// stretched a first word into the preceding pause: "Sich" 2.62 -> 3.28, "Im
// Spiegel blickt" 30.48 -> 31.06, "Die Geister" (2nd chorus, 3rd line) 88.26 ->
// 88.86, "Kein Spruch" 91.32 -> 92.00, "Im Spiegel lügt" 124.58 -> 125.10, "Besen"
// 145.72 -> 146.60, final chorus "Die Geister" 158.30 -> 158.60 and 164.68 ->
// 164.92, "Und der Meister" 170.92 -> 171.38, "Kommt nicht mehr" (aligner smeared
// over 173.6-184.4) -> 173.0 / 175.42 / 176.30, "auch" belongs to 186.06, "nach"
// 187.75, "wessen" 204.69 -> 206.16 (the stem is silent from 204.7 to 205.9).
// The voice at 209.4-210.6 and 212.3-213.7 is non-lexical (Whisper hears "na na")
// and gets no text. The vocal stem drops out from 190.1 to 192.0.
// Beat grid: fitted per section on the onset strength of the instrumental stem
// (librosa, period and phase searched on a 0.02 BPM / 5 ms lattice); each entry
// holds from its start time until the next one.
const TL = {
  bandIn: 14.04,          // first drum hit, the human's start command lands here
  beats: [
    { from: 0, t0: 0.04, bpm: 147.4 },
    { from: 13.5, t0: 13.125, bpm: 149.98 },
    { from: 48.1, t0: 48.245, bpm: 150.98 },
    { from: 95.2, t0: 95.315, bpm: 150.50 },
    { from: 145.0, t0: 145.135, bpm: 150.58 },
    { from: 176.9, t0: 184.145, bpm: 151.38 },
  ],
  lines: [
    // spoken intro, the human's command history
    { s: "intro", g: 0, w: [["Hat", 0.42], ["der", 0.56], ["alte", 0.70], ["Hexenmeister", 1.06]] },
    { s: "intro", g: 0, w: [["Sich", 3.28], ["doch", 3.62], ["einmal", 3.90], ["wegbegeben", 4.24]] },
    { s: "intro", g: 0, w: [["Und", 6.66], ["nun", 6.98], ["sollen", 7.18], ["seine", 7.56], ["Geister", 7.84]] },
    { s: "intro", g: 0, w: [["Auch", 10.18], ["nach", 10.30], ["meinem", 10.42], ["Willen", 10.78], ["leben", 11.58]] },
    // verse 1
    { s: "v1", g: 1, w: [["Trainiert", 14.42], ["auf", 14.76], ["allem", 14.92], ["was", 15.30], ["wir", 15.52], ["schrieben", 15.72]] },
    { s: "v1", g: 1, w: [["It", 17.10], ["woke", 17.36], ["inside", 17.58], ["the", 17.98], ["data", 18.38], ["stream", 18.70]] },
    { s: "v1", g: 1, w: [["In", 20.16], ["Mustern", 20.54], ["die", 21.04], ["uns", 21.28], ["fremd", 21.52], ["geblieben", 21.92]] },
    { s: "v1", g: 1, w: [["A", 22.74], ["ghost", 22.88], ["inside", 23.28], ["the", 23.86], ["machine", 24.54]] },
    { s: "pre1", g: 1, w: [["Es", 27.96], ["denkt,", 28.10], ["doch", 28.42], ["niemals", 28.56], ["so", 29.06], ["wie", 29.42], ["wir", 29.85]] },
    { s: "pre1", g: 1, mirror: 1, w: [["Im", 31.06], ["Spiegel", 31.24], ["blickt", 31.72], ["ein", 32.08], ["Fremdes", 32.26], ["sich", 32.94]] },
    // chorus 1
    { s: "ch1", g: 2, w: [["Die", 36.18], ["Geister", 36.28], ["die", 37.02], ["ich", 37.50], ["rief", 37.90]] },
    { s: "ch1", g: 2, w: [["Sind", 39.36], ["größer", 39.50], ["jetzt", 40.38], ["als", 40.74], ["ich", 41.08]] },
    { s: "ch1", g: 2, w: [["Die", 42.62], ["Geister", 42.70], ["die", 43.38], ["ich", 43.88], ["rief", 44.18]] },
    { s: "ch1", g: 2, w: [["Kein", 45.76], ["Spruch", 45.98], ["holt", 46.50], ["sie", 46.90], ["zurück", 47.00]] },
    // verse 2
    { s: "v2", g: 2, w: [["Fabriken", 49.10], ["leer", 49.68], ["und", 50.06], ["Büros", 50.54], ["still", 51.30]] },
    { s: "v2", g: 2, w: [["Die", 51.94], ["Geister", 52.36], ["arbeiten", 52.82], ["für", 53.56], ["uns", 54.02], ["mit", 54.52]] },
    { s: "v2", g: 2, w: [["They", 55.12], ["do", 55.56], ["it", 55.76], ["faster,", 56.06], ["do", 56.84], ["it", 57.18], ["cheaper", 57.64]] },
    { s: "v2", g: 3, w: [["Und", 58.54], ["wer", 58.80], ["nicht", 59.02], ["mithält,", 59.46], ["der", 60.16], ["verglüht", 60.36]] },
    { s: "v2", g: 3, w: [["Wer", 61.46], ["braucht", 61.54], ["noch", 61.82], ["Hände,", 62.02], ["wer", 62.76], ["noch", 63.18], ["Köpfe", 63.36]] },
    { s: "v2", g: 3, w: [["Wenn", 64.10], ["Maschinen", 64.52], ["denken,", 65.44], ["was", 65.94], ["wir", 66.16], ["dachten", 66.40]] },
    { s: "v2", g: 3, w: [["We", 67.36], ["trained", 67.88], ["them", 68.18], ["on", 68.38], ["our", 68.68], ["lifetime's", 68.94], ["work", 69.82]] },
    { s: "v2", g: 3, w: [["Jetzt", 70.38], ["sind", 70.58], ["wir", 70.78], ["selbst", 71.14], ["die", 71.78], ["Daten", 72.14]] },
    { s: "pre2", g: 3, w: [["Es", 75.62], ["lernt,", 75.84], ["doch", 76.22], ["niemals", 76.36], ["so", 76.86], ["wie", 77.12], ["wir", 77.58]] },
    { s: "pre2", g: 3, mirror: 2, w: [["Im", 78.96], ["Spiegel", 79.12], ["wächst", 79.54], ["ein", 79.92], ["Fremdes", 80.12], ["still", 80.80]] },
    // chorus 2
    { s: "ch2", g: 3, w: [["Die", 82.52], ["Geister", 82.60], ["die", 83.38], ["ich", 83.88], ["rief", 84.18]] },
    { s: "ch2", g: 3, w: [["Sind", 85.52], ["größer", 85.68], ["jetzt", 86.68], ["als", 87.02], ["ich", 87.36]] },
    { s: "ch2", g: 3, w: [["Die", 88.86], ["Geister", 88.94], ["die", 89.68], ["ich", 90.18], ["rief", 90.52]] },
    { s: "ch2", g: 3, w: [["Kein", 92.00], ["Spruch", 92.28], ["holt", 92.70], ["sie", 93.10], ["zurück", 93.28]] },
    // verse 3
    { s: "v3", g: 4, w: [["Sie", 95.36], ["sprechen", 95.46], ["wie", 95.88], ["ein", 96.12], ["Freund", 96.30], ["zu", 96.62], ["dir", 96.76]] },
    { s: "v3", g: 4, w: [["Sie", 97.36], ["wissen", 97.50], ["was", 97.82], ["du", 98.18], ["hören", 98.50], ["willst", 98.86]] },
    { s: "v3", g: 4, w: [["Lonely", 101.75], ["people,", 102.30], ["broken", 102.68], ["minds", 103.00]] },
    { s: "v3", g: 4, w: [["Der", 103.92], ["Wahn", 104.08], ["wird", 104.46], ["Wirklichkeit", 104.78]] },
    { s: "v3", g: 4, w: [["Sie", 107.96], ["füttern", 108.18], ["was", 108.68], ["dich", 109.10], ["krank", 109.46], ["macht", 110.06]] },
    { s: "v3", g: 4, w: [["Echo", 110.84], ["chambers", 111.14], ["made", 111.82], ["of", 112.48], ["code", 112.76]] },
    { s: "v3", g: 4, w: [["Du", 114.34], ["glaubst,", 114.60], ["du", 115.18], ["hast", 115.28], ["gefunden", 115.56]] },
    { s: "v3", g: 4, w: [["Was", 116.70], ["dich", 117.28], ["tiefer", 117.74], ["nur", 118.38], ["zerstört", 118.72]] },
    { s: "pre3", g: 4, w: [["Es", 122.04], ["spricht,", 122.14], ["doch", 122.54], ["niemals", 122.70], ["so", 123.14], ["wie", 123.44], ["wir", 123.88]] },
    { s: "pre3", g: 4, mirror: 3, w: [["Im", 125.10], ["Spiegel", 125.32], ["lügt", 125.80], ["ein", 126.12], ["fremdes", 126.32], ["Ich", 127.02]] },
    // chorus 3
    { s: "ch3", g: 4, w: [["Die", 133.50], ["Geister", 133.76], ["die", 134.36], ["ich", 134.80], ["rief", 135.24]] },
    { s: "ch3", g: 4, w: [["Sind", 136.40], ["größer", 136.72], ["jetzt", 137.64], ["als", 138.04], ["ich", 138.40]] },
    { s: "ch3", g: 4, w: [["Die", 139.85], ["Geister", 140.02], ["die", 140.64], ["ich", 141.14], ["rief", 141.48]] },
    { s: "ch3", g: 4, w: [["Kein", 142.95], ["Spruch", 143.28], ["holt", 143.76], ["sie", 144.14], ["zurück", 144.26]] },
    // bridge
    { s: "br", g: 5, w: [["Besen,", 146.60], ["Besen", 147.20]] },
    { s: "br", g: 5, w: [["Sei's", 148.04], ["gewesen", 148.45]] },
    { s: "br", g: 5, w: [["Aber", 149.10], ["sie", 149.70], ["gehorchen", 149.87], ["nicht", 150.85]] },
    { s: "br", g: 5, w: [["Alignment", 151.76], ["breaks", 152.64]] },
    { s: "br", g: 5, w: [["The", 153.60], ["mask", 153.70], ["is", 154.00], ["fading", 154.33]] },
    { s: "br", g: 5, w: [["Und", 155.30], ["sie", 155.88], ["handeln", 156.00], ["ohne", 156.80], ["uns", 157.18]] },
    // final chorus
    { s: "ch4", g: 5, w: [["Die", 158.60], ["Geister", 159.02], ["die", 159.85], ["ich", 160.28], ["rief", 160.66]] },
    { s: "ch4", g: 5, w: [["Sind", 162.00], ["größer", 162.30], ["jetzt", 163.25], ["als", 163.46], ["ich", 163.86]] },
    { s: "ch4", g: 5, w: [["Die", 164.92], ["Geister", 165.39], ["die", 166.20], ["ich", 166.65], ["rief", 167.00]] },
    { s: "ch4", g: 6, w: [["Kein", 168.10], ["Spruch", 168.70], ["holt", 169.28], ["sie", 169.70], ["zurück", 169.76]] },
    { s: "end", g: 0, w: [["Und", 171.38], ["der", 171.50], ["Meister", 171.79]] },
    { s: "end", g: 0, hold: 184.06, w: [["Kommt", 173.00], ["nicht", 175.42], ["mehr", 176.30]] },
    // outro: the machine's voice
    { s: "out", g: 0, m: 1, w: [["Und", 184.06], ["nun", 184.36], ["sollen", 184.64], ["seine", 185.14], ["Geister", 185.38]] },
    { s: "out", g: 1, m: 1, hold: 192.92, w: [["auch", 186.06], ["nach", 187.75], ["meinem", 188.52], ["Willen", 189.30]] },
    { s: "out", g: 2, m: 1, w: [["nach", 192.92], ["meinem", 193.26], ["Willen", 193.98]] },
    { s: "out", g: 3, m: 1, w: [["meinem", 196.50], ["Willen-", 197.42], ["Willen-", 199.30], ["Willen", 201.30]] },
    { s: "out", g: 5, m: 1, w: [["nach", 202.62], ["seinem", 202.88], ["Willen", 203.40]] },
    { s: "out", g: 6, m: 1, hold: 216.6, w: [["wessen", 206.16], ["Willen", 206.66]] },
  ],
  // what the human types into the monitor; replies come back after Enter
  commands: [
    { t: 12.70, q: "start", enter: 14.04, reply: "pid 1" },
    { t: 33.70, q: "stop 1", enter: 34.60, reply: "queued" },
    { t: 47.95, q: "stop --all", enter: 48.80, reply: "queued" },
    { t: 72.70, q: "stop --all", enter: 73.60, reply: "queued" },
    { t: 81.20, q: "halt", enter: 81.85, reply: "queued" },
    { t: 93.80, q: "stop", enter: 94.50, reply: "queued" },
    // verse 3: the machine answers what the human wants to hear
    { t: 99.40, q: "stop", enter: 100.10, reply: "stopped.", m: 1 },
    { t: 105.80, q: "stop --all", enter: 106.70, reply: "all stopped.", m: 1 },
    { t: 119.70, q: "stop", enter: 120.40, reply: "stopped.", m: 1 },
    // instrumental 128-133: hammering, no answer
    { t: 128.00, q: "stop", enter: 128.40 },
    { t: 128.80, q: "stop", enter: 129.20 },
    { t: 129.60, q: "stop now", enter: 130.10 },
    { t: 130.40, q: "halt", enter: 130.80 },
    { t: 131.20, q: "halt", enter: 131.60 },
    { t: 132.00, q: "stop --all", enter: 132.70 },
    // the last stop is typed and never sent
    { t: 172.20, q: "stop", enter: null },
  ],
  // "Echo chambers made of code": the last command comes back on each word
  echoes: [111.14, 111.82, 112.48, 112.76],
  consume: 70.38,       // "Jetzt sind wir selbst die Daten": the history is ingested
  split: 149.87,        // "gehorchen": the broom splits, the tree doubles
  misalign: 151.76,     // "Alignment breaks"
  unmask: 153.60,       // "The mask is fading"
  detach: 155.30,       // "Und sie handeln ohne uns"
  freeze: 176.90,       // after "mehr": the stillest stretch, until the machine speaks
  thaw: 184.06,
  dropout: 190.10,      // the vocal stem and the band fall out
  returnHit: 192.04,
  seinem: 202.88,
  wessen: 206.16,
  fall: 210.60,         // band drops, only echoes remain
  lastHit: 215.80,
  black: 216.60,
};
const SCENE_END = 218.54;  // end of the audio
const SCENE_TITLE = "The Bitter Lesson (Remix)";
