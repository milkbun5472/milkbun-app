"""Real GLB regression: rounded knit back, slim flanks and unchanged accessories.

Blender -b --python cardigan-back-assets.py -- before.glb after.glb report.json
"""
import json
import itertools
import runpy
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

sys.path.insert(0, str(Path(__file__).parent))
from cloth_asset_helpers import snapshot, image_hashes, assert_preserved, flipped_areas

before, after, destination = sys.argv[sys.argv.index('--') + 1:]
repo = Path(__file__).resolve().parents[2]
catalog = json.loads((repo / 'apps/fairy-garden/doll.json').read_text())


def back_sections(obj):
    tree = BVHTree.FromPolygons(
        [v.co[:] for v in obj.data.shape_keys.key_blocks['Basis'].data],
        [f.vertices[:] for f in obj.data.polygons],
    )
    values = {}
    for z in (.48, .54, .60):
        for x in (0, .05, -.14, .14):
            point, _, _, _ = tree.ray_cast(Vector((x, 1, z)), Vector((0, -1, 0)), 2)
            assert point is not None, ('Missing back surface', x, z)
            values[(x, z)] = point.y
    return values


def endpoint_fold_counts(obj):
    obj.data.calc_loop_triangles()
    triangles = np.array([t.vertices[:] for t in obj.data.loop_triangles])
    basis = np.array([v.co[:] for v in obj.data.shape_keys.key_blocks['Basis'].data])
    p = basis[triangles]
    reference = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    counts = []
    for values in itertools.product((0, 1), repeat=6):
        points = basis.copy()
        for dim, high in zip(catalog['dims'], values):
            delta = np.array([v.co[:] for v in obj.data.shape_keys.key_blocks[dim['key']].data]) - basis
            points += delta * (dim['max' if high else 'min'] - 1)
        p = points[triangles]
        normals = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
        counts.append(np.count_nonzero(np.sum(normals * reference, axis=1) < 0))
    return np.array(counts)


old = snapshot(before)
obj = bpy.data.objects['outfit_cardigan']
old_sections = back_sections(obj)
old_flips = flipped_areas(obj, catalog)
old_counts = endpoint_fold_counts(obj)
new = snapshot(after)
obj = bpy.data.objects['outfit_cardigan']
new_sections = back_sections(obj)
new_flips = flipped_areas(obj, catalog)
new_counts = endpoint_fold_counts(obj)
count, drift = assert_preserved(old, new, {'outfit_cardigan'})
assert image_hashes(before) == image_hashes(after), 'Original atlas bytes changed'
assert set(new['outfit_cardigan']['keys']) == {'Basis', 'height', 'shoulder', 'waist', 'flare', 'build', 'head'}
assert np.max(new_flips - old_flips) < .0001, 'A body endpoint introduced folded triangles'
assert np.all(new_counts <= old_counts), 'A body endpoint added a folded triangle'

# Measure the surface itself, independently of the fitting formula. A flat
# centre panel must not pass simply because the filename/version changed.
for z in (.48, .54, .60):
    assert new_sections[(0, z)] - old_sections[(0, z)] > .025, ('Back still flattened', z)
    assert new_sections[(0, z)] - new_sections[(.05, z)] > .008, ('Back centre still planar', z)
    for x in (-.14, .14):
        assert abs(new_sections[(x, z)] - old_sections[(x, z)]) < .001, ('Slim flank expanded', x, z)
assert obj['sideFitVersion'] == 2

# Front rabbit pouch/decoration and outer side seams keep their coordinates
# in every morph, including duplicate UV-seam vertices after Draco export.
a, b = old['outfit_cardigan'], new['outfit_cardigan']
tree = KDTree(len(b['points']))
for i, point in enumerate(b['points']):
    tree.insert(point, i)
tree.balance()
preserved = 0
for i, point in enumerate(a['points']):
    x, y, z = point
    if not ((y < -.13 and .35 < z < .58) or (abs(x) >= .136 and .42 < z < .64)):
        continue
    near = tree.find_range(point, 1e-5)
    assert near, ('Front accessory or flank moved', i, point)
    assert any(all(np.max(np.abs(np.array(a['keys'][key][i]) - np.array(b['keys'][key][j]))) < 1e-5
                   for key in a['keys']) for _, j, _ in near), ('Protected morph moved', i)
    preserved += 1
assert preserved > 100

# Re-running the authoring pipeline on a v2 mesh cannot thin sleeves or
# change knit normals again.
fit = runpy.run_path(str(repo / 'art/fairy-garden/doll/fit_cloth_sides.py'))['fit_cardigan']
points = {key.name: np.array([v.co[:] for v in key.data]) for key in obj.data.shape_keys.key_blocks}
normals = np.array([n.vector[:] for n in obj.data.corner_normals])
fit(obj)
for key in obj.data.shape_keys.key_blocks:
    np.testing.assert_array_equal(points[key.name], [v.co[:] for v in key.data])
np.testing.assert_array_equal(normals, [n.vector[:] for n in obj.data.corner_normals])

report = {
    'preservedMeshes': count, 'maxDrift': drift, 'sameAtlasBytes': True,
    'protectedVerticesAllMorphs': preserved, 'bodyEndpointCombinations': len(new_flips),
    'maxAdditionalFlippedArea': float(np.max(new_flips - old_flips)), 'idempotent': True,
    'maxEndpointFoldedTrianglesBefore': int(old_counts.max()),
    'maxEndpointFoldedTrianglesAfter': int(new_counts.max()),
    'backSections': [{'x': x, 'z': z, 'before': old_sections[(x, z)], 'after': value}
                     for (x, z), value in new_sections.items()],
}
Path(destination).write_text(json.dumps(report, indent=2))
print(json.dumps(report))
