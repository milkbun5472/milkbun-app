"""Preserve suit details and original hands; verify wrist overlap and sleeve continuity."""

import sys, json, numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cloth_asset_helpers import snapshot, image_hashes
from mathutils.kdtree import KDTree

before, after, output = sys.argv[sys.argv.index("--") + 1 :]
a = snapshot(before)
b = snapshot(after)
changed = {
    "outfit_" + outfit + "_" + side + "_sleeve"
    for outfit in ("suit",)
    for side in ("left", "right")
}
drift = 0
count = 0
assert set(a) - changed == set(b) - changed, (set(a) - set(b), set(b) - set(a))
for name in sorted(set(a) - changed):
    for aa, bb in ((a[name], b[name]), (b[name], a[name])):
        assert aa["keys"].keys() == bb["keys"].keys(), name
        tree = KDTree(len(aa["points"]))
        for i, p in enumerate(aa["points"]):
            tree.insert(p, i)
        tree.balance()
        keys = list(aa["keys"])
        ap = np.stack(
            [np.array(aa["points"])] + [np.array(aa["keys"][k]) for k in keys], axis=1
        )
        bp = np.stack(
            [np.array(bb["points"])] + [np.array(bb["keys"][k]) for k in keys], axis=1
        )
        for p, values in zip(bb["points"], bp):
            near = tree.find_range(p, 1e-5)
            assert near, (name, p)
            error = min(np.max(np.abs(ap[i] - values)) for _, i, _ in near)
            assert error < 1e-5, (name, float(error))
            drift = max(drift, float(error))
    count += 1
for name in changed:
    q = b[name]
    assert set(q["keys"]) == {
        "Basis",
        "height",
        "shoulder",
        "waist",
        "flare",
        "build",
        "head",
    }
    for pts in q["keys"].values():
        assert np.isfinite(np.array(pts)).all()
# Check all 64 body-shape endpoints on the reshaped sleeve surfaces.
import bpy, itertools, runpy

catalog = json.loads(
    (Path(__file__).parents[2] / "apps/fairy-garden/doll.json").read_text()
)
panel_checks = 0
for name in changed:
    obj = bpy.data.objects[name]
    assert obj.get("slopedShoulderVersion") == 1
    obj.data.calc_loop_triangles()
    triangles = np.array([t.vertices[:] for t in obj.data.loop_triangles])
    basis = np.array([v.co[:] for v in obj.data.shape_keys.key_blocks["Basis"].data])
    p = basis[triangles]
    reference = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    valid = np.linalg.norm(reference, axis=1) > 1e-9
    triangles, reference = triangles[valid], reference[valid]
    for values in itertools.product((0, 1), repeat=6):
        points = basis.copy()
        for dim, high in zip(catalog["dims"], values):
            delta = (
                np.array(
                    [v.co[:] for v in obj.data.shape_keys.key_blocks[dim["key"]].data]
                )
                - basis
            )
            points += delta * (dim["max" if high else "min"] - 1)
        p = points[triangles]
        normal = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
        assert np.all(np.sum(normal * reference, axis=1) > 0), (
            name,
            values,
            "flipped sleeve",
        )
        panel_checks += 1
from mathutils import Vector

