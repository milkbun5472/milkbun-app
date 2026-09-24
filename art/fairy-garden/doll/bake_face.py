"""Bake a face decal into the doll's own base-colour texture.
# Usage: python3 bake_face.py doll-blank-face.glb decal.png out.glb  (decal from decal.html)
Front orthographic projection: decal pixel = f(world x, z). Only texels on
front-facing face islands are touched. The model's blush is first painted
back to skin; the decal carries a clean elliptical blush."""
import bpy,sys,json,numpy as np
from PIL import Image,ImageFilter,ImageDraw
src,decal,out=sys.argv[-3:]
S=.00145;CX,CZ=0.0,.870          # metres per reference px; head centre (x,z) — one transform for all faces
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
obj=next(o for o in bpy.data.objects if o.type=='MESH');me=obj.data;mat=me.materials[0]
img=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for o_ in n.outputs for l in o_.links))
W,H=img.size;tex=np.array(img.pixels[:],np.float32).reshape(H,W,4)
co=np.array([obj.matrix_world@v.co for v in me.vertices])
me.calc_loop_triangles()
uvl=me.uv_layers.active.data
# Texel -> world position for front-of-head triangles (barycentric raster).
Xw=np.full((H,W),np.nan);Zw=np.full((H,W),np.nan)
for t in me.loop_triangles:
    vs=[me.loops[k].vertex_index for k in t.loops];P=co[vs]
    if P[:,1].mean()>-.02 or P[:,2].mean()<.62:continue
    uv=np.array([uvl[k].uv[:] for k in t.loops])*[W,H]
    x0,y0=np.floor(uv.min(0)).astype(int)-1;x1,y1=np.ceil(uv.max(0)).astype(int)+1
    xs,ys=np.meshgrid(np.arange(max(0,x0),min(W,x1)),np.arange(max(0,y0),min(H,y1)))
    px=np.stack([xs+.5,ys+.5],-1).reshape(-1,2)
    a,b,c=uv;m=np.array([b-a,c-a]).T
    if abs(np.linalg.det(m))<1e-9:continue
    l=np.linalg.solve(m,(px-a).T).T;w0=1-l[:,0]-l[:,1]
    inside=(l[:,0]>=-.02)&(l[:,1]>=-.02)&(w0>=-.02)
    if not inside.any():continue
    pos=w0[inside,None]*P[0]+l[inside,0,None]*P[1]+l[inside,1,None]*P[2]
    yy=ys.reshape(-1)[inside];xx=xs.reshape(-1)[inside]
    Xw[yy,xx]=pos[:,0];Zw[yy,xx]=pos[:,2]
cover0=~np.isnan(Xw)
# Extend positions into the atlas padding so seams sample decal texels too.
for _ in range(10):
    miss=np.isnan(Xw)
    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
        sx=np.roll(np.roll(Xw,dy,0),dx,1);sz=np.roll(np.roll(Zw,dy,0),dx,1)
        take=miss&~np.isnan(sx);Xw[take]=sx[take];Zw[take]=sz[take];miss=np.isnan(Xw)
cover=~np.isnan(Xw)
print('front texels',cover.sum())
T=tex[...,:3]
# 1. Paint the old blush back to skin (pink texels on the front islands).
T8=(T*255)
pink=cover&(T8[...,0]-T8[...,1]>34)&(T8[...,0]>200)
pinkd=np.array(Image.fromarray((pink*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)))>0
pinkd&=np.array(Image.fromarray((cover*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)))>0
for sgn in (-1,1):
    sel=pinkd&(np.sign(np.nan_to_num(Xw))==sgn)
    print('blush',sgn,'x',np.nanmean(Xw[sel]).round(4),'z',np.nanmean(Zw[sel]).round(4),'w',(np.nanmax(Xw[sel])-np.nanmin(Xw[sel])).round(3),'h',(np.nanmax(Zw[sel])-np.nanmin(Zw[sel])).round(3),'px x',((np.nanmean(Xw[sel])-CX)/S).round(1),'y',((CZ-np.nanmean(Zw[sel]))/S).round(1))
skin=np.array([232,200,172])/255.
T[pinkd]=skin
# Old eye sites: flat skin (their faint seam lines would show between features).
for sx_ in (-.085,.085):
    near=cover&(((Xw-sx_)/.05)**2+((Zw-.80)/.07)**2<1)
    T[near]=skin
# 2. Composite the decal (RGBA, 1024 px over reference units -160..160).
D=np.array(Image.open(decal).convert('RGBA')).astype(np.float32)/255.
dn=D.shape[0]
u=((Xw-CX)/S+160)/320*dn;v=((CZ-Zw)/S+160)/320*dn     # image row grows downward
ok=cover&(u>=0)&(u<dn-1)&(v>=0)&(v<dn-1)
ui=u[ok].astype(int);vi=v[ok].astype(int)
rgba=D[vi,ui]
T[ok]=T[ok]*(1-rgba[:,3:])+rgba[:,:3]*rgba[:,3:]
tex[...,:3]=T
# Flatten the normal map where the old eyes and blush left relief.
nimg=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_node.type=='NORMAL_MAP' for o_ in n.outputs for l in o_.links))
NW,NH=nimg.size;N=np.array(nimg.pixels[:],np.float32).reshape(NH,NW,4)
flat=cover&((((np.abs(Xw)-.085)/.07)**2+((Zw-.80)/.09)**2<1)|(((np.abs(Xw)-.11)/.07)**2+((Zw-.745)/.06)**2<1))
f=np.array(Image.fromarray((flat*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)).resize((NW,NH)))/255.
N[...,:3]=N[...,:3]*(1-f[...,None])+np.array([.5,.5,1.])*f[...,None]
nimg.pixels.foreach_set(N.ravel());nimg.update()
nimg.filepath_raw=out+'.normal.png';nimg.file_format='PNG';nimg.save();nimg.pack()
img.pixels.foreach_set(tex.ravel());img.update()
img.filepath_raw=out+'.basecolor.png';img.file_format='PNG';img.save();img.pack()
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB')
print('baked',ok.sum())
