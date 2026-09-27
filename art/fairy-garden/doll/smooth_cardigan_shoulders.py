"""Remove the pink sweater's shoulder crown without changing its cuff or hands.

The fitted v3 sleeve expands too quickly just outside the armhole. Reduce only
that radial expansion, preserving a round cross-section and the original axis.
Run after fit_cuffs; coordinates below are in the shared Blender Z-up space.
"""
from pathlib import Path
import runpy
import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent


def smooth_cardigan_shoulders():
    deform = runpy.run_path(str(HERE / 'body_shape.py'))['deform']
    changed = []
    for side, sign in [('left', -1), ('right', 1)]:
        sleeve = bpy.data.objects.get('outfit_cardigan_' + side + '_sleeve')
        if not sleeve or sleeve.get('slopedShoulderVersion') == 1:
            continue
        assert sleeve.get('fittedCuffVersion') == 3, 'Fit the continuous sleeve first'
        axis = Vector((sign * .095, 0, -.19)).normalized()
        across = axis.cross(Vector((0, 1, 0))).normalized()
        start = Vector((sign * .153, 0, .655))
        center = Vector((0, .01 if sign > 0 else .002, 0)) + across * (-.025 if sign > 0 else .020)
        inset = Vector((-sign * .012, 0, -.012 * .35))
        inset_projection = -inset.dot(axis)
        moved = []
        for vertex in sleeve.data.vertices:
            # Invert round_sleeves' inset; the fit_cuffs center shift is radial.
            raw = (vertex.co - start).dot(axis)
            t = (raw + inset_projection) / (1 + inset_projection / .16) if raw < .16 else raw
            if t < 0:
                t = raw + inset_projection
            if t >= .115:
                continue
            fade = 1 - np.clip(t / .16, 0, 1)
            blend = float(np.clip((t + .015) / .12, 0, 1))
            blend = blend * blend * (3 - 2 * blend)
            origin = start + axis * t + center * blend + inset * fade
            radial = vertex.co - origin
            reduction = float(np.interp(t,
                [-.055, -.045, -.030, -.015, 0, .02, .04, .065, .09, .115],
                [0, .002, .005, .008, .009, .011, .0115, .007, .003, 0]))
            if radial.length and reduction > 0:
                vertex.co -= radial.normalized() * reduction
                moved.append(vertex.index)
        points = np.array([sleeve.data.vertices[i].co[:] for i in moved])
        keys = sleeve.data.shape_keys.key_blocks
        for i, p in zip(moved, points):
            keys['Basis'].data[i].co = p
        for name in ('height', 'shoulder', 'waist', 'flare', 'build', 'head'):
            positions = points + deform(points, np.ones(len(points)), name, True)
            for i, p in zip(moved, positions):
                keys[name].data[i].co = p
        # Imported GLBs carry normals from the old bulge; let Blender recompute.
        sleeve.data.normals_split_custom_set([(0, 0, 0)] * len(sleeve.data.loops))
        sleeve['slopedShoulderVersion'] = 1
        changed.append(sleeve.name)
    return changed


def main():
    import sys
    source, destination, part = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    smooth_cardigan_shoulders()
    export = runpy.run_path(str(HERE / 'split_outfits.py'))['export']
    export(lambda o: True, destination)
    export(lambda o: o.type == 'ARMATURE' or o.get('outfit') == 'cardigan', part)


if __name__ == '__main__':
    main()
