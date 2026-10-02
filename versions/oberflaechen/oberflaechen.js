/**
 * @typedef {{ slug: string, title: string, duration: number, video: string, poster: string, accent: string, note?: string, making: string, lyrics: string, live?: string }} Song
 * @typedef {{ rate: number, envelope: number[], cues: [number, number][] }} Live
 * @typedef {{ title: string, from: string, songs: string[] }} Act
 * @typedef {{ song: Song, act: number, win: HTMLElement, view: HTMLElement, lyrics: HTMLElement, status: HTMLElement, link: HTMLAnchorElement, lines: HTMLElement[] }} Pane
 */

// Every video plays inside a single interface; the window title names it, condensed from the song's `making` text.
const INTERFACES = {
  "system-prompt": "Systemprompt",
  "im-addicted-to-claude-code": "Aktivitätskalender",
  "empire-of-ai": "Livestream",
  "hallelujah-the-god-machine": "Lernkurve",
  "lost-in-the-vault": "Notizgraph",
  "good-morning-claude": "Code-Editor",
  "machine-of-loving-grace": "Chat",
  "ich-predicte-dich": "Nächstes Token",
  "sycophancy": "Präferenzvergleich",
  "prompt-engineer": "Eingabefeld",
  "neunundachtzig-tabs": "Browser",
  "bin-ich-noch-der-expert": "Regelkreis",
  "the-bitter-lesson": "Go-Diagramm",
  "the-bitter-lesson-remix": "Prozessmonitor",
};

// Cascade origin and step per act, as fractions of the free desktop space. Later acts start further
// right and lower, so the windows of the whole album pile up toward the end.
const CASCADE = [
  { x: 0, y: 0, dx: 0.09, dy: 0.11 },
  { x: 0.3, y: 0.18, dx: 0.12, dy: 0.13 },
  { x: 0.62, y: 0.4, dx: 0.126, dy: 0.2 },
];

const VIDEO_BASE = new URL("../../video/", import.meta.url);
const NARRATIVE_URL = new URL("../narrative.json", import.meta.url);
const CODE_URL = "https://github.com/chpollin/TROTZDEM/blob/main/video/";
const CODA = "coda";

const desktop = /** @type {HTMLElement} */ (document.getElementById("desktop"));
const wallpaper = /** @type {HTMLElement} */ (document.getElementById("wallpaper"));
const dock = /** @type {HTMLElement} */ (document.getElementById("dock"));
const root = document.documentElement;
const calm = matchMedia("(prefers-reduced-motion: reduce)");

// one player for the whole desktop; it moves into whichever window has focus
const player = document.createElement("video");
player.controls = true;
player.playsInline = true;
player.preload = "metadata";

/** @type {Pane[]} */
const panes = [];
/** @type {Map<string, Pane>} */
const bySlug = new Map();
/** @type {Map<string, Live>} */
const liveCache = new Map();
/** @type {Pane[]} paint order, the last one is in front */
let stack = [];
/** @type {Act[]} */
let acts = [];
/** @type {Act} */
let coda;
/** @type {HTMLAnchorElement} */
let codaLink;
let codaAccent = "";
/** @type {Pane | null} */
let focused = null;
let reached = 0;
/** @type {Live | null} */
let live = null;
let currentLine = -1;
let glow = 0;
let lastPaint = 0;
let switchTimer = 0;

const resolve = (/** @type {string} */ path) => new URL(path, VIDEO_BASE).href;

/**
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {(Node | string)[]} children
 */
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** @param {Pane} pane */
function renderLines(pane) {
  pane.lines = pane.song.lyrics.split("\n").map(line => el("span", { className: "line", textContent: line }));
  pane.lyrics.replaceChildren(...pane.lines);
  pane.lyrics.classList.remove("is-live");
  pane.lyrics.scrollTop = 0;
}

/** A window that is not playing shows its poster and its lyrics as plain text. @param {Pane} pane */
function settle(pane) {
  const img = el("img", { src: resolve(pane.song.poster), alt: "", loading: "lazy", decoding: "async" });
  pane.view.replaceChildren(img);
  renderLines(pane);
  pane.status.hidden = true;
  pane.win.style.removeProperty("--glow");
}

/** @param {Pane} pane */
function activate(pane) {
  pane.view.replaceChildren(player);
  player.poster = resolve(pane.song.poster);
  player.src = resolve(pane.song.video);
  renderLines(pane);
  pane.status.hidden = false;
  currentLine = -1;
  glow = 0;
  loadLive(pane);
}

/** @param {Pane} pane */
async function loadLive(pane) {
  live = null;
  if (!pane.song.live) return;
  let data = liveCache.get(pane.song.slug);
  if (!data) {
    try {
      data = /** @type {Live} */ (await (await fetch(resolve(pane.song.live))).json());
    } catch {
      // without cues the lyrics stay readable as plain text
      return;
    }
    liveCache.set(pane.song.slug, data);
  }
  // another window may have been brought to front while this one loaded
  if (focused !== pane) return;
  live = data;
  for (const [time, index] of data.cues) {
    const line = pane.lines[index];
    if (!line) continue;
    const button = el("button", { type: "button", className: "line cue", textContent: line.textContent });
    button.dataset.time = String(time);
    line.replaceWith(button);
    pane.lines[index] = button;
  }
  pane.lyrics.classList.toggle("is-live", data.cues.length > 0);
  update();
}

