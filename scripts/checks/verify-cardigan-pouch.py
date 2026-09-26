"""Compare cream pouch side texels/positions with the original unsliced garment.
Blender --background --python this.py -- original.glb repaired.glb report.json
"""
import bpy,json,sys,numpy as np
from pathlib import Path
from mathutils.kdtree import KDTree

def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    return bpy.data.objects['outfit_cardigan']

original,repaired,report=sys.argv[sys.argv.index('--')+1:]
o=load(original);uv=o.data.uv_layers.active.data
im=next(n.image for n in o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
w,h=im.size;pixels=np.array(im.pixels[:]).reshape(h,w,4)[:,:,:3]**(1/2.2)
samples=[]
for loop in o.data.loops:
    p=o.data.vertices[loop.vertex_index].co;t=uv[loop.index].uv
    # The exposed side wall, beyond the old front-only protection box.
    if .10<p.x<.21 and -.105<p.y<-.045 and .435<p.z<.55:
        r,g,b=pixels[min(h-1,max(0,int(t.y*h))),min(w-1,max(0,int(t.x*w)))]
        if g-b>max(r-g,.005)*.5:
            samples.append((p.copy(),t.copy()))
assert len(samples)>20, 'The reference must exercise the cream side wall'
o=load(repaired);uv=o.data.uv_layers.active.data;color=o.data.color_attributes['Color'].data
points={};tree=KDTree(len(o.data.vertices))
for v in o.data.vertices:tree.insert(v.co,v.index)
tree.balance()
for loop in o.data.loops:points.setdefault(loop.vertex_index,[]).append(loop.index)
missing=0;maxBlend=0
for p,t in samples:
    matches=[li for _,vi,_ in tree.find_range(p,.00015) for li in points.get(vi,[]) if (uv[li].uv-t).length<.001]
    if not matches:missing+=1;continue
    maxBlend=max(maxBlend,min(color[li].color[1] for li in matches))
result={'sideTexelSamples':len(samples),'missingOriginalSamples':missing,'maxKnitBlend':maxBlend}
Path(report).write_text(json.dumps(result,indent=2));print(result)
assert missing==0, 'Original cream pouch geometry/UVs must survive the sleeve cut'
assert maxBlend<.001, 'Knit colour must not overwrite the cream pouch side'
print('PASS original pouch side geometry, UVs and cream colour protection')
