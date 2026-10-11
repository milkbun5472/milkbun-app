"""Complete the hoodie's crossbody strap behind the hood and around the bag side.

The authored C03 shell has only the front section. This closed ribbon continues
that section, uses the same accent dye as the bag, and follows torso morphs rather
than either arm. Shared by assembly and one-time migration of an existing doll.
"""
import bpy,runpy
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).parent
NAME='outfit_ranger_back_strap'

def restore_ranger_strap():
 cloth=bpy.data.objects['outfit_ranger']
 if not cloth.get('cleanBagVersion'):cloth['textureSlots']='ranger'
 if bpy.data.objects.get(NAME):return
 cloth=bpy.data.objects['outfit_ranger'];rig=cloth.parent
 cloth.data.calc_loop_triangles();tree=BVHTree.FromPolygons([v.co for v in cloth.data.vertices],[tuple(f.vertices) for f in cloth.data.loop_triangles],all_triangles=True)
 # Shoulder continuation is tucked underneath the hood. Back rays fit the
 # existing sweatshirt instead of assuming a flat back; the hood stays on top.
 points=[(-.095,-.060,.623),(-.104,-.048,.650),(-.085,.008,.650),(-.080,.070,.638)]
 normals=[(0,-1,0),(0,-.65,.76),(0,0,1),(0,.7,.7)]
 for i in range(17):
  t=i/16;x=-.070+.200*t;z=.630-.185*t
  hit,_,_,_=tree.ray_cast(Vector((x,.5,z)),Vector((0,-1,0)))
  y=min(hit.y,.10 if z>.60 else .122) if hit else .115
  points.append((x,y+.006,z));normals.append((0,1,0))
 points.extend([(.138,.075,.443),(.142,.02,.437),(.139,-.04,.430),(.120,-.125,.422)])
 normals.extend([(.65,.76,0),(1,0,0),(.8,-.6,0),(0,-1,0)])
 # The shared ribbon keeps the hoodie's original path, section and taper.
 ribbon=runpy.run_path(str(HERE/'strap_ribbon.py'))['strap_ribbon']
 section=[(-.016,-.001),(-.018,0),(-.018,.003),(-.016,.004),(.016,.004),(.018,.003),(.018,0),(.016,-.001)]
 o=ribbon(NAME,points,normals,section,rig)
 mesh=o.data;verts=[v.co[:] for v in mesh.vertices]
 # Match the original dark front strap, not the wardrobe accent's lighter base.
 im=next(n.image for n in cloth.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image);W,H=im.size;pixels=np.array(im.pixels[:]).reshape(H,W,4);uv=cloth.data.uv_layers.active.data;colors=[]
 for f in cloth.data.polygons:
  p=f.center
  if p.y<-.09 and -.10<p.x<.07 and .55<p.z<.66:
   for li in f.loop_indices:
    u=uv[li].uv;c=pixels[min(H-1,max(0,int(u.y*H))),min(W-1,max(0,int(u.x*W))),:3]
    if .015<float(c.mean())<.13:colors.append(c)
 assert colors,'Find the original bag leather before matching its continuation'
 mat=bpy.data.materials.new('Ranger bag strap leather');mat.use_nodes=True;bs=mat.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*np.median(colors,axis=0)**1.5,1);bs.inputs['Roughness'].default_value=.85;mesh.materials.append(mat)
 attr=mesh.color_attributes.new('slot','FLOAT_COLOR','CORNER')
 for loop in attr.data:loop.color=(.77,0,0,1)
 o['outfit']='ranger';o['slotBase']=cloth['slotBase'].to_dict();o['backStrapVersion']=1
 o.vertex_groups.new(name='body').add(list(range(len(verts))),1,'REPLACE');m=o.modifiers.new('Rig','ARMATURE');m.object=rig
 P=np.array(verts);deform=runpy.run_path(str(HERE/'body_shape.py'))['deform'];o.shape_key_add(name='Basis')
 for key in ('height','shoulder','waist','flare','build','head'):
  k=o.shape_key_add(name=key);k.value=0;D=deform(P,np.zeros(len(P)),key,True)
  for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
 return o

def main():
 import sys
 src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src);restore_ranger_strap()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
if __name__=='__main__':main()
