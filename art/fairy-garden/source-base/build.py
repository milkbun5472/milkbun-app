"""Preserve the supplied traveler intact in a packed Blender source scene.

Only a parent transform normalizes display height. No mesh, UV, normal,
material or image reconstruction takes place. Run with Blender --background.
"""
import array
import hashlib
import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'clay-reference.glb'
OUT = Path(os.environ.get('SOURCE_BASE_OUT', '/tmp/garden-source-base'))
OUT.mkdir(parents=True, exist_ok=True)
SOURCE_SHA = 'b2fe2232ecb845d98036f8c6c03f5ccae68d76d4d2815b3c01b8c04b01952848'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
imported = list(bpy.context.scene.objects)
meshes = [o for o in imported if o.type == 'MESH']


def field_digest(items, field, components, kind='f'):
    data = array.array(kind, [0]) * (len(items) * components)
    items.foreach_get(field, data)
    return hashlib.sha256(data.tobytes()).hexdigest()


def snapshot():
    result = {'meshes': {}, 'images': {}}
    for obj in meshes:
        mesh = obj.data
        result['meshes'][obj.name] = {
            'vertices': len(mesh.vertices), 'polygons': len(mesh.polygons),
            'positions': field_digest(mesh.vertices, 'co', 3),
            'indices': field_digest(mesh.loops, 'vertex_index', 1, 'i'),
            'normals': field_digest(mesh.corner_normals, 'vector', 3),
            'uv': {uv.name: field_digest(uv.uv, 'vector', 2) for uv in mesh.uv_layers},
            'materials': [mat.name for mat in mesh.materials],
        }
    for image in bpy.data.images:
        if image.packed_file:
            result['images'][image.name] = {
                'size': list(image.size),
                'sha256': hashlib.sha256(image.packed_file.data).hexdigest(),
            }
    return result


before = snapshot()
assert len(meshes) == 1 and len(before['images']) == 3
points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
minimum = [min(v[i] for v in points) for i in range(3)]
maximum = [max(v[i] for v in points) for i in range(3)]
scale = 1.707 / (maximum[2] - minimum[2])
root = bpy.data.objects.new('Original traveler — display scale only', None)
bpy.context.collection.objects.link(root)
for obj in imported:
    if obj.parent is None:
        obj.parent = root
root.scale = (scale,) * 3
root.location.z = -minimum[2] * scale
root['source_sha256'] = SOURCE_SHA
root['geometry_policy'] = 'Original intact. Do not cut, remesh or replace the face.'

# Neutral soft studio lighting; all character materials remain imported.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.world = bpy.data.worlds.new('Neutral studio')
scene.world.use_nodes = True
background = scene.world.node_tree.nodes['Background']
background.inputs['Color'].default_value = (.55, .55, .55, 1)
background.inputs['Strength'].default_value = .3


def light(name, location, energy, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, .95)) - obj.location).to_track_quat('-Z', 'Y').to_euler()


light('Soft key', (-2.3, -3.5, 3.5), 260, 4)
light('Fill', (2, -3, 1.8), 130, 3)
light('Back rim', (0, 2.2, 2.2), 180, 2)
camera_data = bpy.data.cameras.new('Traveler review camera')
camera = bpy.data.objects.new('Traveler review camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.02
scene.render.resolution_x = 768
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'


def view(angle):
    camera.location = (6 * math.sin(angle), -6 * math.cos(angle), .87)
    camera.rotation_euler = (Vector((0, 0, .87)) - camera.location).to_track_quat('-Z', 'Y').to_euler()


view(0)
bpy.ops.file.pack_all()
assert before == snapshot(), 'Imported data changed during scene setup'
blend_path = OUT / 'source-traveler.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
# Verify the saved artifact itself, including every mesh normal and packed image.
bpy.ops.wm.open_mainfile(filepath=str(blend_path))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert before == snapshot(), 'Saved Blender file did not preserve original data'
report = {
    'source_sha256': SOURCE_SHA, 'unchanged_after_save_reload': True,
    'source_bounds': {'min': minimum, 'max': maximum},
    'display_height': 1.707, 'uniform_parent_scale': scale,
    'data': before,
    'limitations': ['Single original textured mesh; no new wardrobe split or rig yet.'],
}
(OUT / 'preservation.json').write_text(json.dumps(report, indent=2) + '\n')
scene = bpy.context.scene
camera = scene.camera
for label, angle in [('front', 0), ('three-quarter', math.pi / 4), ('side', math.pi / 2), ('back', math.pi)]:
    view(angle)
    scene.render.filepath = str(OUT / (label + '.png'))
    bpy.ops.render.render(write_still=True)
print('SOURCE_BASE_VERIFIED', blend_path)
