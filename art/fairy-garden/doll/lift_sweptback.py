"""Add broad upper-crown volume to the reviewed sweptback shell once.

Input: v89.633 web hair_sweptback.glb, after refine_sweptback.py.
Usage: Blender -b --python lift_sweptback.py -- input.glb output.glb
The output is an authoring shell; attach/export with the existing add_hair helpers.
"""
import hashlib
import json
import runpy
import sys
from pathlib import Path

import bpy
import numpy as np


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def lift(points):
    x, y, z = points.T  # +Y points toward the back in Blender anchor space.
    # A narrow lateral mask creates a central bump. Lift the entire upper cap,
    # including its left/right shoulders, with a long fade to the temples.
    weight = smooth((z - .10) / .70)
    weight *= 1 - smooth((y - .60) / .50)
    result = points.copy()
    result[:, 2] += .12 * weight
    result[:, 0] *= 1 + .035 * weight
    result[:, 1] += .012 * weight * (1 - smooth((y + .15) / .50))
    return result


def main():
    source, output = sys.argv[-2:]
    expected = 'ec49139adade38ad7e62c4c303f26c9a0378c0506cda938b9d3db343e61673d9'
    if hashlib.sha256(Path(source).read_bytes()).hexdigest() != expected:
        raise ValueError('Use the reviewed v89.633 web shell; do not apply the crown lift twice')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    hair = next(obj for obj in bpy.data.objects if obj.type == 'MESH')
    mesh = hair.data
    mesh.transform(hair.matrix_world)
    hair.matrix_world.identity()
    before = np.array([v.co[:] for v in mesh.vertices])
    deform = runpy.run_path(str(Path(__file__).with_name('hair_deform.py')))['deform_mesh']
    report = deform(mesh, lift)
    after = np.array([v.co[:] for v in mesh.vertices])
    fixed = (before[:, 2] <= .10) | (before[:, 1] >= 1.10)
    report.update(maxLift=float((after-before)[:, 2].max()),
                  fixedVertices=int(fixed.sum()), fixedMaxDrift=float(np.abs(after[fixed]-before[fixed]).max()),
                  beforeBounds=[before.min(0).tolist(), before.max(0).tolist()],
                  afterBounds=[after.min(0).tolist(), after.max(0).tolist()])
    assert report['fixedMaxDrift'] == 0
    bpy.ops.object.select_all(action='DESELECT')
    hair.select_set(True)
    bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True)
    Path(output).with_suffix('.json').write_text(json.dumps(report, indent=2))
    print(report)


if __name__ == '__main__':
    main()
