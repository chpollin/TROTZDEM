/**
 * @typedef {{ slug: string, title: string, duration: number, video: string, poster: string, accent: string, note?: string, style: string, making: string, lyrics: string, live?: string }} Song
 * @typedef {{ rate: number, envelope: number[], cues: [number, number][] }} Live
 * @typedef {{ title: string, from: string, songs: string[] }} Act
 * @typedef {{ song: Song, act: number, offset: number, el: HTMLLIElement }} Turn
 */

// the page sits two levels below the repository root and reads the album data in place
const VIDEO = new URL("../../video/", import.meta.url);
const NARRATIVE = new URL("../narrative.json", import.meta.url);
const CODE_URL = "https://github.com/chpollin/TROTZDEM/blob/main/video/";
const at = path => new URL(path, VIDEO).href;

const root = document.documentElement;
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const transcript = /** @type {HTMLElement} */ (document.getElementById("transcript"));
const meter = /** @type {HTMLElement} */ (document.getElementById("meter"));

const player = document.createElement("video");
player.controls = true;
player.playsInline = true;
player.preload = "metadata";

/** @type {Turn[]} */
let turns = [];
/** @type {HTMLElement[]} */
let actEls = [];
/** @type {HTMLElement} */
let codaEl;
let total = 1;
let current = -1;
let ended = false;

/** @type {Map<string, Live>} */
const liveCache = new Map();
/** @type {Live | null} */
let live = null;

// the stream of the current turn: line elements appear as they are sung and stay once revealed
/** @type {HTMLElement | null} */
let stream = null;
/** @type {HTMLElement | null} */
let caret = null;
/** @type {string[]} */
let lines = [];
/** @type {(HTMLElement | undefined)[]} */
let lineEls = [];
/** @type {Map<number, number>} */
let cueTimes = new Map();
let revealed = -1;
let currentLine = -1;
let level = 0;
let lastPaint = 0;
let userScrolledAt = -Infinity;

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** @param {Song} song */
function turnLink(song) {
  const a = /** @type {HTMLAnchorElement} */ (el("a", "", song.title));
  a.href = `#${song.slug}`;
  return a;
}

/** @param {Map<string, Song>} bySlug @param {Act} act */
function fromLine(bySlug, act) {
  const p = el("p", "from", "aus ");
  const song = bySlug.get(act.from);
  if (song) p.append(turnLink(song));
  return p;
}

/** @param {Song[]} songs @param {{ acts: Act[], coda: Act }} narrative */
function build(songs, narrative) {
  const bySlug = new Map(songs.map(s => [s.slug, s]));
  let offset = 0;
  narrative.acts.forEach((act, k) => {
    const section = el("section", "act");
    section.setAttribute("aria-labelledby", `act-${k}`);
    const h2 = el("h2", "act-title", act.title);
    h2.id = `act-${k}`;
    const list = el("ol", "turns");
    list.setAttribute("role", "list");
    for (const slug of act.songs) {
      const song = bySlug.get(slug);
      if (!song) continue;
      const li = /** @type {HTMLLIElement} */ (el("li", "turn"));
      li.id = `turn-${slug}`;
      // data-driven accent, so a condensed turn keeps its song's colour
      li.style.setProperty("--accent", song.accent);
      const h3 = el("h3", "turn-title");
      h3.id = `title-${slug}`;
      h3.append(turnLink(song));
      const prompt = el("p", "prompt");
      prompt.append(el("span", "role", "Suno-Prompt"), " ", el("span", "prompt-text", song.style));
      const lastLine = song.lyrics.trimEnd().split("\n").at(-1) ?? "";
      li.append(h3, prompt, el("p", "last", lastLine), el("div", "body"));
      list.append(li);
      turns.push({ song, act: k, offset, el: li });
      offset += song.duration;
    }
    section.append(h2, fromLine(bySlug, act), list);
    transcript.append(section);
    actEls.push(section);
  });
  total = offset;

  codaEl = el("section", "coda");
  codaEl.setAttribute("aria-labelledby", "coda-title");
  codaEl.hidden = true;
  const h2 = el("h2", "act-title", narrative.coda.title);
  h2.id = "coda-title";
  const restart = el("button", "restart", "Neue Sitzung");
  restart.setAttribute("type", "button");
  restart.addEventListener("click", () => {
    const first = turns[0].song.slug;
    if (location.hash === `#${first}`) show(0, true, true);
    else location.hash = first;
  });
  codaEl.append(h2, fromLine(bySlug, narrative.coda), restart);
  transcript.append(codaEl);

  // act boundaries on the meter, where the transcript compacts
  for (const k of narrative.acts.keys()) {
    if (k === 0) continue;
    const first = turns.find(turn => turn.act === k);
    if (!first) continue;
    const tick = el("span", "meter-tick");
    tick.style.setProperty("--at", (first.offset / total).toFixed(4));
    meter.append(tick);
  }
}

