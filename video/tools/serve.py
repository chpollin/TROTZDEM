"""Serve the video folder locally with HTTP byte ranges, so videos can be seeked.

Python's http.server answers every request with the whole file, and browsers
refuse to seek in a video without range support.

    python tools/serve.py          # http://127.0.0.1:8089/
"""

import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        m = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start, end = m.group(1), m.group(2)
        if start:
            first, last = int(start), min(int(end) if end else size - 1, size - 1)
        else:
            first, last = max(0, size - int(end)), size - 1
        if first > last:
            self.send_error(416, "Range Not Satisfiable")
            return None
        f = open(path, "rb")
        f.seek(first)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {first}-{last}/{size}")
        self.send_header("Content-Length", str(last - first + 1))
        self.end_headers()
        self.remaining = last - first + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        try:
            while remaining > 0:
                chunk = source.read(min(1 << 16, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the browser cancels range requests while seeking
        finally:
            self.remaining = None

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8089
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(RangeHandler, directory=str(VIDEO)))
    print(f"http://127.0.0.1:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
