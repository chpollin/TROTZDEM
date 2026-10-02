"""Collect every song with a rendered video into album.json for the album page.

Reads songs.json (order and optional poster times), each song's source/meta.json
and source/lyrics.txt, probes the rendered MP4 and grabs a poster frame into
<song>/out/poster.jpg. Songs without a rendered video are left out, so running
this again after a new render adds that song.

    python tools/build_album.py
"""

import json
import re
import subprocess
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent


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
    # drop a leading title line that only repeats the song title in quotes
    return "\n".join(lines)


def main():
    cfg = json.loads((VIDEO / "songs.json").read_text(encoding="utf-8"))
    songs = []
    for s in cfg["songs"]:
        slug = s["slug"]
        mp4 = VIDEO / slug / "out" / f"{slug}.mp4"
        meta_path = VIDEO / slug / "source" / "meta.json"
        if not mp4.exists() or not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        dur = duration(mp4)
        poster = mp4.with_name("poster.jpg")
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
            "poster": f"{slug}/out/poster.jpg",
            "lyrics": lyrics,
        })
    (VIDEO / "album.json").write_text(json.dumps({"album": "TROTZDEM", "songs": songs}, ensure_ascii=False, indent=2) + "\n",
                                      encoding="utf-8")
    print(f"album.json: {', '.join(s['slug'] for s in songs)}")


if __name__ == "__main__":
    main()
