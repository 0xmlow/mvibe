#!/usr/bin/env python3
"""Export an existing Excel cell painting as exact vector geometry and PNG.

Uses only Python's standard library. Does not rasterize or embed the workbook.
"""
import argparse
import collections
import json
from pathlib import Path, PurePosixPath
import re
import struct
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape
import zipfile
import zlib

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

def position(address):
    match = re.fullmatch(r"([A-Z]+)([1-9][0-9]*)", address)
    if not match:
        raise ValueError(f"Invalid cell address: {address}")
    column = 0
    for char in match[1]:
        column = column * 26 + ord(char) - 64
    return column - 1, int(match[2]) - 1

def read_art(path, sheet_name=None):
    with zipfile.ZipFile(path) as book:
        workbook = ET.fromstring(book.read("xl/workbook.xml"))
        sheets = workbook.findall("s:sheets/s:sheet", NS)
        sheet = next((s for s in sheets if s.get("name") == sheet_name), None) if sheet_name else sheets[0]
        if sheet is None:
            raise ValueError(f"Sheet not found: {sheet_name}")
        rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        relationship = next(r for r in rels if r.get("Id") == sheet.get(f"{{{REL}}}id"))
        target = relationship.get("Target")
        part = target.lstrip("/") if target.startswith("/") else str(PurePosixPath("xl") / target)
        root = ET.fromstring(book.read(part))
        if root.find("s:drawing", NS) is not None or root.find("s:mergeCells", NS) is not None:
            raise ValueError("This exporter handles unmerged colored cells. Drawings or merged cells require a separate rendering workflow.")
        styles = ET.fromstring(book.read("xl/styles.xml"))
        fills = []
        for fill in styles.find("s:fills", NS):
            pattern = fill.find("s:patternFill", NS)
            if pattern is None or pattern.get("patternType") != "solid":
                fills.append(None)
                continue
            color = pattern.find("s:fgColor", NS)
            rgb = color.get("rgb") if color is not None else None
            if not rgb or color.get("tint") is not None:
                raise ValueError("Theme, indexed, or tinted fills must be resolved to explicit RGB colors before export.")
            fills.append(rgb[-6:].upper())
        xfs = [fills[int(style.get("fillId", "0"))] for style in styles.find("s:cellXfs", NS)]
        formats = {n.get("numFmtId"): n.get("formatCode") for n in styles.findall("s:numFmts/s:numFmt", NS)}
        hidden = [formats.get(style.get("numFmtId")) == ";;;" for style in styles.find("s:cellXfs", NS)]
        cells = []
        for cell in root.findall("s:sheetData/s:row/s:c", NS):
            value = cell.find("s:v", NS)
            safe_marker = value is not None and value.text == "0" and hidden[int(cell.get("s", "0"))] and cell.get("t", "n") == "n"
            if cell.find("s:f", NS) is not None or cell.find("s:is", NS) is not None or (value is not None and not safe_marker):
                raise ValueError("The selected sheet contains values or text. This exporter is for pure cell-fill artwork.")
            color = xfs[int(cell.get("s", "0"))]
            if color:
                x, y = position(cell.get("r"))
                cells.append((x, y, color))
        if not cells:
            raise ValueError("No solid RGB cell fills found.")
        width, height = max(x for x, _, _ in cells) + 1, max(y for _, y, _ in cells) + 1
        if width * height > 1_100_000:
            raise ValueError("The painted region exceeds 1.1 million cells.")
        pixels = ["FFFFFF"] * (width * height)
        for x, y, color in cells:
            pixels[y * width + x] = color
        return {"width": width, "height": height, "pixels": pixels}

def save_svg(grid, path, title):
    width, height, pixels = grid["width"], grid["height"], grid["pixels"]
    paths = collections.defaultdict(list)
    for y in range(height):
        x = 0
        while x < width:
            color = pixels[y * width + x]
            end = x + 1
            while end < width and pixels[y * width + end] == color:
                end += 1
            paths[color].append(f"M{x} {y}h{end-x}v1h-{end-x}z")
            x = end
    with path.open("w") as handle:
        handle.write(f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{width*4}" height="{height*4}" viewBox="0 0 {width} {height}" shape-rendering="crispEdges">\n')
        handle.write(f"<title>{escape(title)}</title>\n<desc>Exact vector export of {width*height:,} Excel cell fills. Each painted cell and RGB color is preserved. No embedded images.</desc>\n")
        for color, segments in sorted(paths.items()):
            handle.write(f'<path fill="#{color}" d="{"".join(segments)}"/>\n')
        handle.write("</svg>\n")

def save_png(grid, path, scale):
    width, height = grid["width"], grid["height"]
    def chunk(name, data):
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)
    compressor = zlib.compressobj(9)
    data = bytearray()
    for y in range(height):
        row = b"\x00" + b"".join(bytes.fromhex(c) * scale for c in grid["pixels"][y*width:(y+1)*width])
        for _ in range(scale):
            data.extend(compressor.compress(row))
    data.extend(compressor.flush())
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width*scale, height*scale, 8, 2, 0, 0, 0)) + chunk(b"sRGB", b"\x00") + chunk(b"IDAT", data) + chunk(b"IEND", b""))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--svg", type=Path, required=True)
    parser.add_argument("--png", type=Path)
    parser.add_argument("--grid", type=Path)
    parser.add_argument("--scale", type=int, choices=(1, 2, 4), default=4)
    parser.add_argument("--sheet")
    parser.add_argument("--title")
    args = parser.parse_args()
    targets = [p for p in (args.svg, args.png, args.grid) if p]
    if len({p.resolve() for p in targets}) != len(targets):
        parser.error("Output paths must be distinct.")
    for target in targets:
        if target.exists():
            parser.error(f"Output already exists; choose a new name: {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
    grid = read_art(args.workbook, args.sheet)
    save_svg(grid, args.svg, args.title or args.workbook.stem)
    if args.png:
        save_png(grid, args.png, args.scale)
    if args.grid:
        args.grid.write_text(json.dumps(grid, separators=(",", ":")))
    print(f"Exported {grid['width']} × {grid['height']} cells, {len(set(grid['pixels']))} colors.")

if __name__ == "__main__":
    main()
