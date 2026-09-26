"""Restore continuous source cloth and separate whole-arm sleeves for C01–C03.
Keep original accessory UVs and pin upper garments to the torso. Reduce only
once source seams have been welded; share rounded sleeve construction with C04.
"""
from pathlib import Path
import bpy,bmesh,runpy,numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
HERE=Path(__file__).resolve().parent
CONFIG={
 'academy':('01',(.32,.27,.07,.06),.27),
 'garden':('02',(.26,.25,.015,.015),.27),
 'ranger':('03',(.485,.455,.01,.01),.02),
}

def restore_other_outfits():
 for outfit,(code,atlas,slot) in CONFIG.items():
  old=bpy.data.objects['outfit_'+outfit]
  if old.get('roundSleeveVersion'):continue
  rig=old.parent;mat=old.data.materials[0];props={k:old[k].to_dict() if hasattr(old[k],'to_dict') else old[k] for k in old.keys()}
  tree=KDTree(len(old.data.polygons));attr=next(a for a in old.data.color_attributes if len({round(d.color[0]*8) for d in a.data})>1);slots=[]
  for f in old.data.polygons:tree.insert(f.center,f.index);slots.append(attr.data[f.loop_indices[0]].color[0])
  tree.balance()
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(HERE/'v2/outfits'/('outfit_c'+code+'.glb')));imported=set(bpy.data.objects)-before
  o=max((o for o in imported if o.type=='MESH'),key=lambda o:len(o.data.vertices));o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity()
  bm=bmesh.new();bm.from_mesh(o.data);uv=bm.loops.layers.uv.active
  for f in bm.faces:
   if max((l[uv].uv-f.loops[0][uv].uv).length for l in f.loops)<1e-5:
    for l in f.loops:l[uv].uv=(atlas[0],atlas[1])

  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
  seen=set();crumbs=[]
  for seed in bm.verts:
   if seed in seen:continue
   comp=[];pending=[seed];seen.add(seed)
   while pending:
    v=pending.pop();comp.append(v)
    for e in v.link_edges:
     other=e.other_vert(v)
     if other not in seen:seen.add(other);pending.append(other)
   if len(comp)<25 and all(abs(v.co.x)>.11 and .39<v.co.z<.64 for v in comp):crumbs.extend(comp)
  if crumbs:bmesh.ops.delete(bm,geom=crumbs,context='VERTS')
  # Sleeve cuts stop above the waist; front pouches and back hoods remain intact.
  for x in [-.135,.135]:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(x,0,0),plane_no=(1,0,0),dist=1e-6)
  remove=[]
  for f in bm.faces:
   c=f.calc_center_median()
   if abs(c.x)>.135 and (.43 if outfit=='garden' else .40)<c.z<.715 and not(c.y<-.10 and c.z<.52 and (outfit=='garden' and c.x<0 or outfit=='ranger' and c.x>0)):remove.append(f)
  bmesh.ops.delete(bm,geom=remove,context='FACES')
  # Close native source cracks and the side cut before decimation.
  patches=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)['faces']
  torso_uv={'academy':(.12,.85),'garden':(.47,.63),'ranger':(.485,.455)}[outfit]
  for f in patches:
   for l in f.loops:l[uv].uv=torso_uv
  bmesh.ops.triangulate(bm,faces=patches)
  sideverts=[v for v in bm.verts if .11<abs(v.co.x)<.15 and -.085<v.co.y<.085 and .44<v.co.z<.69]
  for _ in range(8):bmesh.ops.smooth_vert(bm,verts=sideverts,factor=.4,use_axis_x=True,use_axis_y=True,use_axis_z=True)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  bpy.context.view_layer.objects.active=o
  for m in list(o.modifiers):o.modifiers.remove(m)
  # Keep original detail surfaces; union only the overlapping flat side closures.
  source_mesh=o.data.copy()
  m=o.modifiers.new('Union side closures','REMESH');m.mode='VOXEL';m.voxel_size=.002;m.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=m.name)
  def side_region(p,margin=0):return abs(p.x)>.115-margin and -.09-margin<p.y<.09+margin and .445-margin<p.z<.675+margin
  bm=bmesh.new();bm.from_mesh(o.data)
  bmesh.ops.delete(bm,geom=[f for f in bm.faces if not side_region(f.calc_center_median(),.005)],context='FACES')
  bm.to_mesh(o.data);bm.free()
  side_mesh=o.data
  bm=bmesh.new();bm.from_mesh(source_mesh)
  bmesh.ops.delete(bm,geom=[f for f in bm.faces if side_region(f.calc_center_median())],context='FACES')
  # Side union is a single clean fabric region, so it needs no atlas seams.
  uv=bm.loops.layers.uv.active
  newverts=[bm.verts.new(v.co) for v in side_mesh.vertices]
  for poly in side_mesh.polygons:
   f=bm.faces.new([newverts[i] for i in poly.vertices]);f.smooth=True
   for loop in f.loops:loop[uv].uv=torso_uv
  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
  bm.to_mesh(source_mesh);bm.free();o.data=source_mesh
  # Newly unioned side vertices belong wholly to the body.
  for v in o.data.vertices:
   if not v.groups:o.vertex_groups['body'].add([v.index],1,'REPLACE')

  m=o.modifiers.new('Continuous surface reduction','DECIMATE');m.ratio=min(1,10000/max(1,sum(len(f.vertices)-2 for f in o.data.polygons)));bpy.ops.object.modifier_apply(modifier=m.name)
  # Cargo trousers must clear the actual body at the hip, including slider ends.
  if outfit=='ranger':
   from mathutils.bvhtree import BVHTree
   body=bpy.data.objects['DollBody'];body.data.calc_loop_triangles()
   skin=BVHTree.FromPolygons([v.co for v in body.data.vertices],[tuple(t.vertices) for t in body.data.loop_triangles],all_triangles=True)
   for v in o.data.vertices:
    if .10<v.co.z<.44:
     hit,normal,face,distance=skin.find_nearest(v.co)
     signed=(v.co-hit).dot(normal)
     gap=.027 if v.co.z>.30 else .009
     if signed<gap:v.co+=normal*(gap-signed)
  for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
  color=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  def smooth(a,b,x):
   t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
  for f in o.data.polygons:
   f.material_index=0;f.use_smooth=True;_,j,_=tree.find(f.center)
   for li in f.loop_indices:
    p=o.data.vertices[o.data.loops[li].vertex_index].co
    blend=smooth(.085,.125,abs(p.x))*smooth(.395,.43,p.z)*(1-smooth(.67,.71,p.z))*smooth(-.105,-.075,p.y)
    color.data[li].color=(.02 if blend>.5 else slots[j],blend,0,1)
  o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
  normals=[]
  for li,l in enumerate(o.data.loops):
   p=o.data.vertices[l.vertex_index].co;n=o.data.corner_normals[li].vector.copy()
   blend=smooth(.105,.135,abs(p.x))*smooth(.43,.47,p.z)*(1-smooth(.67,.71,p.z))*smooth(-.10,-.065,p.y)
   normals.append(n.lerp(Vector((1 if p.x>0 else -1,p.y*7,0)).normalized(),blend).normalized())
  o.data.normals_split_custom_set(normals)
  o.data.materials.clear();o.data.materials.append(mat)
  for obj in imported-{o}:bpy.data.objects.remove(obj,do_unlink=True)
  bpy.data.objects.remove(old,do_unlink=True);o.name='outfit_'+outfit;o.parent=rig
  for k,v in props.items():o[k]=v
  # Upper cloth, bag and straps have no arm influence; trouser/dress weights stay authored.
  for v in o.data.vertices:
   if v.co.z>.4 or any(o.vertex_groups[g.group].name.endswith('Arm') and g.weight>.01 for g in v.groups):
    for g in o.vertex_groups:g.remove([v.index])
    o.vertex_groups['body'].add([v.index],1,'REPLACE')
  P=np.array([v.co[:] for v in o.data.vertices]);arm=np.zeros(len(P));shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
  o.shape_key_add(name='Basis')
  for name in ['height','shoulder','waist','flare','build','head']:
   k=o.shape_key_add(name=name);k.value=0;D=shape(P,arm,name,True)
   for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
  m=o.modifiers.new('Rig','ARMATURE');m.object=rig
  # Lower the shoulder crown and tuck the sleeve root beneath the armhole.
  # The entire sleeve retains its volume under the whole-arm rotation.
  profile=[(-.055,.008),(-.045,.021),(-.030,.033),(-.015,.041),(0,.048),(.02,.054),(.04,.058),(.06,.059),(.09,.059),(.115,.058),(.14,.055),(.162,.051),(.178,.047),(.182,.045),(.188,.047),(.208,.046),(.214,.044),(.214,.038),(.196,.038)]
  if outfit=='garden':profile=[(-.055,.008),(-.04,.025),(-.025,.039),(-.01,.048),(.015,.060),(.04,.073),(.07,.076),(.10,.068),(.13,.052),(.14,.046),(.15,.046),(.156,.042),(.156,.035),(.14,.035)]
  runpy.run_path(str(HERE/'round_sleeves.py'))['round_sleeves'](o,profile,atlas,slot,inset=.012)
  o['roundSleeveVersion']=1;o['continuousSurfaceVersion']=1
  o['repairAtlas']=[torso_uv[0]-.015,torso_uv[1]-.015,.03,.03]
  # Torso coverage has a lower boundary so shorts/skirt leave bare legs visible.
  o['skinCoverage']={'torsoAbove':(.30 if outfit=='ranger' else .40),'torsoBelow':.705,'sleeve':[.15 if outfit=='garden' else .205,.46,.705,.10],'armAxis':[.165,.655,.11,-.255]}
  print('RESTORED',outfit,len(o.data.polygons))

def main():
 import sys
 src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src);restore_other_outfits()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
if __name__=='__main__':main()
