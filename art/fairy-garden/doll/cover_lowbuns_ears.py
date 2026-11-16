"""Wrap the existing temple locks over the upper ears without changing the body.
Blender -b --python cover_lowbuns_ears.py -- rounded.glb covered.glb
"""
import bpy, numpy as np, json, hashlib, sys, runpy
from pathlib import Path
src,out=sys.argv[-2:]
assert hashlib.sha256(Path(src).read_bytes()).hexdigest()=='32d3eb0bff7c4457ee8b3d297df610b8f71f4e702601f523a3fb2af03327026a','Use round-v3 authoring shell'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
h=next(o for o in bpy.data.objects if o.type=='MESH');h.data.transform(h.matrix_world);h.matrix_world.identity()
def smooth(v):
    t=np.clip(v,0,1);return t*t*(3-2*t)
def weight(p):
    x,y,z=p.T
    return smooth((abs(x)-.60)/.40)*smooth((z+.80)/.45)*(1-smooth((z+.05)/.70))*smooth((y+.80)/.45)*(1-smooth((y-.05)/.50))
def deform(p):
    q=p.copy();w=weight(p)
    q[:,0]+=.12*w*np.sign(p[:,0]);q[:,1]-=.14*w;q[:,2]-=.06*w
    return q
before=np.array([v.co[:] for v in h.data.vertices]);helper=runpy.run_path(str(Path(__file__).with_name('hair_deform.py')))['deform_mesh'];report=helper(h.data,deform);after=np.array([v.co[:] for v in h.data.vertices]);fixed=weight(before)==0
report.update(fixedVertices=int(fixed.sum()),fixedMaxDrift=float(np.abs(before[fixed]-after[fixed]).max()),maxMove=float(np.linalg.norm(after-before,axis=1).max()),beforeBounds=[before.min(0).tolist(),before.max(0).tolist()],afterBounds=[after.min(0).tolist(),after.max(0).tolist()])
assert report['fixedMaxDrift']==0
bpy.ops.object.select_all(action='DESELECT');h.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(out).with_suffix('.blend')))
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
Path(out).with_suffix('.json').write_text(json.dumps(report,indent=2));print(report)
