"""Trace the nine reference faces into fixed SVG paths. No redesign: the
# Usage: python3 trace.py reference-nine-faces.png faces.json [reference-default-doll.png]
features are colour-segmented from the reference pixels and vectorised."""
import json,sys
import numpy as np
from PIL import Image
import potrace
REF=sys.argv[1];OUT=sys.argv[2]
IDS=['happy','cozy','relax','surprise','amazed','proud','gloomy','sad','irritated']
ZH=['开心','舒畅','轻松','惊喜','惊讶','骄傲','郁闷','难过','烦躁']
im=Image.open(REF).convert('RGB');A=np.array(im).astype(int);bg=A[5,5]
UP=4
NINE_DY=-6   # whole-set vertical offset so the nine share the default face's eye height
def trace(mask):
    bm=potrace.Bitmap(~mask)  # potracer traces False pixels as foreground
    plist=bm.trace(turdsize=160,alphamax=1.0,opticurve=True,opttolerance=0.2)
    d=[]
    for curve in plist:
        s=curve.start_point;d.append(f"M{s.x:.1f} {s.y:.1f}")
        for seg in curve.segments:
            if seg.is_corner:d.append(f"L{seg.c.x:.1f} {seg.c.y:.1f}L{seg.end_point.x:.1f} {seg.end_point.y:.1f}")
            else:d.append(f"C{seg.c1.x:.1f} {seg.c1.y:.1f} {seg.c2.x:.1f} {seg.c2.y:.1f} {seg.end_point.x:.1f} {seg.end_point.y:.1f}")
        d.append("Z")
    return "".join(d)
meta={}
for k,(id_,zh) in enumerate(zip(IDS,ZH)):
    i,j=k%3,k//3
    x0=[150,590,1030][i];y0=[20,345,665][j]
    # Skin pixels only: the label chip of the row above must not count as head.
    blk=A[y0:y0+290,x0:x0+360];sub=(blk[...,0]>200)&(blk[...,1]>160)&(blk[...,0]-blk[...,2]>40)
    ys=np.nonzero(sub.any(1))[0];top=ys.min()+y0
    row=np.nonzero(sub[ys.min()+60])[0];cx=(row.min()+row.max())//2+x0;cy=top+126
    # Register every cell on its blush pair (the one landmark all nine share):
    # blush centres sit at (+-78, +80) from the head centre on the sheet.
    pk=(blk[...,0]>243)&(blk[...,0]-blk[...,1]>48)&(blk[...,1]<215)
    pk[:max(0,top-y0+120)]=False
    py,pxs=np.nonzero(pk)
    if len(pxs)>200:
        mid=(pxs.min()+pxs.max())/2
        cx=int(round(mid))+x0;cy=int(round(py.mean()))+y0-80
    box=(cx-140,cy-40,cx+140,cy+125)   # face band only: excludes ears' edges and label
    crop=im.crop(box).resize(((box[2]-box[0])*UP,(box[3]-box[1])*UP),Image.LANCZOS)
    C=np.array(crop).astype(int);r,g,b=C[...,0],C[...,1],C[...,2]
    lum=.3*r+.59*g+.11*b
    ink=lum<135                                  # dark brown features
    mouth=(r-g>55)&(g<168)&~ink                  # red mouth and tongue
    tongue=mouth&(g>128)                          # lighter inner part
    # Keep only blobs inside the face (drop ear shadows at the crop edges).
    def keep_inner(m):
        m=m.copy();m[:, :UP*28]=False;m[:, -UP*28:]=False;return m
    ink,mouth,tongue=keep_inner(ink),keep_inner(mouth),keep_inner(tongue)
    # Everything below the eye band is the mouth (its dark rim included);
    # the mouth keeps its own red, it is never recoloured as eye ink.
    split=UP*(40+76)                              # 76 px below head centre
    low=np.zeros_like(ink);low[split:,UP*(140-32):UP*(140+32)]=True   # mouth sits within 32 px of centre
    mouth=(mouth|ink)&low;ink=ink&~low;tongue=tongue&low
    # The clay eyes carry a soft specular highlight that falls outside the ink
    # threshold; close it so the traced shape is the painted shape.
    def close(m,n=6):
        from PIL import ImageFilter
        im=Image.fromarray((m*255).astype('uint8'))
        im=im.filter(ImageFilter.MaxFilter(2*n+1)).filter(ImageFilter.MinFilter(2*n+1))
        return np.array(im)>127
    ink=close(ink,18)
    ic=C[ink].mean(0) if ink.any() else [74,49,40];mc=C[mouth&~tongue].mean(0);tc=C[tongue].mean(0) if tongue.any() else mc
    hexc=lambda c:'#%02x%02x%02x'%tuple(int(v) for v in c)
    # Coordinates: reference pixels, origin at head centre.
    # One shared lift for all nine (their eyes sat ~6 px below the default face).
    tf=f'translate({box[0]-cx} {box[1]-cy+NINE_DY}) scale({1/UP})'
    svg=[f'<g transform="{tf}">',f'<path d="{trace(mouth)}" fill="{hexc(mc)}"/>']
    if tongue.sum()>UP*UP*6:svg.append(f'<path d="{trace(tongue)}" fill="{hexc(tc)}"/>')
    svg.append(f'<path d="{trace(ink)}" fill="{hexc(ic)}"/></g>')
    meta[id_]={'label':zh,'svg':''.join(svg)}
json.dump(meta,open(OUT,'w'),ensure_ascii=False)
print('traced',len(meta))

# --- default face: the eyes of Lisa's bald-doll reference (no mouth) --------
# Traced the same way, then scaled so the eye spacing equals the nine-face
# sheet's (106 px) and centred at the sheet's eye height (+36 px).
if len(sys.argv)>3:
    dim=Image.open(sys.argv[3]).convert('RGB')
    box=(360,480,650,610);EC=((405.5+598.5)/2,541.5);k=106/(598.5-405.5)
    crop=dim.crop(box).resize(((box[2]-box[0])*UP,(box[3]-box[1])*UP),Image.LANCZOS)
    C=np.array(crop).astype(int);lum=.3*C[...,0]+.59*C[...,1]+.11*C[...,2]
    ink=(lum<135)&(lum>25)
    ic=C[ink].mean(0)
    tf=f'translate({-EC[0]*k+box[0]*k:.3f} {36-EC[1]*k+box[1]*k:.3f}) scale({k/UP:.5f})'
    meta['default']={'label':'默认','svg':f'<g transform="{tf}"><path d="{trace(ink)}" fill="#%02x%02x%02x"/></g>'%tuple(int(v) for v in ic)}
    json.dump(meta,open(OUT,'w'),ensure_ascii=False)
    print('traced default')
