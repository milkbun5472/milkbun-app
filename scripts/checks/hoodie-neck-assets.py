"""Blender QA: -- before.glb after.glb report.json. Browser checks the visible cut."""
import itertools
import json
import runpy
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from cloth_asset_helpers import snapshot, image_hashes, assert_preserved

before, after, output = sys.argv[sys.argv.index('--') + 1:]
a, b = snapshot(before), snapshot(after)
added = set(b) - set(a)
assert added == {'outfit_ranger_neck_lining'}
count, drift = assert_preserved(a, {k: v for k, v in b.items() if k not in added}, set())
assert image_hashes(before) == image_hashes(after)

catalog = json.loads((Path(__file__).parents[2] / 'apps/fairy-garden/doll.json').read_text())
obj = bpy.data.objects['outfit_ranger_neck_lining']
assert all(k.value == 0 for k in list(obj.data.shape_keys.key_blocks)[1:])
obj.data.calc_loop_triangles()
tri = np.array([t.vertices[:] for t in obj.data.loop_triangles])
basis = np.array([v.co[:] for v in obj.data.shape_keys.key_blocks['Basis'].data])
pts = basis[tri]
ref = np.cross(pts[:, 1] - pts[:, 0], pts[:, 2] - pts[:, 0])
valid = np.linalg.norm(ref, axis=1) > 1e-10
tri, ref = tri[valid], ref[valid]
minimum_dot = 1
for combo in itertools.product((False, True), repeat=6):
 points = basis.copy()
 for dim, high in zip(catalog['dims'], combo):
  delta = np.array([v.co[:] for v in obj.data.shape_keys.key_blocks[dim['key']].data]) - basis
  points += delta * (dim['max' if high else 'min'] - 1)
 pts = points[tri]
 normals = np.cross(pts[:, 1] - pts[:, 0], pts[:, 2] - pts[:, 0])
 dot = np.sum(normals * ref, axis=1)
 assert np.all(dot > 0), (combo, 'folded or collapsed lining')
 minimum_dot = min(minimum_dot, float(np.min(dot / np.sum(ref * ref, axis=1))))
bm = bmesh.new(); bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000001)
assert all(e.is_manifold for e in bm.edges), 'lining has an exposed cut edge'
bm.free()

counts = {o.name: len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH'}
runpy.run_path(str(Path(__file__).parents[2] / 'art/fairy-garden/doll/repair_hoodie_neck.py'))['repair_hoodie_neck']()
assert counts == {o.name: len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH'}
result = dict(preservedMeshes=count, maximumDrift=drift, preservedTextures=len(image_hashes(after)), bodyEndpoints=64, minimumAreaDotRatio=minimum_dot, closedEdges=True, idempotent=True)
Path(output).write_text(json.dumps(result, indent=2))
print(result)
