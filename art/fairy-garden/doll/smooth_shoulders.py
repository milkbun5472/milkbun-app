"""Remove garment shoulder crowns without changing cuffs or hands.

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


OUTFITS = ("academy", "garden", "ranger", "cardigan", "jacket", "suit")


def smooth_shoulders(outfits=OUTFITS):
    deform = runpy.run_path(str(HERE / "body_shape.py"))["deform"]
    changed = []
    for outfit in outfits:
        for side, sign in [("left", -1), ("right", 1)]:
            sleeve = bpy.data.objects.get("outfit_" + outfit + "_" + side + "_sleeve")
            if not sleeve or sleeve.get("slopedShoulderVersion") == 1:
                continue
            assert sleeve.get("fittedCuffVersion") == 3 or (
                outfit == "suit" and sleeve.get("roundSleeveVersion") == 1
            ), "Fit the continuous sleeve first"
            axis = Vector((sign * 0.095, 0, -0.19)).normalized()
            across = axis.cross(Vector((0, 1, 0))).normalized()
            start = Vector((sign * 0.153, 0, 0.655))
            short = outfit == "garden"
            center = Vector((0, 0.01 if sign > 0 else 0.002, 0)) + across * (
                (-0.033 if short else -0.025)
                if sign > 0
                else (0.031 if short else 0.020)
            )
            if outfit == "suit" and sleeve.get("fittedCuffVersion") != 3:
                center = Vector((0, 0, 0))
            inset = Vector((-sign * 0.012, 0, -0.012 * 0.35))
            inset_projection = -inset.dot(axis)
            moved = []
            for vertex in sleeve.data.vertices:
                # Invert round_sleeves' inset; the fit_cuffs center shift is radial.
                raw = (vertex.co - start).dot(axis)
                t = (
                    (raw + inset_projection) / (1 + inset_projection / 0.16)
                    if raw < 0.16
                    else raw
                )
                if t < 0:
                    t = raw + inset_projection
                if t >= 0.115:
                    continue
                fade = 1 - np.clip(t / 0.16, 0, 1)
                blend = float(np.clip((t + 0.015) / 0.12, 0, 1))
                blend = blend * blend * (3 - 2 * blend)
                origin = start + axis * t + center * blend + inset * fade
                radial = vertex.co - origin
                reduction = float(
                    np.interp(
                        t,
                        [
                            -0.055,
                            -0.045,
                            -0.030,
                            -0.015,
                            0,
                            0.02,
                            0.04,
                            0.065,
                            0.09,
                            0.115,
                        ],
                        [0, 0.002, 0.005, 0.008, 0.009, 0.011, 0.0115, 0.007, 0.003, 0],
                    )
                )
                if outfit == "suit" and sleeve.get("fittedCuffVersion") != 3:
                    # C06 retains its original narrower cuff. Match the sloped root
                    # to that sleeve, tapering the correction to zero at .115.
                    reduction = float(
                        np.interp(
                            t,
                            [
                                -0.055,
                                -0.047,
                                -0.030,
                                -0.010,
                                0.015,
                                0.04,
                                0.065,
                                0.09,
                                0.115,
                            ],
                            [
                                0,
                                0.0141,
                                0.01937,
                                0.01681,
                                0.01229,
                                0.00916,
                                0.00616,
                                0.00329,
                                0,
                            ],
                        )
                    )
                if radial.length and reduction > 0:
                    vertex.co -= radial.normalized() * reduction
                    moved.append(vertex.index)
            points = np.array([sleeve.data.vertices[i].co[:] for i in moved])
            keys = sleeve.data.shape_keys.key_blocks
            for i, p in zip(moved, points):
                keys["Basis"].data[i].co = p
            for name in ("height", "shoulder", "waist", "flare", "build", "head"):
                positions = points + deform(points, np.ones(len(points)), name, True)
                for i, p in zip(moved, positions):
                    keys[name].data[i].co = p
            # Imported GLBs carry normals from the old bulge; let Blender recompute.
            sleeve.data.normals_split_custom_set([(0, 0, 0)] * len(sleeve.data.loops))
            sleeve["slopedShoulderVersion"] = 1
            changed.append(sleeve.name)
    return changed


def main():
    import sys

    source, destination, parts = sys.argv[sys.argv.index("--") + 1 :]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    changed = smooth_shoulders()
    export = runpy.run_path(str(HERE / "split_outfits.py"))["export"]
    export(lambda o: True, destination)
    Path(parts).mkdir(parents=True, exist_ok=True)
    for outfit in OUTFITS:
        if any(name.startswith("outfit_" + outfit + "_") for name in changed):
            export(
                lambda o: o.type == "ARMATURE" or o.get("outfit") == outfit,
                str(Path(parts) / (outfit + ".glb")),
            )


if __name__ == "__main__":
    main()