body = bpy.data.objects["DollBody"]
assert body["originalHandVersion"] == 1 and not body.get("fittedWristVersion")
body.data.calc_loop_triangles()
seams = []
for outfit in ("suit",):
    cloth = bpy.data.objects["outfit_" + outfit]
    mask = cloth["skinCoverage"]["sleeve"][0]
    assert cloth["fittedCuffVersion"] == 3
    for side, sign in [("left", -1), ("right", 1)]:
        sleeve = bpy.data.objects["outfit_" + outfit + "_" + side + "_sleeve"]
        assert sleeve["fittedCuffVersion"] == 3
        assert any(
            abs(a.data[0].color[0] - 0.02) < 0.002 for a in sleeve.data.color_attributes
        ), "missing cloth dye slot"
        a = Vector((sign * 0.095, 0, -0.19)).normalized()
        start = Vector((sign * 0.153, 0, 0.655))
        radii = []
        v = a.cross(Vector((0, 1, 0))).normalized()
        short = outfit == "garden"
        center = Vector((0, 0.01 if sign > 0 else 0.002, 0)) + v * (
            (-0.033 if short else -0.025) if sign > 0 else (0.031 if short else 0.020)
        )
        for tri in body.data.loop_triangles:
            verts = [body.data.vertices[i] for i in tri.vertices]
            if not all(
                v.co.x * sign > 0.12
                and sum(
                    g.weight
                    for g in v.groups
                    if body.vertex_groups[g.group].name.endswith(("Arm", "Forearm"))
                )
                > 0.5
                for v in verts
            ):
                continue
            for i in range(3):
                p, q = verts[i].co, verts[(i + 1) % 3].co
                t0 = (p - start).dot(a)
                t1 = (q - start).dot(a)
                if (t0 - mask) * (t1 - mask) < 0:
                    cross = p.lerp(q, (mask - t0) / (t1 - t0))
                    rad = cross - start - a * mask - center
                    radii.append(rad.length)
        cuff_radius = min(
            (v.co - start - a * (v.co - start).dot(a) - center).length
            for v in sleeve.data.vertices
            if abs((v.co - start).dot(a) - mask) < 0.012
        )
        assert radii and max(radii) < cuff_radius, (
            outfit,
            side,
            max(radii, default=0),
            cuff_radius,
        )
        # Measure the exported outer profile itself: a large middle bulb followed
        # by a pinched cuff must fail even if the skin remains covered.
        sections = {}
        for point in sleeve.data.vertices:
            t = (point.co - start).dot(a)
            if 0.114 < t < 0.216:
                sections.setdefault(round(t, 3), []).append(point.co.copy())
        profile = []
        for t, points in sorted(sections.items()):
            if len(points) < 20:
                continue
            yy = [p.y for p in points]
            vv = [p.dot(v) for p in points]
            radius = max(max(yy) - min(yy), max(vv) - min(vv)) * 0.5
            if radius > 0.059:
                profile.append((t, radius))  # omit the inner return wall
        assert len(profile) >= 5, (outfit, profile)
        assert max(r for _, r in profile) - min(r for _, r in profile) < 0.009, (
            outfit,
            "segmented sleeve",
            profile,
        )
        assert all(b[1] - a0[1] < 0.002 for a0, b in zip(profile, profile[1:])), (
            outfit,
            "flared cuff",
            profile,
        )
        seams.append(
            {
                "outfit": outfit,
                "side": side,
                "skinRadius": max(radii),
                "sleeveRadius": cuff_radius,
                "outerProfile": profile,
            }
        )

# Reapplying the authoring repair must not add a second shell or alter a mesh.
repair = runpy.run_path(
    str(Path(__file__).parents[2] / "art/fairy-garden/doll/fit_cuffs.py")
)["fit_cuffs"]
image_count = len(bpy.data.images)
repair()
repair()
for name, saved in b.items():
    obj = bpy.data.objects[name]
    assert np.array_equal(
        np.array(saved["points"]),
        np.array([obj.matrix_world @ v.co for v in obj.data.vertices]),
    ), name
assert image_count == len(bpy.data.images)

old = image_hashes(before)
new = image_hashes(after)
assert old == new, "Original texture modified"
report = {
    "preservedMeshes": count,
    "maxCoordinateAndMorphDrift": drift,
    "originalTexturesPreserved": len(old),
    "unchangedTextureCount": len(new),
    "finiteMorphs": True,
    "bodyEndpointChecks": panel_checks,
    "idempotent": True,
    "cuffOverlap": seams,
}
open(output, "w").write(json.dumps(report, indent=2))
print(report)
