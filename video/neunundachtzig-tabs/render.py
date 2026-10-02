"""Render the canvas scene in index.html frame by frame into an MP4.

The scene is a pure function of time, so frames can be rendered out of order
by parallel browser processes. Each worker encodes one contiguous segment; the
segments are concatenated without re-encoding and muxed with the audio.

    python render.py                 # full video, 1920x1080, 30 fps
    python render.py --from 30 --to 45 --out out/test.mp4
    python render.py --still 36 52.5 # PNGs for inspection
"""

import argparse
import base64
import math
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PAGE = (HERE / "index.html").as_uri() + "?render=1"
AUDIO = HERE / "source" / "audio.wav"
W, H = 1920, 1080


def open_page(browser):
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    page.on("pageerror", lambda e: print("page error:", e, file=sys.stderr))
    page.goto(PAGE)
    page.wait_for_function("window.sceneReady === true")
    return page


def grab(page, t):
    data = page.evaluate("t => window.renderFrame(t)", t)
    return base64.b64decode(data.split(",", 1)[1])


def render_segment(args, first, last, path):
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(args.fps),
         "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
         "-pix_fmt", "yuv420p", "-g", str(args.fps * 2), "-bf", "2", str(path)],
        stdin=subprocess.PIPE,
    )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = open_page(browser)
        for i in range(first, last):
            enc.stdin.write(grab(page, i / args.fps))
        browser.close()
    enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed on segment {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--from", dest="start", type=float, default=0.0)
    ap.add_argument("--to", dest="end", type=float, default=None)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--out", default="out/neunundachtzig-tabs.mp4")
    ap.add_argument("--still", type=float, nargs="+", default=None)
    args = ap.parse_args()

    out = HERE / args.out
    out.parent.mkdir(parents=True, exist_ok=True)

    if not AUDIO.exists():
        sys.exit(f"missing {AUDIO}, see README")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = open_page(browser)
        if args.still is not None:
            for t in args.still:
                png = out.with_name(f"still-{t:06.2f}.png")
                png.write_bytes(grab(page, t))
                print(png)
            browser.close()
            return
        scene_end = page.evaluate("SCENE_END")
        browser.close()
    if args.end is None:
        args.end = scene_end

    first, last = round(args.start * args.fps), math.ceil(args.end * args.fps)
    step = math.ceil((last - first) / args.workers)
    tmp = out.parent / "segments"
    tmp.mkdir(exist_ok=True)
    jobs = [(a, min(a + step, last), tmp / f"seg{k:02d}.mp4")
            for k, a in enumerate(range(first, last, step))]
    with ProcessPoolExecutor(len(jobs)) as pool:
        for f in [pool.submit(render_segment, args, *j) for j in jobs]:
            f.result()

    listing = tmp / "list.txt"
    listing.write_text("".join(f"file '{j[2].name}'\n" for j in jobs))
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
         "-ss", str(args.start), "-i", str(AUDIO),
         # pad in case the scene runs past the audio
         "-map", "0:v", "-map", "1:a", "-af", "apad", "-t", str(args.end - args.start),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "384k", "-ar", "48000",
         "-movflags", "+faststart", str(out)],
        check=True,
    )
    print(out)


if __name__ == "__main__":
    main()
