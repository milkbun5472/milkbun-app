"""Comb the supplied sweptback shell into a short-sided, full-nape pompadour.

Run after fit_shell.py (INNER=1.18 DZ=-.10), before compress_asset.py.
The original triangles, UVs and textures remain; custom normals follow the
same smooth deformation, including across duplicated UV seam vertices.
Usage: Blender -b --python refine_sweptback.py -- fitted.glb refined.glb
"""
import json
import sys
import runpy
from pathlib import Path

import bpy
import numpy as np


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def comb(points):
    result = points.copy()
    x, y, z = points.T  # Blender anchor space: +Y is the back of the head.
    side = smooth((np.abs(x) - .30) / .55)
    lower = smooth((.10 - z) / 1.05)
    radius = np.maximum(.01, np.sqrt(x * x + y * y))
    rear = smooth((y / radius - .25) / .45)
    front = 1 - rear
    # Separate temples from the nape by direction around the skull. A height
    # cutoff alone either leaves the long side tips or exposes the lower skull.
    result[:, 1] = y + .12 * side * lower * front
    lower_length = .15 * np.logaddexp(0, (.05 - z) / .15)
    result[:, 2] = z + (-.08 + .53 * front) * lower_length
    result[:, 2] += .15 * np.maximum(0, z - .3)
    return result


def main():
    source, output = sys.argv[-2:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    hair = next(obj for obj in bpy.data.objects if obj.type == 'MESH')
    mesh = hair.data
    mesh.transform(hair.matrix_world)
    hair.matrix_world.identity()
    deform_mesh=runpy.run_path(str(Path(__file__).with_name('hair_deform.py')))['deform_mesh']
    report=deform_mesh(mesh,comb)
    bpy.ops.object.select_all(action='DESELECT')
    hair.select_set(True)
    bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True)
    Path(output).with_suffix('.json').write_text(json.dumps(report, indent=2))
    print(report)


if __name__ == '__main__':
    main()
