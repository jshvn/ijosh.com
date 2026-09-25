#!/usr/bin/env python3
"""Golden-snapshot visual regression check for the site.

Locks the rendered pixels (light + dark, desktop + mobile) to golden baselines
and fails the build on unintended drift.

Modes:
  bless    capture the local build and save it as the golden baseline
  check    capture the local build and diff against the golden (exit 1 over threshold)
  vs-live  diff the local page against a live URL (for matching a deploy)

Rendering uses Playwright's Chromium and diffing uses Pillow, both from the toolbox image
(docker/Dockerfile). Run via the Taskfile (`task visual:check`), which builds and runs it there.
"""
import argparse
import functools
import http.server
import sys
import threading
from pathlib import Path

try:
    from PIL import Image, ImageChops
    from playwright.sync_api import sync_playwright
except ImportError as exc:
    sys.exit(f"missing dependency ({exc}) — run this through the Taskfile, in the toolbox image.")

ROOT = Path.cwd()
VIS = ROOT / "tests" / "visual"
GOLD = VIS / "golden"
OUT = VIS / "out"

# Viewports are the initial size; screenshots are full-page, so the phone card, which
# runs past the first screen, is captured whole.
VIEWPORTS = {"desktop": (1440, 900), "mobile": (390, 844)}
SCHEMES = ("light", "dark")


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # silence per-request access logs
        pass


def serve(directory: Path):
    handler = functools.partial(_QuietHandler, directory=str(directory))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def shoot(browser, url: str, path: Path, w: int, h: int, scheme: str = "light", tries: int = 3) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # The photo and the mark load from brand.ijosh.com, and inside the toolbox Chromium now and
    # then aborts them with ERR_NETWORK_CHANGED. A capture with a failed request is retaken.
    for _ in range(tries):
        page = browser.new_page(
            viewport={"width": w, "height": h},
            device_scale_factor=1,
            color_scheme=scheme,
            reduced_motion="reduce",  # neutralizes the entry fade -> deterministic capture
        )
        failed = []
        page.on("requestfailed", lambda r: failed.append(f"{r.url} {r.failure}")
                if "cloudflareinsights.com" not in r.url else None)
        # Analytics beacon is irrelevant to layout and can stall `load`; drop it.
        page.route("**cloudflareinsights.com**", lambda route: route.abort())
        page.goto(url, wait_until="load", timeout=30000)
        if not failed:
            page.screenshot(path=str(path.resolve()), full_page=True)
            page.close()
            return
        page.close()
        print(f"retaking {path.name}: {failed[0]}")
    sys.exit(f"{path.name}: requests failed on every one of {tries} tries: {failed}")


def diff(ref: Path, cur: Path, out: Path, tol: int):
    a = Image.open(ref).convert("RGB")
    b = Image.open(cur).convert("RGB")
    if a.size != b.size:  # tolerate height drift; compare the common region
        w, h = min(a.size[0], b.size[0]), min(a.size[1], b.size[1])
        a, b = a.crop((0, 0, w, h)), b.crop((0, 0, w, h))
    d = ImageChops.difference(a, b).split()
    max_chan = ImageChops.lighter(ImageChops.lighter(d[0], d[1]), d[2])
    mask = max_chan.point(lambda v: 255 if v > tol else 0)
    count = mask.histogram()[-1]  # count of 255-valued (changed) pixels, C-fast
    base = a.convert("L").convert("RGB")
    red = Image.new("RGB", a.size, (255, 40, 40))
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.composite(red, base, mask.convert("L")).save(out)
    return count, a.size[0] * a.size[1]


def cmd_bless(args):
    httpd, port = serve(args.serve_dir)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for name, (w, h) in VIEWPORTS.items():
                for scheme in SCHEMES:
                    out = GOLD / f"{name}-{scheme}.png"
                    shoot(browser, f"http://127.0.0.1:{port}/", out, w, h, scheme)
                    print(f"blessed {name}-{scheme} -> {out}")
            browser.close()
    finally:
        httpd.shutdown()


def cmd_check(args):
    httpd, port = serve(args.serve_dir)
    failed = False
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for name, (w, h) in VIEWPORTS.items():
                for scheme in SCHEMES:
                    tag = f"{name}-{scheme}"
                    gold = GOLD / f"{tag}.png"
                    if not gold.exists():
                        print(f"[FAIL] {tag}: no golden — run `task visual:bless`")
                        failed = True
                        continue
                    local = OUT / f"{tag}-local.png"
                    shoot(browser, f"http://127.0.0.1:{port}/", local, w, h, scheme)
                    changed, total = diff(gold, local, OUT / f"{tag}-diff.png", args.tol)
                    ratio = changed / total
                    ok = ratio <= args.threshold
                    failed = failed or not ok
                    print(f"[{'PASS' if ok else 'FAIL'}] {tag}: {ratio * 100:.3f}% changed "
                          f"({changed}/{total}px, tol={args.tol}) -> {OUT / (tag + '-diff.png')}")
            browser.close()
    finally:
        httpd.shutdown()
    sys.exit(1 if failed else 0)


def cmd_vslive(args):
    httpd, port = serve(args.serve_dir)
    ok = False
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            w, h = VIEWPORTS["desktop"]
            local, ref = OUT / "vslive-local.png", OUT / "vslive-ref.png"
            shoot(browser, f"http://127.0.0.1:{port}/", local, w, h, "light")
            shoot(browser, args.ref, ref, w, h, "light")
            changed, total = diff(ref, local, OUT / "vslive-diff.png", args.tol)
            ratio = changed / total
            ok = ratio <= args.threshold
            print(f"[{'PASS' if ok else 'FAIL'}] page vs {args.ref}: "
                  f"{ratio * 100:.3f}% differ ({changed}/{total}px) -> {OUT / 'vslive-diff.png'}")
            browser.close()
    finally:
        httpd.shutdown()
    sys.exit(0 if ok else 1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--serve-dir", type=Path, default=ROOT / "public", help="built site to serve (default: public)")
    p.add_argument("--tol", type=int, default=24, help="per-channel diff tolerance, absorbs anti-aliasing (default: 24)")
    sub = p.add_subparsers(dest="mode", required=True)

    sub.add_parser("bless").set_defaults(func=cmd_bless)

    c = sub.add_parser("check")
    c.add_argument("--threshold", type=float, default=0.001, help="max changed-pixel ratio to pass (default: 0.001 = 0.1%%); margin over anti-aliasing noise, below real-regression signal")
    c.set_defaults(func=cmd_check)

    v = sub.add_parser("vs-live")
    v.add_argument("--ref", default="https://ijosh.com/", help="live URL to compare against")
    v.add_argument("--threshold", type=float, default=0.01, help="max differing-pixel ratio to pass (default: 0.01 = 1%%)")
    v.set_defaults(func=cmd_vslive)

    args = p.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    args.func(args)


if __name__ == "__main__":
    main()
