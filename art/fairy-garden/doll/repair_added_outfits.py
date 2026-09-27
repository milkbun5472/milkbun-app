"""Rejoin C05/C06 torso flanks while keeping original pocket/lapel components.

Run in Blender: --python repair_added_outfits.py -- source.glb output.glb.
The shared sleeves, hands, pants and the other outfits are not rebuilt.
"""

import bpy
import bmesh
import runpy
import math
import sys
import numpy as np
from pathlib import Path

HERE = Path(__file__).parent
DIM_KEYS = ("height", "shoulder", "waist", "flare", "build", "head")
deform = runpy.run_path(str(HERE / "body_shape.py"))["deform"]


def repair_outfit(oid, config=None):
    if oid not in ("jacket", "suit", "tee"):
        raise ValueError("Unsupported added outfit: " + oid)
    original = bpy.data.objects["outfit_" + oid]
    if original.get("closedFlankVersion") == 2:
        return
    if config is None:
        config = runpy.run_path(str(HERE / "add_outfit.py"))["EXTRA"][oid]
    o = bpy.data.objects["outfit_" + oid]
    # Blender Z-up rest coordinates; these bounds leave the original collar and hem.
    # T恤：宽松款，接缝放到 .11（从正面看在侧边，重建的侧面也和原衣身一样宽）；
    # 侧面补到下摆 .32，下面那截牛仔布按原贴图颜色保护起来不删。
    lo = 0.375 if oid == "suit" else 0.32 if oid == "tee" else 0.38
    hi = 0.691
    cut = 0.11 if oid == "tee" else 0.08
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000015)
    protected = bm.faces.layers.int.new("OriginalDetails")
    todo = set(bm.verts)
    while todo:
        v = todo.pop()
        group = {v}
        q = [v]
        while q:
            for e in q.pop().link_edges:
                for v in e.verts:
                    if v in todo:
                        todo.remove(v)
                        group.add(v)
                        q.append(v)
        if (
            len(group) < 220
            and min(v.co.z for v in group) > 0.31
            and max(v.co.z for v in group) < 0.70
            and min(v.co.y for v in group) < -0.07
        ):
            for v in group:
                for f in v.link_faces:
                    f[protected] = 1
    # Clip the pocket selection boundaries before keeping faces, so no long sleeve triangle survives.
    # T恤没有口袋：这一刀和下面的口袋保护都跳过
    for ax, vals in ([] if oid == "tee" else [
        (0, [-0.15, -0.068, 0.068, 0.15]),
        (1, [-0.055]),
        (2, ([0.407, 0.455] if oid == "suit" else [0.442, 0.495, 0.544, 0.600])),
    ]):
        for val in vals:
            co = [0, 0, 0]
            co[ax] = val
            no = [0, 0, 0]
            no[ax] = 1
            bmesh.ops.bisect_plane(
                bm,
                geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                plane_co=co,
                plane_no=no,
                dist=1e-7,
            )
    if oid == "tee":
        # 牛仔布（偏蓝的灰）不许被侧面重建删掉：T恤下摆盖着裤腰，一条高度线分不开两者
        uvl = bm.loops.layers.uv.active
        srcimg = next(n.image for n in o.data.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
        TWd, THd = srcimg.size
        px = np.array(srcimg.pixels[:]).reshape(THd, TWd, 4)
        for f in bm.faces:
            u, v = np.mean([l[uvl].uv[:] for l in f.loops], 0)
            c = px[int(np.clip(v, 0, 1) * (THd - 1)), int(np.clip(u, 0, 1) * (TWd - 1))][:3] ** (1 / 2.2)
            if c[2] > c[0] + 0.01 and c[0] < 0.72:
                f[protected] = 1
    # Keep the original pocket lips and bags, including portions connected to the body.
    for f in bm.faces:
        c = f.calc_center_median()
        pocket = (
            (0.407 < c.z < 0.455)
            if oid == "suit"
            else (0.442 < c.z < 0.495 or 0.544 < c.z < 0.600)
        )
        if oid != "tee" and pocket and 0.068 < abs(c.x) < 0.15 and c.y < -0.055:
            f[protected] = 1
    for ax, vals in [(2, [lo, hi]), (0, [-cut, cut])]:
        for val in vals:
            co = [0, 0, 0]
            co[ax] = val
            no = [0, 0, 0]
            no[ax] = 1
            bmesh.ops.bisect_plane(
                bm,
                geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                plane_co=co,
                plane_no=no,
                dist=1e-7,
            )
    bmesh.ops.delete(
        bm,
        geom=[
            f
            for f in bm.faces
            if not f[protected]
            and abs(f.calc_center_median().x) > cut + 1e-6
            and lo < f.calc_center_median().z < hi
        ],
        context="FACES",
    )
    uv = bm.loops.layers.uv.active
    col = bm.loops.layers.float_color.active or bm.loops.layers.color.active
    atlas = config["sleeves"]["atlas"]
    newverts = []
    originalmat = o.data.materials[0]
    sourceim = next(
        n.image
        for n in originalmat.node_tree.nodes
        if n.type == "TEX_IMAGE" and n.image
    )
    W, Ht = sourceim.size
    pixels = np.array(sourceim.pixels[:]).reshape(Ht, W, 4)

    def tex(uvv):
        x = np.clip(uvv[0] * (W - 1), 0, W - 1)
        y = np.clip(uvv[1] * (Ht - 1), 0, Ht - 1)
        return pixels[int(y), int(x)]

    for sign in [-1, 1]:
        edges = [
            e
            for e in bm.edges
            if e.is_boundary
            and all(not f[protected] for f in e.link_faces)
            and all(
                abs(v.co.x - sign * cut) < 1e-5 and lo - 1e-5 <= v.co.z <= hi + 1e-5
                for v in e.verts
            )
        ]
        zs = sorted(set([lo, hi] + [round(v.co.z, 7) for e in edges for v in e.verts]))
        zs = [z for i, z in enumerate(zs) if i == 0 or z - zs[i - 1] > 0.00002]
        segments = [tuple(v.co.copy() for v in e.verts) for e in edges]
        texedges = []
        for e in edges:
            l = e.link_loops[0]
            texedges.append(
                (
                    l.vert.co.copy(),
                    l.link_loop_next.vert.co.copy(),
                    l[uv].uv.copy(),
                    l.link_loop_next[uv].uv.copy(),
                )
            )

        def sample(z, front):
            vals = []
            for a, b in segments:
                if (
                    min(a.z, b.z) - 1e-6 <= z <= max(a.z, b.z) + 1e-6
                    and abs(a.z - b.z) > 1e-7
                ):
                    y = (a + (b - a) * ((z - a.z) / (b.z - a.z))).y
                    if (y < 0) == front:
                        vals.append(y)
            if vals:
                return max(vals) if front else min(vals)
            vs = [v for e in edges for v in e.verts if (v.co.y < 0) == front]
            return min(vs, key=lambda v: abs(v.co.z - z)).co.y

        # Smooth the body profile only; keep detail components at original coordinates.
        rawz = np.linspace(lo, hi, 80)
        raw = np.array([[sample(z, True), sample(z, False)] for z in rawz])
        sm = np.array(
            [np.median(raw[max(0, i - 4) : min(80, i + 5)], axis=0) for i in range(80)]
        )
        sm = np.stack(
            [np.polyval(np.polyfit(rawz, sm[:, k], 5), rawz) for k in range(2)], axis=1
        )
        for v in list(bm.verts):
            if (
                abs(v.co.x - sign * cut) < 0.018
                and lo < v.co.z < hi
                and not any(f[protected] for f in v.link_faces)
            ):
                front = v.co.y < 0
                old = sample(v.co.z, front)
                target = float(np.interp(v.co.z, rawz, sm[:, 0 if front else 1]))
                v.co.y += (target - old) * max(0, 1 - abs(v.co.x - sign * cut) / 0.018)
                newverts.append(v)

        def edgecolor(z, front):
            target = float(np.interp(z, rawz, sm[:, 0 if front else 1]))
            candidates = []
            for a, b, ua, ub in texedges:
                if abs(b.z - a.z) < 1e-7:
                    continue
                t = np.clip((z - a.z) / (b.z - a.z), 0, 1)
                p = a + (b - a) * t
                if (p.y < 0) == front:
                    candidates.append(
                        (abs(p.z - z) * 4 + abs(p.y - target), tex(ua + (ub - ua) * t))
                    )
            return (
                min(candidates, key=lambda q: q[0])[1]
                if candidates
                else tex((atlas[0], atlas[1]))
            )

        TH = 256
        TW = 64
        strip = np.ones((TH, TW, 4))
        base = tex((atlas[0] + atlas[2] / 2, atlas[1] + atlas[3] / 2))
        for ii in range(TH):
            zz = lo + (hi - lo) * ii / (TH - 1)
            ca = np.clip(edgecolor(zz, True), base * 0.85, base * 1.15)
            cb = np.clip(edgecolor(zz, False), base * 0.85, base * 1.15)
            for jj in range(TW):
                t = jj / (TW - 1)
                wa = math.exp(-t * 8)
                wb = math.exp(-(1 - t) * 8)
                strip[ii, jj, :3] = (base * (1 - wa - wb) + ca * wa + cb * wb)[:3]
        im = bpy.data.images.new(oid + " seam cloth " + str(sign), TW, TH, alpha=False)
        im.pixels.foreach_set(strip.astype(np.float32).ravel())
        im.update()
        im.pack()
        mat = originalmat.copy()
        for n in mat.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image == sourceim:
                n.image = im
        midx = len(o.data.materials)
        o.data.materials.append(mat)
        rings = []
        N = 32
        coords = {}
        for z in zs:
            yf = float(np.interp(z, rawz, sm[:, 0]))
            yb = float(np.interp(z, rawz, sm[:, 1]))
            ring = []
            for j in range(N + 1):
                t = j / N
                x = sign * (
                    cut
                    + (
                        0.060
                        + 0.007 * math.sin(math.pi * (z - lo) / (hi - lo))
                        - 0.009 * max(0, (z - 0.63) / 0.061)
                    )
                    * math.sin(math.pi * t)
                )
                y = (
                    (yf + yb) / 2
                    - (yb - yf) / 2 * math.cos(math.pi * t)
                    + 0.025 * math.sin(math.pi * t) ** 0.4 * (1 - t)
                )
                v = bm.verts.new((x, y, z))
                ring.append(v)
                newverts.append(v)
                coords[v] = (t, (z - lo) / (hi - lo))
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for j in range(N):
                f = bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
                f.smooth = True
                f.material_index = midx
                for l in f.loops:
                    l[uv].uv = coords[l.vert]
                    # BMesh byte colors store sRGB: 0.1517 decodes to the cloth slot 0.02.
                    # Imported GLBs can carry a white COLOR_0 plus the real slot layer.
                    for layer in list(bm.loops.layers.color) + list(
                        bm.loops.layers.float_color
                    ):
                        l[layer] = (
                            (0.1517, 0, 0, 1)
                            if layer in list(bm.loops.layers.color)
                            else (0.02, 0, 0, 1)
                        )
    layers = {k: bm.verts.layers.shape.get(k) for k in ["Basis", *DIM_KEYS]}
    weights = bm.verts.layers.deform.verify()
    body = o.vertex_groups["body"].index
    for v in newverts:
        p = np.array([v.co[:]])
        for k, layer in layers.items():
            if layer:
                v[layer] = (
                    p[0] if k == "Basis" else (p + deform(p, np.zeros(1), k, True))[0]
                )
        v[weights][body] = 1
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000025)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    if o.data.has_custom_normals:
        o.data.normals_split_custom_set([(0, 0, 0)] * len(o.data.loops))
    old = bpy.data.objects.get("outfit_" + oid + "_side_lining")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    o["closedFlankVersion"] = 2


def main():
    source, output = sys.argv[sys.argv.index("--") + 1 :]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    for oid in ("jacket", "suit", "tee"):
        if bpy.data.objects.get("outfit_" + oid):
            repair_outfit(oid)
    settings = runpy.run_path(str(HERE / "split_outfits.py"))["EXPORT"]
    bpy.ops.export_scene.gltf(filepath=output, **{**settings, "use_selection": False})


if __name__ == "__main__":
    main()
