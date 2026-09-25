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
H.data.update();H.name='hair'
bpy.ops.object.select_all(action='DESELECT');H.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
print('written',out)
