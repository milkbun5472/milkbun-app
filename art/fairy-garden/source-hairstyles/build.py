"""Build source-preserving hair variants in Blender, then export morphable GLB."""
import json,math,os,sys,hashlib
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from source_split import split_source
from face_study import split_original_head,make_face
from pack_glb import pack
from hair_geometry import build_style,Sculpt,linear
OUT=Path(os.environ.get('SOURCE_HAIR_OUT','/tmp/garden-source-hair'));OUT.mkdir(parents=True,exist_ok=True)
DIMS=json.loads((HERE.parent/'source-base/sliders.json').read_text())['dims']
CATALOG=json.loads((HERE.parent/'hairstyles.json').read_text())
cache=OUT/'split-source.blend'
cache_key=hashlib.sha256((HERE/'source_split.py').read_bytes()+(HERE.parent/'source-base/traveler-sliders.blend').read_bytes()).hexdigest()
cache_manifest=OUT/'split-source.sha256'
if not cache.exists() or not cache_manifest.exists() or cache_manifest.read_text()!=cache_key or os.environ.get('REBUILD_SPLIT'):
    bpy.ops.wm.open_mainfile(filepath=str(HERE.parent/'source-base/traveler-sliders.blend'))
    original=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    body,hair=split_source(original)
    bpy.data.objects.remove(original,do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(cache))
    cache_manifest.write_text(cache_key)
else:bpy.ops.wm.open_mainfile(filepath=str(cache))
body=bpy.data.objects['SourceBody'];hair=bpy.data.objects['hair_korean']
for obj in (body,hair):
    assert all(key.value==0 for key in list(obj.data.shape_keys.key_blocks)[1:])

def morphs(obj):
    obj.shape_key_add(name='Basis')
    for dim in DIMS:
        key=obj.shape_key_add(name=dim['key']);key.slider_min=dim['min']-1;key.slider_max=dim['max']-1;key.value=0
        for v in key.data:
            p=v.co.copy()
            if dim['key']=='height':v.co.z+=.36
            elif dim['key']=='head':v.co+=p-Vector((0,.018,.962))
    obj['hairSliderConvention']='Whole hairstyle follows head isotropically, including long ends.'

# A concealed round scalp supports the forehead exposed by middle/side parts.
# It sits behind the unchanged eyes, cheeks, jaw and ears. It is not a new face.
body,original_head=split_original_head(body)
scalp=make_face()
morphs(scalp)
if os.environ.get('REUSE_HAIR'):
    # Explicit artist iteration: recompute only scalp while retaining the last
    # exported hair geometry and its keys. Never used for the final full build.
    import shutil
    hair_cache=OUT/'hair-iteration-cache.blend'
    shutil.copyfile(OUT/'traveler-hairstyles.blend',hair_cache)
    with bpy.data.libraries.load(str(hair_cache),link=False) as (source,target):
        target.objects=['hair_'+style for style in CATALOG if style!='korean']
    new=target.objects
    for obj in new:bpy.context.collection.objects.link(obj)
else:
    new=[build_style(style) for style in CATALOG if style!='korean']
    for obj in new:morphs(obj)
objects=[body,original_head,hair,scalp]+new
report=json.loads(body['sourcePartitionAudit'])
report.pop('forehead_policy',None)
report.update({'styles':list(CATALOG),'new_hair_meshes':len(new),'hairline_vertices':int(scalp['hairlineVertices']),
               'dimensions':DIMS,'face_policy':'Original head retained for M01; replacement styles use a smooth head with painted eyes and blush.','scope':'Hairstyle and body preview. Clothing separation and animation are not implemented.'})
(OUT/'asset-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for obj in objects:obj.hide_set(False)
sc=bpy.context.scene
sc.render.engine='CYCLES';sc.cycles.samples=20;sc.cycles.use_denoising=True
sc.render.resolution_x=600;sc.render.resolution_y=760;sc.render.resolution_percentage=100
sc.render.film_transparent=False
sc.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.66,.60,.52,1)
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
sc.view_settings.view_transform='AgX'
sc.camera.data.type='ORTHO';sc.camera.data.ortho_scale=1.42

def choose(style):
    for o in [hair]+new:
        o.hide_render=o.name!='hair_'+style;o.hide_set(o.hide_render)
    scalp.hide_render=style=='korean';scalp.hide_set(scalp.hide_render)
    original_head.hide_render=style!='korean';original_head.hide_set(original_head.hide_render)

def view(angle):
    sc.camera.location=(5*math.sin(angle),-5*math.cos(angle),1.29)
    sc.camera.rotation_euler=(Vector((0,0,1.29))-sc.camera.location).to_track_quat('-Z','Y').to_euler()

sc['hairStyleCatalog']=json.dumps(CATALOG,ensure_ascii=False)
choose('korean');view(0)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'traveler-hairstyles.blend'))
if not os.environ.get('NO_EXPORT'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.hide_set(False);o.select_set(True);o.hide_render=False
    bpy.context.view_layer.objects.active=body
    bpy.ops.export_scene.gltf(filepath=str(OUT/'traveler-hairstyles.glb'),export_format='GLB',use_selection=True,export_morph=True,export_morph_normal=True,export_extras=True,export_image_format='AUTO')
    report['lossless_buffer_sharing']=pack(OUT/'traveler-hairstyles.glb')
    (OUT/'asset-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
styles=os.environ.get('RENDER_STYLES',','.join(CATALOG)).split(',')
for style in styles:
    if not style:continue
    choose(style)
    for label,angle in [('front',0),('side',math.pi/2),('back',math.pi)]:
        view(angle);sc.render.filepath=str(OUT/f'{style}-{label}.png');bpy.ops.render.render(write_still=True)
print('HAIR_BUILD_COMPLETE',flush=True)
