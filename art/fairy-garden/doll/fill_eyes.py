"""Fill the carved eye pits: smooth the geometry back to the round face and
# Usage: python3 fill_eyes.py source-50k.glb doll-blank-face.glb  (bpy 5.x)
paint the eye pixels in the base-colour texture back to the local skin tone."""
import bpy,sys,bmesh,numpy as np
from PIL import Image,ImageFilter
src,out=sys.argv[-2],sys.argv[-1]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
obj=next(o for o in bpy.data.objects if o.type=='MESH');me=obj.data
mat=me.materials[0]
img=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for out_ in n.outputs for l in out_.links))
W,H=img.size;tex=np.array(img.pixels[:],np.float32).reshape(H,W,4)
# Per-vertex UV and colour
uv=np.zeros((len(me.vertices),2));cnt=np.zeros(len(me.vertices))
for l,u in zip(me.loops,me.uv_layers.active.data):uv[l.vertex_index]+=u.uv[:];cnt[l.vertex_index]+=1
uv/=np.maximum(cnt,1)[:,None]
px=np.clip((uv*[W,H]).astype(int),0,[W-1,H-1]);col=tex[px[:,1],px[:,0],:3]
co=np.array([obj.matrix_world@v.co for v in me.vertices])
lum=col@[.3,.59,.11]
face=(co[:,2]>.75)&(co[:,1]<-.05)
dark=face&(lum<.25)
print('dark verts',dark.sum(),'x',co[dark,0].min().round(3),co[dark,0].max().round(3),'z',co[dark,2].min().round(3),co[dark,2].max().round(3))
# The eyes are open holes into the hollow head. Close each hole with new
# faces, subdivide them so they can bend, then relax the patch into the round
# face with the untouched surface held fixed.
bm=bmesh.new();bm.from_mesh(me);bm.transform(obj.matrix_world)
# glTF splits vertices along UV seams; weld them so only real holes remain open.
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
bm.verts.ensure_lookup_table();bm.edges.ensure_lookup_table()
def front(v):return v.co.z>.72 and v.co.y<-.05 and abs(v.co.x)<.2
bnd=[e for e in bm.edges if e.is_boundary and front(e.verts[0]) and front(e.verts[1])]
print('boundary edges near eyes',len(bnd))
uvlay=bm.loops.layers.uv.active
before=set(bm.faces)
bmesh.ops.holes_fill(bm,edges=bnd,sides=0)
new=[f for f in bm.faces if f not in before]
print('filled faces',len(new),[len(f.verts) for f in new])
res=bmesh.ops.triangulate(bm,faces=new);new=res['faces']
edges=list({e for f in new for e in f.edges if all(ff in new for ff in e.link_faces) or e.is_boundary})
inner=[e for e in {e for f in new for e in f.edges}]
bmesh.ops.subdivide_edges(bm,edges=inner,cuts=3,use_grid_fill=True)
bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
# Patch = new region (anything inside the old holes) + 3 rings of original skin.
newv={v for f in bm.faces if f not in before for v in f.verts}
reg=set(newv)
for _ in range(3):reg|={e.other_vert(v) for v in list(reg) for e in v.link_edges}
reg={v for v in reg if front(v)}
# The eye pits themselves (no hole once seams are welded): take every vertex
# inside a generous ellipse around each eye.
for v in bm.verts:
    if front(v) and ((abs(v.co.x)-.085)/.045)**2+((v.co.z-.801)/.062)**2<1:reg.add(v)
fixed={v for v in reg if any(e.other_vert(v) not in reg for e in v.link_edges)}
move=[v for v in reg if v not in fixed]
for _ in range(600):
    P={v:sum((e.other_vert(v).co for e in v.link_edges),v.co*0)/len(v.link_edges) for v in move}
    for v,p in P.items():v.co=p
# New faces get the UV of their nearest original skin face (plain skin tone).
skinuv=None
for f in bm.faces:
    if f in before and all(v in fixed or v not in reg for v in f.verts) and any(v in fixed for v in f.verts):
        skinuv=f.loops[0][uvlay].uv.copy();break
for f in bm.faces:
    if f not in before:
        for l in f.loops:l[uvlay].uv=skinuv
bm.transform(obj.matrix_world.inverted())
reg=np.zeros(len(bm.verts),bool)
for v in move:reg[v.index]=True
idx=np.nonzero(reg)[0]
nb=None
bm.to_mesh(me);bm.free();me.update()
# Texture: every eye-dark texel on the front-of-face islands becomes skin.
from PIL import ImageDraw
T=(tex[...,:3]*255).clip(0,255).astype(np.uint8)
co=np.array([obj.matrix_world@v.co for v in me.vertices])
face=(co[:,2]>.72)&(co[:,1]<-.05)&(np.abs(co[:,0])<.2)
uvl=me.uv_layers.active.data
fimg=Image.new('L',(W,H),0);df=ImageDraw.Draw(fimg)
for p in me.polygons:
    if all(face[v] for v in p.vertices):
        df.polygon([(uvl[k].uv[0]*W,uvl[k].uv[1]*H) for k in p.loop_indices],fill=255)
F=np.array(fimg)>0
Lm=T.astype(float)@[.3,.59,.11]
Tr,Tg=T[...,0].astype(int),T[...,1].astype(int)
pink=(Tr-Tg>38)&(Tr>200)                      # blush stays untouched
darkpx=F&(Lm<150)
# Include island padding: seams sample texels just outside the island.
Fpad=np.array(Image.fromarray((F*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)))>0
mask=(np.array(Image.fromarray((darkpx*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13)))>0)&Fpad&~pink
mask|=Fpad&(Lm<200)&~pink&(np.array(Image.fromarray((darkpx*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(31)))>0)
skin=np.median(T[F&(Lm>185)],0)
print('eye px',mask.sum(),'skin',skin)
soft=np.array(Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)))/255.
soft=np.maximum(soft,mask)*~pink
T2=(T*(1-soft[...,None])+skin*soft[...,None]).astype(np.uint8)
# The dark shards were shading, not colour: the source carries custom
# normals and a normal map that still point into the old pits. Flatten both
# over the eye region.
nimg=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_node.type=='NORMAL_MAP' for o_ in n.outputs for l in o_.links))
NW,NH=nimg.size;N=np.array(nimg.pixels[:],np.float32).reshape(NH,NW,4)
near=F&(np.array(Image.fromarray((darkpx*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(41)))>0)
nmask=np.array(Image.fromarray((near*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)).resize((NW,NH)))/255.
N[...,:3]=N[...,:3]*(1-nmask[...,None])+np.array([.5,.5,1.])*nmask[...,None]
nimg.pixels.foreach_set(N.ravel());nimg.update()
nimg.filepath_raw=out+'.normal.png';nimg.file_format='PNG';nimg.save();nimg.pack()
# Recompute vertex normals from the smoothed surface (drop the stale custom ones).
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.mesh.customdata_custom_splitnormals_clear()
for p in me.polygons:p.use_smooth=True
out_px=np.concatenate([T2/255.,tex[...,3:]],2).astype(np.float32)
img.pixels.foreach_set(out_px.ravel());img.update()
img.filepath_raw=out+'.basecolor.png';img.file_format='PNG';img.save();img.pack()  # export reads the packed bytes
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB')
print('done')
