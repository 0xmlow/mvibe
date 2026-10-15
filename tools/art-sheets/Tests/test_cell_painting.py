import json
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from PIL import Image, ImageDraw
from test_exports import APP, helper, validate_triplet

with tempfile.TemporaryDirectory(prefix="art-sheets-paint-") as temporary:
    root=Path(temporary)
    # A spatial fixture with diagonal architecture, a circular focal point,
    # thin highlights, and a gradient. The test does not sample its expected answer.
    image=Image.new("RGB",(384,240))
    for y in range(240):
        for x in range(384): image.putpixel((x,y),(20+x//5,12+y//8,25+x//4))
    draw=ImageDraw.Draw(image)
    draw.polygon([(0,220),(270,20),(330,35),(80,240)],fill=(204,50,35))
    draw.ellipse((150,40,270,160),fill=(25,120,210));draw.ellipse((180,70,240,130),fill=(5,8,20))
    for x in range(90,180,8): draw.rectangle((x,180,x+3,196),fill=(235,222,180))
    source=root/"reference.png";image.save(source);before=source.read_bytes()
    def convert(*extra):
        result=subprocess.run([str(APP),"--convert",str(source),"--output",str(root),"--detail","384",*extra],capture_output=True,text=True,check=True)
        return Path(result.stdout.strip())
    painted=convert(); art=validate_triplet(painted)
    raw=validate_triplet(convert("--mosaic"))
    assert len(set(art["pixels"]))<=24
    assert sum(a!=b for a,b in zip(art["pixels"],raw["pixels"]))/len(art["pixels"])>.70
    workbook=next(painted.glob("*.xlsx"))
    under=helper.read_art(workbook,"Underpainting");brush=helper.read_art(workbook,"Brushwork")
    assert under["pixels"]!=brush["pixels"] and brush["pixels"]!=art["pixels"]
    with zipfile.ZipFile(workbook) as z:
        ns={"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        book=ET.fromstring(z.read("xl/workbook.xml"))
        assert [s.get("name") for s in book.find("s:sheets",ns)]==["Painting","Underpainting","Brushwork"]
        assert not any("media/" in n for n in z.namelist())
    assert validate_triplet(convert())["pixels"]==art["pixels"],"Painting must be reproducible"
    fine=validate_triplet(convert("--brush","1"))
    broad=validate_triplet(convert("--brush","3"))
    assert sum(a!=b for a,b in zip(fine["pixels"],broad["pixels"]))/len(art["pixels"])>.05
    assert source.read_bytes()==before
    print("PASS: default paints rather than samples; palette limit; three real cell stages; deterministic strokes; brush control changes artwork; exact SVG/PNG agreement; source preserved.")
