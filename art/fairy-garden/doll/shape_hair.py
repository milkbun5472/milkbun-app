"""Affine touch-ups on a fitted hat (anchor space), so strands keep their curvature:
FRONT_K pulls the front half back (y<0: y *= 1-FRONT_K) to seat the fringe on the forehead;
WIDEN scales the whole hat sideways (x *= 1+WIDEN).
Usage: FRONT_K=.14 WIDEN=.09 python3 shape_hair.py in.glb out.glb"""
import bpy,sys,os
src,out=sys.argv[-2:]
FK=float(os.environ.get('FRONT_K',0));WX=float(os.environ.get('WIDEN',0))
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
H=[o for o in bpy.data.objects if o.type=='MESH'][0];H.data.transform(H.matrix_world);H.matrix_world.identity()
for v in H.data.vertices:
    if v.co.y<0:v.co.y*=1-FK
    v.co.x*=1+WX
bpy.ops.object.select_all(action='DESELECT');H.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
