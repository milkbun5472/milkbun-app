"""Cut the hair out of a Hunyuan 'doll wearing hairstyle' model and fit it
# Hat:  FILL_N=24 ANCHOR=head-anchor.json FRINGE_K=.74 python3 fit_hair.py hunyuan-doll-with-hair.glb doll-face.glb hats/hair_x.glb
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
# The source's own eye pits float a little in front of our face: drop anything
# close to the skin inside the two eye ellipses (the lifted fringe clears them).
eye|=(fc[:,1]<-.08)&(((np.abs(fc[:,0])-.075)/.045)**2+((fc[:,2]-.785)/.055)**2<1)&(dist<.02)
# On the face itself keep only what stands clear of our skin (hanging fringe);
# the source's own eye pits and cheeks sit within a few mm of it.
facezone=(fc[:,1]<-.08)&(fc[:,2]<.88)&(np.abs(fc[:,0])<.2)
# Colour only decides on the face and ears; the back of the head is all hair
# (its bright highlights must not punch bald spots).
exposed=(fc[:,1]<.0)|(np.abs(fc[:,0])>.19)
hair=(fc[:,2]>.60)&~(skinlike&exposed)&~eye&~(facezone&(dist<.006))
# Under the jaw the source's own chin and neck are in shadow and read as
# non-skin; drop anything hugging our skin there (front half only; the nape
# hair behind stays).
jaw=(fc[:,2]<.76)&(fc[:,1]<.03)&(dist<.012)
hair&=~jaw
print('jaw scraps removed',int(jaw.sum()))
# Around the ears and jaw, light tan faces are the source's shaded ear and
# cheek skin; real hair there is darker.
tan=(lum>.34)&(fc[:,2]<.86)&(fc[:,1]<.08)&(np.abs(fc[:,0])>.12)
hair&=~tan
print('tan scraps removed',int(tan.sum()))
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
    cen=np.mean([f.calc_center_median()[:] for f in comp],0)
    # Tiny crumbs anywhere, and loose flakes in front of the face.
    if len(comp)<6 or (cen[1]<-.08 and .74<cen[2]<.87 and .03<abs(cen[0])<.15 and len(comp)<int(__import__('os').environ.get('FACE_CRUMB',60))):small+=comp
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
# Lift whole sunken locks: each connected strand is translated outward along
# the skull radius by its deepest penetration + 3 mm, so it keeps its shape.
bm.verts.ensure_lookup_table();seen=set();moved=0
Cz=np.array([0,.0252,.93])
for v0 in bm.verts:
    if v0 in seen:continue
    comp=[v0];stack=[v0];seen.add(v0)
    while stack:
        w=stack.pop()
        for e in w.link_edges:
            u=e.other_vert(w)
            if u not in seen:seen.add(u);comp.append(u);stack.append(u)
    worst=0.
    for w in comp:
        loc,n,idx,d=tree.find_nearest(w.co);sd=(w.co-loc).dot(n)
        worst=min(worst,sd)
    if -float(os.environ.get('LIFT_MAX',.012))<worst<-.001:
        c=np.mean([w.co[:] for w in comp],0);r=c-Cz;r/=np.linalg.norm(r)
        off=Vector((r*(-worst+.003)).tolist())
        for w in comp:w.co+=off
        moved+=1
print('locks lifted',moved)
# Fill the bare back-crown with borrowed locks: copy real rear locks and swing
# them up over the skull (rotation about the skull centre keeps them on it).
from mathutils import Matrix
import random
rnd=random.Random(2)
bm.verts.ensure_lookup_table();comps=[];seen=set()
for v0 in bm.verts:
    if v0 in seen:continue
    comp=[v0];st=[v0];seen.add(v0)
    while st:
        w=st.pop()
        for e in w.link_edges:
            u=e.other_vert(w)
            if u not in seen:seen.add(u);comp.append(u);st.append(u)
    c=np.mean([w.co[:] for w in comp],0)
    if c[1]>.04 and .74<c[2]<1.05 and 60<len(comp)<4000:comps.append(comp)
print('donor locks',len(comps))
Cv=Vector((0,.0252,.93));added=0
for k in range(int(os.environ.get('FILL_N',9))):
    if not comps:break
    donor=rnd.choice(comps)
    faces=list({f for w in donor for f in w.link_faces})
    d=bmesh.ops.duplicate(bm,geom=faces)
    nv=[g for g in d['geom'] if isinstance(g,bmesh.types.BMVert)]
    yaw=(k/(max(1,int(os.environ.get('FILL_N',9))-1))-.5)*1.8+rnd.uniform(-.12,.12)
    pitch=rnd.uniform(.55,1.15)
    R=Matrix.Rotation(yaw,4,'Z')@Matrix.Rotation(pitch,4,'X')@Matrix.Rotation(-yaw*.3,4,'Z')
    bmesh.ops.rotate(bm,verts=nv,cent=Cv,matrix=R)
    # keep it resting on the scalp
    worst=0.
    for w in nv:
        loc,n,idx,dd=tree.find_nearest(w.co);worst=min(worst,(w.co-loc).dot(n))
    if worst<0:
        c=sum((w.co for w in nv),Vector())/len(nv);r=(c-Cv).normalized()
        for w in nv:w.co+=r*(-worst+.006)
    added+=1
print('borrowed locks',added)
# After the fringe lift, clear anything that ended up lying on our eyes.
EZ=float(os.environ.get('EYE_Z',.798));EX=.077
bm.faces.ensure_lookup_table()
kill=[]
for f in bm.faces:
    c=f.calc_center_median()
    if c.y<-.08 and ((abs(c.x)-EX)/.035)**2+((c.z-EZ)/.055)**2<1:
        loc,n,idx,d=tree.find_nearest(c)
        if (c-loc).dot(n)<.02:kill.append(f)
bmesh.ops.delete(bm,geom=kill,context='FACES')
print('cleared over eyes',len(kill))
bm.to_mesh(H.data);bm.free();H.name='hair_m02'
print('islands dropped',len(small))
# Hat mode: write the hair alone, in head-anchor space (origin = skull centre,
# unit = skull radius). The body is never part of this file.
if os.environ.get('ANCHOR'):
    import json
    A=json.load(open(os.environ['ANCHOR']));Cc=np.array(A['center']);Rr=A['radius']
    for v in H.data.vertices:v.co=((np.array(v.co)-Cc)/Rr).tolist()
    H.data.update();H['hairAnchorSpace']='origin=skull centre, unit=skull radius'
    # Hair base: a thin hair-coloured shell hugging the skull (top and back,
    # never the forehead), so gaps between locks never show bald scalp.
    base_col=np.median(hc[hair],0)
    cap=bpy.data.meshes.new('hair_base');vs=[];fs=[];nu,nv=96,48
    for j in range(nv+1):
        th=np.pi*j/nv
        for i in range(nu):
            ph=2*np.pi*i/nu;vs.append((np.sin(th)*np.cos(ph),np.sin(th)*np.sin(ph),np.cos(th)))
    for j in range(nv):
        for i in range(nu):
            a_=j*(nu+0)+i;b_=j*nu+(i+1)%nu;fs.append((a_,b_,b_+nu,a_+nu))
    V=np.array(vs)*float(os.environ.get('BASE_R',1.012))
    keep=[k for k,f in enumerate(fs) if all(
        V[q][2]>-.05 and not (V[q][1]<-.55 and V[q][2]<.42) for q in f)]
    cap.from_pydata(V.tolist(),[],[fs[k] for k in keep]);cap.update()
    import bmesh as _b;bb=_b.new();bb.from_mesh(cap);_b.ops.remove_doubles(bb,verts=bb.verts,dist=1e-6)
    _b.ops.delete(bb,geom=[v for v in bb.verts if not v.link_faces],context='VERTS');bb.to_mesh(cap);bb.free()
    m=bpy.data.materials.new('Hair base');m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*[float(x)**2.2 for x in base_col],1);bs.inputs['Roughness'].default_value=.9
    # Strand grooves radiating from the crown whorl, baked as vertex colour;
    # overall a shade darker so it reads as the under-layer between locks.
    ca=cap.color_attributes.new('Col','FLOAT_COLOR','POINT');bc=np.array([float(x)**2.2 for x in base_col])
    for k,v in enumerate(cap.vertices):
        x,y,z=v.co;ph=np.arctan2(y,x);th=np.arccos(max(-1,min(1,z/np.linalg.norm(v.co[:]))))
        g=.5+.5*np.sin(ph*38+th*6+3*np.sin(ph*7))
        f=.55+.35*g**2
        ca.data[k].color=(*(bc*f),1)
    vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Col'
    m.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
    cap.materials.append(m);capo=bpy.data.objects.new('hair_base',cap);bpy.context.collection.objects.link(capo)
    capo.parent=H
    bpy.ops.object.select_all(action='DESELECT');H.select_set(True);capo.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
    print('hat written');sys.exit(0)
bpy.ops.object.select_all(action='DESELECT')
for o in ((H,) if 'HAIR_ONLY' in __import__('os').environ else (H,D)):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
print('done')
