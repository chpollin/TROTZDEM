"""Fetch a song from the Suno playlist and derive everything a scene needs.

Per song in songs.json (or the slugs given) this writes into <song>/source/:
suno.mp4, cover.jpeg, audio.wav, meta.json, lyrics.txt, vocals.wav,
instrumental.wav, align.json, transcript.json and timing-report.md, and
<song>/analysis.js. Needs the video venv (CUDA torch, stable-ts, audio-separator).

    .venv/Scripts/python tools/prepare.py                  # every song
    .venv/Scripts/python tools/prepare.py sycophancy       # one song

The timing report is a starting point, not a timeline: the aligner stretches
first words, so line onsets have to be checked against the transcription and
the vocal phrase starts before they go into timeline.js.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import HOP, SR, analyze, flux_frames, load, rms_frames  # noqa: E402

VIDEO = Path(__file__).resolve().parent.parent
API = "https://studio-api.prod.suno.com/api/playlist/{}/?page={}"
# Suno's API and CDN refuse Python's default user agent
UA = {"User-Agent": "Mozilla/5.0"}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA))


def download(url, path):
    with get(url) as r:
        path.write_bytes(r.read())


def fetch_playlist(pid):
    clips, page = {}, 1
    while True:
        with get(API.format(pid, page)) as r:
            d = json.load(r)
        for c in d["playlist_clips"]:
            clips[c["clip"]["id"]] = c["clip"]
        if len(clips) >= d.get("num_total_results", 0) or not d["playlist_clips"]:
            return clips
        page += 1


def sung_lines(lyrics):
    """Lyric lines without Suno's stage directions, labels and markdown."""
    out = []
    for line in lyrics.splitlines():
        line = re.sub(r"\[[^\]]*\]", "", line).replace("**", "").strip()
        line = re.sub(r"^(Refrain|Chorus|Verse|Bridge|Outro|Intro)\s*\d*:\s*", "", line, flags=re.I)
        line = re.sub(r"\([^)]*\)", "", line).strip().strip('"„“').strip()
        if line and re.search(r"\w", line):
            out.append(line)
    return out


def phrase_starts(vocals):
    db = 20 * np.log10(rms_frames(vocals) + 1e-6)
    on = db > np.percentile(db, 95) - 28
    starts, off = [], 0
    for i, v in enumerate(on):
        if v:
            if off >= 13:  # at least 0.25 s of silence before
                starts.append(i * HOP / SR)
            off = 0
        else:
            off += 1
    return starts


def tempo_windows(instrumental, tag_bpm, win=16.0):
    flux = flux_frames(instrumental)
    dt = HOP / SR
    dur = len(flux) * dt
    if tag_bpm:
        cands = np.unique(np.r_[np.arange(tag_bpm - 6, tag_bpm + 6.01, 0.1), np.arange(tag_bpm * 2 - 8, tag_bpm * 2 + 8.01, 0.2)])
    else:
        cands = np.arange(70, 190.01, 0.25)
    rows = []
    for a in np.arange(0, dur - 4, win):
        b = min(dur, a + win)
        best = (-1, 0, 0)
        for bpm in cands:
            p = 60 / bpm
            for ph in np.arange(0, p, 0.01):
                idx = np.minimum((np.arange(a + ph, b, p) / dt).astype(int), len(flux) - 1)
                sc = flux[idx].mean() / (flux[int(a / dt):int(b / dt)].mean() + 1e-9)
                if sc > best[0]:
                    best = (sc, bpm, a + ph)
        rows.append((a, b, best[1], best[2], best[0]))
    return rows


