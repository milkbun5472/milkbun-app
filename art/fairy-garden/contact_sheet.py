"""Typeset actual Blender renders, without repainting their model pixels.
python3 art/fairy-garden/contact_sheet.py /tmp/fairy-doll-trends
Requires Pillow. PNG/.blend assets remain outside the repository.
"""
from pathlib import Path
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
OUT=Path(sys.argv[1] if len(sys.argv)>1 else os.environ.get('DOLL_OUT','/tmp/fairy-doll-trends'))
FONT=os.environ.get('DOLL_FONT','/System/Library/Fonts/Supplemental/Songti.ttc')
labels=list(json.loads((Path(__file__).parent/'hairstyles.json').read_text()).values())

def assemble(name,title,rows):
    width=1800; header=128; caption=90
    images=[Image.open(OUT/file).convert('RGB') for file,_ in rows]
    assert all(im.width==width for im in images)
    page=Image.new('RGB',(width,header+sum(im.height+caption for im in images)), '#f3eee7')
    draw=ImageDraw.Draw(page); big=ImageFont.truetype(FONT,48); small=ImageFont.truetype(FONT,32)
    draw.text((60,35),title,font=big,fill='#302c29')
    y=header
    for im,(_,names) in zip(images,rows):
        page.paste(im,(0,y)); y+=im.height
        for i,label in enumerate(names):
            draw.text((width*(i+.5)/3,y+22),label,font=small,fill='#302c29',anchor='mt')
        y+=caption
    page.save(OUT/name)

assemble('hair-focus.png','发型重做 · 正面 / 侧面',[
    ('focus-front.png',labels[:3]),('focus-profile.png',labels[:3])])
if all((OUT/f'catalog-{i}.png').exists() for i in range(1,5)):
    assemble('hair-catalog.png','十二种发型 · 同一底模 / 同一发色',[
        (f'catalog-{i+1}.png',labels[i*3:i*3+3]) for i in range(4)])
