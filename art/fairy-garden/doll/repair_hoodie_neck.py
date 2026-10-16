"""Close C03's exposed neck cut inside a continuous, fitted fabric lining.

The original body, hood, sleeves, bag and trousers retain their geometry. Only
this outfit lowers its torso mask; the lining covers the cut and chest below.
"""
import math
import runpy
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
loft = runpy.run_path(str(HERE / 'sewn_fabric.py'))['loft']
TORSO_BELOW = .675


def repair_hoodie_neck():
    garment = bpy.data.objects['outfit_ranger']
    garment['skinCoverage']['torsoBelow'] = TORSO_BELOW
    if garment.get('neckLiningVersion') == 1:
        return
    body = bpy.data.objects.get('DollBody')
    if body is None:
        bpy.ops.import_scene.gltf(filepath=str(HERE.parents[2] / 'apps/fairy-garden/doll.glb'))
        body = bpy.data.objects['DollBody']
    body.data.calc_loop_triangles()
    skin = BVHTree.FromPolygons([v.co for v in body.data.vertices], [t.vertices[:] for t in body.data.loop_triangles], all_triangles=True)
    profiles = []
    for t in np.linspace(0, 1, 16):
        def lining(a, t=t):
            front = max(0, math.cos(a))
            rx = .105 * (1 - t) + .062 * t
            ry = (.085 + .020 * front) * (1 - t) + (.050 + .017 * front) * t
            # The lining curves outside the chest while turning back toward
            # the neck. This prevents skin from emerging through its front.
            ry += (.005 + .009 * front) * math.sin(math.pi * t)
            outer = .690 - .050 * front
            inner = .727 - .023 * front
            z = outer * (1 - t) + inner * t
            direction = Vector((math.sin(a), -math.cos(a), 0))
            point, _, _, distance = skin.ray_cast(Vector((.003, .010, z)), direction, .4)
            radius = math.hypot(rx * math.sin(a), ry * math.cos(a))
            if point is not None:
                conformed = distance + .003
                blend = max(0, min(1, (z - .660) / .012))
                radius += max(0, conformed - radius) * blend
                rim = max(0, min(1, (t - .80) / .20))
                rim = rim * rim * (3 - 2 * rim)
                radius = radius * (1 - rim) + conformed * rim
            return (.003 + radius * direction.x, .010 + radius * direction.y, z)
        profiles.append(lining)
    collar = loft('outfit_ranger_neck_lining', garment, 'cloth', profiles, count=64, light=1.02)
    collar['neckLiningVersion'] = 1
    garment['neckLiningVersion'] = 1


if __name__ == '__main__':
    source, destination = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    repair_hoodie_neck()
    split = runpy.run_path(str(HERE / 'split_outfits.py'))
    rig = bpy.data.objects['outfit_ranger'].parent
    split['export'](lambda o: o == rig or o.get('outfit') == 'ranger', destination)
