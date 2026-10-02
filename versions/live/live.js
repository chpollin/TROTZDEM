/**
 * Live stage: every song's scene.js runs in its own iframe of video/player.html?embed,
 * because scenes declare top-level consts and cannot share one page. The rendered mp4
 * of the song is the clock and the sound; when a scene fails or cannot keep up, the
 * same video element simply becomes visible.
 *
 * @typedef {{ slug: string, title: string, duration: number, video: string, poster: string, accent: string, note?: string, lyrics: string, live?: string }} Song
 * @typedef {{ title: string, from: string, songs: string[] }} Act
 * @typedef {{ rate: number, envelope: number[], cues: [number, number][] }} Live
 * @typedef {Song & { act: number, no: number }} Entry
 * @typedef {{
 *   entry: Entry, el: HTMLDivElement, media: HTMLVideoElement, frame: HTMLIFrameElement | null,
 *   drawAt: ((t: number) => void) | null, ready: Promise<boolean>, reason: string, gone: boolean,
 *   dirty: boolean, lastFrame: number, lastDraw: number, lastT: number, anchor: [number, number], intervals: number[],
 *   hold: number | null, freeze: number | null, posterUntilPlay: boolean
 * }} Deck
 * @typedef {[number, number, number]} Anchor time, x, y in 1920x1080 scene space
 */

const VIDEO = new URL("../../video/", import.meta.url);
const NARRATIVE = new URL("../narrative.json", import.meta.url);
const CODE_URL = "https://github.com/chpollin/TROTZDEM/blob/main/video/";

// the mp4s were rendered at 30 fps; drawing at exactly those frame times reproduces them
const FPS = 30;
// a scene that delivers fewer than about 22 frames a second looks worse than the rendered video
const SLOW_MS = 45;
const GAUGE_FRAMES = 30;
const LOAD_TIMEOUT_MS = 20000;
const NEXT_WAIT_MS = 6000;
const CARD_HOLD_MS = 2600;
const DISSOLVE_MS = 1200;
const BLACK_MS = 600;
const ATOM_MS = 800;
const ATOM_REST_MS = 300;
const TAIL_WAIT_MS = 3000;
// "System Prompt initializing..." is fully typed by then (system-prompt/timeline.js, intro)
const CODA_FRAME = 3;

const calm = matchMedia("(prefers-reduced-motion: reduce)");
const motion = ms => (calm.matches ? 0 : ms);

/**
 * Where each scene hands over. `in` is the first frame worth showing and where the caret
 * lands, `out` the last frame before the scene empties and where the caret leaves. All
 * scenes fill the ground with black, so fading through black joins any two of them.
 * The values come from each scene's layout constants and timeline.js.
 * @type {Record<string, { in: Anchor, out: Anchor }>}
 */
const ANCHORS = {
  "system-prompt": { in: [0, 960, 540], out: [79.62, 1359, 853] },
  "im-addicted-to-claude-code": { in: [0.05, 960, 540], out: [212.45, 960, 540] },
  "empire-of-ai": { in: [0, 160, 240], out: [203.84, 96, 940] },
  "hallelujah-the-god-machine": { in: [0.8, 250, 92], out: [195.45, 960, 562] },
  "lost-in-the-vault": { in: [0, 960, 540], out: [263.3, 960, 540] },
  "good-morning-claude": { in: [0.6, 354, 852], out: [171.7, 1314, 852] },
  "machine-of-loving-grace": { in: [0.3, 417, 936], out: [195.6, 960, 950] },
  "ich-predicte-dich": { in: [0, 150, 600], out: [156.66, 960, 660] },
  "sycophancy": { in: [0.3, 96, 52], out: [252.1, 542, 553] },
  "prompt-engineer": { in: [0, 960, 590], out: [246.5, 131, 771] },
  "neunundachtzig-tabs": { in: [0, 960, 540], out: [113.1, 960, 520] },
  "bin-ich-noch-der-expert": { in: [0.82, 960, 432], out: [216.9, 960, 460] },
  "the-bitter-lesson": { in: [0.7, 1074, 264], out: [164, 1130, 819] },
  "the-bitter-lesson-remix": { in: [0, 960, 540], out: [216.6, 960, 540] },
};