def prepare(slug, clip, models):
    song = VIDEO / slug
    src = song / "source"
    src.mkdir(parents=True, exist_ok=True)
    meta = {k: clip.get(k) for k in ("id", "title", "image_large_url", "video_url")}
    meta["tags"] = clip["metadata"].get("tags", "")
    meta["duration"] = clip["metadata"].get("duration")
    (src / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    lyrics = clip["metadata"].get("prompt", "")
    (src / "lyrics.txt").write_text(lyrics, encoding="utf-8")

    if not (src / "suno.mp4").exists():
        download(clip["video_url"], src / "suno.mp4")
        download(clip["image_large_url"], src / "cover.jpeg")
    import subprocess
    if not (src / "audio.wav").exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src / "suno.mp4"), "-vn", "-ac", "2", "-ar", "48000",
                        str(src / "audio.wav")], check=True)

    if not (src / "vocals.wav").exists():
        sep = models["separator"]()
        for f in sep.separate(str(src / "audio.wav")):
            f = Path(f) if Path(f).is_absolute() else src / Path(f).name
            f.replace(src / ("vocals.wav" if "(Vocals)" in f.name else "instrumental.wav"))
    analyze(song)

    lines = sung_lines(lyrics)
    whisper = models["whisper"]()
    aligned = whisper.align(str(src / "vocals.wav"), "\n".join(lines), language="de", original_split=True)
    aligned.save_as_json(str(src / "align.json"))
    free = whisper.transcribe(str(src / "vocals.wav"), language="de", word_timestamps=True, vad=True)
    free.save_as_json(str(src / "transcript.json"))

    vocals = load(src / "vocals.wav")
    starts = phrase_starts(vocals)
    m = re.search(r"(\d{2,3})\s*(?:-\s*\d{2,3}\s*)?BPM", meta["tags"], re.I)
    tempo = tempo_windows(load(src / "instrumental.wav"), int(m.group(1)) if m else None)
    mix = load(src / "audio.wav")
    loud = 20 * np.log10(rms_frames(mix) + 1e-6)
    per2 = [loud[int(t / (HOP / SR)):int((t + 2) / (HOP / SR))].mean() for t in np.arange(0, len(mix) / SR - 1, 2)]

    al = json.loads((src / "align.json").read_text(encoding="utf-8"))
    tr = json.loads((src / "transcript.json").read_text(encoding="utf-8"))
    rep = [f"# Timing report: {meta['title']}", "",
           f"Duration {len(mix) / SR:.2f} s. Style prompt: {meta['tags']}", "",
           "## Lyrics as written (with Suno stage directions)", "", "```", lyrics, "```", "",
           "## Forced alignment of the written lines on the vocal stem", "",
           "Start and end per line, then word onsets. First words are often stretched.", ""]
    for s in al["segments"]:
        rep.append(f"- {s['start']:7.2f} {s['end']:7.2f}  {s['text'].strip()}")
        rep.append("  " + " | ".join(f"{w['word'].strip()}@{w['start']:.2f}" for w in s["words"]))
    rep += ["", "## Free transcription of the vocal stem (what is actually sung, roughly)", ""]
    for s in tr["segments"]:
        rep.append(f"- {s['start']:7.2f} {s['end']:7.2f}  {s['text'].strip()}")
    rep += ["", "## Vocal phrase starts (after at least 0.25 s of silence)", "",
            " ".join(f"{t:.2f}" for t in starts), "",
            "## Tempo per 16 s window (instrumental stem; bpm, first beat, fit score; scores near 1 mean no pulse)", ""]
    for a, b, bpm, first, sc in tempo:
        rep.append(f"- {a:6.1f}-{b:6.1f}  {bpm:6.2f} BPM  first beat {first:7.3f}  score {sc:.2f}")
    rep += ["", "## Mix loudness per 2 s (dBFS), for sections", "",
            " ".join(f"{i * 2}:{v:.0f}" for i, v in enumerate(per2)), ""]
    (src / "timing-report.md").write_text("\n".join(rep), encoding="utf-8")
    print(f"{slug}: {len(lines)} lines, {len(starts)} phrase starts, report written")


def main():
    cfg = json.loads((VIDEO / "songs.json").read_text(encoding="utf-8"))
    wanted = set(sys.argv[1:])
    clips = fetch_playlist(cfg["playlist"])
    cache = {}

    def separator():
        if "sep" not in cache:
            from audio_separator.separator import Separator
            cache["sep"] = Separator(output_format="WAV")
            cache["sep"].load_model("model_bs_roformer_ep_317_sdr_12.9755.ckpt")
        return cache["sep"]

    def whisper():
        if "wh" not in cache:
            import stable_whisper
            cache["wh"] = stable_whisper.load_model("large-v3", device="cuda")
        return cache["wh"]

    for s in cfg["songs"]:
        if wanted and s["slug"] not in wanted:
            continue
        sep_dir = VIDEO / s["slug"] / "source"
        sep_dir.mkdir(parents=True, exist_ok=True)
        models = {"separator": lambda d=sep_dir: _sep_into(separator(), d), "whisper": whisper}
        prepare(s["slug"], clips[s["clip"]], models)


def _sep_into(sep, out_dir):
    # the separator writes into its output_dir; point it at this song's source folder
    sep.output_dir = str(out_dir)
    sep.model_instance.output_dir = str(out_dir)
    return sep


if __name__ == "__main__":
    main()
