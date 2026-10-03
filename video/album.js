/**
 * @typedef {{ slug: string, title: string, duration: number, video: string, poster: string, thumb?: string, accent: string, note?: string, sources?: { text: string, url: string }[], style: string, making: string, lyrics: string, live?: string }} Song
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
const nowSources = document.getElementById("now-sources");
const sourcesTitle = document.getElementById("sources-title");
const masthead = document.querySelector(".masthead h1");
const glowLayer = /** @type {HTMLElement} */ (document.querySelector(".glow"));
const CODE_URL = "https://github.com/chpollin/TROTZDEM/blob/main/video/";

// album.json and the posters live next to this script; the page may sit elsewhere
const base = new URL("./", import.meta.url);
const resolve = path => new URL(path, base).href;

const calm = matchMedia("(prefers-reduced-motion: reduce)");
// matches the container query in album.css that puts the info beside the track list
const wide = matchMedia("(min-width: 58rem)");

// smoothed loudness at which the masthead moves to the next, more worn cut; it moves back only
// WEAR_HYSTERESIS below, so a level hovering at a threshold does not flicker
const WEAR_UP = [0.3, 0.5, 0.65];
const WEAR_HYSTERESIS = 0.06;
const WEAR_FONTS = ["Redaction", "Redaction35", "Redaction70", "Redaction100"];

/** @type {Map<string, Live>} */
const liveCache = new Map();
/** @type {Live | null} */
let live = null;
/** @type {HTMLElement[]} */
let lineEls = [];
let currentLine = -1;
let glow = 0;
let glowText = "0.000";
let lastPaint = 0;
let ticking = false;
/** @type {HTMLAnchorElement | null} */
let currentLink = null;
let wear = -1;
let wearReady = false;
// once the viewer opens or closes the lyrics, their choice outlasts the default
let lyricsChosen = false;

// lyrics as a native captions track for fullscreen and assistive technology; most scenes draw
// the sung line themselves, so the track starts hidden and the viewer switches it on in the controls
const captions = player.addTextTrack("captions", "Liedtext", "de");
captions.mode = "hidden";
// instrumental gaps run up to a minute, so a line leaves the screen after this many seconds
const CAPTION_MAX = 7;

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
    img.src = resolve(song.thumb ?? song.poster);
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

/** @param {boolean} hasCues */
function defaultLyricsOpen(hasCues) {
  if (!lyricsChosen) lyricsPanel.open = hasCues && wide.matches;
}

/** @param {Song} song */
async function loadLive(song) {
  live = null;
  for (const cue of [...(captions.cues ?? [])]) captions.removeCue(cue);
  if (!song.live) {
    defaultLyricsOpen(false);
    return;
  }
  let data = liveCache.get(song.slug);
  if (!data) {
    try {
      const res = await fetch(resolve(song.live));
      if (!res.ok) throw new Error(`${res.status} ${res.url}`);
      data = /** @type {Live} */ (await res.json());
    } catch (error) {
      // without live data the lyrics stay plain text, which is enough to read along
      console.warn("live data unavailable", error);
      defaultLyricsOpen(false);
      return;
    }
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
  defaultLyricsOpen(data.cues.length > 0);
  data.cues.forEach(([time, index], k) => {
    const text = lineEls[index]?.textContent.trim();
    if (!text) return;
    const next = data.cues[k + 1]?.[0] ?? song.duration;
    captions.addCue(new VTTCue(time, Math.min(next, time + CAPTION_MAX), text));
  });
  update();
}

function scrollToLine() {
  const el = lineEls[currentLine];
  if (!el || !lyricsPanel.open) return;
  lyrics.scrollTo({ top: el.offsetTop - lyrics.clientHeight / 2, behavior: calm.matches ? "auto" : "smooth" });
}

/** @param {number} level */
function weather(level) {
  let next = -1;
  if (wearReady && !player.paused && !calm.matches) {
    next = Math.max(wear, 0);
    while (next < WEAR_UP.length && level >= WEAR_UP[next]) next++;
    while (next > 0 && level < WEAR_UP[next - 1] - WEAR_HYSTERESIS) next--;
  }
  if (next === wear) return;
  wear = next;
  // without the attribute the stylesheet's resting cut applies
  if (wear < 0) masthead.removeAttribute("data-wear");
  else masthead.setAttribute("data-wear", String(wear));
}

function update() {
  const t = player.currentTime;
  if (currentLink && player.duration) currentLink.style.setProperty("--progress", (t / player.duration).toFixed(4));
  if (!live) return;
  const level = player.paused || calm.matches ? 0 : (live.envelope[Math.floor(t * live.rate)] ?? 0) / 99;
  // smoothing keeps single drum hits from flickering the page
  glow += (level - glow) * 0.3;
  const text = glow.toFixed(3);
  if (text !== glowText) {
    glowText = text;
    glowLayer.style.setProperty("--glow", text);
  }
  weather(glow);
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
    ticking = false;
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
  const sources = song.sources ?? [];
  nowSources.replaceChildren(...sources.map(source => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = source.url;
    a.textContent = source.text;
    li.append(a);
    return li;
  }));
  nowSources.hidden = sourcesTitle.hidden = !sources.length;
  nowCode.href = `${CODE_URL}${song.slug}/scene.js`;
  nowMaking.closest(".making").hidden = !song.making && !sources.length;
  renderLyrics(song.lyrics);
  loadLive(song);
  tracks.querySelectorAll("a").forEach((a, j) => {
    if (j === i) {
      a.setAttribute("aria-current", "true");
      currentLink = a;
    } else {
      a.removeAttribute("aria-current");
      a.style.removeProperty("--progress");
    }
  });
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      album: "TROTZDEM",
      artwork: [{ src: resolve(song.poster), sizes: "1280x720", type: "image/jpeg" }],
    });
  }
  // a browser may refuse playback without a gesture; the controls stay usable either way
  if (play) player.play().catch(() => {});
}

