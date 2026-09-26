"""Restore continuous source cloth and separate whole-arm sleeves for C01–C03.
Keep original accessory UVs and pin upper garments to the torso. Reduce only
once source seams have been welded; share rounded sleeve construction with C04.
"""
from pathlib import Path
import bpy,bmesh,runpy,numpy as np
from mathutils import Vector,Matrix
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
  weights=KDTree(len(old.data.vertices));weight_rows=[]
  for v in old.data.vertices:weights.insert(v.co,v.index);weight_rows.append({old.vertex_groups[g.group].name:g.weight for g in v.groups})
  weights.balance()
  tree=KDTree(len(old.data.polygons));attr=next(a for a in old.data.color_attributes if len({round(d.color[0]*8) for d in a.data})>1);slots=[]
  for f in old.data.polygons:tree.insert(f.center,f.index);slots.append(attr.data[f.loop_indices[0]].color[0])
  tree.balance()
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(HERE/'v2/outfits'/(('hunyuan-c02-shell' if outfit=='garden' else 'outfit_c'+code)+'.glb')));imported=set(bpy.data.objects)-before
  o=max((o for o in imported if o.type=='MESH'),key=lambda o:len(o.data.vertices));o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity()
  if outfit=='garden':
   # C02 must start before skin conformation: that step collapsed the collar and
   # lining into one another. Placement matches the authored skin_outfit recipe.
   P=np.array([v.co[:] for v in o.data.vertices]);c=(P.min(0)+P.max(0))/2
   o.data.transform(Matrix.Translation(Vector((-c[0],-c[1],-P[:,2].min()))));o.data.transform(Matrix.Diagonal((.58,.58*1.2,.58,1)));o.data.transform(Matrix.Translation(Vector((0,0,.185))))
   g=o.vertex_groups.new(name='body');g.add(list(range(len(o.data.vertices))),1,'REPLACE')
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
  cut=.12 if outfit=='garden' else .135
  for x in [-cut,cut]:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(x,0,0),plane_no=(1,0,0),dist=1e-6)
  remove=[]
  for f in bm.faces:
   c=f.calc_center_median()
   bag=c.z<.52 and (outfit=='garden' and c.x<0 and c.y<-.065 or outfit=='ranger' and c.x>0 and c.y<-.10)
   sleeve=abs(c.x)>cut and (.43 if outfit=='garden' else .40)<c.z<(.675 if outfit=='garden' else .715)
   cuff=outfit=='garden' and abs(c.x)>.175 and .375<c.z<.68
   if (sleeve or cuff) and not bag:remove.append(f)
  bmesh.ops.delete(bm,geom=remove,context='FACES')
  if outfit=='garden':
   seen=set();parts=[]
   for seed in bm.verts:
    if seed in seen:continue
    part=[];stack=[seed];seen.add(seed)
    while stack:
     v=stack.pop();part.append(v)
     for e in v.link_edges:
      w=e.other_vert(v)
      if w not in seen:seen.add(w);stack.append(w)
    parts.append(part)
   largest=max(parts,key=len)
   bmesh.ops.delete(bm,geom=[v for part in parts if part is not largest for v in part],context='VERTS')
  # Close native source cracks and the side cut before decimation.
  patches=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)['faces']
  torso_uv={'academy':(.12,.85),'garden':(.47,.63),'ranger':(.485,.455)}[outfit]
  for f in patches:
   for l in f.loops:l[uv].uv=torso_uv
  bmesh.ops.triangulate(bm,faces=patches)
  armhole_hulls=[]
  if outfit=='garden':
   # One outer armhole closure: nested lining loops must not create overlapping caps.
   for sign in [-1,1]:
    pts=sorted(set((round(v.co.y,6),round(v.co.z,6)) for v in bm.verts if abs(v.co.x-sign*cut)<.0001 and .445<v.co.z<.677))
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lo=[];hi=[]
    for p in pts:
     while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
     lo.append(p)
    for p in reversed(pts):
     while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
     hi.append(p)
    hull=lo[:-1]+hi[:-1]
    armhole_hulls.append((sign,hull))
  sideverts=[v for v in bm.verts if .11<abs(v.co.x)<.15 and -.085<v.co.y<.085 and .44<v.co.z<.69]
  for _ in range(0 if outfit=='garden' else 8):bmesh.ops.smooth_vert(bm,verts=sideverts,factor=.4,use_axis_x=True,use_axis_y=True,use_axis_z=True)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  bpy.context.view_layer.objects.active=o
  for m in list(o.modifiers):o.modifiers.remove(m)
  if outfit!='garden':
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
  if outfit=='garden':
   # Add the closure AFTER reduction; long flat triangles interpolate waist/shoulder
   # morphs through the inner cloth. A dense surface follows the same body formula.
   bm=bmesh.new();bm.from_mesh(o.data);uv=bm.loops.layers.uv.active
   bmesh.ops.delete(bm,geom=[f for f in bm.faces if all(abs(abs(v.co.x)-cut)<.0002 for v in f.verts) and .43<f.calc_center_median().z<.68],context='FACES')
   for sign,hull in armhole_hulls:
    vs=[bm.verts.new((sign*(cut+.002),y,z)) for y,z in hull]
    f=bm.faces.new(vs);f.smooth=True
    for l in f.loops:l[uv].uv=torso_uv
    triangles=bmesh.ops.triangulate(bm,faces=[f])['faces']
    edges=list({e for f in triangles for e in f.edges})
    bmesh.ops.subdivide_edges(bm,edges=edges,cuts=8,use_grid_fill=True)
   bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
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
  if outfit=='garden':
   im=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image);W,H=im.size;tex=np.array(im.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2);uvs=o.data.uv_layers.active.data
  for f in o.data.polygons:
   f.material_index=0;f.use_smooth=True;_,j,_=tree.find(f.center)
   face_slot=slots[j]
   if outfit=='garden':
    U=np.array([uvs[li].uv[:] for li in f.loop_indices]);C=np.median(tex[np.clip((U[:,1]*H).astype(int),0,H-1),np.clip((U[:,0]*W).astype(int),0,W-1)],0);lum=C@[.2126,.7152,.0722]
    face_slot=.27 if lum>.68 or (lum>.43 and max(C)-min(C)<.08) else .02
   for li in f.loop_indices:
    p=o.data.vertices[o.data.loops[li].vertex_index].co
    blend=smooth(.085,.125,abs(p.x))*smooth(.395,.43,p.z)*(1-smooth(.67,.71,p.z))*smooth(-.105,-.075,p.y)
    if outfit=='garden' and face_slot==.27:blend=0
    color.data[li].color=(.02 if blend>.5 else face_slot,blend,0,1)
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
  if outfit=='garden':
   for v in o.data.vertices:
    if v.co.z>=.4:continue
    _,wi,_=weights.find(v.co)
    for g in o.vertex_groups:g.remove([v.index])
    leg={name:w for name,w in weight_rows[wi].items() if name in ('leftLeg','rightLeg')}
    leg['body']=1-sum(leg.values())
    for name,w in leg.items():(o.vertex_groups.get(name) or o.vertex_groups.new(name=name)).add([v.index],w,'REPLACE')
  # Upper cloth, bag and straps have no arm influence; trouser/dress weights stay authored.
  for v in o.data.vertices:
   if v.co.z>.4 or any(o.vertex_groups[g.group].name.endswith('Arm') and g.weight>.01 for g in v.groups):
    for g in o.vertex_groups:g.remove([v.index])
    o.vertex_groups['body'].add([v.index],1,'REPLACE')
  P=np.array([v.co[:] for v in o.data.vertices]);arm=np.zeros(len(P));shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
  o.shape_key_add(name='Basis')
  for name in ['height','shoulder','waist','flare','build','head']:
   k=o.shape_key_add(name=name);k.value=0;D=shape(P,arm,name,'garden' if outfit=='garden' else True)
   for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
  m=o.modifiers.new('Rig','ARMATURE');m.object=rig
  # Lower the shoulder crown and tuck the sleeve root beneath the armhole.
  # The entire sleeve retains its volume under the whole-arm rotation.
  profile=[(-.055,.008),(-.045,.021),(-.030,.033),(-.015,.041),(0,.048),(.02,.054),(.04,.058),(.06,.059),(.09,.059),(.115,.058),(.14,.055),(.162,.051),(.178,.047),(.182,.045),(.188,.047),(.208,.046),(.214,.044),(.214,.038),(.196,.038)]
  if outfit=='garden':profile=[(-.055,.008),(-.04,.021),(-.025,.032),(-.01,.039),(.015,.047),(.04,.050),(.07,.050),(.10,.048),(.13,.045),(.14,.044),(.15,.044),(.156,.042),(.156,.035),(.14,.035)]
  runpy.run_path(str(HERE/'round_sleeves.py'))['round_sleeves'](o,profile,atlas,slot,inset=.012)
  o['roundSleeveVersion']=1;o['continuousSurfaceVersion']=1
  o['repairAtlas']=[torso_uv[0]-.015,torso_uv[1]-.015,.03,.03]
  # Torso coverage has a lower boundary so shorts/skirt leave bare legs visible.
  o['skinCoverage']={'torsoAbove':(.30 if outfit=='ranger' else .40),'torsoBelow':.705,'sleeve':[.15 if outfit=='garden' else .205,.46,.705,.10],'armAxis':[.165,.655,.11,-.255]}
  if outfit=='garden':o['cleanDressVersion']=1;o['textureSlots']='garden'
  if outfit=='garden':runpy.run_path(str(HERE/'repair_garden_shoes.py'))['repair_garden_shoes']()
  print('RESTORED',outfit,len(o.data.polygons))

def main():
 import sys
 src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src);restore_other_outfits()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
if __name__=='__main__':main()
