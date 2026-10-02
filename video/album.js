/**
 * @typedef {{ slug: string, title: string, duration: number, video: string, poster: string, lyrics: string }} Song
 */

const player = /** @type {HTMLVideoElement} */ (document.getElementById("player"));
const tracks = document.getElementById("tracks");
const nowTitle = document.getElementById("now-title");
const nowTrack = document.getElementById("now-track");
const nowDuration = document.getElementById("now-duration");
const lyrics = document.getElementById("lyrics");

const pad = n => String(n).padStart(2, "0");
const minutes = s => `${Math.floor(s / 60)}:${pad(Math.round(s % 60))}`;

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
    img.src = song.poster;
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

/** @param {Song[]} songs @param {boolean} play */
function show(songs, play) {
  const i = Math.max(0, songs.findIndex(s => s.slug === location.hash.slice(1)));
  const song = songs[i];
  if (player.dataset.slug !== song.slug) {
    player.dataset.slug = song.slug;
    player.poster = song.poster;
    player.src = song.video;
  }
  document.title = `${song.title} – TROTZDEM`;
  nowTitle.textContent = song.title;
  nowTrack.textContent = `Titel ${pad(i + 1)}`;
  nowDuration.textContent = minutes(song.duration);
  lyrics.textContent = song.lyrics;
  tracks.querySelectorAll("a").forEach((a, j) => {
    if (j === i) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  });
  // a browser may refuse playback without a gesture; the controls stay usable either way
  if (play) player.play().catch(() => {});
}

async function main() {
  const res = await fetch("album.json");
  /** @type {{ songs: Song[] }} */
  const album = await res.json();
  const songs = album.songs;
  renderList(songs);
  show(songs, false);
  // choosing a title is a gesture, so playback may start; loading a URL is not
  addEventListener("hashchange", () => show(songs, true));
  player.addEventListener("ended", () => {
    const i = songs.findIndex(s => s.slug === player.dataset.slug);
    if (i < songs.length - 1) location.hash = songs[i + 1].slug;
  });
}

main();
