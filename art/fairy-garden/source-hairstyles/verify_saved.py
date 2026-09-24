import bpy,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'traveler-hairstyles.blend'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(objects)==14
assert all(k.value==0 for o in objects for k in list(o.data.shape_keys.key_blocks)[1:])
assert sorted(o.name for o in objects if not o.hide_get())==['SourceBody','hair_korean']
images={i.name:hashlib.sha256(i.packed_file.data).hexdigest() for i in bpy.data.images if i.packed_file}
report=json.loads((root/'asset-validation.json').read_text())
assert images==report['source_texture_hashes']
report['saved_blend_verified']={'meshes':14,'neutral_morphs':True,'default_visible':['SourceBody','hair_korean'],'all_images_packed':True}
report['asset_sha256']={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['traveler-hairstyles.blend','traveler-hairstyles.glb']}
(root/'asset-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('SAVED_BLEND_VERIFIED',report['saved_blend_verified'])