/** @param {Song[]} songs @param {number} delta */
function step(songs, delta) {
  const i = songs.findIndex(s => s.slug === player.dataset.slug) + delta;
  if (i >= 0 && i < songs.length) location.hash = songs[i].slug;
}

/** @returns {Promise<Song[]>} */
async function loadSongs() {
  const res = await fetch(resolve("album.json"));
  if (!res.ok) throw new Error(`${res.status} ${res.url}`);
  /** @type {{ songs: Song[] }} */
  const album = await res.json();
  if (!album.songs?.length) throw new Error("album.json lists no songs");
  return album.songs;
}

/** @param {unknown} error */
function showLoadError(error) {
  console.error(error);
  const stage = /** @type {HTMLElement} */ (player.closest(".stage"));
  const message = document.createElement("p");
  message.className = "load-error";
  message.setAttribute("role", "alert");
  message.textContent = "Die Titel konnten nicht geladen werden. Bitte die Seite später neu laden.";
  stage.removeAttribute("aria-labelledby");
  stage.replaceChildren(message);
  /** @type {HTMLElement} */ (tracks.closest("nav")).hidden = true;
  /** @type {HTMLElement} */ (document.querySelector(".info")).hidden = true;
}

/** on a phone the list sits below the player, so a chosen title would otherwise play out of view */
function revealPlayer() {
  const { top, bottom } = player.getBoundingClientRect();
  if (top > -1 && bottom < innerHeight + 1) return;
  player.scrollIntoView({ block: "nearest", behavior: calm.matches ? "auto" : "smooth" });
}

async function main() {
  /** @type {Song[]} */
  let songs;
  try {
    songs = await loadSongs();
  } catch (error) {
    showLoadError(error);
    return;
  }
  renderList(songs);
  show(songs, false);
  // choosing a title is a gesture, so playback may start; loading a URL is not
  addEventListener("hashchange", () => show(songs, true));
  tracks.addEventListener("click", event => {
    if (/** @type {HTMLElement} */ (event.target).closest("a")) revealPlayer();
  });
  // play can fire twice within one frame, and a second loop would double the work
  player.addEventListener("play", () => {
    // the worn cuts load on first playback; until then the masthead keeps its resting cut
    if (!wearReady) {
      Promise.all(WEAR_FONTS.map(font => document.fonts.load(`1em "${font}"`, "TROTZDEM")))
        .then(() => { wearReady = true; })
        .catch(() => {});
    }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(tick);
  });
  player.addEventListener("seeked", update);
  player.addEventListener("pause", update);
  lyricsPanel.addEventListener("toggle", scrollToLine);
  lyricsPanel.querySelector("summary").addEventListener("click", () => { lyricsChosen = true; });
  lyrics.addEventListener("click", event => {
    const cue = /** @type {HTMLElement} */ (event.target).closest(".cue");
    if (!cue) return;
    player.currentTime = Number(cue.dataset.time);
    player.play().catch(() => {});
  });
  player.addEventListener("ended", () => step(songs, 1));
  if ("mediaSession" in navigator) {
    // an action the browser does not support throws; the remaining ones still work
    for (const [action, delta] of /** @type {const} */ ([["previoustrack", -1], ["nexttrack", 1]])) {
      try {
        navigator.mediaSession.setActionHandler(action, () => step(songs, delta));
      } catch {}
    }
  }
}

main();
