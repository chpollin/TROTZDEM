"""Check real scene pixels and preview dependency failures without encoding video.

Run from the repository root with the existing script-pipeline environment:
    video/.venv/Scripts/python.exe video/jagged-alien-intelligences/check_scene.py

Uses the renderer's module server and browser adapter, existing Pillow/Playwright,
and the maintained local assets. The rupture regression revisits 160.7 after
180 seconds, then compares fresh contexts and major frames in reverse order.
No images, videos or generated measurements are written. See the production
document for the selected recording and the immutable-texture decision.
"""

import hashlib
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import Browser, Page, sync_playwright

SONG = Path(__file__).resolve().parent
TOOLS = SONG.parent / "tools"
# Reuse the existing flat pipeline directly, without packaging or a second exporter.
sys.path.insert(0, str(TOOLS))
from render import grab, module_server, open_page  # noqa: E402

TIMES = (0, 10.46, 23.92, 68.9, 98.88, 138.74, 146, 153.22, 160.7, 166.74, 180)


def _pixels(page: Page, seconds: float) -> bytes:
    with Image.open(BytesIO(grab(page, seconds))) as image:
        assert image.size == (1920, 1080), "Unexpected renderer frame dimensions"
        return hashlib.sha256(image.convert("RGBA").tobytes()).digest()


def _check_pixels(browser: Browser, base_url: str) -> None:
    page = open_page(browser, SONG.name, base_url, True)
    rupture = _pixels(page, 160.7)
    _pixels(page, 180)
    assert rupture == _pixels(page, 160.7), "Rupture pixels depend on frame history"
    expected = {seconds: _pixels(page, seconds) for seconds in TIMES}
    assert len(set(expected.values())) > 1, "Scene did not change across major frames"
    for seconds in reversed(TIMES):
        assert expected[seconds] == _pixels(page, seconds), (
            f"History changed t={seconds}"
        )
    page.close()
    # Each browser.new_page inside open_page creates an isolated browser context.
    for order in (TIMES, tuple(reversed(TIMES))):
        page = open_page(browser, SONG.name, base_url, True)
        for seconds in order:
            assert expected[seconds] == _pixels(page, seconds), (
                f"Fresh context changed t={seconds}"
            )
        page.close()


def _check_preview(browser: Browser, base_url: str) -> None:
    lines = [
        line.strip()
        for line in (SONG / "suno-lyrics.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("[")
    ]
    for missing in (
        None,
        "source/original.mp3",
        "assets/strawberry.png",
        "audio-envelope.json",
    ):
        page = browser.new_page()
        if missing:
            page.route(
                f"**/{SONG.name}/{missing}",
                lambda route: route.fulfill(
                    status=404, body="Missing dependency fixture"
                ),
            )
        page.goto(f"{base_url}{SONG.name}/preview.html")
        page.wait_for_function(
            "window.sceneReady === true || window.sceneError !== undefined"
        )
        page.wait_for_function(
            "count => document.querySelectorAll('#lyrics li').length === count",
            arg=len(lines),
        )
        assert page.locator("#lyrics li").all_text_contents() == lines, missing
        error = page.evaluate("window.sceneError")
        if missing:
            assert error, f"Missing {missing} was silently accepted"
            assert page.locator(".controls").is_hidden()
            assert page.locator("audio").is_hidden()
            if missing == "audio-envelope.json":
                assert "prepare-audio.mjs" in error, error
        else:
            assert not error, error
            assert page.locator("audio").is_visible()
        page.wait_for_load_state("networkidle")
        page.close()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    with module_server(True) as base_url, sync_playwright() as playwright:
        assert base_url is not None
        browser = playwright.chromium.launch()
        try:
            _check_pixels(browser, base_url)
            _check_preview(browser, base_url)
        finally:
            browser.close()
    print("OK: repeat/fresh-context scene pixels and preview dependency fallbacks")


if __name__ == "__main__":
    main()
