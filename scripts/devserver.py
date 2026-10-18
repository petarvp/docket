#!/usr/bin/env python3
"""Local static file server for development. Serves the project root on
PORT (default 8000). Avoids os.getcwd() so it works even when the parent
process's working directory isn't resolvable."""
import http.server
import os
import socketserver

PORT = int(os.environ.get("PORT", "8000"))
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_ROOT, **kwargs)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReusableTCPServer(("", PORT), Handler) as httpd:
        print(f"Serving {PROJECT_ROOT} on port {PORT}")
        httpd.serve_forever()
