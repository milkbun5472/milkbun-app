"""Restore C06 shoes from the intact source, before skin conformation.

Keep the original UVs, leather detail and sole. Only the upper overlap follows
existing trouser geometry; no nearest-body projection is applied to the feet.
"""

import bpy, bmesh, runpy, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

H = Path(__file__).resolve().parent


def restore_suit_footwear():
    g = bpy.data.objects["outfit_suit"]
    rig = g.parent
    if bpy.data.objects.get("outfit_suit_footwear"):
        assert g.get("sourceFootwearVersion") == 1
        return False
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(H / "v2/outfits/hunyuan-c06-shell.glb"))
    new = set(bpy.data.objects) - before
    r = next(o for o in new if o.type == "MESH")
    mw = r.matrix_world.copy()
    r.parent = None
    r.data.transform(mw)
    r.matrix_world.identity()
    P = np.array([v.co[:] for v in r.data.vertices])
    c = (P.min(0) + P.max(0)) / 2
    r.data.transform(Matrix.Translation(Vector((-c[0], -c[1], -P[:, 2].min()))))
    r.data.transform(Matrix.Diagonal((0.69, 0.69, 0.69, 1)))
    bm = bmesh.new()
    bm.from_mesh(r.data)
    bmesh.ops.bisect_plane(
        bm,
        geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        plane_co=(0, 0, 0.15),
        plane_no=(0, 0, 1),
        dist=1e-6,
        clear_outer=True,
    )
    bm.to_mesh(r.data)
    bm.free()
    from mathutils.bvhtree import BVHTree

    surface = BVHTree.FromObject(g, bpy.context.evaluated_depsgraph_get())
    for v in r.data.vertices:
        if v.co.z <= 0.125:
            continue
        t = min(1, (v.co.z - 0.125) / 0.02)
        t = t * t * (3 - 2 * t)
        p, n, _, _ = surface.find_nearest(v.co)
        if p is not None:
            v.co = v.co.lerp(p - n * 0.002, t)
    bpy.context.view_layer.objects.active = r
    r.select_set(True)
    m = r.modifiers.new("Shoe detail budget", "DECIMATE")
    m.ratio = min(1, 6000 / max(1, len(r.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=m.name)
    for o in new - {r}:
        bpy.data.objects.remove(o, do_unlink=True)
    slots = runpy.run_path(str(H / "outfit_slots.py"))
    slots["colour_slots"](r, True, False, {"trim_lum": 0.6})
    # The shared classifier gives low faces the bottom slot first. Here socks
    # must retain the shirt/trim dye, independently of black leather and trousers.
    image = slots["base_image"](r.data.materials[0])
    width, height = image.size
    texture = np.array(image.pixels[:]).reshape(height, width, 4)[:, :, :3] ** (1 / 2.2)
    uv = r.data.uv_layers.active
    color = r.data.color_attributes.active_color
    for face in r.data.polygons:
        coords = np.array([uv.data[i].uv[:] for i in face.loop_indices])
        pixels = texture[
            np.clip((coords[:, 1] * height).astype(int), 0, height - 1),
            np.clip((coords[:, 0] * width).astype(int), 0, width - 1),
        ]
        z = np.mean([r.data.vertices[i].co.z for i in face.vertices])
        if .08 < z < .115 and np.median(pixels, axis=0) @ [0.2126, 0.7152, 0.0722] > .5:
            for i in face.loop_indices:
                color.data[i].color = (0.27, 0, 0, 1)
    r.name = "outfit_suit_footwear"
    r.parent = rig
    r.data.materials.clear()
    r.data.materials.append(g.data.materials[0].copy())
    for f in r.data.polygons:
        f.material_index = 0
        f.use_smooth = True
    r["outfit"] = "suit"
    r["slotBase"] = g["slotBase"]
    r["coversFeetBelow"] = 0.14
    for vg in list(r.vertex_groups):
        r.vertex_groups.remove(vg)
    for side in ["left", "right"]:
        r.vertex_groups.new(name=side + "Leg")
    for v in r.data.vertices:
        r.vertex_groups["leftLeg" if v.co.x < 0 else "rightLeg"].add(
            [v.index], 1, "REPLACE"
        )
    md = r.modifiers.new("Rig", "ARMATURE")
    md.object = rig
    P = np.array([v.co[:] for v in r.data.vertices])
    r.shape_key_add(name="Basis")
    deform = runpy.run_path(str(H / "body_shape.py"))["deform"]
    for key in ["height", "shoulder", "waist", "flare", "build", "head"]:
        k = r.shape_key_add(name=key)
        k.value = 0
        k.data.foreach_set("co", (P + deform(P, np.zeros(len(P)), key, True)).ravel())
    bm = bmesh.new()
    bm.from_mesh(g.data)
    bmesh.ops.bisect_plane(
        bm,
        geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        plane_co=(0, 0, 0.135),
        plane_no=(0, 0, 1),
        dist=1e-6,
        clear_inner=True,
    )
    bm.to_mesh(g.data)
    bm.free()
    g["sourceFootwearVersion"] = 1
    r["sourceFootwearVersion"] = 1
    return True


def main():
    import sys

    source, master, part = sys.argv[sys.argv.index("--") + 1 :]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    restore_suit_footwear()
    export = runpy.run_path(str(H / "split_outfits.py"))["export"]
    export(lambda o: True, master)
    export(lambda o: o.type == "ARMATURE" or o.get("outfit") == "suit", part)


if __name__ == "__main__":
    main()
