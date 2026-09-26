"""Affine touch-ups on a fitted hat (anchor space), so strands keep their curvature:
FRONT_K pulls the front half back (y<0: y *= 1-FRONT_K) to seat the fringe on the forehead;
WIDEN scales the whole hat sideways (x *= 1+WIDEN);
FLAT_K flattens the top: above FLAT_Z0, z -> FLAT_Z0+(z-FLAT_Z0)*(1-FLAT_K);
FRINGE_K shortens the fringe: front half (fades in from y=0 to y=-.5) below FRINGE_Z pulled up toward it, z -> FRINGE_Z+(z-FRINGE_Z)*(1-(1-FRINGE_K)*w);
TUCK_K tucks the back ends in: y>0, y *= 1-TUCK_K*w, w 0 at TUCK_Z1 -> 1 at the lowest point.
Usage: FRONT_K=.14 WIDEN=.09 FLAT_K=0 FLAT_Z0=.3 TUCK_K=0 TUCK_Z1=0 FRINGE_K=1 FRINGE_Z=.35 python3 shape_hair.py in.glb out.glb"""
import bpy,sys,os
src,out=sys.argv[-2:]
FK=float(os.environ.get('FRONT_K',0));WX=float(os.environ.get('WIDEN',0))
FL=float(os.environ.get('FLAT_K',0));FZ=float(os.environ.get('FLAT_Z0',.3))
FRK=float(os.environ.get('FRINGE_K',1));FRZ=float(os.environ.get('FRINGE_Z',.35))
TK=float(os.environ.get('TUCK_K',0));TZ=float(os.environ.get('TUCK_Z1',0))
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
H=[o for o in bpy.data.objects if o.type=='MESH'][0];H.data.transform(H.matrix_world);H.matrix_world.identity()
z0=min(v.co.z for v in H.data.vertices)
for v in H.data.vertices:
    if TK and v.co.y>0:
        t=min(max((TZ-v.co.z)/(TZ-z0),0),1);v.co.y*=1-TK*t*t*(3-2*t)
    if FRK!=1 and v.co.y<0 and v.co.z<FRZ:
        t=min(max(-v.co.y/.5,0),1);w=t*t*(3-2*t);v.co.z=FRZ+(v.co.z-FRZ)*(1-(1-FRK)*w)
    if v.co.y<0:v.co.y*=1-FK
    v.co.x*=1+WX
    if FL and v.co.z>FZ:v.co.z=FZ+(v.co.z-FZ)*(1-FL)
bpy.ops.object.select_all(action='DESELECT');H.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
