"""Restore C03 from its unpainted closed source, keeping accessories and clean hems."""
import bpy,bmesh,runpy,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
HERE=Path(__file__).parent

def clean_hoodie():
 old=bpy.data.objects['outfit_ranger']
 if old.get('cleanHoodieVersion'):
  runpy.run_path(str(HERE/'clean_ranger_edges.py'))['clean_ranger_edges']();return
 rig=old.parent;mat=old.data.materials[0];props={k:old[k].to_dict() if hasattr(old[k],'to_dict') else old[k].to_list() if hasattr(old[k],'to_list') else old[k] for k in old.keys()}
 # Keep the already fitted trousers and their source UVs, shoes and leg morphs.
 pants=old.copy();pants.data=old.data.copy();pants.name='outfit_ranger_trousers';bpy.context.collection.objects.link(pants)
 bm=bmesh.new();bm.from_mesh(pants.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z>=.397 or (f.calc_center_median().x>.065 and f.calc_center_median().y<-.115 and f.calc_center_median().z>.34)],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(pants.data);bm.free()
 for k in list(pants.keys()):del pants[k]
 pants['outfit']='ranger';pants['slotBase']=props['slotBase'];pants['retainedTrousersVersion']=1
 accessories=old.copy();accessories.data=old.data.copy();accessories.name='outfit_ranger_front_accessories';bpy.context.collection.objects.link(accessories)
 im=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image);W,H=im.size;pixels=np.array(im.pixels[:]).reshape(H,W,4);tex=pixels[:,:,:3]**(1/2.2)
 bm=bmesh.new();bm.from_mesh(accessories.data);uv=bm.loops.layers.uv.active;remove=[]
 for f in bm.faces:
  p=f.calc_center_median();U=np.array([l[uv].uv[:] for l in f.loops]);C=np.median(tex[np.clip((U[:,1]*H).astype(int),0,H-1),np.clip((U[:,0]*W).astype(int),0,W-1)],0)
  if not ((p.x>.07 and p.y<-.095 and .345<p.z<.515) or (p.y<-.065 and .35<p.z<.72 and max(C)<.60 and max(C)-min(C)<.20)):remove.append(f)
 bmesh.ops.delete(bm,geom=remove,context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003)
 seen=set();scraps=[]
 for v in bm.verts:
  if v in seen:continue
  part=[];stack=[v];seen.add(v)
  while stack:
   w=stack.pop();part.append(w)
   for e in w.link_edges:
    q=e.other_vert(w)
    if q not in seen:seen.add(q);stack.append(q)
  if len(part)<15:scraps.extend(part)
 bmesh.ops.delete(bm,geom=scraps,context='VERTS');bm.to_mesh(accessories.data);bm.free()
 for k in list(accessories.keys()):del accessories[k]
 for attr in accessories.data.color_attributes:
  for c in attr.data:c.color=(.77,0,0,1)
 accessories['outfit']='ranger';accessories['slotBase']=props['slotBase'];accessories['textureSlots']='ranger';accessories['retainedAccessoryVersion']=1
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(HERE/'v2/outfits/hunyuan-c03-shell.glb'));imported=set(bpy.data.objects)-before
 o=max((o for o in imported if o.type=='MESH'),key=lambda o:len(o.data.vertices));o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity()
 P=np.array([v.co[:] for v in o.data.vertices]);c=(P.min(0)+P.max(0))/2;o.data.transform(Matrix.Translation(Vector((-c[0],-c[1],-P[:,2].min()))));o.data.transform(Matrix.Diagonal((.63,.63*1.3,.63,1)));o.data.transform(Matrix.Translation(Vector((0,0,.06))))
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,.385),plane_no=(0,0,1),dist=1e-6);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<.385],context='FACES');bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
 for x in [-.13,.13]:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(x,0,0),plane_no=(1,0,0),dist=1e-6)
 uv=bm.loops.layers.uv.active;remove=[]
 im=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image);W,H=im.size;tex=np.array(im.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2)
 for f in bm.faces:
  p=f.calc_center_median();U=np.array([l[uv].uv[:] for l in f.loops]);C=np.median(tex[np.clip((U[:,1]*H).astype(int),0,H-1),np.clip((U[:,0]*W).astype(int),0,W-1)],0);bag=p.y<-.065 and .35<p.z<.715 and max(C)<.43 and max(C)-min(C)<.16
  if bag or (p.x>.065 and p.y<-.10 and .35<p.z<.52) or (abs(p.x)>.13 and .39<p.z<.715 or abs(p.x)>.175 and .375<p.z<.715):remove.append(f)
 bmesh.ops.delete(bm,geom=remove,context='FACES')
 # Keep the connected garment; severed old sleeve scraps are not accessories.
 seen=set();parts=[]
 for v in bm.verts:
  if v in seen:continue
  part=[];stack=[v];seen.add(v)
  while stack:
   w=stack.pop();part.append(w)
   for e in w.link_edges:
    q=e.other_vert(w)
    if q not in seen:seen.add(q);stack.append(q)
  parts.append(part)
 largest=max(parts,key=len);bmesh.ops.delete(bm,geom=[v for p in parts if p is not largest for v in p],context='VERTS')
 patches=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)['faces']
 for f in patches:
  for l in f.loops:l[uv].uv=(.485,.455)
 bmesh.ops.triangulate(bm,faces=patches)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 bpy.context.view_layer.objects.active=o
 for m in list(o.modifiers):o.modifiers.remove(m)
 m=o.modifiers.new('Continuous hoodie budget','DECIMATE');m.ratio=min(1,16000/max(1,sum(len(f.vertices)-2 for f in o.data.polygons)));bpy.ops.object.modifier_apply(modifier=m.name)
 # Rebuild the underarm wall as one rounded cloth volume, under the original
 # collar, pocket and bag, rather than leaving the old sleeve caps as islands.
 import math
 bm=bmesh.new();bm.from_mesh(o.data);uv=bm.loops.layers.uv.active;rings=[];N=96
 for z,rx,front,back in [(.392,.14,-.075,.09),(.402,.154,-.088,.111),(.425,.156,-.088,.113),(.48,.151,-.082,.11),(.55,.148,-.077,.106),(.62,.144,-.072,.10),(.665,.133,-.060,.088),(.682,.115,-.047,.071)]:
  ring=[]
  for j in range(N):
   a=j*2*math.pi/N;c=math.cos(a);q=math.sin(a);x=(rx-.006)*math.copysign(abs(c)**.5,c);y=(front+back)/2+((back-front)/2-.018*max(0,1-abs(x)/.12))*math.copysign(abs(q)**.5,q);ring.append(bm.verts.new((x,y,z)))
  rings.append(ring)
 for i in range(len(rings)-1):
  for j in range(N):
   f=bm.faces.new((rings[i][j],rings[i][(j+1)%N],rings[i+1][(j+1)%N],rings[i+1][j]))
   for l in f.loops:l[uv].uv=(.485,.455)
 for ring in (list(reversed(rings[0])),rings[-1]):
  f=bm.faces.new(ring)
  for l in f.loops:l[uv].uv=(.485,.455)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 # Union the cut's nested boundary surfaces before giving the side a smooth seam.
 source=o.copy();source.data=o.data.copy();bpy.context.collection.objects.link(source)
 m=o.modifiers.new('Closed cloth union','REMESH');m.mode='VOXEL';m.voxel_size=.0018;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
 bm=bmesh.new();bm.from_mesh(o.data)
 side=[v for v in bm.verts if abs(v.co.x)>.112 and -.09<v.co.y<.105 and .385<v.co.z<.71]
 for _ in range(12):bmesh.ops.smooth_vert(bm,verts=side,factor=.5,use_axis_x=True,use_axis_y=True,use_axis_z=True)
 bm.to_mesh(o.data);bm.free()
 m=o.modifiers.new('Cloth surface budget','DECIMATE');m.ratio=min(1,9500/max(1,sum(len(f.vertices)-2 for f in o.data.polygons)));bpy.ops.object.modifier_apply(modifier=m.name)
 o.data.uv_layers.new(name='UVMap')
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.003);bpy.ops.object.mode_set(mode='OBJECT')
 source.data.materials.clear();source.data.materials.append(mat.copy());sm=source.data.materials[0]
 mixattr=source.data.color_attributes.new('SideCloth','FLOAT_COLOR','CORNER')
 def ramp(a,b,x):
  t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
 for loop in source.data.loops:
  p=source.data.vertices[loop.vertex_index].co;blend=ramp(.09,.125,abs(p.x))*ramp(-.11,-.077,p.y)*(1-ramp(.105,.135,p.y))*ramp(.375,.405,p.z)*(1-ramp(.66,.70,p.z));mixattr.data[loop.index].color=(blend,blend,blend,1)
 image=next(n.image for n in sm.node_tree.nodes if n.type=='TEX_IMAGE' and n.image);sm.node_tree.nodes.clear();texnode=sm.node_tree.nodes.new('ShaderNodeTexImage');texnode.image=image;em=sm.node_tree.nodes.new('ShaderNodeEmission');output=sm.node_tree.nodes.new('ShaderNodeOutputMaterial');vc=sm.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='SideCloth';mix=sm.node_tree.nodes.new('ShaderNodeMixRGB');mix.inputs[2].default_value=tuple([((float(c)+.055)/1.055)**2.4*.80 for c in pixels[int(.455*H),int(.485*W)][:3]]+[1]);sm.node_tree.links.new(vc.outputs['Color'],mix.inputs[0]);sm.node_tree.links.new(texnode.outputs['Color'],mix.inputs[1]);sm.node_tree.links.new(mix.outputs[0],em.inputs['Color']);sm.node_tree.links.new(em.outputs[0],output.inputs[0])
 mat=mat.copy();o.data.materials.clear();o.data.materials.append(mat);baked=bpy.data.images.new('Clean hoodie atlas',1024,1024,alpha=False)
 target=mat.node_tree.nodes.new('ShaderNodeTexImage');target.image=baked;mat.node_tree.nodes.active=target
 source.select_set(True);bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=1;bpy.context.scene.render.bake.use_selected_to_active=True;bpy.context.scene.render.bake.cage_extrusion=.018;bpy.context.scene.render.bake.max_ray_distance=.04;bpy.context.scene.render.bake.margin=8
 bpy.ops.object.bake(type='EMIT')
 import tempfile,os
 fd,path=tempfile.mkstemp(suffix='.jpg');os.close(fd);baked.filepath_raw=path;baked.file_format='JPEG';baked.save();baked.pack();os.unlink(path)
 for node in mat.node_tree.nodes:
  if node.type=='TEX_IMAGE':node.image=baked
 bpy.data.objects.remove(source,do_unlink=True)
 # The bag is retained separately; remove the white closure left where its
 # old fused volume was cut, keeping the cloth wall behind it.
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().x>.065 and f.calc_center_median().y<-.105 and .35<f.calc_center_median().z<.53],context='FACES');bm.to_mesh(o.data);bm.free()
 o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
 for g in list(o.vertex_groups):o.vertex_groups.remove(g)
 for name in ('body','leftLeg','rightLeg'):o.vertex_groups.new(name=name)
 o.vertex_groups['body'].add(list(range(len(o.data.vertices))),1,'REPLACE')
 # The baked cloth atlas has continuous UVs; accessories retain their own atlas.
 for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
 attr=o.data.color_attributes.new('slot','FLOAT_COLOR','CORNER')
 for f in o.data.polygons:
  f.material_index=0;f.use_smooth=True
  for li in f.loop_indices:
   p=o.data.vertices[o.data.loops[li].vertex_index].co;attr.data[li].color=(.52 if p.z<.385 else .02,0,0,1)
 o.data.materials.clear();o.data.materials.append(mat)
 for obj in imported-{o}:bpy.data.objects.remove(obj,do_unlink=True)
 bpy.data.objects.remove(old,do_unlink=True);o.name='outfit_ranger';o.parent=rig
 for k,v in props.items():o[k]=v
 if 'repairAtlas' in o:del o['repairAtlas']
 o['cleanHoodieVersion']=1;o['textureSlots']='ranger';o['skinCoverage']['torsoAbove']=.30
 P=np.array([v.co[:] for v in o.data.vertices]);shape=runpy.run_path(str(HERE/'body_shape.py'))['deform'];o.shape_key_add(name='Basis')
 for key in ('height','shoulder','waist','flare','build','head'):
  k=o.shape_key_add(name=key);k.value=0;D=shape(P,np.zeros(len(P)),key,True)
  for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
 m=o.modifiers.new('Rig','ARMATURE');m.object=rig
 runpy.run_path(str(HERE/'clean_ranger_edges.py'))['clean_ranger_edges']()

def main():
 import sys
 src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src);clean_hoodie()
 runpy.run_path(str(HERE/'fit_cuffs.py'))['fit_cuffs']()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
if __name__=='__main__':main()