function setStates() {
  const act = ended ? actEls.length : turns[current].act;
  turns.forEach((turn, j) => {
    turn.el.dataset.state = ended || j < current ? "done" : j === current ? "current" : "queued";
    const link = turn.el.querySelector("h3 a");
    if (!ended && j === current) link?.setAttribute("aria-current", "step");
    else link?.removeAttribute("aria-current");
  });
  actEls.forEach((section, k) => {
    section.dataset.state = k < act ? "compacted" : k === act ? "open" : "queued";
  });
  codaEl.hidden = !ended;
}

/** @param {number} position seconds into the album */
function setMeter(position) {
  const fill = Math.min(1, Math.max(0, position / total));
  meter.style.setProperty("--fill", fill.toFixed(4));
  meter.setAttribute("aria-valuenow", String(Math.round(fill * 100)));
}

/** @param {Song} song */
function buildBody(song) {
  const body = el("div", "body");
  const response = el("div", "response");
  const screen = el("div", "screen");
  player.setAttribute("aria-labelledby", `title-${song.slug}`);
  screen.append(player);
  const wrap = el("div", "stream-wrap");
  stream = el("div", "stream");
  stream.setAttribute("role", "region");
  stream.setAttribute("aria-label", `Liedtext ${song.title}`);
  caret = el("span", "caret");
  caret.setAttribute("aria-hidden", "true");
  stream.append(caret);
  for (const type of ["wheel", "touchmove", "keydown"]) {
    stream.addEventListener(type, () => { userScrolledAt = performance.now(); }, { passive: true });
  }
  wrap.append(stream);
  response.append(screen, wrap);
  body.append(response);
  if (song.note) body.append(el("p", "note", song.note));
  if (song.making) {
    const details = el("details", "making");
    details.append(el("summary", "", "Wie das Video gemacht ist"), el("p", "", song.making));
    body.append(details);
  }
  const code = el("p", "code-link");
  const a = /** @type {HTMLAnchorElement} */ (el("a", "", "Code dieses Videos auf GitHub"));
  a.href = `${CODE_URL}${song.slug}/scene.js`;
  code.append(a);
  body.append(code);
  return body;
}

/** @param {number} upTo @param {boolean} animate */
function reveal(upTo, animate) {
  if (!stream || !caret) return;
  for (let k = revealed + 1; k <= upTo && k < lines.length; k++) {
    const text = lines[k];
    const time = cueTimes.get(k);
    /** @type {HTMLElement} */
    let line;
    if (time !== undefined) {
      line = el("button", "line cue", text);
      line.setAttribute("type", "button");
      line.dataset.time = String(time);
    } else {
      line = el("span", text.trim() ? "line" : "line gap", text);
    }
    // only lines that arrive during playback stream in; a jump reveals its backlog at once
    if (animate && k >= upTo - 1) line.classList.add("is-new");
    lineEls[k] = line;
    stream.insertBefore(line, caret);
  }
  revealed = Math.max(revealed, Math.min(upTo, lines.length - 1));
  caret.hidden = revealed >= lines.length - 1;
}

function follow() {
  // a reader who scrolled the stream keeps their place for a while
  if (!stream || performance.now() - userScrolledAt < 4000) return;
  const line = lineEls[currentLine];
  const top = currentLine >= revealed || !line
    ? stream.scrollHeight
    : line.offsetTop - stream.clientHeight / 2;
  stream.scrollTo({ top, behavior: calm.matches ? "auto" : "smooth" });
}

function update() {
  if (current < 0 || ended) return;
  const turn = turns[current];
  const t = player.currentTime;
  setMeter(turn.offset + Math.min(t, turn.song.duration));
  if (!live) return;
  const raw = player.paused || calm.matches ? 0 : (live.envelope[Math.floor(t * live.rate)] ?? 0) / 99;
  // smoothing keeps single drum hits from flickering the caret
  level += (raw - level) * 0.3;
  root.style.setProperty("--level", level.toFixed(3));
  let index = -1;
  for (const [time, line] of live.cues) {
    if (time > t + 0.1) break;
    index = line;
  }
  if (index > revealed) reveal(index, !player.paused);
  if (index === currentLine) return;
  lineEls[currentLine]?.classList.remove("is-current");
  currentLine = index;
  lineEls[index]?.classList.add("is-current");
  follow();
}

