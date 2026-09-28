"""Fit the sleeves around the original hands; never squeeze the skin to fit cloth."""
import bpy,runpy,numpy as np
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).parent


def restore_original_body(source):
 """Migrate v1's altered skin from the last untouched body, retaining its rig."""
 old=bpy.data.objects['DollBody']
 if not old.get('fittedWristVersion'):return
 rig=old.parent;old.name='DiscardedWristFit';before=set(bpy.data.objects)
 bpy.ops.import_scene.gltf(filepath=str(source));imported=set(bpy.data.objects)-before
 body=next(o for o in imported if o.name=='DollBody')
 if body.get('fittedWristVersion'):raise ValueError('Source must contain the original, unaltered hands')
 body.parent=rig
 for mod in body.modifiers:
  if mod.type=='ARMATURE':mod.object=rig
 for obj in imported-{body}:bpy.data.objects.remove(obj,do_unlink=True)
 bpy.data.objects.remove(old,do_unlink=True)


def fit_cuffs():
 """One gently tapered sleeve, without the inflated middle or cinched cuff."""
 shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
 build=runpy.run_path(str(HERE/'round_sleeves.py'))['round_sleeves']
 body=bpy.data.objects['DollBody']
 if body.get('fittedWristVersion'):
  raise ValueError('Restore the original body before fitting sleeves')
 body['originalHandVersion']=1
 for name in ('academy','garden','ranger','cardigan','jacket','suit','tee'):
  cloth=bpy.data.objects.get('outfit_'+name)   # jacket is attached later by add_outfit.py, which calls this again
  if not cloth or cloth.get('fittedCuffVersion',0)>=3:continue
  short=name in ('garden','tee');end=.156 if short else .214   # T恤（2026-09-27）也是到手肘上的短袖
  old=[bpy.data.objects['outfit_'+name+'_'+side+'_sleeve'] for side in ('left','right')]
  template=old[0]
  # Keep each garment's original clean fabric patch, tint slot and material.
  uv=np.array([p.uv[:] for p in template.data.uv_layers.active.data]);lo=uv.min(0);hi=uv.max(0)
  atlas=(*lo,*(hi-lo))
  # Imported glTFs may expose an all-white display layer before the dye slot.
  # Select the encoded slot, just as the shared runtime does.
  slot=next(a.data[0].color[0] for a in template.data.color_attributes if a.data[0].color[0]<.9)
  for sleeve in old:sleeve.name+='Discarded'
  # Radius rises only beneath the armhole, then tapers continuously to the hem.
  # There is no elbow bulb, wrist pinch, or second raised cuff ring.
  rings=[(-.055,.004),(-.045,.018),(-.030,.030),(-.015,.042),(0,.052),(.02,.060),(.04,.0645),(.065,.064),(.09,.063),(.115,.0625)]
  rings+=([(.14,.062),(.15,.0615),(.156,.061),(.156,.058),(.14,.058)] if short else
          [(.14,.062),(.162,.0615),(.178,.061),(.188,.061),(.208,.0605),(.214,.060),(.214,.057),(.196,.057)])
  build(template,[(t,r/.87) for t,r in rings],atlas,slot,inset=.012)
  for side,sign in [('left',-1),('right',1)]:
   sleeve=bpy.data.objects['outfit_'+name+'_'+side+'_sleeve']
   a=Vector((sign*.095,0,-.19)).normalized();v=a.cross(Vector((0,1,0))).normalized();start=Vector((sign*.153,0,.655))
   center=Vector((0,.01 if sign>0 else .002,0))+v*((-.033 if short else -.025) if sign>0 else (.031 if short else .020))
   for p in sleeve.data.vertices:
    t=(p.co-start).dot(a);blend=max(0,min(1,(t+.015)/.12));blend=blend*blend*(3-2*blend)
    p.co+=center*blend
   P=np.array([p.co[:] for p in sleeve.data.vertices]);sleeve.data.shape_keys.key_blocks['Basis'].data.foreach_set('co',P.ravel())
   for key in ('height','shoulder','waist','flare','build','head'):
    sleeve.data.shape_keys.key_blocks[key].data.foreach_set('co',(P+shape(P,np.ones(len(P)),key,True)).ravel())
   sleeve['fittedCuffVersion']=3;sleeve['continuousSleeveProfile']=1
  for sleeve in old:bpy.data.objects.remove(sleeve,do_unlink=True)
  c=cloth['skinCoverage'];c['sleeve']=[round(end-.016,3),0,.76,.10];c['armAxis']=[.153,.655,.095,-.19];cloth['fittedCuffVersion']=3

 # Apply the shared shoulder slope after the shared cuff fit, including
 # already-fitted assets loaded for a later outfit migration.
 runpy.run_path(str(HERE/'smooth_shoulders.py'))['smooth_shoulders']()

def main():
 import sys
 src,original,out=sys.argv[sys.argv.index('--')+1:]
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
 restore_original_body(original);fit_cuffs()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)

if __name__=='__main__':main()
