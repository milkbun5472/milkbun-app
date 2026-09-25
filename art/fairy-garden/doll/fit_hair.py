"""Cut the hair out of a Hunyuan 'doll wearing hairstyle' model and fit it
# Usage: FRINGE_K=.74 python3 fit_hair.py hunyuan-doll-with-hair.glb doll-face.glb out.glb
onto our bald doll. Hair = faces whose texels are dark brown, away from the
eyes. Alignment uses the two ears (both dolls share the same bald head)."""
import bpy,sys,bmesh,numpy as np
src,doll,out=sys.argv[-3:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
def load(p,name):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=p)
    o=[x for x in bpy.data.objects if x not in before and x.type=='MESH'][0];o.name=name;return o
H=load(src,'hair_src');D=load(doll,'doll')
def world(o):return np.array([o.matrix_world@v.co for v in o.data.vertices])
def texcol(o):
    me=o.data;mat=me.materials[0]
    img=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for x in n.outputs for l in x.links))
    W,Hh=img.size;t=np.array(img.pixels[:],np.float32).reshape(Hh,W,4)
    uvl=me.uv_layers.active.data;col=np.zeros((len(me.polygons),3))
    for p in me.polygons:
        uv=np.mean([uvl[k].uv[:] for k in p.loop_indices],0)
        col[p.index]=t[min(Hh-1,int(uv[1]*Hh)),min(W-1,int(uv[0]*W)),:3]
    return col
Hp=world(H);Dp=world(D)
hc=texcol(H);lum=hc@[.3,.59,.11]
fc=np.array([Hp[list(p.vertices)].mean(0) for p in H.data.polygons])
dark=lum<.30
eye=(fc[:,1]<-.1)&(np.abs(np.abs(fc[:,0])-.085)<.05)&(np.abs(fc[:,2]-.80)<.07)
hair=dark&~eye&(fc[:,2]>.62)
print('hair faces',hair.sum(),'of',len(fc))
# Fit on the lower head, which the hair leaves bare on both models:
# chin, cheeks and ears (skin-coloured verts between neck and eye level).
skin_v=np.zeros(len(Hp),bool)
for p in H.data.polygons:
    c=hc[p.index]
    if c[0]>.62 and c[0]-c[2]>.12:skin_v[list(p.vertices)]=True
def lower_head(P,mask):
    q=P[mask&(P[:,2]>.64)&(P[:,2]<.80)]
    return q
qh=lower_head(Hp,skin_v);qd=lower_head(Dp,np.ones(len(Dp),bool))
def frame(q):
    return np.array([q[:,0].min(),q[:,0].max(),q[:,1].min(),q[:,2].min()])
fh,fd=frame(qh),frame(qd)
s=float((fd[1]-fd[0])/(fh[1]-fh[0]))
cxh=(fh[0]+fh[1])/2;cxd=(fd[0]+fd[1])/2
t=np.array([cxd-s*cxh,fd[2]-s*fh[2],fd[3]-s*fh[3]])
print('lower head src',fh.round(3),'doll',fd.round(3),'scale',round(s,4),'shift',t.round(4))
# Transform the whole source first, then decide hair by height above OUR
# bald head: anything standing off the scalp is hair (bright highlights too);
# faces lying on the head surface are the source's own skin and are dropped.
H.data.transform(H.matrix_world);H.matrix_world.identity()
for v in H.data.vertices:v.co=(s*np.array(v.co)+t).tolist()
H.data.update()
from mathutils import Vector
from mathutils.bvhtree import BVHTree
bmD=bmesh.new();bmD.from_mesh(D.data);bmD.transform(D.matrix_world);bmD.normal_update();tree=BVHTree.FromBMesh(bmD)
P2=np.array([v.co[:] for v in H.data.vertices])
fc=np.array([P2[list(p.vertices)].mean(0) for p in H.data.polygons])
dist=np.zeros(len(fc))
for i,c in enumerate(fc):
    loc,n,idx,d=tree.find_nearest(Vector(c))
    dist[i]=d*(1 if (Vector(c)-loc).dot(n)>0 else -1)
# Skin is bright peach; hair, highlights included, is grey-brown.
skinlike=(hc[:,0]>.62)&(hc[:,0]-hc[:,2]>.12)
# Source eyes are pits (behind our face); fringe tips hang in front of them.
eye=eye&(dist<.003)
# On the face itself keep only what stands clear of our skin (hanging fringe);
# the source's own eye pits and cheeks sit within a few mm of it.
facezone=(fc[:,1]<-.08)&(fc[:,2]<.88)&(np.abs(fc[:,0])<.2)
# Colour only decides on the face and ears; the back of the head is all hair
# (its bright highlights must not punch bald spots).
exposed=(fc[:,1]<.0)|(np.abs(fc[:,0])>.19)
hair=(fc[:,2]>.60)&~(skinlike&exposed)&~eye&~(facezone&(dist<.006))
print('by colour',hair.sum())
# Remove tiny floating islands left by the cut.
print('hair faces',hair.sum())
bm=bmesh.new();bm.from_mesh(H.data);bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[f for f in bm.faces if not hair[f.index]],context='FACES')
bm.faces.ensure_lookup_table();seen=set();small=[]
for f in bm.faces:
    if f in seen:continue
    comp=[f];stack=[f];seen.add(f)
    while stack:
        g=stack.pop()
        for e in g.edges:
            for h in e.link_faces:
                if h not in seen:seen.add(h);comp.append(h);stack.append(h)
    if len(comp)<6:small+=comp
bmesh.ops.delete(bm,geom=small,context='FACES')
# Our skull is slightly fuller at the back: rear hair that sinks under the
# scalp is lifted just above it (front half untouched, the part stays open).
lifted=0
for v in bm.verts:
    if v.co.y<.0:continue
    loc,n,idx,d=tree.find_nearest(v.co)
    sd=(v.co-loc).dot(n)
    if sd<.003:v.co=loc+n*.003;lifted+=1
print('rear lifted',lifted)
# Shorten the fringe to clear the eyes: compress front hair vertically toward
# the crown (z anchor), weighted by how far forward it sits. Crown, sides and
# back stay put, so the roots still sit on the scalp.
import os
K=float(os.environ.get('FRINGE_K',.72));Z0=1.0
for v in bm.verts:
    y=v.co.y;w=min(1,max(0,(-.02-y)/.13));w=w*w*(3-2*w)
    if v.co.z<Z0:
        v.co.z=Z0-(Z0-v.co.z)*(1-(1-K)*w)
bm.to_mesh(H.data);bm.free();H.name='hair_m02'
print('islands dropped',len(small))
bpy.ops.object.select_all(action='DESELECT')
for o in ((H,) if 'HAIR_ONLY' in __import__('os').environ else (H,D)):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
print('done')
