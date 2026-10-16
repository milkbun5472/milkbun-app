"""Continuous thick fabric, palette ownership and body morphs for authored collars."""
import math
import runpy
from pathlib import Path
import bpy
import bmesh
import numpy as np
HERE = Path(__file__).resolve().parent
DEFORM = runpy.run_path(str(HERE / 'body_shape.py'))['deform']
KEYS = ('height', 'shoulder', 'waist', 'flare', 'build', 'head')

def material(template, slot, light):
    color = template['slotBase'][slot]
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    mat = bpy.data.materials.new(template['outfit'].capitalize() + ' clean ' + slot)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*[v * light for v in linear], 1)
    bs.inputs['Roughness'].default_value = .86
    return mat


def loft(name, template, slot, profiles, start=0, end=2 * math.pi, count=96, light=1):
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
    obj['outfit'] = template['outfit']
    obj['slotBase'] = template['slotBase'].to_dict()
    obj['dyeSlot'] = slot
    mesh.materials.append(material(template, slot, light))
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