/** @param {number} now */
function tick(now) {
  if (player.paused || player.ended) {
    update();
    return;
  }
  requestAnimationFrame(tick);
  // about 15 updates a second suffice; the CSS transitions fill the gaps
  if (now - lastPaint < 66) return;
  lastPaint = now;
  update();
}

/** @param {Song} song */
async function loadLive(song) {
  live = null;
  if (!song.live) {
    reveal(lines.length - 1, false);
    return;
  }
  let data = liveCache.get(song.slug);
  if (!data) {
    data = /** @type {Live} */ (await (await fetch(at(song.live))).json());
    liveCache.set(song.slug, data);
  }
  // another turn may have been chosen while this one loaded
  if (turns[current]?.song.slug !== song.slug) return;
  live = data;
  cueTimes = new Map(data.cues.map(([time, line]) => [line, time]));
  update();
}

/** @param {number} i @param {boolean} play @param {boolean} scroll */
function show(i, play, scroll) {
  ended = false;
  const turn = turns[i];
  const song = turn.song;
  if (i !== current) {
    turns[current]?.el.querySelector(".body")?.replaceChildren();
    current = i;
    live = null;
    lines = song.lyrics.split("\n");
    lineEls = [];
    cueTimes = new Map();
    revealed = -1;
    currentLine = -1;
    userScrolledAt = -Infinity;
    turn.el.querySelector(".body")?.replaceWith(buildBody(song));
    player.poster = at(song.poster);
    player.src = song.video;
    loadLive(song);
  }
  root.style.setProperty("--accent", song.accent);
  document.title = `${song.title} | Eine Sitzung | TROTZDEM`;
  setStates();
  setMeter(turn.offset + player.currentTime);
  if (scroll) turn.el.scrollIntoView({ behavior: calm.matches ? "auto" : "smooth", block: "start" });
  // a browser may refuse playback without a gesture; the controls stay usable either way
  if (play) player.play().catch(() => {});
}

function endSession() {
  ended = true;
  turns[current]?.el.querySelector(".body")?.replaceChildren();
  // no current turn, so choosing any turn afterwards rebuilds it
  current = -1;
  live = null;
  setMeter(total);
  root.style.setProperty("--level", "0");
  document.title = "Eine Sitzung | TROTZDEM";
  setStates();
  codaEl.scrollIntoView({ behavior: calm.matches ? "auto" : "smooth", block: "center" });
  codaEl.querySelector("button")?.focus({ preventScroll: true });
}

const indexOfHash = () => turns.findIndex(turn => turn.song.slug === location.hash.slice(1));

async function main() {
  const [album, narrative] = await Promise.all([
    fetch(at("album.json")).then(res => res.json()),
    fetch(NARRATIVE).then(res => res.json()),
  ]);
  build(album.songs, narrative);
  const start = indexOfHash();
  show(Math.max(0, start), false, start > 0);

  // choosing a turn is a gesture, so playback may start; loading a URL is not
  addEventListener("hashchange", () => {
    const i = indexOfHash();
    if (i >= 0) show(i, true, true);
  });
  player.addEventListener("play", () => requestAnimationFrame(tick));
  player.addEventListener("seeked", update);
  player.addEventListener("pause", update);
  player.addEventListener("ended", () => {
    reveal(lines.length - 1, false);
    if (current < turns.length - 1) location.hash = turns[current + 1].song.slug;
    else endSession();
  });
  transcript.addEventListener("click", event => {
    const target = /** @type {HTMLElement} */ (event.target);
    // the hash does not change when the chosen turn is already in the URL, so no hashchange follows
    const link = target.closest('a[href^="#"]');
    if (link instanceof HTMLAnchorElement && link.hash === location.hash) {
      const i = indexOfHash();
      if (i >= 0 && i !== current) {
        event.preventDefault();
        show(i, true, true);
      }
      return;
    }
    const cue = target.closest(".cue");
    if (!(cue instanceof HTMLElement)) return;
    player.currentTime = Number(cue.dataset.time);
    player.play().catch(() => {});
  });
}

main();
