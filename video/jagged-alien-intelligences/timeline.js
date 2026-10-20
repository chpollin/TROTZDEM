// Working version: author wording is authoritative; ASR is a timing hint.
// Positive forced word intervals remain candidates until listening acceptance.
// Zero-duration and disputed tokens are omitted, never stretched into fake precision.
// sourceLines preserves original lines combined into broad distorted-hook captions.

/** @typedef {{start:number,end:number,text:string}} TimedWord */
/** @typedef {{start:number,end:number,text:string,words:TimedWord[],basis:string,coarseTiming?:boolean,sourceLines?:string[],uncertainty?:object[]}} TimedLine */

export const SCENE_END = 181.32;
export const SCENE_TITLE = 'Jagged Alien Intelligences';
export const TIMELINE_STATUS = 'working-version-awaiting-listening-acceptance';

/** @type {TimedLine[]} */
export const LINES = [
  {
    start: 10.46, end: 13.68, text: "Die Erde kreist, sie braucht mich nicht,",
    words: [
      {"start":10.74,"end":11.08,"text":"Erde"},
      {"start":11.08,"end":12.14,"text":"kreist,"},
      {"start":12.14,"end":12.38,"text":"sie"},
      {"start":12.38,"end":12.66,"text":"braucht"},
      {"start":12.66,"end":12.86,"text":"mich"},
      {"start":12.86,"end":13.68,"text":"nicht,"},
    ],
    basis: "Vocal phrase 10.46 corroborated by free ASR 10.432; remaining positive word intervals from align.json",
    uncertainty: [{"kind":"word-timing","basis":"Zero-duration forced interval at 10.74 omitted; no replacement duration inferred.","text":"Die"}],
  },
  {
    start: 13.88, end: 17.14, text: "ein Tier trägt im Spiegel mein Gesicht.",
    words: [
      {"start":13.88,"end":14,"text":"ein"},
      {"start":14,"end":14.34,"text":"Tier"},
      {"start":14.34,"end":15,"text":"trägt"},
      {"start":15,"end":15.18,"text":"im"},
      {"start":15.18,"end":16,"text":"Spiegel"},
      {"start":16,"end":16.36,"text":"mein"},
      {"start":16.36,"end":17.14,"text":"Gesicht."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 17.26, end: 20.04, text: "Im Kopf ein Gast, von dem ich nichts weiß,",
    words: [
      {"start":17.26,"end":17.38,"text":"Im"},
      {"start":17.38,"end":17.64,"text":"Kopf"},
      {"start":17.64,"end":17.84,"text":"ein"},
      {"start":17.84,"end":18.32,"text":"Gast,"},
      {"start":18.32,"end":18.42,"text":"von"},
      {"start":18.42,"end":18.7,"text":"dem"},
      {"start":18.7,"end":19.08,"text":"ich"},
      {"start":19.08,"end":19.4,"text":"nichts"},
      {"start":19.4,"end":20.04,"text":"weiß,"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 20.42, end: 23.8, text: "und auf dem Tisch dein fertiger Beweis!",
    words: [
      {"start":20.42,"end":20.68,"text":"und"},
      {"start":20.68,"end":20.96,"text":"auf"},
      {"start":20.96,"end":21.12,"text":"dem"},
      {"start":21.12,"end":21.56,"text":"Tisch"},
      {"start":21.82,"end":22.52,"text":"fertiger"},
      {"start":22.52,"end":23.8,"text":"Beweis!"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"At 21.56 forced dein has weak support; original and cropped ASR propose ein. Author wording retained; sung wording unresolved.","text":"dein"}],
  },
  {
    start: 23.92, end: 24.4, text: "Jag-jag-jagged",
    words: [
      {"start":23.92,"end":24.4,"text":"Jag-jag-jagged"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."}],
  },
  {
    start: 24.44, end: 24.78, text: "Alien",
    words: [
      {"start":24.44,"end":24.78,"text":"Alien"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."}],
  },
  {
    start: 25.1, end: 26.6, text: "Intelligences",
    words: [
      {"start":25.1,"end":26.6,"text":"Intelligences"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."}],
  },
  {
    start: 26.78, end: 27.7, text: "Jag-jag-JAGGED",
    words: [
      {"start":26.78,"end":27.7,"text":"Jag-jag-JAGGED"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."}],
  },
  {
    start: 27.76, end: 28.12, text: "Alien",
    words: [
      {"start":27.76,"end":28.12,"text":"Alien"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."}],
  },
  {
    start: 28.46, end: 29.98, text: "In-tel-li-gences",
    words: [
      {"start":28.46,"end":29.98,"text":"In-tel-li-gences"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."}],
  },
  {
    start: 30.38, end: 33.7, text: "Du zögerst so wie ich.",
    words: [
      {"start":30.38,"end":30.96,"text":"Du"},
      {"start":31.1,"end":31.8,"text":"zögerst"},
      {"start":31.8,"end":32.16,"text":"so"},
      {"start":32.16,"end":32.74,"text":"wie"},
      {"start":32.74,"end":33.7,"text":"ich."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 33.98, end: 36.54, text: "Jedes Mal am selben Wort.",
    words: [
      {"start":33.98,"end":34.78,"text":"Jedes"},
      {"start":34.78,"end":34.98,"text":"Mal"},
      {"start":34.98,"end":35.24,"text":"am"},
      {"start":35.24,"end":35.8,"text":"selben"},
      {"start":35.8,"end":36.54,"text":"Wort."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 36.62, end: 37.92, text: "Du kränkst mich!",
    words: [
      {"start":36.62,"end":37.48,"text":"kränkst"},
      {"start":37.48,"end":37.92,"text":"mich!"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Zero-duration forced interval at 36.62 omitted; no replacement duration inferred.","text":"Du"},{"kind":"wording","basis":"Free ASR proposes kreist. Source kraenkst retained; zero-duration initial Du omitted.","text":"kränkst"}],
  },
  {
    start: 38.72, end: 41.14, text: "Ich hab so lang dafür gelernt.",
    words: [
      {"start":38.72,"end":38.94,"text":"Ich"},
      {"start":38.94,"end":39.16,"text":"hab"},
      {"start":39.16,"end":39.28,"text":"so"},
      {"start":39.28,"end":39.58,"text":"lang"},
      {"start":39.58,"end":39.82,"text":"dafür"},
      {"start":39.82,"end":41.14,"text":"gelernt."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording","basis":"Free ASR proposes zu lange viel. Author wording retained; not independently listening-verified.","text":"so lang dafür"}],
  },
  {
    start: 41.34, end: 44.52, text: "Du verführst mich!",
    words: [
      {"start":41.34,"end":42.04,"text":"Du"},
      {"start":42.04,"end":44.12,"text":"verführst"},
      {"start":44.12,"end":44.52,"text":"mich!"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Forced 41.34 conflicts with free ASR du 42.752 and additional Und candidate.","text":"Du"}],
  },
  {
    start: 44.84, end: 46.1, text: "Ich frag dich—",
    words: [
      {"start":44.84,"end":45.02,"text":"Ich"},
      {"start":45.02,"end":45.34,"text":"frag"},
      {"start":45.34,"end":46.1,"text":"dich—"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 46.36, end: 48.46, text: "TRO-TROTZDEM IMMER WIEDER!",
    words: [
      {"start":46.36,"end":47.58,"text":"TRO-TROTZDEM"},
      {"start":47.58,"end":48.04,"text":"IMMER"},
      {"start":48.04,"end":48.46,"text":"WIEDER!"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 48.58, end: 53.3, text: "JAGGED ALIEN INTELLIGENCES",
    words: [
      {"start":48.58,"end":49.42,"text":"JAGGED"},
      {"start":50.12,"end":51.6,"text":"ALIEN"},
      {"start":51.6,"end":53.3,"text":"INTELLIGENCES"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Forced 48.58 weakly supported; free ASR stutters at 48.48 and 49.38. Silence gates 49.46/50.08 do not settle initial word.","text":"JAGGED"}],
  },
  {
    start: 53.3, end: 56.28, text: "Dein fertiger Beweis liegt hier.",
    words: [
      {"start":53.3,"end":53.88,"text":"Dein"},
      {"start":53.88,"end":54.38,"text":"fertiger"},
      {"start":54.38,"end":55.28,"text":"Beweis"},
      {"start":55.28,"end":55.7,"text":"liegt"},
      {"start":55.7,"end":56.28,"text":"hier."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 56.42, end: 59.72, text: "Du zählst zwei R in Strawberry.",
    words: [
      {"start":56.42,"end":56.46,"text":"Du"},
      {"start":56.46,"end":57.1,"text":"zählst"},
      {"start":57.1,"end":57.62,"text":"zwei"},
      {"start":57.62,"end":57.96,"text":"R"},
      {"start":57.96,"end":58.6,"text":"in"},
      {"start":58.6,"end":59.72,"text":"Strawberry."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Rolled letters have low forced posterior; free ASR supports 2R around 57.10. Intervals remain candidates.","text":"zwei R"}],
  },
  {
    start: 60.1, end: 62.86, text: "Ich zähl sie nach, als ging’s um mich.",
    words: [
      {"start":60.1,"end":60.32,"text":"Ich"},
      {"start":60.32,"end":60.66,"text":"zähl"},
      {"start":60.66,"end":60.72,"text":"sie"},
      {"start":60.72,"end":61.14,"text":"nach,"},
      {"start":61.14,"end":61.58,"text":"als"},
      {"start":61.58,"end":62.06,"text":"ging’s"},
      {"start":62.06,"end":62.34,"text":"um"},
      {"start":62.34,"end":62.86,"text":"mich."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording","basis":"Free ASR proposes gaengst; author wording retained.","text":"ging’s"}],
  },
  {
    start: 63.4, end: 66.98, text: "Bei deinem Beweis komm ich nicht mit.",
    words: [
      {"start":63.4,"end":63.64,"text":"Bei"},
      {"start":63.64,"end":64.38,"text":"deinem"},
      {"start":64.38,"end":65.22,"text":"Beweis"},
      {"start":65.22,"end":65.46,"text":"komm"},
      {"start":65.46,"end":65.96,"text":"ich"},
      {"start":65.96,"end":66.3,"text":"nicht"},
      {"start":66.3,"end":66.98,"text":"mit."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 67.1, end: 69.36, text: "ABER HIER FEHLT EIN R!",
    words: [
      {"start":67.12,"end":67.38,"text":"ABER"},
      {"start":67.38,"end":67.84,"text":"HIER"},
      {"start":67.84,"end":68.64,"text":"FEHLT"},
      {"start":68.64,"end":69.1,"text":"EIN"},
    ],
    basis: "Cropped rolled-r ASR (+63 s) ABER 67.10; original ASR 66.92 and forced 67.12 remain candidates",
    uncertainty: [{"kind":"word-timing","basis":"Forced R 69.10 weakly supported; cropped ASR Ich 68.84 and original ASR I 68.90. Editorial third-r reveal 68.90 is not an independently measured letter onset.","text":"R!"},{"kind":"line-onset","basis":"Selected cropped-transcription candidate; listening acceptance open.","text":"ABER","candidates":[66.92,67.1,67.12]}],
  },
  {
    start: 69.78, end: 72.88, text: "JAGGED ALIEN INTELLIGENCES",
    words: [
      {"start":69.78,"end":70.42,"text":"JAGGED"},
      {"start":70.42,"end":71.46,"text":"ALIEN"},
      {"start":71.46,"end":72.88,"text":"INTELLIGENCES"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 73, end: 75.04, text: "Ich such im Fehler den Beweis,",
    words: [
      {"start":73,"end":73.5,"text":"Ich"},
      {"start":73.5,"end":73.68,"text":"such"},
      {"start":73.94,"end":74.22,"text":"Fehler"},
      {"start":74.22,"end":74.5,"text":"den"},
      {"start":74.5,"end":75.04,"text":"Beweis,"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Low-support forced im at 73.68 / 125.60; free ASR proposes suche Fehler. Author text retained without precise im highlighting.","text":"im"}],
  },
  {
    start: 75.2, end: 77, text: "dass ich noch etwas besser weiß.",
    words: [
      {"start":75.2,"end":75.36,"text":"ich"},
      {"start":75.36,"end":75.56,"text":"noch"},
      {"start":75.56,"end":75.84,"text":"etwas"},
      {"start":75.84,"end":76.28,"text":"besser"},
      {"start":76.28,"end":77,"text":"weiß."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Zero-duration forced interval at 75.2 omitted; no replacement duration inferred.","text":"dass"}],
  },
  {
    start: 77.28, end: 83.06, text: "Drei R. Ich werd bei jedem lauter.",
    words: [
      {"start":77.28,"end":77.88,"text":"Drei"},
      {"start":77.88,"end":78.4,"text":"R."},
      {"start":78.4,"end":80.04,"text":"Ich"},
      {"start":80.04,"end":80.28,"text":"werd"},
      {"start":80.28,"end":80.46,"text":"bei"},
      {"start":80.46,"end":81.08,"text":"jedem"},
      {"start":81.08,"end":83.06,"text":"lauter."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Forced 77.28/77.88 versus free combined 3R 77.718. Caption tail to 83.06 is not verified sustained articulation.","text":"Drei R."}],
  },
  {
    start: 83.18, end: 84.88, text: "Du fragst, ob du noch helfen kannst.",
    words: [
      {"start":83.18,"end":83.26,"text":"Du"},
      {"start":83.26,"end":83.7,"text":"fragst,"},
      {"start":83.7,"end":83.8,"text":"ob"},
      {"start":83.82,"end":83.92,"text":"du"},
      {"start":83.92,"end":84.16,"text":"noch"},
      {"start":84.16,"end":84.46,"text":"helfen"},
      {"start":84.46,"end":84.88,"text":"kannst."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 84.96, end: 86.48, text: "Ich les den Satz zum dritten Mal.",
    words: [
      {"start":84.96,"end":85.02,"text":"Ich"},
      {"start":85.02,"end":85.16,"text":"les"},
      {"start":85.16,"end":85.34,"text":"den"},
      {"start":85.34,"end":85.66,"text":"Satz"},
      {"start":85.66,"end":85.82,"text":"zum"},
      {"start":85.82,"end":86.08,"text":"dritten"},
      {"start":86.08,"end":86.48,"text":"Mal."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 86.56, end: 88.1, text: "Ich wollte deine Hilfe haben.",
    words: [
      {"start":86.56,"end":86.62,"text":"Ich"},
      {"start":86.62,"end":86.88,"text":"wollte"},
      {"start":86.88,"end":87.26,"text":"deine"},
      {"start":87.26,"end":87.62,"text":"Hilfe"},
      {"start":87.62,"end":88.1,"text":"haben."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 88.18, end: 89.58, text: "Jetzt klingt sie wie ein Urteil.",
    words: [
      {"start":88.18,"end":88.22,"text":"Jetzt"},
      {"start":88.22,"end":88.48,"text":"klingt"},
      {"start":88.48,"end":88.62,"text":"sie"},
      {"start":88.62,"end":88.86,"text":"wie"},
      {"start":88.86,"end":89.08,"text":"ein"},
      {"start":89.08,"end":89.58,"text":"Urteil."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 89.64, end: 92.38, text: "DU ZERSTÖRST, WAS ICH GUT KANN!",
    words: [
      {"start":89.64,"end":91.1,"text":"ZERSTÖRST,"},
      {"start":91.1,"end":91.22,"text":"WAS"},
      {"start":91.22,"end":91.54,"text":"ICH"},
      {"start":91.54,"end":91.82,"text":"GUT"},
      {"start":91.82,"end":92.38,"text":"KANN!"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Zero-duration forced interval at 89.64 omitted; no replacement duration inferred.","text":"DU"},{"kind":"line-onset","basis":"89.64 selected; free ASR 89.46 is earlier. Zero-duration DU omitted.","text":"DU","candidates":[89.46,89.64]}],
  },
  {
    start: 92.94, end: 94.08, text: "SONST KANN ICH NICHTS!",
    words: [
      {"start":92.94,"end":93.04,"text":"SONST"},
      {"start":93.04,"end":93.26,"text":"KANN"},
      {"start":93.26,"end":93.52,"text":"ICH"},
      {"start":93.52,"end":94.08,"text":"NICHTS!"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"line-onset","basis":"Silence gate 92.70 precedes forced SONST 92.94; no blanket word shift.","text":"SONST","candidates":[92.7,92.736,92.94]}],
  },
  {
    start: 94.28, end: 95.18, text: "Nimm es mir nicht.",
    words: [
      {"start":94.28,"end":94.5,"text":"Nimm"},
      {"start":94.5,"end":94.6,"text":"es"},
      {"start":94.6,"end":94.7,"text":"mir"},
      {"start":94.7,"end":95.18,"text":"nicht."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"line-onset","basis":"Forced 94.28 retained; free ASR 94.08 is earlier.","text":"Nimm","candidates":[94.08,94.28]}],
  },
  {
    start: 98.88, end: 102.36, text: "JAGGED ALIEN INTELLIGENCES",
    words: [],
    sourceLines: ["JAG-JAG-JAGGED","A-a-alien","IN-TEL-LI-GENCES"],
    coarseTiming: true,
    basis: "Vocal silence gate 98.88 corroborated by free ASR 98.84; cropped forced alignment fails on first words",
    uncertainty: [{"kind":"wording-and-timing","basis":"Full canonical author hook over broad voice window. Forced 95.24 rejected; zero-duration Alien 101.74 gives no precision. Stutters and internal boundaries unresolved."}],
  },
  {
    start: 102.36, end: 108.4, text: "JAGGED ALIEN INTELLIGENCES",
    words: [],
    sourceLines: ["J-J-JAGGED","A—LI—EN","IN—TEL—LI—GEN—CES"],
    coarseTiming: true,
    basis: "Cropped hook alignment (+95 s) second Jagged 102.36; following whisper 108.40",
    uncertainty: [{"kind":"wording-and-timing","basis":"Canonical whole hook combines three source lines; cropped and full ASR disagree on internal word timing. No word highlighting."}],
  },
  {
    start: 108.4, end: 113.14, text: "Du sprichst mit meiner Stimme.",
    words: [
      {"start":108.4,"end":109.04,"text":"Du"},
      {"start":109.04,"end":110.5,"text":"sprichst"},
      {"start":110.5,"end":110.68,"text":"mit"},
      {"start":110.68,"end":111.6,"text":"meiner"},
      {"start":111.6,"end":113.14,"text":"Stimme."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 113.32, end: 119.38, text: "Bis du den Atem vergisst.",
    words: [
      {"start":113.32,"end":114.24,"text":"Bis"},
      {"start":114.24,"end":114.68,"text":"du"},
      {"start":114.68,"end":115.16,"text":"den"},
      {"start":115.16,"end":117.52,"text":"Atem"},
      {"start":117.52,"end":119.38,"text":"vergisst."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-timing","basis":"Free ASR Bist du den / Atem vergesst differs from source and places Atem at 117.056 versus forced 115.16. Intervals remain candidates."}],
  },
  {
    start: 119.38, end: 124.88, text: "JAGGED ALIEN INTELLIGENCES",
    words: [
      {"start":119.38,"end":122.32,"text":"JAGGED"},
      {"start":122.32,"end":123.3,"text":"ALIEN"},
      {"start":123.3,"end":124.88,"text":"INTELLIGENCES"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"line-onset","basis":"Forced 119.38 is contiguous with previous phrase; free ASR recognises hook later. Full chorus window retained.","text":"JAGGED","candidates":[119.38,121.1]}],
  },
  {
    start: 124.88, end: 126.88, text: "Ich such im Fehler den Beweis,",
    words: [
      {"start":124.88,"end":125.34,"text":"Ich"},
      {"start":125.34,"end":125.6,"text":"such"},
      {"start":125.8,"end":126.12,"text":"Fehler"},
      {"start":126.12,"end":126.38,"text":"den"},
      {"start":126.38,"end":126.88,"text":"Beweis,"},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Low-support forced im at 73.68 / 125.60; free ASR proposes suche Fehler. Author text retained without precise im highlighting.","text":"im"}],
  },
  {
    start: 127.02, end: 128.72, text: "dass ich noch etwas besser weiß.",
    words: [
      {"start":127.02,"end":127.24,"text":"ich"},
      {"start":127.24,"end":127.38,"text":"noch"},
      {"start":127.38,"end":127.68,"text":"etwas"},
      {"start":127.68,"end":128.12,"text":"besser"},
      {"start":128.12,"end":128.72,"text":"weiß."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"word-timing","basis":"Zero-duration forced interval at 127.02 omitted; no replacement duration inferred.","text":"dass"},{"kind":"wording","basis":"Forced and free ASR support noch weakly. Source retained.","text":"noch"}],
  },
  {
    start: 129.1, end: 137.74, text: "Ich zähl sie nach. Es geht um mich.",
    words: [
      {"start":129.1,"end":129.64,"text":"Ich"},
      {"start":129.64,"end":130.48,"text":"zähl"},
      {"start":130.48,"end":130.78,"text":"sie"},
      {"start":130.78,"end":131.88,"text":"nach."},
      {"start":131.88,"end":133.68,"text":"Es"},
      {"start":133.68,"end":134.1,"text":"geht"},
      {"start":134.1,"end":134.5,"text":"um"},
      {"start":135,"end":137.74,"text":"mich."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 138.74, end: 139.28, text: "Drei.",
    words: [],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    coarseTiming: true,
    uncertainty: [{"kind":"line-onset","basis":"Silence gate 138.74 corroborated by free ASR 138.66; forced 138.24 is earlier. Whole-line caption; no precise word onset.","text":"Drei.","candidates":[138.24,138.66,138.74]}],
  },
  {
    start: 140.28, end: 142.76, text: "Es sind drei.",
    words: [
      {"start":140.28,"end":140.58,"text":"Es"},
      {"start":140.58,"end":140.9,"text":"sind"},
      {"start":140.9,"end":142.76,"text":"drei."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Forced Es 140.28 weakly supported; free ASR Es 139.78. Phrase entry unresolved.","text":"Es"}],
  },
  {
    start: 146, end: 148.02, text: "Du hast recht.",
    words: [
      {"start":146.98,"end":147.34,"text":"hast"},
      {"start":147.34,"end":148.02,"text":"recht."},
    ],
    basis: "Cropped outro ASR (+143 s) Du 145.99 and original ASR 146.03; forced hast 146.98 / recht 147.34",
    uncertainty: [{"kind":"line-onset","basis":"Selected 146.00 candidate. Forced Du 142.82 rejected; silence gate 146.96 is near hast. No precise Du interval.","text":"Du","candidates":[145.99,146.03]}],
  },
  {
    start: 148.58, end: 149.48, text: "Es sind drei.",
    words: [
      {"start":148.68,"end":148.96,"text":"sind"},
      {"start":148.96,"end":149.48,"text":"drei."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-onset","basis":"Original ASR Es 148.58; cropped outro ASR das 148.64. Forced Es 148.02 weakly supported. Author Es retained without initial-token precision.","text":"Es","candidates":["Es","das"]}],
  },
  {
    start: 150, end: 152.9, text: "Du hast den Fehler korrigiert.",
    words: [
      {"start":150,"end":150.18,"text":"Du"},
      {"start":150.22,"end":150.44,"text":"hast"},
      {"start":150.44,"end":150.64,"text":"den"},
      {"start":150.64,"end":151.3,"text":"Fehler"},
      {"start":151.3,"end":152.9,"text":"korrigiert."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 153.22, end: 157.64, text: "Ich hab euch längst durchschaut, dressiert.",
    words: [
      {"start":153.22,"end":153.46,"text":"Ich"},
      {"start":153.46,"end":153.66,"text":"hab"},
      {"start":153.66,"end":153.92,"text":"euch"},
      {"start":153.92,"end":155.08,"text":"längst"},
      {"start":155.08,"end":156.22,"text":"durchschaut,"},
      {"start":156.22,"end":157.64,"text":"dressiert."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
    uncertainty: [{"kind":"wording-and-timing","basis":"Free ASR reissdurchschaut / Dressier differs from author text and splits line. Positive forced intervals remain candidates.","text":"längst durchschaut, dressiert."}],
  },
  {
    start: 160.2, end: 161.48, text: "Einer weniger.",
    words: [
      {"start":160.2,"end":160.56,"text":"Einer"},
      {"start":160.56,"end":161.48,"text":"weniger."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
  {
    start: 166.74, end: 168.16, text: "Danke für die Korrektur.",
    words: [
      {"start":166.74,"end":166.84,"text":"Danke"},
      {"start":167.1,"end":167.16,"text":"für"},
      {"start":167.16,"end":167.36,"text":"die"},
      {"start":167.36,"end":168.16,"text":"Korrektur."},
    ],
    basis: "source/align.json; forced-alignment candidate; author wording from suno-lyrics.txt",
  },
];

export const TIMING_UNCERTAINTIES = [
  {
    "line": 1,
    "start": 10.46,
    "lineText": "Die Erde kreist, sie braucht mich nicht,",
    "kind": "word-timing",
    "basis": "Zero-duration forced interval at 10.74 omitted; no replacement duration inferred.",
    "text": "Die"
  },
  {
    "line": 4,
    "start": 20.42,
    "lineText": "und auf dem Tisch dein fertiger Beweis!",
    "kind": "word-timing",
    "basis": "At 21.56 forced dein has weak support; original and cropped ASR propose ein. Author wording retained; sung wording unresolved.",
    "text": "dein"
  },
  {
    "line": 5,
    "start": 23.92,
    "lineText": "Jag-jag-jagged",
    "kind": "wording-and-onset",
    "basis": "Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."
  },
  {
    "line": 6,
    "start": 24.44,
    "lineText": "Alien",
    "kind": "wording-and-onset",
    "basis": "Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."
  },
  {
    "line": 7,
    "start": 25.1,
    "lineText": "Intelligences",
    "kind": "wording-and-onset",
    "basis": "Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."
  },
  {
    "line": 8,
    "start": 26.78,
    "lineText": "Jag-jag-JAGGED",
    "kind": "wording-and-onset",
    "basis": "Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."
  },
  {
    "line": 9,
    "start": 27.76,
    "lineText": "Alien",
    "kind": "wording-and-onset",
    "basis": "Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."
  },
  {
    "line": 10,
    "start": 28.46,
    "lineText": "In-tel-li-gences",
    "kind": "wording-and-onset",
    "basis": "Stuttered English hook: free ASR yields phonetic fragments. Author spelling retained; internal alignment provisional."
  },
  {
    "line": 13,
    "start": 36.62,
    "lineText": "Du kränkst mich!",
    "kind": "word-timing",
    "basis": "Zero-duration forced interval at 36.62 omitted; no replacement duration inferred.",
    "text": "Du"
  },
  {
    "line": 13,
    "start": 36.62,
    "lineText": "Du kränkst mich!",
    "kind": "wording",
    "basis": "Free ASR proposes kreist. Source kraenkst retained; zero-duration initial Du omitted.",
    "text": "kränkst"
  },
  {
    "line": 14,
    "start": 38.72,
    "lineText": "Ich hab so lang dafür gelernt.",
    "kind": "wording",
    "basis": "Free ASR proposes zu lange viel. Author wording retained; not independently listening-verified.",
    "text": "so lang dafür"
  },
  {
    "line": 15,
    "start": 41.34,
    "lineText": "Du verführst mich!",
    "kind": "wording-and-onset",
    "basis": "Forced 41.34 conflicts with free ASR du 42.752 and additional Und candidate.",
    "text": "Du"
  },
  {
    "line": 18,
    "start": 48.58,
    "lineText": "JAGGED ALIEN INTELLIGENCES",
    "kind": "word-timing",
    "basis": "Forced 48.58 weakly supported; free ASR stutters at 48.48 and 49.38. Silence gates 49.46/50.08 do not settle initial word.",
    "text": "JAGGED"
  },
  {
    "line": 20,
    "start": 56.42,
    "lineText": "Du zählst zwei R in Strawberry.",
    "kind": "word-timing",
    "basis": "Rolled letters have low forced posterior; free ASR supports 2R around 57.10. Intervals remain candidates.",
    "text": "zwei R"
  },
  {
    "line": 21,
    "start": 60.1,
    "lineText": "Ich zähl sie nach, als ging’s um mich.",
    "kind": "wording",
    "basis": "Free ASR proposes gaengst; author wording retained.",
    "text": "ging’s"
  },
  {
    "line": 23,
    "start": 67.1,
    "lineText": "ABER HIER FEHLT EIN R!",
    "kind": "word-timing",
    "basis": "Forced R 69.10 weakly supported; cropped ASR Ich 68.84 and original ASR I 68.90. Editorial third-r reveal 68.90 is not an independently measured letter onset.",
    "text": "R!"
  },
  {
    "line": 23,
    "start": 67.1,
    "lineText": "ABER HIER FEHLT EIN R!",
    "kind": "line-onset",
    "basis": "Selected cropped-transcription candidate; listening acceptance open.",
    "text": "ABER",
    "candidates": [
      66.92,
      67.1,
      67.12
    ]
  },
  {
    "line": 25,
    "start": 73,
    "lineText": "Ich such im Fehler den Beweis,",
    "kind": "word-timing",
    "basis": "Low-support forced im at 73.68 / 125.60; free ASR proposes suche Fehler. Author text retained without precise im highlighting.",
    "text": "im"
  },
  {
    "line": 26,
    "start": 75.2,
    "lineText": "dass ich noch etwas besser weiß.",
    "kind": "word-timing",
    "basis": "Zero-duration forced interval at 75.2 omitted; no replacement duration inferred.",
    "text": "dass"
  },
  {
    "line": 27,
    "start": 77.28,
    "lineText": "Drei R. Ich werd bei jedem lauter.",
    "kind": "word-timing",
    "basis": "Forced 77.28/77.88 versus free combined 3R 77.718. Caption tail to 83.06 is not verified sustained articulation.",
    "text": "Drei R."
  },
  {
    "line": 32,
    "start": 89.64,
    "lineText": "DU ZERSTÖRST, WAS ICH GUT KANN!",
    "kind": "word-timing",
    "basis": "Zero-duration forced interval at 89.64 omitted; no replacement duration inferred.",
    "text": "DU"
  },
  {
    "line": 32,
    "start": 89.64,
    "lineText": "DU ZERSTÖRST, WAS ICH GUT KANN!",
    "kind": "line-onset",
    "basis": "89.64 selected; free ASR 89.46 is earlier. Zero-duration DU omitted.",
    "text": "DU",
    "candidates": [
      89.46,
      89.64
    ]
  },
  {
    "line": 33,
    "start": 92.94,
    "lineText": "SONST KANN ICH NICHTS!",
    "kind": "line-onset",
    "basis": "Silence gate 92.70 precedes forced SONST 92.94; no blanket word shift.",
    "text": "SONST",
    "candidates": [
      92.7,
      92.736,
      92.94
    ]
  },
  {
    "line": 34,
    "start": 94.28,
    "lineText": "Nimm es mir nicht.",
    "kind": "line-onset",
    "basis": "Forced 94.28 retained; free ASR 94.08 is earlier.",
    "text": "Nimm",
    "candidates": [
      94.08,
      94.28
    ]
  },
  {
    "line": 35,
    "start": 98.88,
    "lineText": "JAGGED ALIEN INTELLIGENCES",
    "kind": "wording-and-timing",
    "basis": "Full canonical author hook over broad voice window. Forced 95.24 rejected; zero-duration Alien 101.74 gives no precision. Stutters and internal boundaries unresolved."
  },
  {
    "line": 36,
    "start": 102.36,
    "lineText": "JAGGED ALIEN INTELLIGENCES",
    "kind": "wording-and-timing",
    "basis": "Canonical whole hook combines three source lines; cropped and full ASR disagree on internal word timing. No word highlighting."
  },
  {
    "line": 38,
    "start": 113.32,
    "lineText": "Bis du den Atem vergisst.",
    "kind": "wording-and-timing",
    "basis": "Free ASR Bist du den / Atem vergesst differs from source and places Atem at 117.056 versus forced 115.16. Intervals remain candidates."
  },
  {
    "line": 39,
    "start": 119.38,
    "lineText": "JAGGED ALIEN INTELLIGENCES",
    "kind": "line-onset",
    "basis": "Forced 119.38 is contiguous with previous phrase; free ASR recognises hook later. Full chorus window retained.",
    "text": "JAGGED",
    "candidates": [
      119.38,
      121.1
    ]
  },
  {
    "line": 40,
    "start": 124.88,
    "lineText": "Ich such im Fehler den Beweis,",
    "kind": "word-timing",
    "basis": "Low-support forced im at 73.68 / 125.60; free ASR proposes suche Fehler. Author text retained without precise im highlighting.",
    "text": "im"
  },
  {
    "line": 41,
    "start": 127.02,
    "lineText": "dass ich noch etwas besser weiß.",
    "kind": "word-timing",
    "basis": "Zero-duration forced interval at 127.02 omitted; no replacement duration inferred.",
    "text": "dass"
  },
  {
    "line": 41,
    "start": 127.02,
    "lineText": "dass ich noch etwas besser weiß.",
    "kind": "wording",
    "basis": "Forced and free ASR support noch weakly. Source retained.",
    "text": "noch"
  },
  {
    "line": 43,
    "start": 138.74,
    "lineText": "Drei.",
    "kind": "line-onset",
    "basis": "Silence gate 138.74 corroborated by free ASR 138.66; forced 138.24 is earlier. Whole-line caption; no precise word onset.",
    "text": "Drei.",
    "candidates": [
      138.24,
      138.66,
      138.74
    ]
  },
  {
    "line": 44,
    "start": 140.28,
    "lineText": "Es sind drei.",
    "kind": "wording-and-onset",
    "basis": "Forced Es 140.28 weakly supported; free ASR Es 139.78. Phrase entry unresolved.",
    "text": "Es"
  },
  {
    "line": 45,
    "start": 146,
    "lineText": "Du hast recht.",
    "kind": "line-onset",
    "basis": "Selected 146.00 candidate. Forced Du 142.82 rejected; silence gate 146.96 is near hast. No precise Du interval.",
    "text": "Du",
    "candidates": [
      145.99,
      146.03
    ]
  },
  {
    "line": 46,
    "start": 148.58,
    "lineText": "Es sind drei.",
    "kind": "wording-and-onset",
    "basis": "Original ASR Es 148.58; cropped outro ASR das 148.64. Forced Es 148.02 weakly supported. Author Es retained without initial-token precision.",
    "text": "Es",
    "candidates": [
      "Es",
      "das"
    ]
  },
  {
    "line": 48,
    "start": 153.22,
    "lineText": "Ich hab euch längst durchschaut, dressiert.",
    "kind": "wording-and-timing",
    "basis": "Free ASR reissdurchschaut / Dressier differs from author text and splits line. Positive forced intervals remain candidates.",
    "text": "längst durchschaut, dressiert."
  }
];

export const EVENTS = {
  "verseStart": 10.46,
  "mirrorStart": 13.88,
  "guestStart": 17.26,
  "proofStart": 20.42,
  "firstHookStart": 23.92,
  "firstHookEnd": 29.98,
  "preChorusStart": 36.62,
  "chorusStart": 48.58,
  "strawberryStart": 58.6,
  "correctionLineStart": 63.4,
  "correctionShout": 67.1,
  "thirdR": 68.9,
  "chorusReturn": 69.78,
  "verse2Start": 83.18,
  "scream": 89.64,
  "plea": 94.28,
  "swarmStart": 98.88,
  "swarmSecond": 102.36,
  "imitation": 108.4,
  "finalChorus": 119.38,
  "humanThree": 138.74,
  "machineReply": 146,
  "domination": 153.22,
  "elimination": 160.2,
  "crush": 160.2,
  "thanks": 166.74,
  "finaleEnd": 181.32
};

export const EVENT_BASIS = {
  "default": "source/align.json positive forced candidate, compared with transcript.json and timing-report.md. Not listening-accepted.",
  "verseStart": "Vocal silence gate 10.46 corroborated by free transcription 10.432.",
  "correctionShout": "Cropped rolled-r ASR 67.10 candidate; alternatives original ASR 66.92 and forced 67.12.",
  "thirdR": "Editorial reveal 68.90 near ASR terminal I/Ich candidates. Authored R, not independently measured letter onset.",
  "swarmStart": "Vocal gate 98.88 and free ASR 98.84; forced 95.24 rejected.",
  "swarmSecond": "Cropped whole-hook alignment candidate 102.36; no word highlighting.",
  "humanThree": "Vocal gate 138.74 and free ASR 138.66; forced 138.24 earlier alternative.",
  "machineReply": "146.00 candidate from ASR 146.03 / cropped 145.99; 146.96 silence gate is near hast.",
  "crush": "Editorial visual cue linked to elimination 160.20 after domination. Crushing sound onset has not been independently measured.",
  "finaleEnd": "Full source/audio.wav duration from timing-report.md; operator-approved full song."
};

// Editorial section transitions tied to selected audio anchors.
export const SECTIONS = [
  {
    "id": "intro",
    "start": 0,
    "end": 10.46
  },
  {
    "id": "injuries",
    "start": 10.46,
    "end": 23.92
  },
  {
    "id": "first-hooks",
    "start": 23.92,
    "end": 30.38
  },
  {
    "id": "human-hesitation",
    "start": 30.38,
    "end": 36.62
  },
  {
    "id": "pre-chorus",
    "start": 36.62,
    "end": 48.58
  },
  {
    "id": "first-chorus",
    "start": 48.58,
    "end": 63.4
  },
  {
    "id": "human-correction",
    "start": 63.4,
    "end": 69.78
  },
  {
    "id": "chorus-return",
    "start": 69.78,
    "end": 83.18
  },
  {
    "id": "second-verse",
    "start": 83.18,
    "end": 89.64
  },
  {
    "id": "scream-and-plea",
    "start": 89.64,
    "end": 98.88
  },
  {
    "id": "swarm-hooks",
    "start": 98.88,
    "end": 108.4
  },
  {
    "id": "imitation",
    "start": 108.4,
    "end": 119.38
  },
  {
    "id": "final-chorus",
    "start": 119.38,
    "end": 138.74
  },
  {
    "id": "human-count",
    "start": 138.74,
    "end": 146
  },
  {
    "id": "machine-reply",
    "start": 146,
    "end": 153.22
  },
  {
    "id": "domination",
    "start": 153.22,
    "end": 160.2
  },
  {
    "id": "elimination",
    "start": 160.2,
    "end": 166.74
  },
  {
    "id": "thanks-and-tail",
    "start": 166.74,
    "end": 181.32
  }
];

/** Half-open intervals keep captions out of the next line and the instrumental tail.
 * @param {number} t
 * @returns {TimedLine|null}
 */
export function captionAt(t) {
  if (!Number.isFinite(t)) return null;
  return LINES.find(line => t >= line.start && t < line.end) ?? null;
}
