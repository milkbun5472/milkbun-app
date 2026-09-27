"""A closed satchel and one continuous shoulder strap for the shared hoodie."""
import bpy,bmesh,runpy
import numpy as np
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).parent
KEYS=('height','shoulder','waist','flare','build','head')

def clean_old_front(cloth):
 # Remove the fused source strap's relief and colour from the cloth atlas.
 mesh=cloth.data;mesh.calc_loop_triangles();im=next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
 W,H=im.size;pixels=np.array(im.pixels[:]).reshape(H,W,4);uv=mesh.uv_layers.active.data
 def weight(P):
  x,y,z=P.T;line=.52-z
  lateral=np.clip((.062-np.abs(x-line))/.018,0,1)
  return lateral*np.clip((z-.425)/.025,0,1)*np.clip((.645-z)/.020,0,1)*np.clip((-y-.060)/.025,0,1)
 mask=np.zeros((H,W));
 for f in mesh.loop_triangles:
  U=np.array([uv[l].uv[:] for l in f.loops])*[W,H];P=np.array([mesh.vertices[v].co[:] for v in f.vertices]);lo=np.maximum(0,np.floor(U.min(0)-1).astype(int));hi=np.minimum([W-1,H-1],np.ceil(U.max(0)+1).astype(int));
  if np.all(weight(P)==0):continue
  X,Y=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));Q=np.stack([X.ravel()+.5,Y.ravel()+.5],1)
  M=np.array([U[1]-U[0],U[2]-U[0]]).T
  if abs(np.linalg.det(M))<1e-9:continue
  A=(Q-U[0])@np.linalg.inv(M).T;B=np.c_[1-A.sum(1),A];inside=np.all(B>=-.03,1);p=B@P;v=weight(p)*inside
  mask[Y.ravel(),X.ravel()]=np.maximum(mask[Y.ravel(),X.ravel()],v)
 # These UV islands are private to the hoodie; dilate into their bake margin.
 for _ in range(3):mask=np.maximum.reduce([mask,np.roll(mask,1,0),np.roll(mask,-1,0),np.roll(mask,1,1),np.roll(mask,-1,1)])
 rgb=pixels[:,:,:3];alpha=mask[:,:,None];rgb[:]=rgb*(1-alpha)+np.array([.82,.753,.71])*alpha
 edited=bpy.data.images.new('Hoodie without fused strap',W,H,alpha=False);edited.pixels.foreach_set(pixels.astype(np.float32).ravel());edited.update()
 import tempfile,os
 fd,path=tempfile.mkstemp(suffix='.jpg');os.close(fd);edited.filepath_raw=path;edited.file_format='JPEG';edited.save();edited.pack();os.unlink(path)
 mat=mesh.materials[0].copy();mesh.materials[0]=mat
 for node in mat.node_tree.nodes:
  if node.type=='TEX_IMAGE' and node.image==im:node.image=edited
 P=np.array([v.co[:] for v in mesh.vertices]);w=weight(P);target=-.080-.09*(.62-P[:,2]);delta=np.maximum(0,target-P[:,1])*w
 for key in mesh.shape_keys.key_blocks:
  for i,v in enumerate(key.data):v.co.y+=delta[i]
 for i,v in enumerate(mesh.vertices):v.co.y+=delta[i]
 mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
 cloth['cleanBagClothVersion']=1

