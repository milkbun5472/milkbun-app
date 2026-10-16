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
loft = runpy.run_path(str(HERE / 'sewn_fabric.py'))['loft']


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
    loft('outfit_jacket_shirt_yoke', obj, 'trim', profiles, light=1.05)
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
    loft('outfit_jacket_folded_collar', obj, 'cloth', profiles, .62, 2 * math.pi - .62, light=.68)
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
    loft('outfit_jacket_shirt_collar', obj, 'trim', profiles, .18, 2 * math.pi - .18, light=1.13)
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
