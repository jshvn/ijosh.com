#!/usr/bin/env python3
"""Golden-snapshot visual regression check for the site.

The page is meant to look identical across refactors, so we lock the rendered
pixels and fail the build if they drift unintentionally.

Modes:
  bless    screenshot the local build and save it as the golden baseline
  check    screenshot the local build and diff it against the golden (exit 1 over threshold)
  vs-live  diff the local content panel against a live URL (for matching a deploy)

Screenshots use whatever Chrome/Chromium is already on the machine; diffing uses Pillow.
Run via the Taskfile (`task visual:check`) so the venv + build are set up for you.
"""
import argparse
import functools
import glob
import http.server
import os
import subprocess
import sys
import threading
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError:
    sys.exit("Pillow missing — run `task visual:setup` (creates .venv-visual).")

ROOT = Path.cwd()
VIS = ROOT / "tests" / "visual"
GOLD = VIS / "golden"
OUT = VIS / "out"

# Fixed viewports. Mobile is tall on purpose so the stacked content (below the
# photo) is captured, not just the above-the-fold image.
VIEWPORTS = {"desktop": (1440, 900), "mobile": (390, 2200)}


def find_chrome() -> str:
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    home = str(Path.home())
    patterns = [
        home + "/Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/*",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
    for pat in patterns:
        for match in glob.glob(pat):
            if os.access(match, os.X_OK):
                return match
    from shutil import which
    for name in ("google-chrome", "chromium", "chrome"):
        found = which(name)
        if found:
            return found
    sys.exit("No Chrome/Chromium found. Set $CHROME to a browser binary.")


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # silence per-request access logs
        pass


def serve(directory: Path):
    handler = functools.partial(_QuietHandler, directory=str(directory))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def shoot(chrome: str, url: str, path: Path, w: int, h: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # NB: do NOT pass --user-data-dir — a fresh profile deadlocks headless Chrome
    # under --virtual-time-budget. virtual-time fast-forwards the body fade-in.
    cmd = [chrome, "--headless=new", "--hide-scrollbars",
           "--run-all-compositor-stages-before-draw", "--virtual-time-budget=8000",
           "--force-device-scale-factor=1",
           f"--window-size={w},{h}", f"--screenshot={path.resolve()}", url]
    try:
        subprocess.run(cmd, check=True, timeout=90,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        sys.exit(f"screenshot timed out for {url} (>90s)")
    if not path.exists():
        sys.exit(f"screenshot not produced for {url}")


def _saturation(img):
    r, g, b = img.split()
    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    return ImageChops.difference(hi, lo)  # 0 = grey, high = colorful


def diff(ref: Path, cur: Path, out: Path, tol: int, sat: int = 40, crop=None):
    a = Image.open(ref).convert("RGB")
    b = Image.open(cur).convert("RGB")
    if a.size != b.size:  # tolerate height drift; compare the common region
        w, h = min(a.size[0], b.size[0]), min(a.size[1], b.size[1])
        a, b = a.crop((0, 0, w, h)), b.crop((0, 0, w, h))
    if crop:
        a, b = a.crop(crop), b.crop(crop)
    d = ImageChops.difference(a, b).split()
    max_chan = ImageChops.lighter(ImageChops.lighter(d[0], d[1]), d[2])
    changed = max_chan.point(lambda v: 255 if v > tol else 0)
    # The design is monochrome, so any saturated pixel is the flag emoji, which
    # color-rasterizes nondeterministically per capture — exclude it from the diff.
    keep = ImageChops.darker(
        _saturation(a).point(lambda v: 255 if v <= sat else 0),
        _saturation(b).point(lambda v: 255 if v <= sat else 0),
    )
    mask = ImageChops.darker(changed, keep)
    count = mask.histogram()[-1]  # count of 255-valued (changed) pixels, C-fast
    base = a.convert("L").convert("RGB")
    red = Image.new("RGB", a.size, (255, 40, 40))
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.composite(red, base, mask.convert("L")).save(out)
    return count, a.size[0] * a.size[1]


def cmd_bless(args):
    chrome = find_chrome()
    httpd, port = serve(args.serve_dir)
    try:
        for name, (w, h) in VIEWPORTS.items():
            shoot(chrome, f"http://127.0.0.1:{port}/", GOLD / f"{name}.png", w, h)
            print(f"blessed {name} -> {GOLD / (name + '.png')}")
    finally:
        httpd.shutdown()


def cmd_check(args):
    chrome = find_chrome()
    httpd, port = serve(args.serve_dir)
    failed = False
    try:
        for name, (w, h) in VIEWPORTS.items():
            gold = GOLD / f"{name}.png"
            if not gold.exists():
                print(f"[FAIL] {name}: no golden — run `task visual:bless`")
                failed = True
                continue
            local = OUT / f"{name}-local.png"
            shoot(chrome, f"http://127.0.0.1:{port}/", local, w, h)
            changed, total = diff(gold, local, OUT / f"{name}-diff.png", args.tol)
            ratio = changed / total
            ok = ratio <= args.threshold
            failed = failed or not ok
            print(f"[{'PASS' if ok else 'FAIL'}] {name}: {ratio * 100:.3f}% changed "
                  f"({changed}/{total}px, tol={args.tol}) -> {OUT / (name + '-diff.png')}")
    finally:
        httpd.shutdown()
    sys.exit(1 if failed else 0)


def cmd_vslive(args):
    chrome = find_chrome()
    httpd, port = serve(args.serve_dir)
    ok = False
    try:
        w, h = VIEWPORTS["desktop"]
        local, ref = OUT / "vslive-local.png", OUT / "vslive-ref.png"
        shoot(chrome, f"http://127.0.0.1:{port}/", local, w, h)
        shoot(chrome, args.ref, ref, w, h)
        # Right-hand content panel only: the photo uses a different image pipeline
        # than live, so comparing it produces noise, not signal.
        changed, total = diff(ref, local, OUT / "vslive-diff.png", args.tol, crop=(720, 0, w, h))
        ratio = changed / total
        ok = ratio <= args.threshold
        print(f"[{'PASS' if ok else 'FAIL'}] content panel vs {args.ref}: "
              f"{ratio * 100:.3f}% differ ({changed}/{total}px) -> {OUT / 'vslive-diff.png'}")
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
    c.add_argument("--threshold", type=float, default=0.001, help="max changed-pixel ratio to pass (default: 0.001 = 0.1%%); margin over emoji-edge noise, below real-regression signal")
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
