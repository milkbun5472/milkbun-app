"""Split the supplied cream ties along their texture boundary, preserving the hair surface.
Blender -b --python prepare_lowbuns.py -- fitted.glb prepared.glb
"""
import bpy, sys, numpy as np, json
from pathlib import Path
src, out = sys.argv[-2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
h = next(o for o in bpy.data.objects if o.type == 'MESH')
m = h.data
mat = m.materials[0]
bs = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
im = bs.inputs['Base Color'].links[0].from_node.image
w, t = im.size
px = np.array(im.pixels[:]).reshape(t, w, 4)
uv = m.uv_layers.active
band = mat.copy()
band.name = 'hair_accessory'
band['hairAccessory'] = True

def score(v):
    p, u, n = v
    if p[2] >= -.5 or abs(p[0]) <= .35:
        return -1.
    xy = np.clip(u * [w, t] - .5, [0, 0], [w-1.001, t-1.001])
    x, y = xy.astype(int)
    a, b = xy - [x, y]
    c = ((px[y,x]*(1-a)+px[y,x+1]*a)*(1-b)+(px[y+1,x]*(1-a)+px[y+1,x+1]*a)*b)[:3]
    return min(c.min()-.12, c.min()/max(c.max(),1e-8)-.70)

def mix(a, b, f):
    return tuple(x*(1-f)+y*f for x,y in zip(a,b))

def clip(poly, positive):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        sa,sb=score(a),score(b)
        ia,ib=(sa>=0)==positive,(sb>=0)==positive
        if ia: result.append(a)
        if ia != ib:
            # Locate the actual painted boundary on the original triangle edge.
            lo,hi=0.,1.
            for _ in range(12):
                mid=(lo+hi)/2
                if (score(mix(a,b,mid))>=0)==(sa>=0): lo=mid
                else: hi=mid
            result.append(mix(a,b,(lo+hi)/2))
    return result
verts=[]; faces=[]; uvs=[]; normals=[]; materials=[]; vertex_ids={}
for f in m.polygons:
    poly=[(np.array(m.vertices[m.loops[i].vertex_index].co),np.array(uv.data[i].uv),np.array(m.corner_normals[i].vector)) for i in f.loop_indices]
    signs=[score(v)>=0 for v in poly]
    center=tuple(sum(v[k] for v in poly)/len(poly) for k in range(3))
    pieces=[poly]
    if len(set(signs))==1 and (score(center)>=0)!=signs[0]:
        pieces=[[a,b,center] for a,b in zip(poly,poly[1:]+poly[:1])]
    for piece in pieces:
        signs=[score(v)>=0 for v in piece]
        regions=[(piece,int(signs[0]))] if len(set(signs))==1 else [(clip(piece,False),0),(clip(piece,True),1)]
        for region,slot in regions:
            for k in range(1,len(region)-1):
                tri=[region[0],region[k],region[k+1]]
                indices=[]
                for p,u,n in tri:
                    key=tuple(np.round(p,8))
                    if key not in vertex_ids:
                        vertex_ids[key]=len(verts);verts.append(p.tolist())
                    indices.append(vertex_ids[key]);uvs.append(u.tolist());normals.append((n/max(np.linalg.norm(n),1e-12)).tolist())
                faces.append(tuple(indices))
                materials.append(slot)
new=bpy.data.meshes.new('Lowbuns surface with clean tie borders')
new.from_pydata(verts,[],faces);new.materials.append(mat);new.materials.append(band)
layer=new.uv_layers.new(name='UVMap')
for i,u in enumerate(uvs):layer.data[i].uv=u
for f,slot in zip(new.polygons,materials):f.material_index=slot;f.use_smooth=True
new.normals_split_custom_set(normals)
h.data=new
bpy.ops.object.select_all(action='DESELECT');h.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(out).with_suffix('.blend')))
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
report={'sourceFaces':len(m.polygons),'totalFaces':len(faces),'accessoryFaces':sum(materials),'geometry':'Original surface; new vertices only on triangles at the painted tie boundary'}
Path(out).with_suffix('.json').write_text(json.dumps(report,indent=2))
print(report,flush=True)
