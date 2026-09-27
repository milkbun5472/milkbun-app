"""Split the full doll (all outfits) into what the app downloads on demand (她 2026-09-26：按需加载).
- apps/fairy-garden/doll.glb: body, rig, HeadAnchor and hair -- no clothes;
- apps/fairy-garden/outfits/<id>.glb: that outfit's meshes skinned to the same bone names, plus the
  armature so the skin is valid; traveler.mjs rebinds them to each avatar's own bones by name.
The full doll stays the authoring master (MASTER): every migration (add_outfit.py, fit_cuffs.py, ...)
reads and writes that file, then this script refreshes the app files.
Run: python3 -c "import sys,runpy;sys.argv=['x'];runpy.run_path('split_outfits.py',run_name='__main__')"
"""
import bpy,os
HERE=os.path.dirname(os.path.abspath(__file__))
MASTER=os.path.join(HERE,'v2','doll-full.glb')
APP=os.path.join(HERE,'..','..','..','apps','fairy-garden')
EXPORT=dict(export_format='GLB',use_selection=True,export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=MASTER)

def outfit_ids():
    return sorted({o['outfit'] for o in bpy.data.objects if o.type=='MESH' and o.get('outfit')})

def export(keep,out):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:o.select_set(keep(o))
    bpy.ops.export_scene.gltf(filepath=out,**EXPORT)
    print('wrote',os.path.relpath(out,HERE),os.path.getsize(out)//1024,'KB')

def split():
    load();ids=outfit_ids()
    os.makedirs(os.path.join(APP,'outfits'),exist_ok=True)
    export(lambda o:not o.get('outfit'),os.path.join(APP,'doll.glb'))
    for oid in ids:
        export(lambda o:o.type=='ARMATURE' or o.get('outfit')==oid,os.path.join(APP,'outfits',oid+'.glb'))
    stale=[f for f in os.listdir(os.path.join(APP,'outfits')) if f.endswith('.glb') and f[:-4] not in ids]
    for f in stale:os.remove(os.path.join(APP,'outfits',f))
    return ids

if __name__=='__main__':
    split()
