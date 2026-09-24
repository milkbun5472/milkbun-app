"""Add six non-destructive shape keys to the preserved original traveler."""
import array
import hashlib
import itertools
import json
import os
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from body_shapes import displacement
from refine_body import refine_body
from stabilize_fields import stabilize

OUT = Path(os.environ.get('SOURCE_SLIDERS_OUT', '/tmp/garden-source-sliders'))
OUT.mkdir(parents=True, exist_ok=True)
DIMS = json.loads((HERE.parents[2] / 'apps/fairy-garden/doll.json').read_text())['dims']
KEYS = [d['key'] for d in DIMS]
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'source-traveler.blend'))
scene = bpy.context.scene
obj, = [o for o in scene.objects if o.type == 'MESH']
matrix = obj.matrix_world.copy()
inverse = matrix.inverted()


def digest(items, field, size, kind='f'):
    values = array.array(kind, [0]) * (len(items) * size)
    items.foreach_get(field, values)
    return hashlib.sha256(values.tobytes()).hexdigest()


def preserved():
    mesh = obj.data
    return {
        'positions': digest(mesh.vertices, 'co', 3),
        'indices': digest(mesh.loops, 'vertex_index', 1, 'i'),
        'normals': digest(mesh.corner_normals, 'vector', 3),
        'uv': {uv.name: digest(uv.uv, 'vector', 2) for uv in mesh.uv_layers},
        'images': {i.name: hashlib.sha256(i.packed_file.data).hexdigest()
                   for i in bpy.data.images if i.packed_file},
    }


original_source = preserved()
refinement = refine_body(obj)
basis = [v.co.copy() for v in obj.data.vertices]
world = [matrix @ p for p in basis]
original = preserved()
assert original['images'] == original_source['images']
obj.shape_key_add(name='Basis')
fields = {key: [displacement(p, key) for p in world] for key in KEYS}
fields, stabilization = stabilize(world, [tuple(p.vertices) for p in obj.data.polygons], fields)
for dim in DIMS:
    key = obj.shape_key_add(name=dim['key'])
    key.slider_min = dim['min'] - 1
    key.slider_max = dim['max'] - 1
    key.value = 0
    for index, (point, delta) in enumerate(zip(world, fields[dim['key']])):
        key.data[index].co = inverse @ (point + Vector(delta))
obj['sourceBodySliders'] = True
obj['bodySliderConvention'] = 'morph weight = value - 1; 1 is the intact original'
obj['bodySliderDimensions'] = DIMS

# Offline geometric checks over every combined endpoint, not just isolated keys.
world_array = np.array(world, dtype=np.float64)
field_array = np.array([fields[k] for k in KEYS], dtype=np.float64)
base_floor = float(world_array[:, 2].min())
head = world_array[:, 2] >= .98
shoes = world_array[:, 2] <= .145
max_floor_error = 0.0
max_head_error = 0.0
max_shoe_error = 0.0
minimum_area_ratio = 1.0
minimum_resolved_area_ratio = 1.0
minimum_normal_dot = 1.0
worst_normal = None
worst_triangle = None
triangles = [tuple(poly.vertices) for poly in obj.data.polygons]
assert all(len(t) == 3 for t in triangles)
triangles = np.array(triangles)
def crosses(points):
    tri = points[triangles]
    return np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
base_normals = crosses(world_array)
base_area = np.linalg.norm(base_normals, axis=1)
valid = base_area > 1e-10
tri_points = world_array[triangles]
longest_squared = np.maximum.reduce([
    np.sum((tri_points[:, i] - tri_points[:, (i + 1) % 3]) ** 2, axis=1)
    for i in range(3)])