/**
 * @param {Song} song
 * @param {number} act
 * @param {number} step position of the song inside its act
 */
function makePane(song, act, step) {
  const c = CASCADE[Math.min(act, CASCADE.length - 1)];
  const ui = INTERFACES[song.slug] ?? song.title;
  const titleId = `win-${song.slug}`;
  const win = el("section", { className: "win", hidden: true });
  win.dataset.slug = song.slug;
  win.setAttribute("aria-labelledby", titleId);
  win.style.setProperty("--accent", song.accent);
  win.style.setProperty("--x", Math.min(1, c.x + c.dx * step).toFixed(3));
  win.style.setProperty("--y", Math.min(1, c.y + c.dy * step).toFixed(3));

  const view = el("div", { className: "win-view" });
  const lyrics = el("div", { className: "lyrics" });
  const side = el("div", { className: "win-side" }, lyrics);
  const status = el("footer", { className: "win-status", hidden: true },
    el("a", { href: `${CODE_URL}${song.slug}/scene.js`, textContent: "Code dieses Videos auf GitHub" }),
    ...(song.making ? [el("details", {},
      el("summary", { textContent: "Wie das Video gemacht ist" }),
      el("p", { textContent: song.making }))] : []));
  win.append(
    el("header", { className: "win-bar" },
      el("h2", { id: titleId },
        el("span", { className: "win-ui", textContent: ui }), " ",
        el("span", { className: "win-song", textContent: song.title }))),
    el("div", { className: "win-body" }, view, side),
    ...(song.note ? [el("p", { className: "note", textContent: song.note })] : []),
    status);
  desktop.append(win);

  const link = /** @type {HTMLAnchorElement} */ (el("a", { href: `#${song.slug}` },
    el("span", { className: "dock-ui", textContent: ui }),
    el("span", { className: "dock-song", textContent: song.title })));
  link.style.setProperty("--accent", song.accent);

  /** @type {Pane} */
  const pane = { song, act, win, view, lyrics, status, link, lines: [] };
  settle(pane);
  return pane;
}

/** @param {Song[]} songs @param {{ acts: Act[], coda: Act }} narrative */
function build(songs, narrative) {
  const bySongSlug = new Map(songs.map(s => [s.slug, s]));
  acts = narrative.acts;
  coda = narrative.coda;
  codaAccent = bySongSlug.get(coda.from)?.accent ?? "";
  acts.forEach((act, a) => {
    const list = el("ol");
    list.setAttribute("role", "list");
    dock.append(el("section", { className: "dock-act" }, el("h2", { textContent: act.title }), list));
    act.songs.forEach((slug, step) => {
      const song = bySongSlug.get(slug);
      if (!song) return;
      const pane = makePane(song, a, step);
      panes.push(pane);
      bySlug.set(slug, pane);
      list.append(el("li", {}, pane.link));
    });
  });
  codaLink = /** @type {HTMLAnchorElement} */ (el("a", { href: `#${CODA}`, textContent: coda.title }));
  if (codaAccent) codaLink.style.setProperty("--accent", codaAccent);
  dock.append(el("h2", { className: "dock-coda" }, codaLink));
  stack = [...panes];
}

/** Keeps the current entry visible while the dock scrolls on its own beside the desktop. @param {HTMLElement} link */
function revealInDock(link) {
  // on a narrow screen the dock does not scroll itself, and moving the page there would pull it away from the window
  if (dock.scrollHeight <= dock.clientHeight) return;
  const box = dock.getBoundingClientRect();
  const r = link.getBoundingClientRect();
  if (r.top < box.top) dock.scrollTop += r.top - box.top - 8;
  else if (r.bottom > box.bottom) dock.scrollTop += r.bottom - box.bottom + 8;
}

function layout() {
  // the coda counts as the act after the last one, so every window has sunk back by then
  const act = focused ? focused.act : acts.length;
  panes.forEach((pane, i) => {
    const open = i <= reached;
    const isFocused = pane === focused;
    pane.win.hidden = !open;
    pane.win.style.zIndex = String(stack.indexOf(pane) + 1);
    pane.win.dataset.depth = String(Math.max(0, Math.min(2, act - pane.act)));
    pane.win.classList.toggle("is-focused", isFocused);
    // the dock already names every window; only the playing one is exposed in full
    if (isFocused) pane.win.removeAttribute("aria-hidden");
    else pane.win.setAttribute("aria-hidden", "true");
    pane.link.dataset.open = String(open);
    if (isFocused) pane.link.setAttribute("aria-current", "true");
    else pane.link.removeAttribute("aria-current");
  });
  if (focused) codaLink.removeAttribute("aria-current");
  else codaLink.setAttribute("aria-current", "true");
  const actInfo = focused ? acts[focused.act] : coda;
  wallpaper.textContent = actInfo.title;
  const fromAccent = bySlug.get(actInfo.from)?.song.accent ?? codaAccent;
  if (fromAccent) wallpaper.style.setProperty("--accent", fromAccent);
  desktop.classList.toggle("is-coda", !focused);
  revealInDock(focused ? focused.link : codaLink);
  if (focused) root.style.setProperty("--accent", focused.song.accent);
  else if (codaAccent) root.style.setProperty("--accent", codaAccent);
  document.title = focused ? `${focused.song.title} | TROTZDEM Oberflächen` : `${coda.title} | TROTZDEM Oberflächen`;
}

