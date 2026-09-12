#!/usr/bin/env python3
"""Generate Bound toolbar icons as PNGs (stdlib only)."""

from __future__ import annotations

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: str, width: int, pixels: list[list[tuple[int, int, int, int]]]) -> None:
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b, a in row:
            raw.extend((r, g, b, a))
    payload = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, width, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(payload)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def sdf_round_rect(x: float, y: float, cx: float, cy: float, hw: float, hh: float, r: float) -> float:
    dx = abs(x - cx) - (hw - r)
    dy = abs(y - cy) - (hh - r)
    outside = math.hypot(max(dx, 0.0), max(dy, 0.0))
    inside = min(max(dx, dy), 0.0)
    return outside + inside - r


def sdf_circle(x: float, y: float, cx: float, cy: float, r: float) -> float:
    return math.hypot(x - cx, y - cy) - r


def cover(d: float, width: float = 1.15) -> float:
    return max(0.0, min(1.0, 0.5 - d / width))


def render(size: int) -> list[list[tuple[int, int, int, int]]]:
    ink = (18, 28, 37)
    ink_edge = (11, 18, 24)
    gold = (232, 176, 84)
    gold_hot = (255, 214, 140)
    cream = (246, 240, 228)
    pixels: list[list[tuple[int, int, int, int]]] = []
    s = float(size)

    for y in range(size):
        row = []
        for x in range(size):
            px = x + 0.5
            py = y + 0.5
            pad = s * 0.06
            rect = sdf_round_rect(px, py, s / 2, s / 2, s / 2 - pad, s / 2 - pad, s * 0.22)
            alpha = cover(rect, 1.2)
            if alpha <= 0:
                row.append((0, 0, 0, 0))
                continue

            bg = mix(ink, ink_edge, (px + py) / (2 * s))
            # Subtle corner light
            bg = mix(bg, (32, 48, 62), cover(rect + s * 0.08, s * 0.2) * 0.35)

            # Outer O
            cx, cy = s * 0.46, s * 0.50
            outer = sdf_circle(px, py, cx, cy, s * 0.28)
            inner = -(sdf_circle(px, py, cx, cy, s * 0.155))
            ring = max(outer, inner)
            ring_a = cover(ring, 1.1)

            # Small complexity ticks to the right of the O
            ticks = 0.0
            for i, h in enumerate((0.22, 0.34, 0.48, 0.31)):
                tx = s * 0.76
                ty = s * (0.70 - i * 0.10)
                tw = s * (0.045 + h * 0.22)
                th = s * 0.035
                d = sdf_round_rect(px, py, tx, ty, tw, th, th)
                ticks = max(ticks, cover(d, 0.9))

            color = bg
            color = mix(color, gold, ring_a)
            color = mix(color, gold_hot, ring_a * cover(outer + s * 0.04, s * 0.08))
            color = mix(color, cream, ticks * 0.92)
            color = mix(color, gold, ticks * 0.25)

            row.append((color[0], color[1], color[2], int(255 * alpha)))
        pixels.append(row)
    return pixels


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        write_png(path, size, render(size))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