# Near-collinear source triangles can change area substantially while remaining
# subpixel slivers. Report them separately; check orientation on every valid face.
resolved = valid & (base_area > .02 * longest_squared)
for values in itertools.product(*[(d['min'], d['max']) for d in DIMS]):
    weights = {k: v - 1 for k, v in zip(KEYS, values)}
    points = world_array + np.einsum('k,kij->ij', list(weights.values()), field_array)
    max_floor_error = max(max_floor_error, float(abs(points[:, 2].min() - base_floor)))
    pivot = np.array([0, .018, .962])
    expected = pivot + (world_array[head] - pivot) * (1 + weights['head'])
    expected[:, 2] += .36 * weights['height']
    max_head_error = max(max_head_error, float(np.linalg.norm(points[head] - expected, axis=1).max()))
    max_shoe_error = max(max_shoe_error, float(np.linalg.norm(points[shoes] - world_array[shoes], axis=1).max()))
    after_normals = crosses(points)
    after = np.linalg.norm(after_normals, axis=1)
    cosines = np.sum(base_normals[valid] * after_normals[valid], axis=1) / (base_area[valid] * after[valid])
    if cosines.min() < minimum_normal_dot:
        minimum_normal_dot = float(cosines.min())
        nindex = np.flatnonzero(valid)[int(cosines.argmin())]
        worst_normal = {'points': world_array[triangles[nindex]].tolist(), 'values': values,
                        'area': float(base_area[nindex]), 'quality': float(base_area[nindex] / longest_squared[nindex])}
    ratios = np.ones(len(triangles))
    ratios[valid] = after[valid] / base_area[valid]
    minimum_resolved_area_ratio = min(minimum_resolved_area_ratio, float(ratios[resolved].min()))
    index = int(ratios.argmin())
    if ratios[index] < minimum_area_ratio:
        minimum_area_ratio = float(ratios[index])
        worst_triangle = {'indices': triangles[index].tolist(), 'before': float(base_area[index]),
                          'points': world_array[triangles[index]].tolist(), 'values': values}
assert max_floor_error < 1e-7
assert max_head_error < 5e-7
assert max_shoe_error < 1e-7
print('GEOMETRY_AUDIT', minimum_area_ratio, minimum_resolved_area_ratio, minimum_normal_dot, stabilization, flush=True)
assert minimum_area_ratio > .35, (minimum_area_ratio, worst_triangle)
assert minimum_normal_dot > 0, (minimum_normal_dot, worst_normal)
assert original == preserved(), 'The neutral basis, UV, normals or textures changed'

blend = OUT / 'traveler-sliders.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.wm.open_mainfile(filepath=str(blend))
obj, = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert original == preserved(), 'Saved file changed source data'
assert all(obj.data.shape_keys.key_blocks[key].value == 0 for key in KEYS)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(
    filepath=str(OUT / 'traveler-sliders.glb'), export_format='GLB',
    use_selection=True, export_morph=True, export_morph_normal=True,
    export_extras=True, export_image_format='AUTO',
)
report = {
    'source': 'source-traveler.blend', 'dims': DIMS,
    'body_refinement': refinement,
    'sliver_stabilization': stabilization,
    'basis_preserved_after_save_reload': True, 'original_data': original,
    'endpoint_combinations': 64, 'maximum_floor_error': max_floor_error,
    'maximum_head_similarity_error': max_head_error,
    'maximum_shoe_displacement': max_shoe_error,
    'minimum_triangle_area_ratio': minimum_area_ratio,
    'minimum_resolved_triangle_area_ratio': minimum_resolved_area_ratio,
    'minimum_face_normal_dot': minimum_normal_dot,
    'near_collinear_triangle_count': int((valid & ~resolved).sum()),
    'scope': 'Body sliders only. No wardrobe separation or animation rig yet.',
}
(OUT / 'sliders.json').write_text(json.dumps({'dims': DIMS}, ensure_ascii=False, indent=2) + '\n')
(OUT / 'slider-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('SLIDERS_VERIFIED', json.dumps({k: v for k, v in report.items() if k not in ['dims', 'original_data']}))
