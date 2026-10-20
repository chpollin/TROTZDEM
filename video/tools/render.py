"""Render one song's canvas scene frame by frame into an MP4.

The scene is a pure function of time, so frames can be rendered out of order
by parallel browser processes. Each worker encodes one contiguous segment; the
segments are concatenated without re-encoding and muxed with the audio.
Output goes to <song>/out/.
This remains a flat script pipeline. Module scenes opt into one shared loopback
server; classic scenes retain the file URL path described in the architecture.

    python tools/render.py neunundachtzig-tabs                  # full video, 1920x1080, 30 fps
    python tools/render.py neunundachtzig-tabs --from 30 --to 45 --name test
    python tools/render.py neunundachtzig-tabs --still 36 52.5  # PNGs for inspection
    python tools/render.py neunundachtzig-tabs --phone          # plus a 720p copy for the phone
    python tools/render.py jagged-alien-intelligences --module --still 36
"""

import argparse
import base64
import math
import queue
import subprocess
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from functools import partial
from http.server import ThreadingHTTPServer
from multiprocessing import Pool
from pathlib import Path
from threading import Thread
from urllib.parse import urlencode

from playwright.sync_api import Browser, Page, sync_playwright
from serve import RangeHandler

VIDEO = Path(__file__).resolve().parent.parent
W, H = 1920, 1080


@contextmanager
def module_server(enabled: bool) -> Iterator[str | None]:
    """Share one same-origin asset server across all module render workers."""
    if not enabled:
        yield None
        return
    handler = partial(RangeHandler, directory=str(VIDEO))
    with ThreadingHTTPServer(
        ("127.0.0.1", 0), handler, bind_and_activate=False
    ) as server:
        # Concurrent browser font/image bursts exceed the Windows socket backlog default.
        server.request_queue_size = 32
        server.server_bind()
        server.server_activate()
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/"
        finally:
            server.shutdown()
            thread.join()


def open_page(
    browser: Browser, song: str, base_url: str | None = None, module_mode: bool = False
) -> Page:
    if module_mode and base_url is None:
        raise ValueError("module scenes require the loopback asset server")
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    player_url = (
        base_url + "player.html" if module_mode else (VIDEO / "player.html").as_uri()
    )
    query = {"song": song, "render": "1"}
    if module_mode:
        query["module"] = "1"
    page.goto(player_url + "?" + urlencode(query))
    page.wait_for_function(
        "window.sceneReady === true || window.sceneError !== undefined"
    )
    error = page.evaluate("window.sceneError")
    if error or errors:
        raise RuntimeError(f"scene failed to load: {error or errors[0]}")
    page.errors = errors
    return page


def grab(page: Page, t: float) -> bytes:
    data = page.evaluate("t => window.renderFrame(t)", t)
    if page.errors:
        raise RuntimeError(f"scene error at t={t:.3f}: {page.errors[0]}")
    return base64.b64decode(data.split(",", 1)[1])


def render_segment(
    song: str,
    fps: int,
    first: int,
    last: int,
    path: Path,
    base_url: str | None = None,
    module_mode: bool = False,
) -> None:
    enc = subprocess.Popen(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "image2pipe",
            "-framerate",
            str(fps),
            "-c:v",
            "png",
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "16",
            "-pix_fmt",
            "yuv420p",
            "-g",
            str(fps * 2),
            "-bf",
            "2",
            str(path),
        ],
        stdin=subprocess.PIPE,
    )
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = open_page(browser, song, base_url, module_mode)
            for i in range(first, last):
                enc.stdin.write(grab(page, i / fps))
            browser.close()
    finally:
        enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed on segment {path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("song", help="folder name under video/")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--from", dest="start", type=float, default=0.0)
    ap.add_argument("--to", dest="end", type=float, default=None)
    # two per agent: each worker runs a browser and an ffmpeg, and more parallel renders nearly froze the workstation
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--name", default=None, help="output file stem, default: the song")
    ap.add_argument("--still", type=float, nargs="+", default=None)
    ap.add_argument("--phone", action="store_true", help="also write a 720p copy")
    ap.add_argument(
        "--module", action="store_true", help="load an ES module scene over local HTTP"
    )
    args = ap.parse_args()

    with module_server(args.module) as base_url:
        render(args, base_url, args.module)


def render(args: argparse.Namespace, base_url: str | None, module_mode: bool) -> None:
    """Keep the server alive through probing, parallel segments and final muxing."""
    song_dir = VIDEO / args.song
    audio = song_dir / "source" / "audio.wav"
    out_dir = song_dir / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    if not audio.exists():
        sys.exit(f"missing {audio}, run tools/prepare.py first")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = open_page(browser, args.song, base_url, module_mode)
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

    stem = args.name or args.song
    out = out_dir / f"{stem}.mp4"
    first, last = round(args.start * args.fps), math.ceil(args.end * args.fps)
    if last <= first or args.workers < 1:
        sys.exit(
            f"nothing to render: frames {first}..{last} with {args.workers} workers, check --from, --to and --workers"
        )
    step = math.ceil((last - first) / args.workers)
    # one segment folder per output name, so two renders of the same song do not overwrite each other's segments
    tmp = out_dir / f"segments-{stem}"
    tmp.mkdir(exist_ok=True)
    jobs = [
        (a, min(a + step, last), tmp / f"seg{k:02d}.mp4")
        for k, a in enumerate(range(first, last, step))
    ]
    # multiprocessing.Pool rather than ProcessPoolExecutor: on the first failed segment, leaving the
    # with block terminates the workers still rendering instead of waiting for them to finish
    outcomes = queue.SimpleQueue()
    with Pool(len(jobs)) as pool:
        for j in jobs:
            pool.apply_async(
                render_segment,
                (args.song, args.fps, *j, base_url, module_mode),
                callback=outcomes.put,
                error_callback=outcomes.put,
            )
        for _ in jobs:
            outcome = outcomes.get()
            if isinstance(outcome, BaseException):
                raise outcome

    listing = tmp / "list.txt"
    listing.write_text("".join(f"file '{j[2].name}'\n" for j in jobs), encoding="utf-8")
    # mux into a temporary sibling and replace on success, so a failed mux keeps the last good render
    part = out.with_name(out.name + ".part")
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(listing),
            "-ss",
            str(args.start),
            "-i",
            str(audio),
            # pad in case the scene runs past the audio
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-af",
            "apad",
            "-t",
            str(args.end - args.start),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "384k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
            "-f",
            "mp4",
            str(part),
        ],
        check=True,
    )
    part.replace(out)
    print(out)
    if args.phone:
        phone = out.with_name(out.stem + "-handy.mp4")
        subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-y",
                "-i",
                str(out),
                "-vf",
                "scale=1280:720",
                "-c:v",
                "libx264",
                "-preset",
                "slow",
                "-crf",
                "24",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "160k",
                "-movflags",
                "+faststart",
                str(phone),
            ],
            check=True,
        )
        print(phone)


if __name__ == "__main__":
    main()