// a new act switches the desktop: its title comes to the front for a moment, then sinks behind the windows
function announceAct() {
  desktop.classList.remove("is-switching");
  // reading layout restarts the animation when acts change in quick succession
  void desktop.offsetWidth;
  desktop.classList.add("is-switching");
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => desktop.classList.remove("is-switching"), 2400);
}

/** @param {boolean} play */
function show(play) {
  const hash = decodeURIComponent(location.hash.slice(1));
  const target = hash === CODA ? null : bySlug.get(hash) ?? panes[0];
  const previousAct = focused ? focused.act : acts.length;
  if (target !== focused) {
    if (focused) settle(focused);
    focused = target;
    if (target) activate(target);
    else {
      player.pause();
      player.remove();
      live = null;
      glow = 0;
    }
  }
  reached = Math.max(reached, target ? panes.indexOf(target) : panes.length - 1);
  if (target) stack = [...stack.filter(p => p !== target), target];
  layout();
  if (play && target && target.act !== previousAct) announceAct();
  // on a narrow screen the dock sits below the window, so a chosen window has to be brought into view
  if (play && target) {
    const top = target.win.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.6) target.win.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
  }
  // a browser may refuse playback without a gesture; the controls stay usable either way
  if (play && target) player.play().catch(() => {});
}

function scrollToLine() {
  const line = focused?.lines[currentLine];
  if (!line || !focused) return;
  const box = focused.lyrics;
  box.scrollTo({ top: line.offsetTop - box.clientHeight / 2, behavior: calm.matches ? "auto" : "smooth" });
}

function update() {
  if (!live || !focused) return;
  const t = player.currentTime;
  const level = player.paused || calm.matches ? 0 : (live.envelope[Math.floor(t * live.rate)] ?? 0) / 99;
  // smoothing keeps single drum hits from flickering the window chrome
  glow += (level - glow) * 0.3;
  // set on the playing window only, so each change restyles one subtree instead of the page
  focused.win.style.setProperty("--glow", glow.toFixed(3));
  let index = -1;
  for (const [time, line] of live.cues) {
    if (time > t + 0.1) break;
    index = line;
  }
  if (index === currentLine) return;
  focused.lines[currentLine]?.classList.remove("is-current");
  currentLine = index;
  focused.lines[index]?.classList.add("is-current");
  scrollToLine();
}

/** @param {number} now */
function tick(now) {
  if (player.paused || player.ended) {
    update();
    return;
  }
  requestAnimationFrame(tick);
  // about 15 updates a second suffice; the CSS transition fills the gaps
  if (now - lastPaint < 66) return;
  lastPaint = now;
  update();
}

/** @param {KeyboardEvent} event */
function moveInDock(event) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const links = /** @type {HTMLAnchorElement[]} */ ([...dock.querySelectorAll("a")]);
  const i = links.indexOf(/** @type {HTMLAnchorElement} */ (document.activeElement));
  if (i < 0) return;
  event.preventDefault();
  const last = links.length - 1;
  const next = event.key === "Home" ? 0
    : event.key === "End" ? last
    : (i + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
  links[next].focus();
}

async function main() {
  const [album, narrative] = await Promise.all([
    fetch(resolve("album.json")).then(r => r.json()),
    fetch(NARRATIVE_URL).then(r => r.json()),
  ]);
  build(album.songs, narrative);
  // a deep link opens every window up to its target, as if the album had played to there
  show(false);

  // bringing a window to front is a gesture, so playback may start; loading a URL is not
  addEventListener("hashchange", () => show(true));
  desktop.addEventListener("click", event => {
    const target = /** @type {HTMLElement} */ (event.target);
    const cue = /** @type {HTMLElement | null} */ (target.closest(".cue"));
    if (cue) {
      player.currentTime = Number(cue.dataset.time);
      player.play().catch(() => {});
      return;
    }
    const win = /** @type {HTMLElement | null} */ (target.closest(".win"));
    if (win && !win.classList.contains("is-focused")) location.hash = win.dataset.slug ?? "";
  });
  dock.addEventListener("keydown", moveInDock);
  player.addEventListener("play", () => requestAnimationFrame(tick));
  player.addEventListener("seeked", update);
  player.addEventListener("pause", update);
  player.addEventListener("ended", () => {
    const i = focused ? panes.indexOf(focused) : -1;
    location.hash = i >= 0 && i < panes.length - 1 ? panes[i + 1].song.slug : CODA;
  });
}

main();
