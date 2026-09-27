"""Verify dye repair assets preserve unrelated meshes, morphs and source textures."""

import sys, json, numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cloth_asset_helpers import snapshot, image_hashes
from mathutils.kdtree import KDTree

before, after, output = sys.argv[sys.argv.index("--") + 1 :]
import bpy,itertools,runpy
catalog=json.loads((Path(__file__).parents[2]/"apps/fairy-garden/doll.json").read_text())
def flipped_areas(obj):
 obj.data.calc_loop_triangles()
 tri=np.array([t.vertices[:] for t in obj.data.loop_triangles])
 basis=np.array([v.co[:] for v in obj.data.shape_keys.key_blocks['Basis'].data])
 pts=basis[tri];ref=np.cross(pts[:,1]-pts[:,0],pts[:,2]-pts[:,0]);areas=np.linalg.norm(ref,axis=1)
 result=[]
 for values in itertools.product((0,1),repeat=6):
  points=basis.copy()
  for dim,high in zip(catalog['dims'],values):
   delta=np.array([v.co[:] for v in obj.data.shape_keys.key_blocks[dim['key']].data])-basis
   points+=delta*(dim['max' if high else 'min']-1)
  pts=points[tri];norm=np.cross(pts[:,1]-pts[:,0],pts[:,2]-pts[:,0])
  result.append(float(areas[np.sum(norm*ref,axis=1)<0].sum()))
 return np.array(result)
a = snapshot(before)
original_flips = flipped_areas(bpy.data.objects['outfit_ranger_trousers'])
b = snapshot(after)
changed = {"outfit_ranger_trousers"}

drift = 0
count = 0
assert set(a) - changed == set(b) - changed, (set(a) - set(b), set(b) - set(a))
for name in sorted(set(a) - changed):
    for aa, bb in ((a[name], b[name]), (b[name], a[name])):
        assert aa["keys"].keys() == bb["keys"].keys(), name
        tree = KDTree(len(aa["points"]))
        for i, p in enumerate(aa["points"]):
            tree.insert(p, i)
        tree.balance()
        keys = list(aa["keys"])
        ap = np.stack(
            [np.array(aa["points"])] + [np.array(aa["keys"][k]) for k in keys], axis=1
        )
        bp = np.stack(
            [np.array(bb["points"])] + [np.array(bb["keys"][k]) for k in keys], axis=1
        )
        for p, values in zip(bb["points"], bp):
            near = tree.find_range(p, 1e-5)
            assert near, (name, p)
            error = min(np.max(np.abs(ap[i] - values)) for _, i, _ in near)
            assert error < 1e-5, (name, float(error))
            drift = max(drift, float(error))
    count += 1

obj=bpy.data.objects['outfit_ranger_trousers']
assert all(abs(k.value)<1e-8 for k in list(obj.data.shape_keys.key_blocks)[1:])
# Existing source triangles include tiny inverted folds at extreme sliders.
# Cutting must not introduce additional inverted surface area at any endpoint.
new_flips=flipped_areas(obj)
assert np.all(new_flips <= original_flips + 1e-7), (original_flips.tolist(),new_flips.tolist())
endpoints=len(new_flips)
assert min(v.co.z for v in obj.data.vertices) >= .092-1e-4
assert max(v.co.z for v in obj.data.vertices) <= .390+1e-4
assert image_hashes(before)==image_hashes(after)
root=Path(__file__).parents[2]/'art/fairy-garden/doll'
counts={n:len(bpy.data.objects[n].data.vertices) for n in changed}
runpy.run_path(str(root/'clean_ranger_edges.py'))['clean_ranger_edges']()
assert counts=={n:len(bpy.data.objects[n].data.vertices) for n in changed}
assert bpy.data.objects['DollBody']['originalHandVersion']==1
result={'unchangedMeshes':count,'maximumDrift':drift,'unchangedTextures':len(image_hashes(after)),'bodyEndpoints':endpoints,'idempotent':True}
Path(output).write_text(json.dumps(result,indent=2));print(result)
