"""Restore the rabbit outfit's sneakers before the destructive skin-conform step.

The source shoe surface and UVs are retained. Footwear gets its own leg binding,
body morphs, and a covered-skin boundary consumed by the shared traveler renderer.
Run with Blender: --python restore_cardigan_shoes.py -- input.glb output.glb
"""
from pathlib import Path
import bpy, bmesh, numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

HERE = Path(__file__).resolve().parent


def restore_cardigan_shoes():
    if bpy.data.objects.get('outfit_cardigan_footwear'):
        raise RuntimeError('Source footwear is already installed')
    garment = bpy.data.objects['outfit_cardigan']
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    from mathutils.bvhtree import BVHTree
    garment_tree = BVHTree.FromObject(garment, bpy.context.evaluated_depsgraph_get())
    # Keep the existing authored morph offsets, including the seated correction.
    points = np.array([v.co[:] for v in garment.data.vertices])
    kd = KDTree(len(points))
    for i, point in enumerate(points):
        kd.insert(point, i)
    kd.balance()
    morphs = {k.name: np.array([v.co[:] for v in k.data]) - points
              for k in list(garment.data.shape_keys.key_blocks)[1:]}

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(HERE / 'v2/outfits/hunyuan-c04-shell.glb'))
    imported = set(bpy.data.objects) - before
    raw = next(o for o in imported if o.type == 'MESH')
    world = raw.matrix_world.copy()
    raw.parent = None
    raw.data.transform(world)
    raw.matrix_world.identity()
    p = np.array([v.co[:] for v in raw.data.vertices])
    centre = (p.min(0) + p.max(0)) / 2
    raw.data.transform(Matrix.Translation(Vector((-centre[0], -centre[1], -p[:, 2].min()))))
    # Same placement as the authored C04 shell; omit nearest-skin conformation.
    raw.data.transform(Matrix.Diagonal((.63, .63 * 1.5, .63, 1)))
    raw.data.transform(Matrix.Translation(Vector((0, 0, -.01))))
    for v in raw.data.vertices:
        v.co.z += .1 * min(1., max(0., (v.co.z - .05) / .3))
    bm = bmesh.new()
    bm.from_mesh(raw.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(v.co.z > .18 for v in f.verts)], context='FACES')
    bm.to_mesh(raw.data)
    bm.free()
    # Fit only the trouser overlap to the calf. Applying this to the shoe toe
    # and heel was what folded the original side walls into thin strips.
    tree = BVHTree.FromObject(bpy.data.objects['DollBody'], bpy.context.evaluated_depsgraph_get())
    for vertex in raw.data.vertices:
        blend = min(1., max(0., (vertex.co.z - .09) / .035))
        if not blend:
            continue
        point, normal, _, _ = tree.find_nearest(vertex.co)
        if point is None:
            continue
        distance = (vertex.co - point).dot(normal)
        if distance < .008:
            vertex.co += normal * ((.008 - distance) * blend * blend * (3 - 2 * blend))
        join = min(1., max(0., (vertex.co.z - .14) / .03))
        if join:
            p, n, _, _ = garment_tree.find_nearest(vertex.co)
            if p is not None:
                vertex.co = vertex.co.lerp(p - n * .001, join * join * (3 - 2 * join))
    bpy.context.view_layer.objects.active = raw
    modifier = raw.modifiers.new('Retain sneaker detail', 'DECIMATE')
    modifier.ratio = min(1., 5500 / max(1, len(raw.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    raw.name = 'outfit_cardigan_footwear'
    for obj in imported - {raw}:
        bpy.data.objects.remove(obj, do_unlink=True)

    # The source pair extends under the existing trouser cuffs, hiding the join.
    bm = bmesh.new()
    bm.from_mesh(garment.data)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        plane_co=(0, 0, .14), plane_no=(0, 0, 1), dist=1e-6, clear_inner=True)
    bm.to_mesh(garment.data)
    bm.free()
    raw.data.materials.clear()
    raw.data.materials.append(garment.data.materials[0].copy())
    raw['outfit'] = 'cardigan'
    raw['slotBase'] = garment['slotBase']
    raw['coversFeetBelow'] = .14
    raw['sourceFootwearVersion'] = 1
    raw.parent = rig
    for face in raw.data.polygons:
        face.material_index = 0
        face.use_smooth = True
    for attribute in list(raw.data.color_attributes):
        raw.data.color_attributes.remove(attribute)
    slot = raw.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for face in raw.data.polygons:
        z = sum(raw.data.vertices[i].co.z for i in face.vertices) / len(face.vertices)
        for i in face.loop_indices:
            slot.data[i].color = (.5 if z > .085 else .25, 0, 0, 1)
    for group in list(raw.vertex_groups):
        raw.vertex_groups.remove(group)
    for bone in rig.data.bones:
        raw.vertex_groups.new(name=bone.name)
    for v in raw.data.vertices:
        raw.vertex_groups['leftLeg' if v.co.x < 0 else 'rightLeg'].add([v.index], 1., 'REPLACE')
    modifier = raw.modifiers.new('Rig', 'ARMATURE')
    modifier.object = rig
    raw.shape_key_add(name='Basis')
    neighbours = []
    for vertex in raw.data.vertices:
        near = kd.find_n(vertex.co, 8)
        ids = [entry[1] for entry in near]
        weights = 1 / np.maximum([entry[2] for entry in near], .001) ** 2
        neighbours.append((ids, weights / weights.sum()))
    for name, offsets in morphs.items():
        key = raw.shape_key_add(name=name)
        key.value = 0.
        for vertex, (ids, weights) in zip(raw.data.vertices, neighbours):
            key.data[vertex.index].co = vertex.co + Vector(np.sum(offsets[ids] * weights[:, None], axis=0))
    print('Restored source sneakers:', len(raw.data.vertices), 'vertices;', len(raw.data.polygons), 'faces')
    return raw


def main():
    import sys
    src, out = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    restore_cardigan_shoes()
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_extras=True,
        export_skins=True, export_animations=False, export_morph=True, export_morph_normal=False,
        export_image_format='AUTO', export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=10, export_draco_position_quantization=14,
        export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8, export_try_sparse_sk=True, export_try_omit_sparse_sk=True)


if __name__ == '__main__':
    main()
