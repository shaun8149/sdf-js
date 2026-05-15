#!/usr/bin/env python3
"""
sdf-js dev server with aggressive no-cache headers.

Why this exists: stock `python3 -m http.server` doesn't set Cache-Control, so
browsers apply heuristic freshness to JS modules. That makes edits invisible
until the cache expires (often minutes). ES module graph caching makes it
worse — even hard-reload sometimes doesn't fully clear transitive imports.

Run from sdf-js/ directory:
    python3 dev-server.py
    # then open http://127.0.0.1:8000/examples/mvp/index.html
"""

import http.server
import socketserver
import sys

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with socketserver.TCPServer(("127.0.0.1", port), NoCacheHandler) as httpd:
        print(f"sdf-js dev server (no-cache) on http://127.0.0.1:{port}/")
        print("MVP page: http://127.0.0.1:{0}/examples/mvp/index.html".format(port))
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nbye")


if __name__ == "__main__":
    main()