def rebuild_ranger_bag():
 cloth=bpy.data.objects['outfit_ranger']
 if cloth.get('cleanBagVersion'):return
 clean_old_front(cloth)
 pants=bpy.data.objects['outfit_ranger_trousers'];bm=bmesh.new();bm.from_mesh(pants.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z>.33 and ((f.calc_center_median().x>.04 and f.calc_center_median().y<-.085) or (f.calc_center_median().x>.11 and f.calc_center_median().y<-.025))],context='FACES')
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
 uv=bm.loops.layers.uv.active
 reference=min((f for f in bm.faces if f.calc_center_median().x<-.08),key=lambda f:(f.calc_center_median()-Vector((-.12,-.065,.35))).length)
 sample=sum((l[uv].uv for l in reference.loops),Vector((0,0)))/len(reference.loops)
 caps=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)['faces']
 for f in caps:
  for l in f.loops:l[uv].uv=sample
 caps=bmesh.ops.triangulate(bm,faces=caps)['faces']
 bmesh.ops.delete(bm,geom=[f for f in caps if not (f.calc_center_median().x>.09 and f.calc_center_median().y<-.01 and .33<f.calc_center_median().z<.405)],context='FACES')
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(pants.data);bm.free()
 rig=cloth.parent;slot=cloth['slotBase'].to_dict();oldstrap=bpy.data.objects['outfit_ranger_back_strap']
 leather=oldstrap.data.materials[0].copy();leather.name='Ranger clean leather'
 maker=runpy.run_path(str(HERE/'shoes.py'));metal=maker['material']('Ranger muted metal','#a89a7d',.45)
 for name in ('outfit_ranger_front_accessories','outfit_ranger_back_strap'):
  if bpy.data.objects.get(name):bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
 def finish(o,name,mat,dyed=True):
  o.name=name;o.parent=rig;o.data.materials.clear();o.data.materials.append(mat)
  o['outfit']='ranger';o['cleanBagPart']=1
  if dyed:
   o['slotBase']=slot;attr=o.data.color_attributes.new('slot','FLOAT_COLOR','CORNER')
   for c in attr.data:c.color=(.77,0,0,1)
  for f in o.data.polygons:f.use_smooth=True
  o.vertex_groups.new(name='body').add(list(range(len(o.data.vertices))),1,'REPLACE');m=o.modifiers.new('Rig','ARMATURE');m.object=rig
  P=np.array([v.co[:] for v in o.data.vertices]);shape=runpy.run_path(str(HERE/'body_shape.py'))['deform'];o.shape_key_add(name='Basis')
  for key in KEYS:
   k=o.shape_key_add(name=key);k.value=0;k.data.foreach_set('co',(P+shape(P,np.zeros(len(P)),key,True)).ravel())
  return o
 def box(name,center,size,radius,mat,dyed=True):
  bpy.ops.mesh.primitive_cube_add(size=1,location=center);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  bevel=o.modifiers.new('Soft leather corners','BEVEL');bevel.width=radius;bevel.segments=5;bpy.ops.object.modifier_apply(modifier=bevel.name)
  o.data.transform(o.matrix_world);o.matrix_world.identity()
  return finish(o,name,mat,dyed)
 box('outfit_ranger_bag',(.125,-.136,.434),(.139,.070,.145),.022,leather)
 box('outfit_ranger_bag_flap',(.125,-.175,.476),(.133,.018,.069),.012,leather)
 box('outfit_ranger_bag_clasp',(.125,-.187,.450),(.025,.006,.016),.004,metal,False)
 # Strap ends embed in opposite top corners of the bag. The intervening band
 # runs over the shoulder and around the OUTSIDE of the torso, including sides.
 points=[(.065,-.140,.492),(.020,-.128,.505),(-.007,-.120,.530),(-.037,-.109,.560),(-.064,-.101,.590),(-.090,-.072,.621),(-.104,-.038,.645),(-.095,.025,.650),(-.084,.078,.638),(-.054,.118,.614),(-.012,.125,.575),(.035,.128,.538),(.078,.128,.503),(.124,.112,.471),(.157,.083,.463),(.174,.035,.463),(.177,-.025,.466),(.175,-.089,.480),(.184,-.137,.491)]
 normals=[(0,-1,0)]*6+[(0,-.7,.7),(0,0,1),(0,.7,.7)]+[(0,1,0)]*5+[(.6,.8,0),(1,.2,0),(1,0,0),(.7,-.7,0),(0,-1,0)]
 path=[];ns=[]
 for i in range(len(points)-1):
  a,b,c,d=[Vector(points[max(0,min(len(points)-1,j))]) for j in (i-1,i,i+1,i+2)]
  for k in range(6):
   t=k/6;p=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);n=Vector(normals[i]).lerp(Vector(normals[i+1]),t).normalized()
   path.append(p);ns.append(n)
 path.append(Vector(points[-1]));ns.append(Vector(normals[-1]));verts=[];faces=[]
 section=[(-.018,-.001),(-.019,0),(-.019,.003),(-.018,.004),(.018,.004),(.019,.003),(.019,0),(.018,-.001)]
 for i,p in enumerate(path):
  tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized();across=tangent.cross(ns[i]).normalized();normal=across.cross(tangent).normalized()
  for w,h in section:verts.append(tuple(p+across*w+normal*h))
 for i in range(len(path)-1):
  for j in range(8):a=i*8+j;b=i*8+(j+1)%8;faces.append((a,b,b+8,a+8))
 faces.extend([tuple(reversed(range(8))),tuple((len(path)-1)*8+j for j in range(8))])
 mesh=bpy.data.meshes.new('Continuous satchel strap');mesh.from_pydata(verts,[],faces);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 o=bpy.data.objects.new('outfit_ranger_back_strap',mesh);bpy.context.collection.objects.link(o);finish(o,'outfit_ranger_back_strap',leather)
 o['backStrapVersion']=2;o['continuousStrapVersion']=1;cloth['cleanBagVersion']=1
 if 'textureSlots' in cloth:del cloth['textureSlots']
 return o

def main():
 import sys
 src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src);rebuild_ranger_bag()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
if __name__=='__main__':main()
