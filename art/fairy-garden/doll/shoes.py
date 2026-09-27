"""Shared, authored low-poly footwear for the three outfits without source shoes.

Closed rounded lofts replace normal-offset copies of the scanned feet. Each material
is a separate skinned mesh: leather retains the existing boots dye, while soles,
socks and small fastenings keep their own colours. Migration and assembly use this
same builder; all parts use the body's six shape formulas and leg weights.
"""
import bpy,bmesh,math,runpy
import numpy as np
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).parent
KEYS=('height','shoulder','waist','flare','build','head')
STYLES={'academy':('#4a3a32','loafer'),'garden':('#3b2b25','mary-jane'),'ranger':('#5a4a3e','lace-boot')}

def material(name,hex,rough=.65):
 m=bpy.data.materials.new(name);m.use_nodes=True
 c=[int(hex[i:i+2],16)/255 for i in (1,3,5)]
 c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=rough
 return m

class Surface:
 def __init__(self):self.verts=[];self.faces=[]
 def loft(self,rings,n=40,cap=True):
  start=len(self.verts)
  for cx,cy,z,rx,ry in rings:
   for j in range(n):
    a=j*2*math.pi/n;c=math.cos(a);s=math.sin(a)
    # Slightly squared toe and heel, with a soft continuous outline.
    self.verts.append((cx+rx*math.copysign(abs(c)**.82,c),cy+ry*math.copysign(abs(s)**.82,s),z(a) if callable(z) else z))
  for k in range(len(rings)-1):
   for j in range(n):
    a=start+k*n+j;b=start+k*n+(j+1)%n;self.faces.append((a,b,b+n,a+n))
  if cap:self.faces.extend([tuple(start+j for j in reversed(range(n))),tuple(start+(len(rings)-1)*n+j for j in range(n))])
 def tube(self,points,radius=.002,n=8):
  start=len(self.verts)
  for i,p in enumerate(points):
   p=Vector(p);t=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
   t.normalize();u=t.cross(Vector((0,0,1)))
   if u.length<.01:u=t.cross(Vector((0,1,0)))
   u.normalize();v=t.cross(u)
   for j in range(n):self.verts.append(tuple(p+radius*(u*math.cos(j*math.tau/n)+v*math.sin(j*math.tau/n))))
  for i in range(len(points)-1):
   for j in range(n):
    a=start+i*n+j;b=start+i*n+(j+1)%n;self.faces.append((a,b,b+n,a+n))
  self.faces.extend([tuple(start+j for j in reversed(range(n))),tuple(start+(len(points)-1)*n+j for j in range(n))])

