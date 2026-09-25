"""Fit a hollow hair-shell GLB onto the doll's HeadAnchor.
Cast rays from inside the cavity to find its inner surface, fit a sphere to
it, and map that sphere onto the skull (radius * INNER). Output in anchor space.
Usage: [INNER=1.02 DZ=0 DY=0] python3 fit_shell.py shell.glb head-anchor.json out.glb"""
import bpy,sys,json,os,bmesh,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
src,anc,out=sys.argv[-3:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
H=next(o for o in bpy.data.objects if o.type=='MESH')
H.data.transform(H.matrix_world);H.matrix_world.identity()
bm=bmesh.new();bm.from_mesh(H.data);tree=BVHTree.FromBMesh(bm)
RZ=float(os.environ.get('ROTZ',0))
if RZ:
    from mathutils import Matrix
    H.data.transform(Matrix.Rotation(np.radians(RZ),4,'Z'));H.data.update()
    bm=bmesh.new();bm.from_mesh(H.data);tree=BVHTree.FromBMesh(bm)
P=np.array([v.co[:] for v in H.data.vertices]);lo,hi=P.min(0),P.max(0)
c0=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]+(hi[2]-lo[2])*.45))
hits=[]
for i in range(600):
    z=1-(i+.5)/600*1.3            # upper directions mostly (cap opens downward/front)
    if z<-.2:break
    r=np.sqrt(max(0,1-z*z));t=i*2.39996
    d=Vector((r*np.cos(t),r*np.sin(t),z))
    if d.y<-.3 and z<.35:continue   # skip the face opening
    h=tree.ray_cast(c0,d,5)
    if h[0] is not None:hits.append(h[0][:])
Q=np.array(hits);A=np.c_[2*Q,np.ones(len(Q))];b=(Q**2).sum(1)
s_=np.linalg.lstsq(A,b,rcond=None)[0];C=s_[:3];R=float(np.sqrt(s_[3]+C@C))
print('cavity centre',C.round(3),'radius',round(R,3),'hits',len(Q))
AJ=json.load(open(anc));inner=float(os.environ.get('INNER',1.02))
k=inner/R            # anchor units: skull radius = 1
off=np.array([0,float(os.environ.get('DY',0)),float(os.environ.get('DZ',0))])
for v in H.data.vertices:v.co=((np.array(v.co)-C)*k+off).tolist()
XY=float(os.environ.get('XY_S',1))
if XY!=1:
    for v in H.data.vertices:v.co.x*=XY;v.co.y*=XY     # about the head centre; Z untouched
# Back-only depth compression (anchor units, +y = back). Starts at Y0 just
# behind the ears and grows toward the back; front, top and sides untouched.
BK=float(os.environ.get('BACK_K',0))
if BK:
    Y0=float(os.environ.get('BACK_Y0',.10))
    ys=np.array([v.co.y for v in H.data.vertices]);ym=ys.max()
    for v in H.data.vertices:
        if v.co.y>Y0:
            t_=(v.co.y-Y0)/(ym-Y0)
            v.co.y=v.co.y-BK*(v.co.y-Y0)*t_      # quadratic: 0 slope at Y0, full K at the very back
    print('back compressed',BK)
H.data.update();H.name='hair'
bpy.ops.object.select_all(action='DESELECT');H.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
print('written',out)

# ---- CONFORM: wrap the shell's inner surface onto the real head -------------
# For each vertex, along its direction from the skull centre: inner radius of
# the shell ri, head surface rh; new radius = rh + GAP + (r - ri)*THICK.
if os.environ.get('CONFORM_DOLL'):
    import importlib
    for o in [o for o in bpy.data.objects if o is not H]:bpy.data.objects.remove(o)
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=os.environ['CONFORM_DOLL'])
    D=[o for o in bpy.data.objects if o not in before and o.type=='MESH'][0]
    Cc=np.array(AJ['center']);Rr=AJ['radius']
    bmD=bmesh.new();bmD.from_mesh(D.data);bmD.transform(D.matrix_world);tD=BVHTree.FromBMesh(bmD)
    # shell currently in anchor units -> metres
    V=np.array([v.co[:] for v in H.data.vertices])*Rr+Cc
    bmS=bmesh.new();bmS.from_mesh(H.data);bmS.transform(__import__('mathutils').Matrix.Diagonal((Rr,Rr,Rr,1)));bmS.transform(__import__('mathutils').Matrix.Translation(Vector(Cc)));tS=BVHTree.FromBMesh(bmS)
    TH=float(os.environ.get('THICK',.7));GAP=float(os.environ.get('GAP',.004))
    cv=Vector(Cc);out_=[]
    for p in V:
        d=Vector(p)-cv;r=d.length
        if r<1e-6:out_.append(p);continue
        d.normalize()
        hs=tS.ray_cast(cv,d,5);hd=tD.ray_cast(cv,d,5)
        if hs[0] is None or hd[0] is None:out_.append(p);continue
        ri=(hs[0]-cv).length;rh=(hd[0]-cv).length
        depth=max(0,r-ri);gap_=ri-(rh+GAP)
        if os.environ.get('COMPRESS'):
            K=float(os.environ['COMPRESS']);nr=rh+GAP+max(0,r-rh)*K if r>rh else r
        elif os.environ.get('LAYER'):
            f=max(0,1-depth/float(os.environ['LAYER']))**1.5
            nr=r-gap_*f
        else:nr=rh+GAP+depth*TH
        out_.append(np.array(cv+d*nr))
    NEW=np.array(out_);disp=NEW-V
    # Fade out near the face opening / hanging tips, then smooth the field.
    rel=(V-Cc)/Rr;w=np.clip((rel[:,2]+.35)/.5,0,1)
    w*=np.where(rel[:,1]<-.35,np.clip((rel[:,2]-.05)/.4,0,1),1)
    disp*=w[:,None]
    # Weld coincident vertices (UV seams) so both sides move together.
    key=np.round(V/1e-5).astype(np.int64);_,wid=np.unique(key,axis=0,return_inverse=True);wid=wid.ravel()
    nw=wid.max()+1;cnt=np.bincount(wid,minlength=nw)
    D=np.stack([np.bincount(wid,disp[:,k],nw) for k in range(3)],1)/cnt[:,None]
    nbs=[set() for _ in range(nw)]
    for e in H.data.edges:a_,b_=wid[e.vertices[0]],wid[e.vertices[1]];nbs[a_].add(b_);nbs[b_].add(a_)
    nbs=[list(s) for s in nbs]
    for _ in range(int(os.environ.get('SMOOTH',40))):
        D=np.array([D[n].mean(0)*.7+D[i]*.3 if n else D[i] for i,n in enumerate(nbs)])
    disp=D[wid]
    V=(V+disp-Cc)/Rr
    for v,q in zip(H.data.vertices,V):v.co=q.tolist()
    H.data.update()
    bpy.ops.object.select_all(action='DESELECT');H.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
    print('conformed',out)
