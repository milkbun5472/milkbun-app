"""Round only the crown of the reviewed tilt-v2 lowbuns shell.
Blender -b --python round_lowbuns.py -- tilted.glb rounded.glb
"""
import bpy, numpy as np, json, hashlib, sys, runpy
from pathlib import Path
src,out=sys.argv[-2:]
assert hashlib.sha256(Path(src).read_bytes()).hexdigest()=='d0f8667c19bd96353af37cd44f0acb8e01bb482efc2dd6f746a90b58c36e34af','Use tilt-v2 authoring shell, not an already rounded result'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
h=next(o for o in bpy.data.objects if o.type=='MESH');h.data.transform(h.matrix_world);h.matrix_world.identity()
def deform(p):
    q=p.copy();w=np.clip((p[:,2]-.35)/.70,0,1);w=w*w*(3-2*w)
    q[:,2]-=.12*w
    q[:,0]*=1+.025*w
    return q
before=np.array([v.co[:] for v in h.data.vertices]);helper=runpy.run_path(str(Path(__file__).with_name('hair_deform.py')))['deform_mesh'];report=helper(h.data,deform);after=np.array([v.co[:] for v in h.data.vertices]);fixed=before[:,2]<=.35
report.update(maxLowering=float((before-after)[:,2].max()),fixedVertices=int(fixed.sum()),fixedMaxDrift=float(np.abs(before[fixed]-after[fixed]).max()),beforeBounds=[before.min(0).tolist(),before.max(0).tolist()],afterBounds=[after.min(0).tolist(),after.max(0).tolist()])
assert report['fixedMaxDrift']==0
bpy.ops.object.select_all(action='DESELECT');h.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(out).with_suffix('.blend')))
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
Path(out).with_suffix('.json').write_text(json.dumps(report,indent=2));print(report)