def build_shoes(oid,rig,colour=None):
 colour=colour or STYLES[oid][0]
 surfaces={k:Surface() for k in ('leather','sole','welt','detail','sock')}
 boot=oid=='ranger';mary=oid=='garden'
 for side,cx in [(-1,-.105),(1,.09)]:
  sole=surfaces['sole'];upper=surfaces['leather'];welt=surfaces['welt'];detail=surfaces['detail'];sock=surfaces['sock']
  sole.loft([(cx,-.021,-.003,.084,.118),(cx,-.021,.001,.09,.124),(cx,-.021,.015,.09,.124),(cx,-.021,.02,.085,.12)])
  welt.loft([(cx,-.021,.016,.089,.123),(cx,-.021,.019,.09,.124),(cx,-.021,.023,.086,.12)])
  top=.150 if boot else .096
  profile=[(cx,-.021,.020,.086,.120),(cx,-.021,.033,.09,.122),(cx,-.020,.049,.088,.119),(cx,-.010,.062,.083,.105)]
  if mary:
   rim=lambda a:.083+.018*math.sin(a)
   profile += [(cx,.022,lambda a:rim(a)-.005,.079,.083),(cx,.022,rim,.078,.082),(cx,.022,lambda a:rim(a)-.004,.073,.077)]
  else:
   profile += [(cx,.020,.080,.079,.083),(cx,.023,top,.079,.082),(cx,.023,top+.003,.076,.079),(cx,.023,top-.007,.072,.075)]
  upper.loft(profile)
  # The sock remains inside the opening; intersecting near-identical shells
  # create jagged cream patches, so its lower rings have deliberate clearance.
  sock.loft([(cx,.024,.058,.065,.060),(cx,.024,.103,.074,.077),(cx,.024,.13 if not boot else .150,.081,.084),(cx,.024,.138,.079,.083),(cx,.024,.145,.076,.080)])
  # Fine welt seam sits on the lip, separated from the leather upper.
  if boot:
   for z,y in [(.085,-.071),(.106,-.061),(.127,-.061),(.141,-.061)]:
    detail.tube([(cx-.028,y,z-.004),(cx,y-.003,z+.002),(cx+.028,y,z+.008)],.003)
    detail.tube([(cx+.028,y,z-.004),(cx,y-.003,z+.002),(cx-.028,y,z+.008)],.003)
   # Soft padded collar.
   welt.loft([(cx,.023,.141,.080,.083),(cx,.023,.150,.081,.084),(cx,.023,.155,.078,.081)])
  else:
   # A broad curved strap, not a flat floating block. Loafer saddle sits lower.
   pts=[(cx+.076*t,.024-(.078 if mary else .085)*max(0,1-abs(t)**(2/.82))**(.82/2),.084 if mary else .078) for t in np.linspace(-1,1,21)]
   # Ribbon has real thickness and follows the instep.
   start=len(upper.verts)
   for x,yy,z in pts:
    width=.003 if mary else .006;thickness=.013 if mary else .005
    upper.verts.extend([(x,yy-width,z),(x,yy+width,z),(x,yy+width,z+thickness),(x,yy-width,z+thickness)])
   for i in range(len(pts)-1):
    for j in range(4):a=start+i*4+j;b=start+i*4+(j+1)%4;upper.faces.append((a,b,b+4,a+4))
   upper.faces.extend([(start+3,start+2,start+1,start),tuple(start+(len(pts)-1)*4+j for j in range(4))])
   if mary:
    # Small champagne buckle at the outer end of each strap.
    x=cx+side*.073;y=-.012;z=.093
    detail.tube([(x-.008,y-.012,z),(x+.008,y-.012,z),(x+.008,y+.012,z),(x-.008,y+.012,z),(x-.008,y-.012,z)],.0025)
   else:
    # Subtle moc-toe stitch line and a short saddle slit.
    detail.tube([(cx+.086*math.copysign(abs(math.cos(a))**.82,math.cos(a)),-.013+.111*math.copysign(abs(math.sin(a))**.82,math.sin(a)),.058) for a in np.linspace(math.pi,math.tau,25)],.0015)
    detail.tube([(cx-.022,-.070,.083),(cx+.022,-.070,.083)],.0015)
 mats={'leather':material('Shoe leather '+oid,colour),'sole':material('Shoe sole '+oid,'#312822'),'welt':material('Shoe welt '+oid,'#a6896b' if boot else '#715340'),'detail':material('Shoe fastenings '+oid,'#c7b188' if mary else '#c7bba4'),'sock':material('Shoe socks '+oid,'#e8dfcc')}
 objects=[];deform=runpy.run_path(str(HERE/'body_shape.py'))['deform']
 for part,surface in surfaces.items():
  if not surface.verts:continue
  name='outfit_'+oid+'_shoes'+('' if part=='leather' else '_'+part)
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(surface.verts,[],surface.faces);mesh.update()
  bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
  o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=rig;o.data.materials.append(mats[part])
  for f in mesh.polygons:f.use_smooth=True
  # Each foot contributes the same topology. Assign by construction range,
  # including the right sole's x=0 vertex (a sign test leaves it unbound).
  half=len(mesh.vertices)//2
  for offset,side in [(0,'left'),(half,'right')]:o.vertex_groups.new(name=side+'Leg').add(list(range(offset,offset+half)),1,'REPLACE')
  P=np.array([v.co[:] for v in mesh.vertices]);o.shape_key_add(name='Basis')
  for key in KEYS:
   k=o.shape_key_add(name=key);k.value=0;D=deform(P,np.zeros(len(P)),key,True)
   for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
  m=o.modifiers.new('Rig','ARMATURE');m.object=rig
  o['outfit']=oid;o['footwearVersion']=1;o['footwearStyle']=STYLES[oid][1]
  if part=='leather':o['colorSlot']='boots';o['coversFeetBelow']=.14;o['weldedShoeVersion']=1
  objects.append(o)
 return objects

def replace_shoes(outfits=tuple(STYLES)):
 for oid in outfits:
  old=bpy.data.objects.get('outfit_'+oid+'_shoes')
  if old and old.get('footwearVersion')==1:continue
  rig=old.parent if old else bpy.data.objects['DollBody'].parent
  for o in list(bpy.data.objects):
   if o.name.startswith('outfit_'+oid+'_shoes'):bpy.data.objects.remove(o,do_unlink=True)
  build_shoes(oid,rig)

def main():
 import sys
 src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src);replace_shoes()
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_skins=True,export_animations=False,export_morph=True,export_morph_normal=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_draco_color_quantization=8,export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
if __name__=='__main__':main()
