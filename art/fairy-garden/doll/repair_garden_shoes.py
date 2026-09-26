"""Weld the foot before offsetting it, keeping a clean shoe rim and sole."""
import bpy,bmesh,runpy,numpy as np
from pathlib import Path
from mathutils import Vector

def repair_garden_shoes():
 old=bpy.data.objects['outfit_garden_shoes']
 if old.get('weldedShoeVersion'):return
 body=bpy.data.objects['DollBody'];s=body.copy();s.data=body.data.copy();bpy.context.collection.objects.link(s)
 bm=bmesh.new();bm.from_mesh(s.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00005)
 bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,.105),plane_no=(0,0,1),clear_outer=True,dist=1e-6)
 bm.normal_update();layers=list(bm.verts.layers.shape.values())
 for v in bm.verts:
  p=v.co.copy();q=p+v.normal*(.012 if p.z>.012 else .006)
  if abs(p.z-.105)<1e-5:q.z=.105
  if q.z<.004:q.z=-.003
  delta=q-p;v.co=q
  for layer in layers:v[layer]+=delta
 for _ in range(3):bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(s.data);bm.free()
 # The reduced body also has T-junction cracks. Union this plain shoe shell
 # before reapplying the same six shape formulas; no authored texture is involved.
 s.shape_key_clear()
 bpy.context.view_layer.objects.active=s
 for m in list(s.modifiers):s.modifiers.remove(m)
 m=s.modifiers.new('Closed shoe shell','REMESH');m.mode='VOXEL';m.voxel_size=.002;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
 bm=bmesh.new();bm.from_mesh(s.data)
 bmesh.ops.smooth_vert(bm,verts=list(bm.verts),factor=.4,use_axis_x=True,use_axis_y=True,use_axis_z=True)
 for v in bm.verts:
  if v.co.z<0:v.co.z=-.003
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(s.data);bm.free()
 m=s.modifiers.new('Shoe surface budget','DECIMATE');m.ratio=min(1,4500/max(1,sum(len(f.vertices)-2 for f in s.data.polygons)));bpy.ops.object.modifier_apply(modifier=m.name)
 for g in list(s.vertex_groups):s.vertex_groups.remove(g)
 for sign,side in [(-1,'left'),(1,'right')]:s.vertex_groups.new(name=side+'Leg').add([v.index for v in s.data.vertices if v.co.x*sign>0],1,'REPLACE')
 P=np.array([v.co[:] for v in s.data.vertices]);shape=runpy.run_path(str(Path(__file__).with_name('body_shape.py')))['deform'];s.shape_key_add(name='Basis')
 for key in ['height','shoulder','waist','flare','build','head']:
  k=s.shape_key_add(name=key);k.value=0;D=shape(P,np.zeros(len(P)),key,True)
  for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
 m=s.modifiers.new('Rig','ARMATURE');m.object=s.parent
 s.data.materials.clear();s.data.materials.append(old.data.materials[0])
 for a in list(s.data.color_attributes):s.data.color_attributes.remove(a)
 for f in s.data.polygons:f.material_index=0;f.use_smooth=True
 s.data.normals_split_custom_set([(0,0,0)]*len(s.data.loops))
 for k in list(s.keys()):del s[k]
 for k in old.keys():s[k]=old[k].to_dict() if hasattr(old[k],'to_dict') else old[k]
 bpy.data.objects.remove(old,do_unlink=True);s.name='outfit_garden_shoes';s['weldedShoeVersion']=1;s['coversFeetBelow']=.10
