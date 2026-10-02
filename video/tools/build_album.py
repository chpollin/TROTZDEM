"""Collect every song with a rendered video into album.json for the album page.

Reads songs.json (order and optional poster times), each song's source/meta.json
and source/lyrics.txt, probes the rendered MP4 and grabs a poster frame into
posters/<song>.jpg. Songs without a rendered video are left out, so running
this again after a new render adds that song.

Videos are too large for the Pages repository, so for publishing they are
encoded smaller into web/ (unversioned) and attached to a GitHub release; with
--release the page points at that release instead of the local renders.

    python tools/build_album.py                    # local renders
    python tools/build_album.py --release videos   # web encodes, release URLs
"""

import argparse

import json
import re
import subprocess
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent
RELEASE_URL = "https://github.com/chpollin/TROTZDEM/releases/download/{tag}/{slug}.mp4"


def web_encode(src, dst):
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        return
    dst.parent.mkdir(exist_ok=True)
    subprocess.run(
        # four threads, so encoding leaves room for renders running alongside
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "libx264", "-threads", "4", "-preset", "slow", "-crf", "28",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)],
        check=True,
    )


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", metavar="TAG", help="encode web versions and use this release's URLs")
    ap.add_argument("--skip", nargs="*", default=[], help="songs whose render is still a draft")
    args = ap.parse_args()
    (VIDEO / "posters").mkdir(exist_ok=True)
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
        lyrics = (VIDEO / slug / "source" / "lyrics.txt").read_text(encoding="utf-8")
        title = meta["title"]
        lyrics = display_lyrics(lyrics)
        if lyrics.splitlines() and lyrics.splitlines()[0].strip('"„“ ').lower() == title.lower():
            lyrics = "\n".join(lyrics.splitlines()[1:]).lstrip("\n")
        songs.append({
            "slug": slug,
            "title": title,
            "duration": round(dur, 2),
            "video": f"{slug}/out/{slug}.mp4",
            "poster": f"posters/{slug}.jpg",
            # Suno prompts may span lines; each line is its own clause
            "style": ", ".join(" ".join(l.split()).strip(" ,") for l in meta.get("tags", "").splitlines() if l.strip()),
            "lyrics": lyrics,
        })
        making = VIDEO / slug / "making.txt"
        songs[-1]["making"] = making.read_text(encoding="utf-8").strip() if making.exists() else ""
        if args.release:
            web_encode(mp4, VIDEO / "web" / f"{slug}.mp4")
            songs[-1]["video"] = RELEASE_URL.format(tag=args.release, slug=slug)
    (VIDEO / "album.json").write_text(json.dumps({"album": "TROTZDEM", "songs": songs}, ensure_ascii=False, indent=2) + "\n",
                                      encoding="utf-8")
    print(f"album.json: {', '.join(s['slug'] for s in songs)}")


if __name__ == "__main__":
    main()
