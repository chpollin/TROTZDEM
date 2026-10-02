/**
 * @typedef {{ slug: string, title: string, duration: number, video: string, poster: string, accent: string, note?: string, style: string, making: string, lyrics: string, live?: string }} Song
 * @typedef {{ rate: number, envelope: number[], cues: [number, number][] }} Live
 */

const player = /** @type {HTMLVideoElement} */ (document.getElementById("player"));
const tracks = document.getElementById("tracks");
const nowTitle = document.getElementById("now-title");
const nowTrack = document.getElementById("now-track");
const nowDuration = document.getElementById("now-duration");
const lyrics = document.getElementById("lyrics");
const lyricsPanel = /** @type {HTMLDetailsElement} */ (lyrics.closest("details"));
const nowStyle = document.getElementById("now-style");
const nowMaking = document.getElementById("now-making");
const nowNote = document.getElementById("now-note");
const nowCode = /** @type {HTMLAnchorElement} */ (document.getElementById("now-code"));
const CODE_URL = "https://github.com/chpollin/TROTZDEM/blob/main/video/";

// album.json and the posters live next to this script; the page may sit elsewhere
const base = new URL("./", import.meta.url);
const resolve = path => new URL(path, base).href;

const root = document.documentElement;
const calm = matchMedia("(prefers-reduced-motion: reduce)");

/** @type {Map<string, Live>} */
const liveCache = new Map();
/** @type {Live | null} */
let live = null;
/** @type {HTMLElement[]} */
let lineEls = [];
let currentLine = -1;
let glow = 0;
let lastPaint = 0;

const pad = n => String(n).padStart(2, "0");
const minutes = s => { const r = Math.round(s); return `${Math.floor(r / 60)}:${pad(r % 60)}`; };

/** @param {Song[]} songs */
function renderList(songs) {
  songs.forEach((song, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${song.slug}`;
    const no = document.createElement("span");
    no.className = "track-no";
    no.textContent = pad(i + 1);
    const img = document.createElement("img");
    img.src = resolve(song.poster);
    img.alt = "";
    img.loading = "lazy";
    const title = document.createElement("span");
    title.className = "track-title";
    title.textContent = song.title;
    const dur = document.createElement("span");
    dur.className = "track-duration";
    dur.textContent = minutes(song.duration);
    a.append(no, img, title, dur);
    li.append(a);
    tracks.append(li);
  });
}

/** @param {string} text */
function renderLyrics(text) {
  lineEls = text.split("\n").map(line => {
    const el = document.createElement("span");
    el.className = "line";
    el.textContent = line;
    return el;
  });
  lyrics.replaceChildren(...lineEls);
  lyrics.classList.remove("is-live");
  currentLine = -1;
}

/** @param {Song} song */
async function loadLive(song) {
  live = null;
  if (!song.live) return;
  let data = liveCache.get(song.slug);
  if (!data) {
    data = /** @type {Live} */ (await (await fetch(resolve(song.live))).json());
    liveCache.set(song.slug, data);
  }
  // another title may have been chosen while this one loaded
  if (player.dataset.slug !== song.slug) return;
  live = data;
  // a line with a cue becomes a button that seeks the video to where the line is sung
  for (const [time, index] of data.cues) {
    const el = lineEls[index];
    if (!el) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "line cue";
    button.dataset.time = String(time);
    button.textContent = el.textContent;
    el.replaceWith(button);
    lineEls[index] = button;
  }
  lyrics.classList.toggle("is-live", data.cues.length > 0);
  update();
}

function scrollToLine() {
  const el = lineEls[currentLine];
  if (!el || !lyricsPanel.open) return;
  lyrics.scrollTo({ top: el.offsetTop - lyrics.clientHeight / 2, behavior: calm.matches ? "auto" : "smooth" });
}

function update() {
  const t = player.currentTime;
  const current = /** @type {HTMLElement | null} */ (tracks.querySelector('a[aria-current="true"]'));
  if (current && player.duration) current.style.setProperty("--progress", (t / player.duration).toFixed(4));
  if (!live) return;
  const level = player.paused || calm.matches ? 0 : (live.envelope[Math.floor(t * live.rate)] ?? 0) / 99;
  // smoothing keeps single drum hits from flickering the page
  glow += (level - glow) * 0.3;
  root.style.setProperty("--glow", glow.toFixed(3));
  let index = -1;
  for (const [time, line] of live.cues) {
    if (time > t + 0.1) break;
    index = line;
  }
  if (index === currentLine) return;
  lineEls[currentLine]?.classList.remove("is-current");
  currentLine = index;
  lineEls[index]?.classList.add("is-current");
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

/** @param {Song[]} songs @param {boolean} play */
function show(songs, play) {
  const i = Math.max(0, songs.findIndex(s => s.slug === location.hash.slice(1)));
  const song = songs[i];
  if (player.dataset.slug !== song.slug) {
    player.dataset.slug = song.slug;
    player.poster = resolve(song.poster);
    player.src = resolve(song.video);
  }
  document.documentElement.style.setProperty("--accent", song.accent);
  document.title = `${song.title} – TROTZDEM`;
  nowTitle.textContent = song.title;
  nowTrack.textContent = `Titel ${pad(i + 1)}`;
  nowDuration.textContent = minutes(song.duration);
  nowStyle.textContent = song.style;
  nowNote.textContent = song.note ?? "";
  nowNote.hidden = !song.note;
  nowMaking.textContent = song.making;
  nowCode.href = `${CODE_URL}${song.slug}/scene.js`;
  nowMaking.closest(".making").hidden = !song.making;
  renderLyrics(song.lyrics);
  loadLive(song);
  tracks.querySelectorAll("a").forEach((a, j) => {
    if (j === i) a.setAttribute("aria-current", "true");
    else {
      a.removeAttribute("aria-current");
      a.style.removeProperty("--progress");
    }
  });
  // a browser may refuse playback without a gesture; the controls stay usable either way
  if (play) player.play().catch(() => {});
}

async function main() {
  const res = await fetch(resolve("album.json"));
  /** @type {{ songs: Song[] }} */
  const album = await res.json();
  const songs = album.songs;
  renderList(songs);
  show(songs, false);
  // choosing a title is a gesture, so playback may start; loading a URL is not
  addEventListener("hashchange", () => show(songs, true));
  player.addEventListener("play", () => requestAnimationFrame(tick));
  player.addEventListener("seeked", update);
  player.addEventListener("pause", update);
  lyricsPanel.addEventListener("toggle", scrollToLine);
  lyrics.addEventListener("click", event => {
    const cue = /** @type {HTMLElement} */ (event.target).closest(".cue");
    if (!cue) return;
    player.currentTime = Number(cue.dataset.time);
    player.play().catch(() => {});
  });
  player.addEventListener("ended", () => {
    const i = songs.findIndex(s => s.slug === player.dataset.slug);
    if (i < songs.length - 1) location.hash = songs[i + 1].slug;
  });
}

main();
