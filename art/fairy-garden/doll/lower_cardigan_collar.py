"""Lower the rabbit sweater's tall ribbed collar without altering body proportions.

Apply once to the assembled garment. Shape keys use the same deformation as the
body at the new collar position, preserving fit at body-size extremes.
"""
def lower_cardigan_collar(mesh):
    if mesh.get('loweredCollarVersion'):
        return
    def smooth(value):
        value = max(0., min(1., value))
        return value * value * (3 - 2 * value)
    keys = mesh.data.shape_keys
    blocks = list(keys.key_blocks) if keys else []
    points = blocks[0].data if blocks else mesh.data.vertices
    offsets = [.028 * smooth((v.co.z - .685) / .085)
               * smooth((.135 - abs(v.co.x)) / .04) for v in points]
    import numpy as np
    import runpy
    from pathlib import Path
    from mathutils import Vector
    deform = runpy.run_path(str(Path(__file__).with_name('body_shape.py')))['deform']
    old = np.array([v.co[:] for v in points])
    new = old.copy()
    new[:, 2] -= offsets
    # This region is above the arm blend; retain the original arm field if a
    # future authored collar reaches the shoulder cap.
    arm_groups = {g.index for g in mesh.vertex_groups if g.name.endswith(('Arm', 'Forearm'))}
    arm = np.array([sum(g.weight for g in v.groups if g.group in arm_groups)
                    for v in mesh.data.vertices])
    for block in blocks:
        change = new - old
        if block != blocks[0]:
            change = change + deform(new, arm, block.name, True) - deform(old, arm, block.name, True)
        for point, delta in zip(block.data, change):
            point.co += Vector(delta)
    for vertex, offset in zip(mesh.data.vertices, offsets):
        vertex.co.z -= offset
    mesh['loweredCollarVersion'] = 1


if __name__ == '__main__':
    import bpy
    import sys
    source, destination = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    lower_cardigan_collar(bpy.data.objects['outfit_cardigan'])
    bpy.ops.export_scene.gltf(
        filepath=destination, export_format='GLB', export_extras=True,
        export_skins=True, export_animations=False, export_morph=True,
        export_morph_normal=False, export_image_format='AUTO',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=10,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
        export_try_sparse_sk=True, export_try_omit_sparse_sk=True)
