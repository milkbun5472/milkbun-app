"""Replace C05's fragmented collar with sewn, continuous shirt/jacket layers.

Migrate the finished master, retaining the authored sleeves, pockets, trousers,
rig and all other outfits. The same function runs after add_outfit's repairs.
"""
import math
import runpy
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
DEFORM = runpy.run_path(str(HERE / 'body_shape.py'))['deform']
KEYS = ('height', 'shoulder', 'waist', 'flare', 'build', 'head')


def material(template, slot, name):
    color = template['slotBase'][slot]
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    mat = bpy.data.materials.new('Jacket clean ' + slot)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    light = 1.05 if name.endswith('shirt_yoke') else 1.13 if slot == 'trim' else .68
    bs.inputs['Base Color'].default_value = (*[v * light for v in linear], 1)
    bs.inputs['Roughness'].default_value = .86
    return mat


def loft(name, template, slot, profiles, start=0, end=2 * math.pi, count=96):
    # Each profile returns x/y/z at angle a. Open fronts stay open; collars turn
    # under through solid thickness, so their rim never exposes a torn backface.
    closed = start == 0 and end == 2 * math.pi
    columns = count if closed else count + 1
    verts = [profile(start + (end - start) * j / count) for profile in profiles for j in range(columns)]
    faces = []
    for i in range(len(profiles) - 1):
        for j in range(count):
            a = i * columns + j
            b = i * columns + (j + 1) % columns
            faces.append((a, b, b + columns, a + columns))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = template.parent
    obj['outfit'] = 'jacket'
    obj['slotBase'] = template['slotBase'].to_dict()
    obj['dyeSlot'] = slot
    mesh.materials.append(material(template, slot, name))
    mesh.color_attributes.new(name='slot', type='FLOAT_COLOR', domain='CORNER')
    for c in mesh.color_attributes['slot'].data:
        c.color = (.27 if slot == 'trim' else .02, 0, 0, 1)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    bpy.context.view_layer.objects.active = obj
    thick = obj.modifiers.new('Turned fabric edge', 'SOLIDIFY')
    thick.thickness = .002
    thick.offset = 0
    bpy.ops.object.modifier_apply(modifier=thick.name)
    bevel = obj.modifiers.new('Soft sewn rim', 'BEVEL')
    bevel.width = .0008
    bevel.segments = 3
    bevel.affect = 'EDGES'
    bevel.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for f in mesh.polygons:
        f.use_smooth = True
    obj.vertex_groups.new(name='body').add(list(range(len(mesh.vertices))), 1, 'REPLACE')
    armature = obj.modifiers.new('Rig', 'ARMATURE')
    armature.object = obj.parent
    positions = np.array([v.co[:] for v in mesh.vertices])
    obj.shape_key_add(name='Basis')
    for key in KEYS:
        block = obj.shape_key_add(name=key)
        block.value = 0
        block.data.foreach_set('co', (positions + DEFORM(positions, np.zeros(len(positions)), key, True)).ravel())
    return obj


def refine_jacket_collar():
    obj = bpy.data.objects['outfit_jacket']
    if obj.get('refinedCollarVersion') == 1:
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # Remove the old floating lapel islands in full. Preserve original pockets
    # below .61 and the already repaired side panels (separate materials).
    todo = set(bm.verts)
    lapels = []
    while todo:
        first = todo.pop()
        part = {first}
        stack = [first]
        while stack:
            for edge in stack.pop().link_edges:
                for v in edge.verts:
                    if v in todo:
                        todo.remove(v)
                        part.add(v)
                        stack.append(v)
        p = np.array([v.co[:] for v in part])
        collar = p[:, 2].min() > .6501
        lapel = p[:, 2].min() > .61 and p[:, 2].max() > .675 and p[:, 1].mean() < 0 and abs(p[:, 0].mean()) > .075
        if collar or lapel:
            lapels.extend(part)
    bmesh.ops.delete(bm, geom=lapels, context='VERTS')
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), plane_co=(0, 0, .676), plane_no=(0, 0, 1), dist=1e-7)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == 0 and f.calc_center_median().z > .676001 and abs(f.calc_center_median().x) < .065 and f.calc_center_median().y < 0], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    # Rebuilt shirt yoke follows the chest up into a shallow neck opening.
    profiles = []
    for t in np.linspace(0, 1, 13):
        def shirt(a, t=t):
            rx = .062 * (1 - t) + .059 * t
            ry = (.058 + .029 * max(0, math.cos(a))) * (1 - t) + .050 * t
            return (.003 + rx * math.sin(a), .010 - ry * math.cos(a), .673 * (1 - t) + (.731 - .019 * max(0, math.cos(a))) * t)
        profiles.append(shirt)
    loft('outfit_jacket_shirt_yoke', obj, 'trim', profiles)
    # A continuous folded jacket collar, with two soft downward front points.
    profiles = []
    for t in np.linspace(0, 1, 12):
        def collar(a, t=t):
            front = max(0, math.cos(a))
            rx = .077 * (1 - t) + (.113 + .022 * front) * t
            ry = .067 * (1 - t) + .125 * t
            top = .732 - .014 * front
            front_angle = min(a, 2 * math.pi - a)
            bottom = .695 - .043 * math.exp(-((front_angle - .70) / .65) ** 2)
            return (.002 + rx * math.sin(a), .012 - ry * math.cos(a) - .008 * front * t - .005 * math.sin(math.pi * t), top * (1 - t) + bottom * t + .003 * math.sin(math.pi * t))
        profiles.append(collar)
    loft('outfit_jacket_folded_collar', obj, 'cloth', profiles, .62, 2 * math.pi - .62)
    # White shirt collar lies between the neck and jacket, with a small split.
    profiles = []
    for t in np.linspace(0, 1, 10):
        def inner(a, t=t):
            front = max(0, math.cos(a))
            rx = .060 * (1 - t) + .080 * t
            ry = .051 * (1 - t) + .089 * t
            top = .732 - .019 * front
            front_angle = min(a, 2 * math.pi - a)
            bottom = .718 - .042 * math.exp(-((front_angle - .72) / .45) ** 2)
            return (.003 + rx * math.sin(a), .010 - ry * math.cos(a) - .002 * math.sin(math.pi * t), top * (1 - t) + bottom * t + .002 * math.sin(math.pi * t))
        profiles.append(inner)
    loft('outfit_jacket_shirt_collar', obj, 'trim', profiles, .18, 2 * math.pi - .18)
    obj['refinedCollarVersion'] = 1


if __name__ == '__main__':
    split = runpy.run_path(str(HERE / 'split_outfits.py'))
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if args:
        source, destination = args
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=source)
    else:
        split['load']()
    refine_jacket_collar()
    if not args:
        split['export'](lambda o: True, split['MASTER'])
        destination = str(Path(split['APP']) / 'outfits/jacket.glb')
    split['export'](lambda o: o.type == 'ARMATURE' or o.get('outfit') == 'jacket', destination)
