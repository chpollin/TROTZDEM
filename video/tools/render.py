"""Render one song's canvas scene frame by frame into an MP4.

The scene is a pure function of time, so frames can be rendered out of order
by parallel browser processes. Each worker encodes one contiguous segment; the
segments are concatenated without re-encoding and muxed with the audio.
Output goes to <song>/out/.

    python tools/render.py neunundachtzig-tabs                  # full video, 1920x1080, 30 fps
    python tools/render.py neunundachtzig-tabs --from 30 --to 45 --name test
    python tools/render.py neunundachtzig-tabs --still 36 52.5  # PNGs for inspection
    python tools/render.py neunundachtzig-tabs --phone          # plus a 720p copy for the phone
"""

import argparse
import base64
import math
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from playwright.sync_api import sync_playwright

VIDEO = Path(__file__).resolve().parent.parent
W, H = 1920, 1080


def open_page(browser, song):
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((VIDEO / "player.html").as_uri() + f"?song={song}&render=1")
    page.wait_for_function("window.sceneReady === true || window.sceneError !== undefined")
    error = page.evaluate("window.sceneError")
    if error or errors:
        raise RuntimeError(f"scene failed to load: {error or errors[0]}")
    page.errors = errors
    return page


def grab(page, t):
    data = page.evaluate("t => window.renderFrame(t)", t)
    if page.errors:
        raise RuntimeError(f"scene error at t={t:.3f}: {page.errors[0]}")
    return base64.b64decode(data.split(",", 1)[1])


def render_segment(song, fps, first, last, path):
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(fps),
         "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
         "-pix_fmt", "yuv420p", "-g", str(fps * 2), "-bf", "2", str(path)],
        stdin=subprocess.PIPE,
    )
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = open_page(browser, song)
            for i in range(first, last):
                enc.stdin.write(grab(page, i / fps))
            browser.close()
    finally:
        enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed on segment {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("song", help="folder name under video/")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--from", dest="start", type=float, default=0.0)
    ap.add_argument("--to", dest="end", type=float, default=None)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--name", default=None, help="output file stem, default: the song")
    ap.add_argument("--still", type=float, nargs="+", default=None)
    ap.add_argument("--phone", action="store_true", help="also write a 720p copy")
    args = ap.parse_args()

    song_dir = VIDEO / args.song
    audio = song_dir / "source" / "audio.wav"
    out_dir = song_dir / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    if not audio.exists():
        sys.exit(f"missing {audio}, run tools/prepare.py first")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = open_page(browser, args.song)
        if args.still is not None:
            for t in args.still:
                png = out_dir / f"still-{t:06.2f}.png"
                png.write_bytes(grab(page, t))
                print(png)
            browser.close()
            return
        scene_end = page.evaluate("SCENE_END")
        browser.close()
    if args.end is None:
        args.end = scene_end

    out = out_dir / f"{args.name or args.song}.mp4"
    first, last = round(args.start * args.fps), math.ceil(args.end * args.fps)
    step = math.ceil((last - first) / args.workers)
    tmp = out_dir / "segments"
    tmp.mkdir(exist_ok=True)
    jobs = [(a, min(a + step, last), tmp / f"seg{k:02d}.mp4")
            for k, a in enumerate(range(first, last, step))]
    with ProcessPoolExecutor(len(jobs)) as pool:
        for f in [pool.submit(render_segment, args.song, args.fps, *j) for j in jobs]:
            f.result()

    listing = tmp / "list.txt"
    listing.write_text("".join(f"file '{j[2].name}'\n" for j in jobs))
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
         "-ss", str(args.start), "-i", str(audio),
         # pad in case the scene runs past the audio
         "-map", "0:v", "-map", "1:a", "-af", "apad", "-t", str(args.end - args.start),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "384k", "-ar", "48000",
         "-movflags", "+faststart", str(out)],
        check=True,
    )
    print(out)
    if args.phone:
        phone = out.with_name(out.stem + "-handy.mp4")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", "scale=1280:720",
             "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(phone)],
            check=True,
        )
        print(phone)


if __name__ == "__main__":
    main()
