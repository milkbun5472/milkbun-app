import sys, json, numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cloth_asset_helpers import snapshot, image_hashes
from mathutils.kdtree import KDTree

before, after, output = sys.argv[sys.argv.index("--") + 1 :]
a = snapshot(before)
b = snapshot(after)
changed = {"outfit_cardigan_" + side + "_sleeve" for side in ("left", "right")}
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
# Preserve the sleeve-to-hand joint and every distal morph, even after Draco reorders vertices.
cuff_count = 0
for name in changed:
    for aa, bb in ((a[name], b[name]), (b[name], a[name])):
        tree = KDTree(len(aa["points"]))
        for i, p in enumerate(aa["points"]):
            tree.insert(p, i)
        tree.balance()
        for i, p in enumerate(bb["points"]):
            if p.z > .50:
                continue
            near = tree.find_range(p, 1e-5)
            assert near, (name, "cuff moved")
            assert any(all(np.max(np.abs(np.array(aa["keys"][k][j])-bb["keys"][k][i])) < 1e-5 for k in aa["keys"]) for _, j, _ in near)
            cuff_count += 1
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
    triangles = np.array(
        [t.vertices[:] for t in obj.data.loop_triangles]
    )
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
# Reapplying the authoring repair must not add a second shell or alter a mesh.
repair = runpy.run_path(
    str(Path(__file__).parents[2] / "art/fairy-garden/doll/smooth_cardigan_shoulders.py")
)["smooth_cardigan_shoulders"]
image_count = len(bpy.data.images)
assert repair() == []
assert repair() == []
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
    "preservedDistalSamples": cuff_count,
}
open(output, "w").write(json.dumps(report, indent=2))
print(report)
