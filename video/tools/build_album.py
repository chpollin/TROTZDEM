"""Collect every song with a rendered video into album.json for the album page.

Reads songs.json (order, optional title override and poster times), each
song's source/meta.json and source/lyrics.txt, probes the rendered MP4, grabs a
poster frame into posters/<song>.jpg and a small thumbnail for the track list
into posters/thumbs/<song>.webp (JPG where ffmpeg lacks libwebp). Songs without
a rendered video are left out, so running this again after a new render adds
that song.

Videos are too large for the Pages repository, so for publishing they are
encoded smaller into web/ (unversioned) and attached to the GitHub release
`videos`, and album.json points at that release. --local points the page at
the local renders instead, for a preview with tools/serve.py only; an
album.json built that way must not be committed, because Pages has no renders.

    python tools/build_album.py                  # web encodes, release URLs (release "videos")
    python tools/build_album.py --release other  # another release tag
    python tools/build_album.py --local          # local renders, preview only
"""

import argparse

import json
import re
import subprocess
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent
RELEASE_URL = "https://github.com/chpollin/TROTZDEM/releases/download/{tag}/{slug}.mp4"
# the track list shows posters about 96 px wide; four times that stays sharp on high-density screens
THUMB_WIDTH = 384
# --surface in album.css, oklch(0.17 0.006 285), in sRGB
SURFACE = "#0f0f12"


