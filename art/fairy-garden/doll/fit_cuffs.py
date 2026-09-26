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
 shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
 body=bpy.data.objects['DollBody']
 if body.get('fittedWristVersion'):
  raise ValueError('Restore the original body before fitting v2 cuffs')
 body['originalHandVersion']=1
 for name in ('academy','garden','ranger','cardigan'):
  o=bpy.data.objects['outfit_'+name]
  if o.get('fittedCuffVersion',0)>=2:continue
  short=name=='garden';end=.156 if short else .214
  for side,sign in [('left',-1),('right',1)]:
   sleeve=bpy.data.objects['outfit_'+name+'_'+side+'_sleeve'];a=Vector((sign*.095,0,-.19)).normalized();v=a.cross(Vector((0,1,0))).normalized();start=Vector((sign*.153,0,.655))
   # The source forearm is offset from the old sleeve axis. Move the cloth
   # towards it gradually; retain the complete original palm, thumb and wrist.
   center=Vector((0,.01 if sign>0 else .002,0))+v*((-.033 if short else -.025) if sign>0 else (.031 if short else .020))
   for p in sleeve.data.vertices:
    delta=p.co-start;t=delta.dot(a);radial=delta-a*t;r=radial.length
    if r<1e-6:continue
    cuff=max(0,min(1,(t-(end-.075))/.055));cuff=cuff*cuff*(3-2*cuff)
    blend=max(0,min(1,(t-.015)/.11));blend=blend*blend*(3-2*blend)
    extra=(.024 if short else .025)*blend
    if not sleeve.get('fittedCuffVersion'):extra+=.004*cuff
    p.co+=center*blend+radial.normalized()*extra
   P=np.array([p.co[:] for p in sleeve.data.vertices]);sleeve.data.shape_keys.key_blocks['Basis'].data.foreach_set('co',P.ravel())
   for key in ('height','shoulder','waist','flare','build','head'):
    sleeve.data.shape_keys.key_blocks[key].data.foreach_set('co',(P+shape(P,np.ones(len(P)),key,True)).ravel())
   sleeve['fittedCuffVersion']=2
  c=o['skinCoverage'];c['sleeve']=[round(end-.016,3),0,.76,.10];c['armAxis']=[.153,.655,.095,-.19];o['fittedCuffVersion']=2


def main():
 import sys
 src,original,out=sys.argv[sys.argv.index('--')+1:]
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
 restore_original_body(original);fit_cuffs()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)

if __name__=='__main__':main()
