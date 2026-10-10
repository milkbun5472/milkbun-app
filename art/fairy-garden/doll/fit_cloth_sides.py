"""Close academy side seams and slim the cardigan silhouette, retaining atlas,
accessories, six body morphs, cuffs and existing elbow/knee runtime binding.
Usage: Blender -b --python fit_cloth_sides.py -- academy|cardigan in.glb out.glb
"""
import sys, bpy, bmesh, numpy as np
from pathlib import Path
HERE=Path(__file__).resolve().parent

def repair_academy(o):
 if o.get('closedSideVersion'):return
 # A former voxel side union has branched boundaries, so holes_fill alone
 # cannot make it continuous. Sew a continuous, overlapping gusset under each arm. Keep the original
 # collar, lining and atlas details; no global retopology or recolouring.
 import math,runpy
 from mathutils import Vector
 shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
 profile=[(.391,.170,.098),(.405,.170,.098),(.42,.164,.099),(.44,.157,.097),(.46,.150,.096),(.48,.144,.096),(.50,.140,.096),(.525,.136,.095),(.55,.135,.093),(.575,.130,.083),(.595,.119,.072),(.612,.105,.061)]
 for sign,side in [(-1,'left'),(1,'right')]:
  vertices=[];faces=[];N=25
  for z,rx,ry in profile:
   for j in range(N):
    angle=-math.pi*.36+math.pi*.72*j/(N-1)
    vertices.append((sign*rx*math.sqrt(math.cos(angle)),ry*math.copysign(math.sqrt(abs(math.sin(angle))),math.sin(angle)),z))
  for i in range(len(profile)-1):
   for j in range(N-1):
    quad=(i*N+j,i*N+j+1,(i+1)*N+j+1,(i+1)*N+j)
    faces.append(quad if sign>0 else tuple(reversed(quad)))
  mesh=bpy.data.meshes.new('ContinuousVestSide');mesh.from_pydata(vertices,[],faces);mesh.update()
  panel=bpy.data.objects.new('outfit_academy_'+side+'_side',mesh);bpy.context.collection.objects.link(panel);panel.parent=o.parent
  for key in ['outfit','slotBase','repairAtlas']:
   panel[key]=o[key].to_dict() if hasattr(o[key],'to_dict') else o[key]
  panel['closedSideVersion']=1;mesh.materials.append(o.data.materials[0].copy());mesh.uv_layers.new(name='UVMap');mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  for f in mesh.polygons:
   f.use_smooth=True
   for li in f.loop_indices:
    vi=mesh.loops[li].vertex_index;mesh.uv_layers.active.data[li].uv=(.12,.85);mesh.color_attributes['Color'].data[li].color=(0,1,0,1)
  group=panel.vertex_groups.new(name='body');group.add(list(range(len(vertices))),1,'REPLACE');mod=panel.modifiers.new('Rig','ARMATURE');mod.object=o.parent
  panel.shape_key_add(name='Basis');P=np.array(vertices)
  for key in ['height','shoulder','waist','flare','build','head']:
   k=panel.shape_key_add(name=key);k.value=0;D=shape(P,np.zeros(len(P)),key,True)
   for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
 o['closedSideVersion']=1
 print('ACADEMY sewn side panels',len(vertices)*2)

def fit_cardigan(o):
 if o.get('sideFitVersion'):return
 # The cream rabbit bag and diagonal strap keep their original coordinates.
 # Front decoration is retained while the back and side knit lose excess depth.
 keys=o.data.shape_keys.key_blocks
 basis=np.array([v.co[:] for v in keys['Basis'].data]);P=basis.copy()
 ss=lambda x:(lambda t:t*t*(3-2*t))(np.clip(x,0,1))
 factor=ss((P[:,2]-.385)/.07)*(1-ss((P[:,2]-.645)/.07))
 front=ss((P[:,1]+.11)/.065)
 weight=factor*front
 # Protect the cream pouch, including its hip-facing wall; its geometry and
 # atlas samples remain intact while the surrounding pink knit gets thinner.
 image=next(n.image for n in o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
 W,H=image.size;tex=np.array(image.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2);uv=o.data.uv_layers.active.data
 for face in o.data.polygons:
  c=face.center
  if not(0<c.x<.23 and c.y<-.035 and .35<c.z<.58):continue
  colors=[tex[min(H-1,max(0,int(uv[li].uv.y*H))),min(W-1,max(0,int(uv[li].uv.x*W)))] for li in face.loop_indices]
  r,g,b=np.median(colors,axis=0)
  if (g-b)>max(r-g,.005)*.32:
   weight[list(face.vertices)]=0
 depth=1-.22*weight
 for key in keys:
  for i,v in enumerate(key.data):v.co.y*=float(depth[i])
 o['sideFitVersion']=1
 # Cuff and shoulder roots retain their placement; narrow the central sleeve
 # cross-section around the authored arm axis, easing to zero at both ends.
 for side,sign in [('left',-1),('right',1)]:
  s=bpy.data.objects['outfit_cardigan_'+side+'_sleeve']
  axis=np.array([sign*.095,0,-.19]);axis/=np.linalg.norm(axis);start=np.array([sign*.153,0,.655])
  for key in s.data.shape_keys.key_blocks:
   for v in key.data:
    # Transform the morph point about the equivalent authored axis for that key.
    # Body formula has rigid shoulder/height/build shifts for the whole sleeve.
    origin=start.copy()
    if key.name=='height':origin[2]+=.25
    elif key.name=='shoulder':origin[0]+=sign*.072
    elif key.name=='build':origin[0]+=sign*.0297
    q=np.array(v.co[:])-origin;t=float(q@axis);radial=q-axis*t
    w=float(ss((t+.01)/.05)*(1-ss((t-.12)/.05)))
    v.co=tuple(origin+axis*t+radial*(1-.13*w))
  s['sideFitVersion']=1
 print('CARDIGAN depth factor',float(depth.min()))

def fit_cloth_sides():
 for outfit,fix in [('academy',repair_academy),('cardigan',fit_cardigan)]:
  o=bpy.data.objects.get('outfit_'+outfit)
  if o is not None:fix(o)

if __name__=='__main__':
 oid,src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
 (repair_academy if oid=='academy' else fit_cardigan)(bpy.data.objects['outfit_'+oid])
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=16,export_draco_normal_quantization=10,export_draco_texcoord_quantization=14,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
