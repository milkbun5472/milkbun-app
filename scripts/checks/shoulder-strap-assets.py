"""Verify dye repair assets preserve unrelated meshes, morphs and source textures."""

import sys, json, numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cloth_asset_helpers import snapshot, image_hashes, flipped_areas, assert_preserved

before, after, output = sys.argv[sys.argv.index("--") + 1 :]
import bpy,itertools,runpy
catalog=json.loads((Path(__file__).parents[2]/"apps/fairy-garden/doll.json").read_text())
a = snapshot(before)
original_flips = flipped_areas(bpy.data.objects['outfit_ranger_back_strap'],catalog)
b = snapshot(after)
changed = {"outfit_ranger_back_strap"}

count,drift=assert_preserved(a,b,changed)

obj=bpy.data.objects['outfit_ranger_back_strap']
assert all(abs(k.value)<1e-8 for k in list(obj.data.shape_keys.key_blocks)[1:])
# Existing source triangles include tiny inverted folds at extreme sliders.
# Shoulder fitting must not add inverted surface area at any endpoint.
new_flips=flipped_areas(obj,catalog)
assert np.all(new_flips <= original_flips + 1e-7), (original_flips.tolist(),new_flips.tolist())
endpoints=len(new_flips)
assert obj.get("shoulderStrapFitVersion") == 1
assert max(v.co.z for v in obj.data.vertices) > .67
assert image_hashes(before)==image_hashes(after)
root=Path(__file__).parents[2]/'art/fairy-garden/doll'
counts={n:[v.co[:] for v in bpy.data.objects[n].data.vertices] for n in changed}
runpy.run_path(str(root/'fit_ranger_strap.py'))['fit_ranger_strap']()
assert counts=={n:[v.co[:] for v in bpy.data.objects[n].data.vertices] for n in changed}
assert bpy.data.objects['DollBody']['originalHandVersion']==1
result={'unchangedMeshes':count,'maximumDrift':drift,'unchangedTextures':len(image_hashes(after)),'bodyEndpoints':endpoints,'idempotent':True}
Path(output).write_text(json.dumps(result,indent=2));print(result)
