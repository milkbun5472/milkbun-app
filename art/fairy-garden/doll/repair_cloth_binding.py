"""Repair the authored doll's inner wrists and rabbit sweater before adding elbows.

The lining is identified by its collapsed UVs and follows the skin. Outer cloth
uses a continuous sleeve field; the trousers and pouch stay on the torso.
The collar receives a separate local height adjustment; other rest positions,
shape-key offsets, UVs, materials and texture images remain unchanged.
"""
import bpy
from mathutils.kdtree import KDTree


def smooth(value):
    value = min(1., max(0., value))
    return value * value * (3 - 2 * value)


def repair_inner_wrists():
    body = bpy.data.objects['DollBody']
    vertices = body.data.vertices
    parent = list(range(len(vertices)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def join(a, b):
        a, b = root(a), root(b)
        if a != b:
            parent[b] = a
    # Below the armpit the two arms are separate anatomical components. This
    # includes the inner wrist, which a simple absolute-X cutoff left on body.
    eligible = {v.index for v in vertices if v.co.z < .555}
    for edge in body.data.edges:
        a, b = edge.vertices
        if a in eligible and b in eligible:
            join(a, b)
    tree = KDTree(len(vertices))
    for v in vertices:
        tree.insert(v.co, v.index)
    tree.balance()
    for i in eligible:
        for _, j, _ in tree.find_range(vertices[i].co, .0003):
            if j in eligible:
                join(i, j)
    components = {}
    for i in eligible:
        components.setdefault(root(i), []).append(i)
    sides = set()
    for ids in components.values():
        if len(ids) < 100 or min(vertices[i].co.z for i in ids) < .35:
            continue
        side = 'leftArm' if sum(vertices[i].co.x for i in ids) < 0 else 'rightArm'
        sides.add(side)
        for i in ids:
            vertex = vertices[i]
            old = {body.vertex_groups[g.group].name: g.weight for g in vertex.groups}
            total = old.get('body', 0) + old.get(side, 0)
            blend = smooth((.555 - vertex.co.z) / .03)
            weight = old.get(side, 0) * (1-blend) + total * blend
            body.vertex_groups[side].add([i], weight, 'REPLACE')
            body.vertex_groups['body'].add([i], total-weight, 'REPLACE')
    if sides != {'leftArm', 'rightArm'}:
        raise RuntimeError('Expected two separate wrist components; inspect the changed body asset')


def repair_cardigan(mesh, body):
    uv = mesh.data.uv_layers.active.data
    lining = set()
    for face in mesh.data.polygons:
        coords = [uv[i].uv for i in face.loop_indices]
        if max((u - coords[0]).length for u in coords) < 1e-5:
            lining.update(face.vertices)
    if not lining:
        raise RuntimeError('Expected the authored cardigan lining')
    groups = {g.name: g for g in mesh.vertex_groups}
    for vertex in mesh.data.vertices:
        if vertex.index in lining:
            continue
        x, y, z = vertex.co
        if z < .36:
            continue
        arm = smooth((abs(x) - .105) / .055)
        # The pouch is in front of the right inner sleeve. This rule applies to
        # outer fabric only, never the independently identified skin lining.
        if 0 < x < .185 and y < -.028 and z < .55:
            arm = 0.
        arm *= min(1., max(0., (.755-z)/.07))
        # The original trouser side extends above .40 and must not join the cuff.
        if abs(x) < .19:
            arm *= smooth((z-.43)/.06)
        side = 'leftArm' if x < 0 else 'rightArm'
        for group in groups.values():
            group.remove([vertex.index])
        groups[side].add([vertex.index], arm, 'REPLACE')
        groups['body'].add([vertex.index], 1-arm, 'REPLACE')
    tree = KDTree(len(body.data.vertices))
    for vertex in body.data.vertices:
        tree.insert(vertex.co, vertex.index)
    tree.balance()
    for i in lining:
        _, nearest, _ = tree.find(mesh.data.vertices[i].co)
        for group in groups.values():
            group.remove([i])
        for weight in body.data.vertices[nearest].groups:
            groups[body.vertex_groups[weight.group].name].add([i], weight.weight, 'REPLACE')
    # Rest-space coverage follows skinning and morphing. Keep the hand beyond
    # the cuff visible; coverage is switched off when changing to another outfit.
    mesh['skinCoverage'] = {'armAxis': [.165, .655, .11, -.255],
                            'sleeve': [.205, .46, .705, .10], 'torsoBelow': .705}
    import runpy
    from pathlib import Path
    runpy.run_path(str(Path(__file__).with_name('lower_cardigan_collar.py')))['lower_cardigan_collar'](mesh)
