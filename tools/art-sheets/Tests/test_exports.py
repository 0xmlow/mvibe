"""Integration checks against real exported files, independent of Swift writers."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT/"dist/Art sheets.app/Contents/MacOS/ArtSheets"
HELPER = ROOT/"Tests/export_cell_art.py"
spec = importlib.util.spec_from_file_location("exporter", HELPER)
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)

def svg_grid(path):
    tree = ET.parse(path).getroot()
    assert tree.find("{http://www.w3.org/2000/svg}image") is None
    _, _, w, h = map(int, tree.attrib["viewBox"].split())
    result = [None] * (w*h)
    for shape in tree.findall("{http://www.w3.org/2000/svg}path"):
        data = shape.attrib["d"]
        runs = list(re.finditer(r"M(\d+) (\d+)h(\d+)v1h-(\d+)z",data))
        assert "".join(m[0] for m in runs) == data
        for match in runs:
            x,y,length,back = map(int,match.groups()); assert length == back
            assert x+length <= w and y < h
            for i in range(x,x+length):
                assert result[y*w+i] is None, "Overlapping vectors"
                result[y*w+i] = shape.attrib["fill"][1:]
    assert None not in result, "Unpainted vector cells"
    return {"width":w,"height":h,"pixels":result}

def validate_triplet(folder, expected=None, scale=4):
    xlsx = next(folder.glob("*.xlsx")); svg = next(folder.glob("*.svg")); png = next(folder.glob("*.png"))
    grid = helper.read_art(xlsx)
    assert svg_grid(svg) == grid
    if expected: assert grid == expected
    image = Image.open(png).convert("RGB")
    assert image.size == (grid["width"]*scale,grid["height"]*scale)
    expected_image = Image.new("RGB",(grid["width"],grid["height"]))
    expected_image.putdata([tuple(bytes.fromhex(c)) for c in grid["pixels"]])
    assert image.tobytes() == expected_image.resize(image.size,Image.Resampling.NEAREST).tobytes()
    with zipfile.ZipFile(xlsx) as book:
        assert book.testzip() is None
        assert not any(n.startswith("xl/media/") for n in book.namelist())
        for entry in book.namelist():
            if entry.endswith((".xml",".rels")): ET.fromstring(book.read(entry))
        root = ET.fromstring(book.read("xl/styles.xml"))
        ns={"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        assert int(root.find("s:cellXfs",ns).get("count")) < 65490
        cell_styles = list(root.find("s:cellXfs",ns))
        formats = {n.get("numFmtId"): n.get("formatCode") for n in root.findall("s:numFmts/s:numFmt",ns)}
        for name in book.namelist():
            if name.startswith("xl/worksheets/") and name.endswith(".xml"):
                ws = ET.fromstring(book.read(name))
                for cell in ws.findall("s:sheetData/s:row/s:c",ns):
                    assert cell.find("s:v",ns).text == "0", "Importers must retain every painted cell"
                    assert formats[cell_styles[int(cell.get("s"))].get("numFmtId")] == ";;;", "Compatibility values must stay invisible"
        sheet=ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
        view=sheet.find("s:sheetViews/s:sheetView",ns)
        assert view.get("showGridLines")=="0" and view.get("showRowColHeaders")=="0"
    return grid

def run(*args, success=True):
    options = ["--mosaic"] if "--convert" in args else []
    p = subprocess.run([str(APP),*map(str,args),*options],text=True,capture_output=True)
    assert (p.returncode==0)==success,(p.returncode,p.stderr)
    return [Path(line) for line in p.stdout.splitlines() if line.strip()]

def main():
    with tempfile.TemporaryDirectory(prefix="artsheets-test-") as tmp:
        work=Path(tmp); out=work/"exports"
        grid=json.loads((ROOT/"Tests/painting-grid.json").read_text())
        exact=run("--grid",ROOT/"Tests/painting-grid.json","--output",out,"--title",'Eye & "Flower" <test>')[0]
        validate_triplet(exact,grid)
        first_hash={p.name:hashlib.sha256(p.read_bytes()).digest() for p in exact.iterdir()}
        second=run("--grid",ROOT/"Tests/painting-grid.json","--output",out,"--title",'Eye & "Flower" <test>')[0]
        assert first_hash=={p.name:hashlib.sha256(p.read_bytes()).digest() for p in exact.iterdir()}
        assert second!=exact
        image=Image.new("RGBA",(48,80),(0,0,0,0))
        for y in range(80):
            for x in range(48):
                image.putpixel((x,y),(255,0,0,255) if y<40 and x<24 else (0,255,0,255) if y<40 else (0,0,255,255) if x<24 else (0,0,0,0))
        source=work/"portrait.png"; image.save(source); original=source.read_bytes()
        folder=run("--convert",source,"--output",out,"--detail",256)[0]
        art=validate_triplet(folder)
        assert (art["width"],art["height"])==(48,80), "Small source should not be enlarged"
        assert [art["pixels"][i] for i in [0,47,48*79,48*80-1]]==["FF0000","00FF00","0000FF","000000"], "Orientation or matte mismatch"
        white=run("--convert",source,"--output",out,"--white-matte","--png-scale",2)[0]
        assert validate_triplet(white,scale=2)["pixels"][-1]=="FFFFFF"
        broken=work/"broken.png"; broken.write_text("not an image")
        paths=run("--convert",broken,source,"--output",out,success=False)
        assert len(paths)==1; validate_triplet(paths[0]); assert source.read_bytes()==original
        assert not list(out.glob(".ArtSheets-*")), "Temporary export folders leaked"
        print("PASS: exact grid/XLSX/SVG/PNG equality; orientation; portrait aspect; transparency; collisions; XML escaping; batch recovery; source preservation.")

if __name__=="__main__": main()
