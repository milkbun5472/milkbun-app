"""Add elbow joints to the assembled doll without changing its rest shape or outfit design.
Run: Blender --background --python add_elbows.py -- input.glb output.glb
Sleeve islands first regain nearby skin weights; the resulting arm weights are split
between upper arm and forearm. Rest geometry, UVs and morphs stay intact.
"""
import bpy, sys
from mathutils import Vector
def add_elbows():
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    if rig.get('elbowRig'):
        raise RuntimeError('Elbows already present; use the original assembled doll')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.vertex_groups]
    # Earlier shell preparation pinned small sleeve islands to the torso solely
    # because their own bounding box was narrow. Restore nearby skin weights in
    # the sleeve region, including those small islands, before splitting elbows.
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    body = next(o for o in meshes if o.name == 'DollBody')
    body.data.calc_loop_triangles()
    triangles = [tuple(t.vertices) for t in body.data.loop_triangles]
    points = [v.co.copy() for v in body.data.vertices]
    tree = BVHTree.FromPolygons(points, triangles, all_triangles=True)
    basis = [Vector((1,0,0)), Vector((0,1,0)), Vector((0,0,1))]
    body_groups = {g.index:g.name for g in body.vertex_groups}
    weights = [{body_groups[g.group]:g.weight for g in v.groups} for v in body.data.vertices]
    def smooth(v):
        u = min(1.,max(0.,v))
        return u*u*(3-2*u)
    for mesh in meshes:
        if not mesh.get('outfit') or mesh.get('colorSlot') == 'boots':
            continue
        groups = {g.name:g for g in mesh.vertex_groups}
        for v in mesh.data.vertices:
            x,y,z = v.co
            blend = smooth((abs(x)-.13)/.055)*smooth((z-.42)/.06)*smooth((.72-z)/.04)
            if blend <= 0:
                continue
            hit, normal, face, distance = tree.find_nearest(v.co)
            if hit is None or distance > .12:
                continue
            indices = triangles[face]
            bary = barycentric_transform(hit, *[points[i] for i in indices], *basis)
            old = {mesh.vertex_groups[g.group].name:g.weight for g in v.groups}
            delta = 0.
            for name in ('leftArm','rightArm'):
                target = sum(weights[i].get(name,0)*bary[k] for k,i in enumerate(indices))
                value = old.get(name,0)*(1-blend)+target*blend
                delta += old.get(name,0)-value
                groups[name].add([v.index],max(0.,value),'REPLACE')
            groups['body'].add([v.index],max(0.,old.get('body',0)+delta),'REPLACE')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    ends = {}
    for side, sign in [('left', -1), ('right', 1)]:
        upper = rig.data.edit_bones[side + 'Arm']
        shoulder = upper.head.copy()
        hand = Vector((sign * .275, 0, .40))
        elbow = shoulder.lerp(hand, .52)
        upper.tail = elbow
        lower = rig.data.edit_bones.new(side + 'Forearm')
        lower.head, lower.tail = elbow, hand
        lower.roll = upper.roll
        lower.parent, lower.use_connect = upper, True
        ends[side] = (shoulder, hand)
    bpy.ops.object.mode_set(mode='OBJECT')
    for mesh in meshes:
        for side, (shoulder, hand) in ends.items():
            group = mesh.vertex_groups.get(side + 'Arm')
            if group is None:
                continue
            lower = mesh.vertex_groups.new(name=side + 'Forearm')
            axis = hand - shoulder
            for v in mesh.data.vertices:
                weight = next((g.weight for g in v.groups if g.group == group.index), 0)
                if not weight:
                    continue
                point = rig.matrix_world.inverted() @ mesh.matrix_world @ v.co
                along = (point - shoulder).dot(axis) / axis.length_squared
                u = min(1., max(0., (along - .40) / .24))
                blend = u * u * (3 - 2 * u)
                if blend:
                    lower.add([v.index], weight * blend, 'REPLACE')
                    group.add([v.index], weight * (1 - blend), 'REPLACE')
    rig['elbowRig'] = {'version': 1, 'hands': {'left': [-.275, .40, 0], 'right': [.275, .40, 0]}}


def main():
    src, out = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    add_elbows()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True,
        export_extras=True, export_skins=True, export_animations=False,
        export_morph=True, export_morph_normal=False, export_image_format='AUTO',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=10,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=8,
        export_try_sparse_sk=True, export_try_omit_sparse_sk=True)
    print('Elbow rig exported:', out)

if __name__ == '__main__':
    main()
