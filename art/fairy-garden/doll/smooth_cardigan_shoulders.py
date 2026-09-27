"""Compatibility entry for the cardigan-only migration; use the shared shoulder fitter."""

from pathlib import Path
import runpy


def smooth_cardigan_shoulders():
    return runpy.run_path(str(Path(__file__).with_name("smooth_shoulders.py")))[
        "smooth_shoulders"
    ](("cardigan",))


def main():
    import bpy, sys

    source, destination, part = sys.argv[sys.argv.index("--") + 1 :]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    smooth_cardigan_shoulders()
    export = runpy.run_path(str(Path(__file__).with_name("split_outfits.py")))["export"]
    export(lambda o: True, destination)
    export(lambda o: o.type == "ARMATURE" or o.get("outfit") == "cardigan", part)


if __name__ == "__main__":
    main()