const screen = /** @type {HTMLDivElement} */ (document.getElementById("screen"));
const card = /** @type {HTMLElement} */ (document.getElementById("card"));
const cardLine = /** @type {HTMLElement} */ (document.getElementById("card-line"));
const cardSource = /** @type {HTMLElement} */ (document.getElementById("card-source"));
const rail = /** @type {HTMLDivElement} */ (document.getElementById("rail"));
const lines = /** @type {HTMLOListElement} */ (document.getElementById("lines"));
const seek = /** @type {HTMLInputElement} */ (document.getElementById("seek"));
const playButton = /** @type {HTMLButtonElement} */ (document.getElementById("play"));
const nowTitle = /** @type {HTMLElement} */ (document.getElementById("now-title"));
const time = /** @type {HTMLElement} */ (document.getElementById("time"));
const modeText = /** @type {HTMLElement} */ (document.getElementById("mode-text"));
const code = /** @type {HTMLAnchorElement} */ (document.getElementById("code"));
const note = /** @type {HTMLElement} */ (document.getElementById("note"));
const actsList = /** @type {HTMLOListElement} */ (document.getElementById("acts"));
const atom = /** @type {HTMLElement} */ (document.getElementById("atom"));
const atomFade = /** @type {HTMLElement} */ (document.getElementById("atom-fade"));

const REASONS = {
  load: "Gerendertes Video, weil die Szene nicht geladen werden konnte",
  error: "Gerendertes Video, weil die Szene mit einem Fehler abbrach",
  slow: "Gerendertes Video, weil die Szene auf diesem Gerät zu langsam lief",
  media: "Die Tonspur dieses Songs konnte nicht geladen werden",
};

/** @type {Entry[]} */
let order = [];
/** @type {Act[]} */
let acts = [];
/** @type {{ title: string, from: string }} */
let coda = { title: "", from: "" };
/** @type {Map<string, Song>} */
const bySlug = new Map();
/** @type {Map<string, Live>} */
const liveCache = new Map();
/** scenes that already failed in this visit go straight to the video next time @type {Map<string, string>} */
const verdicts = new Map();

/** @type {Set<Deck>} */
const decks = new Set();
/** @type {Deck | null} */
let current = null;
/** @type {{ time: number, el: HTMLElement }[]} */
let cues = [];
let currentCue = -1;
let wantPlay = false;
let busy = false;
let generation = 0;
let lastUi = 0;
let dragging = false;
let cardUntilPlay = false;

const pad = n => String(n).padStart(2, "0");
const minutes = s => { const r = Math.floor(s); return `${Math.floor(r / 60)}:${pad(r % 60)}`; };
const wait = ms => new Promise(ok => setTimeout(ok, ms));
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

/** @param {HTMLElement} el @param {number} to @param {number} [ms] */
function fade(el, to, ms = DISSOLVE_MS) {
  const from = Number(getComputedStyle(el).opacity);
  el.getAnimations().forEach(a => a.cancel());
  el.style.opacity = String(to);
  if (from === to || motion(ms) === 0) return Promise.resolve();
  // opacity and transform animations run on the compositor, so they stay smooth while a scene loads
  return el.animate([{ opacity: from }, { opacity: to }], { duration: motion(ms), easing: "ease" })
    .finished.then(() => {}, () => {});
}

/** @param {Anchor | undefined} at */
function place(at) {
  const scale = screen.clientWidth / 1920;
  return `translate(${((at?.[1] ?? 960) * scale).toFixed(1)}px, ${((at?.[2] ?? 540) * scale).toFixed(1)}px)`;
}

/**
 * The caret of the scenes (4 px wide, blinking every 0.53 s) leaves the point where one
 * song ended and walks in whole steps to where the next begins.
 * @param {Anchor | undefined} out @param {Anchor | undefined} into
 */
