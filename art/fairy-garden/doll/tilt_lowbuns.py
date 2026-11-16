"""Tilt the original prepared lowbuns shell back and shorten cheek wisps once.
Blender -b --python tilt_lowbuns.py -- prepared.glb output.glb
"""
import bpy, numpy as np, json, hashlib, sys, runpy
from pathlib import Path
src,out=sys.argv[-2:]
assert hashlib.sha256(Path(src).read_bytes()).hexdigest()=='b09867b1b45331872d66d06d9319b7f5d75b7632c29a2e72c7af27ab4e5d1986','Use original prepared shell; do not repeat deformation'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
h=next(o for o in bpy.data.objects if o.type=='MESH');h.data.transform(h.matrix_world);h.matrix_world.identity()
a=np.deg2rad(-8);c,s=np.cos(a),np.sin(a);R=np.array([[1,0,0],[0,c,-s],[0,s,c]])
def deform(p):
    q=p.copy();w=np.clip((.15-p[:,1])/.45,0,1);w=w*w*(3-2*w)
    # Shorten vertically along each flowing strand, retaining its pointed tip.
    q[:,2]+=.32*np.logaddexp(0,(-p[:,2]-.10)*8)/8*w
    return q@R.T
before=np.array([v.co[:] for v in h.data.vertices]);helper=runpy.run_path(str(Path(__file__).with_name('hair_deform.py')))['deform_mesh'];report=helper(h.data,deform);after=np.array([v.co[:] for v in h.data.vertices]);front=before[:,1]<-.3
report.update(tiltDegrees=8,frontMinBefore=float(before[front,2].min()),frontMinAfter=float(after[front,2].min()),bounds=[after.min(0).tolist(),after.max(0).tolist()])
bpy.ops.object.select_all(action='DESELECT');h.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(out).with_suffix('.blend')))
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
Path(out).with_suffix('.json').write_text(json.dumps(report,indent=2));print(report)