def luminance(hex_colour: str) -> float:
    channels = [int(hex_colour.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    r, g, b = (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def web_encode(src: Path, dst: Path) -> None:
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        return
    dst.parent.mkdir(exist_ok=True)
    # encode into a temporary sibling and replace on success, so an interrupted encode never
    # leaves a truncated video that the mtime check above would then keep forever
    part = dst.with_name(dst.name + ".part")
    subprocess.run(
        # four threads, so encoding leaves room for renders running alongside
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "libx264", "-threads", "4", "-preset", "slow", "-crf", "28",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-f", "mp4", str(part)],
        check=True,
    )
    part.replace(dst)


def thumb_codec() -> tuple[str, list[str]]:
    """File extension and ffmpeg codec options for thumbnails, WebP where ffmpeg has libwebp."""
    encoders = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True, check=True).stdout
    if re.search(r"\slibwebp\s", encoders):
        return "webp", ["-c:v", "libwebp", "-quality", "80"]
    return "jpg", ["-q:v", "4"]


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out)


def display_lyrics(text):
    """Lyrics as sung text: Suno's stage directions and markdown removed, stanza breaks kept."""
    lines = []
    for line in text.splitlines():
        line = re.sub(r"\[[^\]]*\]", "", line).replace("**", "").strip()
        line = re.sub(r"^Refrain:\s*", "", line)
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        lines.append(line)
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def norm(text):
    return re.sub(r"[^\w]", "", text.lower())


def live_data(song_dir, display):
    """Loudness at 10 Hz and line cues for the page, so it can follow the music and the singing.

    The cues map the forced alignment (source/align.json) onto the display lyrics in order.
    The aligner tends to stretch a line's first word back into the pause before it, so a
    long gap after the first word moves the cue to just before the second word.
    """
    m = re.search(r"const AUDIO_RMS = \[([^\]]*)\]", (song_dir / "analysis.js").read_text(encoding="utf-8"))
    rms = [int(v) for v in m.group(1).split(",") if v] if m else []
    envelope = [round(sum(rms[i:i + 5]) / len(rms[i:i + 5])) for i in range(0, len(rms), 5)]
    cues = []
    align = song_dir / "source" / "align.json"
    if align.exists():
        lines = [norm(line) for line in display.splitlines()]
        i = 0
        for seg in json.loads(align.read_text(encoding="utf-8"))["segments"]:
            key = norm(seg["text"])
            j = next((k for k in range(i, len(lines)) if key and lines[k] and (key in lines[k] or lines[k] in key)), None)
            if j is None:
                continue
            words = seg.get("words") or []
            start = seg["start"]
            if len(words) > 1 and words[1]["start"] - words[0]["start"] > 1.0:
                start = words[1]["start"] - 0.3
            cues.append([round(start, 2), j])
            i = j + 1
    return {"rate": 10, "envelope": envelope, "cues": cues}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", metavar="TAG", default="videos", help="release whose URLs the page plays (default: videos)")
    ap.add_argument("--local", action="store_true", help="play the local renders instead, preview only, never commit the result")
    ap.add_argument("--skip", nargs="*", default=[], help="songs whose render is still a draft")
    args = ap.parse_args()
    (VIDEO / "posters" / "thumbs").mkdir(parents=True, exist_ok=True)
    thumb_ext, thumb_opts = thumb_codec()
    cfg = json.loads((VIDEO / "songs.json").read_text(encoding="utf-8"))
    songs = []
    for s in cfg["songs"]:
        slug = s["slug"]
        mp4 = VIDEO / slug / "out" / f"{slug}.mp4"
        meta_path = VIDEO / slug / "source" / "meta.json"
        if slug in args.skip or not mp4.exists() or not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        dur = duration(mp4)
        poster = VIDEO / "posters" / f"{slug}.jpg"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", str(s.get("poster", round(dur * 0.45, 2))), "-i", str(mp4),
             "-frames:v", "1", "-vf", "scale=1280:-1", "-q:v", "3", str(poster)],
            check=True,
        )
        thumb = VIDEO / "posters" / "thumbs" / f"{slug}.{thumb_ext}"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(poster), "-vf", f"scale={THUMB_WIDTH}:-1", *thumb_opts, str(thumb)],
            check=True,
        )
        lyrics = (VIDEO / slug / "source" / "lyrics.txt").read_text(encoding="utf-8")
        # songs.json may override Suno's title, e.g. to drop a "(Remastered)" the video does not show
        title = s.get("title", meta["title"])
        lyrics = display_lyrics(lyrics)
        # Suno lyrics sometimes open with the title; either spelling counts
        if lyrics.splitlines() and lyrics.splitlines()[0].strip('"„“ ').lower() in {title.lower(), meta["title"].lower()}:
            lyrics = "\n".join(lyrics.splitlines()[1:]).lstrip("\n")
        songs.append({
            "slug": slug,
            "title": title,
            "duration": round(dur, 2),
            "video": f"{slug}/out/{slug}.mp4",
            "poster": f"posters/{slug}.jpg",
            "thumb": f"posters/thumbs/{slug}.{thumb_ext}",
            # the colour that carries meaning inside this video; the page takes it over
            "accent": s.get("accent", "#a77bff"),
            # Suno prompts may span lines; each line is its own clause
            "style": ", ".join(" ".join(tag.split()).strip(" ,") for tag in meta.get("tags", "").splitlines() if tag.strip()),
            "lyrics": lyrics,
            # context the page shows above the making paragraph, e.g. for a deliberately provocative text
            "note": s.get("note", ""),
            "sources": s.get("sources", []),
        })
        # the page lifts dark accents for text itself, but lines and surfaces show them as they are
        if contrast(songs[-1]["accent"], SURFACE) < 4.5:
            print(f"{slug}: accent {songs[-1]['accent']} reaches only {contrast(songs[-1]['accent'], SURFACE):.1f}:1 against the surface")
        (VIDEO / "live").mkdir(exist_ok=True)
        (VIDEO / "live" / f"{slug}.json").write_text(json.dumps(live_data(VIDEO / slug, lyrics), separators=(",", ":")), encoding="utf-8")
        songs[-1]["live"] = f"live/{slug}.json"
        making = VIDEO / slug / "making.txt"
        songs[-1]["making"] = making.read_text(encoding="utf-8").strip() if making.exists() else ""
        if not args.local:
            web_encode(mp4, VIDEO / "web" / f"{slug}.mp4")
            songs[-1]["video"] = RELEASE_URL.format(tag=args.release, slug=slug)
    (VIDEO / "album.json").write_text(json.dumps({"album": "TROTZDEM", "songs": songs}, ensure_ascii=False, indent=2) + "\n",
                                      encoding="utf-8")
    print(f"album.json: {', '.join(s['slug'] for s in songs)}")


if __name__ == "__main__":
    main()