async function travel(out, into) {
  atom.getAnimations().forEach(a => a.cancel());
  atom.style.transform = place(out);
  await fade(atomFade, 1, 200);
  await wait(ATOM_REST_MS);
  const path = [{ transform: place(out) }, { transform: place(into) }];
  atom.style.transform = place(into);
  if (motion(ATOM_MS)) await atom.animate(path, { duration: ATOM_MS, easing: "steps(24, jump-end)" }).finished.catch(() => {});
  await wait(ATOM_REST_MS);
}

/** resolves when the song has played out its tail, or after a cap @param {Deck} deck */
function tail(deck) {
  if (deck.media.ended || deck.media.paused || deck.gone) return Promise.resolve();
  return Promise.race([new Promise(ok => deck.media.addEventListener("ended", ok, { once: true })), wait(TAIL_WAIT_MS)]);
}

/** @param {Deck} deck @param {keyof typeof REASONS} reason */
function fallback(deck, reason) {
  deck.reason = reason;
  deck.drawAt = null;
  deck.frame?.remove();
  deck.frame = null;
  deck.el.classList.remove("is-live");
  if (reason !== "media") verdicts.set(deck.entry.slug, reason);
  if (deck === current) showMode();
}

/** @param {Deck} deck */
function loadScene(deck) {
  const frame = document.createElement("iframe");
  frame.src = new URL(`player.html?song=${encodeURIComponent(deck.entry.slug)}&embed`, VIDEO).href;
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  deck.frame = frame;
  deck.el.prepend(frame);
  const started = performance.now();
  return new Promise(done => {
    const poll = () => {
      if (deck.gone) return done(false);
      /** @type {any} */
      let win = null;
      let error = "";
      try {
        win = frame.contentWindow;
        error = win?.sceneError ?? "";
      } catch (e) {
        error = String(e);
      }
      if (!error && win?.sceneReady === true && typeof win.drawAt === "function") {
        deck.drawAt = win.drawAt;
        deck.dirty = true;
        if (deck === current) showMode();
        return done(true);
      }
      if (error || performance.now() - started > LOAD_TIMEOUT_MS) {
        fallback(deck, "load");
        return done(false);
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

/** @param {number} index */
function makeDeck(index) {
  const entry = order[index];
  const el = document.createElement("div");
  el.className = "deck";
  const media = document.createElement("video");
  media.src = new URL(entry.video, VIDEO).href;
  media.poster = new URL(entry.poster, VIDEO).href;
  media.preload = "auto";
  media.playsInline = true;
  media.setAttribute("aria-hidden", "true");
  el.append(media);
  screen.insertBefore(el, card);
  /** @type {Deck} */
  const deck = {
    entry, el, media, frame: null, drawAt: null, ready: Promise.resolve(false), reason: "", gone: false,
    dirty: true, lastFrame: -1, lastDraw: 0, lastT: 0, anchor: [0, 0], intervals: [], hold: null, freeze: null,
    posterUntilPlay: false,
  };
  const known = verdicts.get(entry.slug);
  if (known) deck.reason = known;
  else deck.ready = loadScene(deck);
  const restart = () => { deck.dirty = true; deck.lastDraw = 0; };
  media.addEventListener("seeking", restart);
  media.addEventListener("seeked", restart);
  media.addEventListener("play", () => { restart(); if (deck === current) { wantPlay = true; showPlaying(); } });
  // the pause that precedes "ended" is not a decision to stop the album
  media.addEventListener("pause", () => { if (deck === current && !media.ended && !busy) { wantPlay = false; showPlaying(); } });
  media.addEventListener("ended", () => { if (deck === current && !busy) advance(); });
  media.addEventListener("error", () => { deck.reason = "media"; if (deck === current) showMode(); });
  decks.add(deck);
  return deck;
}

/** @param {number} index */
function deckFor(index) {
  for (const deck of decks) if (deck.entry.slug === order[index].slug) return deck;
  return makeDeck(index);
}

/** @param {Deck} deck */
function drop(deck) {
  deck.gone = true;
  deck.media.pause();
  deck.media.removeAttribute("src");
  deck.media.load();
  deck.el.remove();
  decks.delete(deck);
}

/** @param {Deck} deck @param {number} now */
function clock(deck, now) {
  const m = deck.media;
  const raw = m.currentTime;
  const end = Number.isFinite(m.duration) ? m.duration - 1 / FPS : deck.entry.duration;
  if (m.paused || m.seeking) {
    deck.anchor = [raw, now];
    deck.lastT = Math.min(raw, end);
    return deck.lastT;
  }
  if (raw !== deck.anchor[0]) deck.anchor = [raw, now];
  // currentTime advances in coarse steps in some browsers, so frames between steps are extrapolated
  let t = deck.anchor[0] + Math.min(0.1, (now - deck.anchor[1]) / 1000) * m.playbackRate;
  if (t < deck.lastT && deck.lastT - t < 0.1) t = deck.lastT;
  deck.lastT = Math.min(t, end);
  return deck.lastT;
}

/** @param {Deck} deck @param {number} now */
function gauge(deck, now) {
  if (deck.lastDraw) {
    deck.intervals.push(now - deck.lastDraw);
    if (deck.intervals.length > GAUGE_FRAMES) deck.intervals.shift();
  }
  deck.lastDraw = now;
  // a rolling window, because many scenes start sparse and get expensive later in the song
  if (deck.intervals.length === GAUGE_FRAMES && median(deck.intervals) > SLOW_MS) fallback(deck, "slow");
}

/** @param {number} now */
function loop(now) {
  requestAnimationFrame(loop);
  if (current && !busy && !current.media.paused
    && current.media.currentTime >= (ANCHORS[current.entry.slug]?.out[0] ?? Infinity)) advance();
  for (const deck of decks) {
    if (!deck.drawAt) continue;
    const playing = !deck.media.paused && !deck.media.seeking;
    if (!playing && !deck.dirty) continue;
    let t = clock(deck, now);
    if (deck.hold !== null && t >= deck.hold) deck.hold = null;
    // the incoming song shows its first meaningful frame until its clock gets there,
    // the outgoing one stays on its last while its sound plays out
    if (deck.hold !== null) t = deck.hold;
    if (deck.freeze !== null) t = Math.min(t, deck.freeze);
    const frame = Math.max(0, Math.floor(t * FPS));
    if (!deck.dirty && frame === deck.lastFrame) continue;
    deck.dirty = false;
    deck.lastFrame = frame;
    try {
      deck.drawAt(frame / FPS);
    } catch (e) {
      console.error(e);
      fallback(deck, "error");
      continue;
    }
    if (!deck.posterUntilPlay) deck.el.classList.add("is-live");
    if (playing) gauge(deck, now);
  }
  if (current && (now - lastUi > 66 || current.media.paused)) {
    lastUi = now;
    showPosition();
  }
}

function showPlaying() {
  playButton.setAttribute("aria-pressed", String(wantPlay));
}

function showMode() {
  if (!current) return;
  const { reason, drawAt } = current;
  modeText.textContent = reason ? REASONS[/** @type {keyof typeof REASONS} */ (reason)]
    : drawAt ? "Live im Browser gerechnet" : "Szene lädt";
}

function showPosition() {
  if (!current) return;
  const m = current.media;
  const duration = Number.isFinite(m.duration) ? m.duration : current.entry.duration;
  const t = Math.min(m.currentTime, duration);
  if (!dragging) {
    seek.max = String(duration);
    seek.value = String(t);
  }
  seek.setAttribute("aria-valuetext", `${minutes(t)} von ${minutes(duration)}`);
  time.textContent = `${minutes(t)} / ${minutes(duration)}`;
  const link = actsList.querySelector('a[aria-current="true"]');
  if (link instanceof HTMLElement) link.style.setProperty("--progress", (t / duration).toFixed(4));
  let index = -1;
  for (let i = 0; i < cues.length && cues[i].time <= t + 0.1; i++) index = i;
  if (index !== currentCue) {
    cues[currentCue]?.el.classList.remove("is-current");
    currentCue = index;
    cues[index]?.el.classList.add("is-current");
    if (!lines.contains(document.activeElement)) {
      setRover(cues[Math.max(index, 0)]?.el);
      centre(cues[index]?.el ?? lines.firstElementChild);
    }
  }
}

/** @param {Element | null | undefined} el */
function centre(el) {
  if (!(el instanceof HTMLElement)) return;
  const offset = rail.clientHeight / 2 - (el.offsetTop + el.offsetHeight / 2);
  lines.style.transform = `translateY(${offset.toFixed(1)}px)`;
}

/** one tab stop for the whole lyric, the arrow keys move within it @param {HTMLElement | undefined} el */
function setRover(el) {
  if (!el) return;
  for (const cue of cues) cue.el.tabIndex = cue.el === el ? 0 : -1;
}

/** @param {Entry} entry */
async function showLyrics(entry) {
  const texts = entry.lyrics.split("\n");
  cues = [];
  currentCue = -1;
  lines.replaceChildren();
  lines.style.transform = "";
  rail.hidden = true;
  let data = liveCache.get(entry.slug);
  if (!data && entry.live) {
    try {
      data = /** @type {Live} */ (await (await fetch(new URL(entry.live, VIDEO))).json());
      liveCache.set(entry.slug, data);
    } catch {
      return;
    }
  }
  if (current?.entry !== entry) return;
  /** @type {Map<number, number>} */
  const cueAt = new Map((data?.cues ?? []).map(([t, i]) => [i, t]));
  const items = [];
  texts.forEach((text, i) => {
    if (!text.trim()) return;
    const li = document.createElement("li");
    const at = cueAt.get(i);
    if (at === undefined) {
      const span = document.createElement("span");
      span.className = "line";
      span.textContent = text;
      li.append(span);
    } else {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "line cue";
      button.textContent = text;
      button.dataset.time = String(at);
      button.tabIndex = -1;
      cues.push({ time: at, el: button });
      li.append(button);
    }
    items.push(li);
  });
  cues.sort((a, b) => a.time - b.time);
  lines.replaceChildren(...items);
  rail.hidden = items.length === 0;
  setRover(cues[0]?.el);
  centre(lines.firstElementChild);
  showPosition();
}

/** @param {string} line @param {string} fromSlug */
async function showCard(line, fromSlug) {
  const source = bySlug.get(fromSlug);
  const caption = source ? `aus ${source.title}` : "";
  if (Number(card.style.opacity || 0) > 0 && cardLine.textContent !== line) await fade(card, 0);
  cardLine.textContent = line;
  cardSource.textContent = caption;
  await fade(card, 1);
}

/** @param {Entry} entry */
function showMeta(entry) {
  document.documentElement.style.setProperty("--accent", entry.accent);
  document.title = `${entry.title} – TROTZDEM live`;
  nowTitle.textContent = entry.title;
  code.href = `${CODE_URL}${entry.slug}/scene.js`;
  note.textContent = entry.note ?? "";
  note.hidden = !entry.note;
  actsList.querySelectorAll("a").forEach(a => {
    if (a.hash === `#${entry.slug}`) a.setAttribute("aria-current", "true");
    else {
      a.removeAttribute("aria-current");
      a.style.removeProperty("--progress");
    }
  });
  showMode();
  showPosition();
}

/** @param {Deck} deck */
function start(deck) {
  if (!wantPlay || deck !== current) return;
  if (cardUntilPlay) {
    cardUntilPlay = false;
    deck.hold = null;
    deck.dirty = true;
    fade(card, 0, BLACK_MS);
  }
  deck.posterUntilPlay = false;
  deck.dirty = true;
  deck.media.play().catch(() => {
    // without a user gesture the browser may refuse; the play button stays the way in
    if (deck === current) { wantPlay = false; showPlaying(); }
  });
}

/** @param {number} index */
function opensAct(index) {
  return order.findIndex(e => e.act === order[index].act) === index;
}

/**
 * Hands the stage to song `index`. On a handover the previous song has reached its out
 * point and plays its tail while it fades to black; the caret walks to where the next
 * song begins, or an opening act shows its title. A title chosen by the user dissolves
 * over the current frame instead.
 * @param {number} index @param {boolean} [handover]
 */
async function enter(index, handover = false) {
  const token = ++generation;
  busy = true;
  const entry = order[index];
  const deck = deckFor(index);
  // choosing the playing title again restarts it in place
  const from = current === deck ? null : current;
  current = deck;
  const act = opensAct(index) && (!from || from.entry.act !== entry.act) ? acts[entry.act] : null;
  if (from && !handover) from.media.pause();
  for (const other of decks) if (other !== deck && other !== from) drop(other);
  cardUntilPlay = false;
  card.classList.remove("is-over");
  showMeta(entry);
  showLyrics(entry);
  // the next scene loads now, while the stage stands still, because loading blocks drawing
  const next = index + 1 < order.length ? deckFor(index + 1) : null;
  const ready = Promise.all([deck.ready, next ? Promise.race([next.ready, wait(NEXT_WAIT_MS)]) : null]);
  if (handover && from) {
    await Promise.all([
      fade(from.el, 0, BLACK_MS),
      act ? showCard(act.title, act.from) : travel(ANCHORS[from.entry.slug]?.out, ANCHORS[entry.slug]?.in),
      act ? wait(CARD_HOLD_MS) : null,
      tail(from),
      ready,
    ]);
  } else if (act) {
    await showCard(act.title, act.from);
    if (token !== generation) return;
    if (from) drop(from);
    await Promise.all([ready, wait(CARD_HOLD_MS)]);
  } else {
    await ready;
  }
  if (token !== generation) return;
  if (deck.media.currentTime !== 0) deck.media.currentTime = 0;
  deck.hold = ANCHORS[entry.slug]?.in[0] || null;
  // a stage opened from a link shows the poster of the rendered video until it is played,
  // because the opening frame of many scenes is still black
  deck.posterUntilPlay = !from && !wantPlay;
  deck.dirty = true;
  deck.el.style.zIndex = "0";
  if (from && !from.gone) from.el.style.zIndex = "-1";
  busy = false;
  start(deck);
  await Promise.all([
    fade(deck.el, 1, handover || act ? BLACK_MS : DISSOLVE_MS),
    fade(card, 0, BLACK_MS),
    fade(atomFade, 0, BLACK_MS),
  ]);
  if (token !== generation) return;
  if (from && !from.gone) drop(from);
}

/** the coda closes the album with its line over the opening frame of the first song */
async function closeAlbum() {
  const token = ++generation;
  busy = true;
  const from = current;
  wantPlay = false;
  showPlaying();
  card.classList.remove("is-over");
  await Promise.all([
    from ? fade(from.el, 0, BLACK_MS) : null,
    showCard(coda.title, coda.from),
    from ? tail(from) : null,
    wait(CARD_HOLD_MS),
  ]);
  if (token !== generation) return;
  for (const deck of [...decks]) drop(deck);
  history.replaceState(null, "", `#${order[0].slug}`);
  const deck = deckFor(0);
  current = deck;
  showMeta(order[0]);
  showLyrics(order[0]);
  const next = order.length > 1 ? deckFor(1) : null;
  await Promise.all([deck.ready, next ? Promise.race([next.ready, wait(NEXT_WAIT_MS)]) : null]);
  if (token !== generation) return;
  deck.hold = order[0].slug === "system-prompt" ? CODA_FRAME : null;
  deck.dirty = true;
  card.classList.add("is-over");
  cardUntilPlay = true;
  busy = false;
  await fade(deck.el, 1, BLACK_MS);
}

function advance() {
  if (!current) return;
  const index = order.indexOf(current.entry);
  current.freeze = ANCHORS[current.entry.slug]?.out[0] ?? null;
  if (index < order.length - 1) {
    history.replaceState(null, "", `#${order[index + 1].slug}`);
    enter(index + 1, true);
  } else closeAlbum();
}

function fromHash() {
  return Math.max(0, order.findIndex(e => e.slug === decodeURIComponent(location.hash.slice(1))));
}

function toggle() {
  wantPlay = !wantPlay;
  showPlaying();
  if (!current || busy) return;
  if (wantPlay) start(current);
  else current.media.pause();
}

/** @param {number} t */
function seekTo(t) {
  if (!current) return;
  current.hold = null;
  current.media.currentTime = Math.max(0, t);
  current.dirty = true;
  showPosition();
}

function renderProgram() {
  const items = acts.map(act => {
    const li = document.createElement("li");
    const heading = document.createElement("h2");
    heading.className = "act-line";
    heading.textContent = act.title;
    const list = document.createElement("ol");
    list.className = "tracks";
    list.setAttribute("role", "list");
    for (const entry of order.filter(e => acts[e.act] === act)) {
      const item = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${entry.slug}`;
      const no = document.createElement("span");
      no.className = "track-no";
      no.textContent = pad(entry.no);
      const title = document.createElement("span");
      title.className = "track-title";
      title.textContent = entry.title;
      const duration = document.createElement("span");
      duration.className = "track-duration";
      duration.textContent = minutes(entry.duration);
      a.append(no, title, duration);
      item.append(a);
      list.append(item);
    }
    li.append(heading, list);
    return li;
  });
  const end = document.createElement("li");
  const line = document.createElement("p");
  line.className = "act-line coda";
  line.textContent = coda.title;
  end.append(line);
  actsList.replaceChildren(...items, end);
}

async function main() {
  const [album, narrative] = await Promise.all([
    fetch(new URL("album.json", VIDEO)).then(r => r.json()),
    fetch(NARRATIVE).then(r => r.json()),
  ]);
  for (const song of /** @type {Song[]} */ (album.songs)) bySlug.set(song.slug, song);
  acts = narrative.acts;
  coda = narrative.coda;
  order = acts.flatMap((act, a) => act.songs.filter(slug => bySlug.has(slug)).map(slug => ({ ...bySlug.get(slug), act: a })))
    .map((entry, i) => ({ ...entry, no: i + 1 }));
  renderProgram();

  playButton.addEventListener("click", toggle);
  screen.addEventListener("click", toggle);
  // choosing a title is a gesture, so playback may start
  addEventListener("hashchange", () => { wantPlay = true; showPlaying(); enter(fromHash()); });
  seek.addEventListener("input", () => { dragging = true; seekTo(Number(seek.value)); });
  seek.addEventListener("change", () => { dragging = false; });
  lines.addEventListener("click", event => {
    const cue = /** @type {HTMLElement} */ (event.target).closest(".cue");
    if (!(cue instanceof HTMLElement)) return;
    seekTo(Number(cue.dataset.time));
    if (!wantPlay) toggle();
  });
  lines.addEventListener("keydown", event => {
    const i = cues.findIndex(c => c.el === document.activeElement);
    if (i < 0) return;
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: cues.length - 1 }[event.key];
    if (to === undefined || !cues[to]) return;
    event.preventDefault();
    setRover(cues[to].el);
    cues[to].el.focus();
    centre(cues[to].el);
  });
  lines.addEventListener("focusout", event => {
    if (lines.contains(/** @type {Node | null} */ (event.relatedTarget))) return;
    centre(cues[currentCue]?.el ?? lines.firstElementChild);
  });
  addEventListener("keydown", event => {
    if (event.target !== document.body || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === "Space") { event.preventDefault(); toggle(); }
    if (event.code === "ArrowLeft" && current) seekTo(current.media.currentTime - 5);
    if (event.code === "ArrowRight" && current) seekTo(current.media.currentTime + 5);
  });
  // frames from before a hidden tab say nothing about how fast the scene draws
  document.addEventListener("visibilitychange", () => { for (const deck of decks) { deck.lastDraw = 0; deck.dirty = true; } });
  addEventListener("resize", () => centre(cues[currentCue]?.el ?? lines.firstElementChild));

  showPlaying();
  enter(fromHash());
  requestAnimationFrame(loop);
}

main();
