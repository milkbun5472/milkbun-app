"""Original clay traveler: authored in Blender from image references.
Blender Z-up, front -Y. All runtime parts use baked coordinates.
Run through export_traveler.py. No external packages required.
"""
import bpy, math, os, json
from mathutils import Vector, Matrix
HERE=os.path.dirname(os.path.abspath(__file__))
S=1.45
LIMITS=dict(height=(.85,1.25),shoulder=(.85,1.2),waist=(.85,1.15),flare=(.78,1.22),build=(.85,1.15),head=(.88,1.1))
LABELS=dict(height='腿长',shoulder='肩宽',waist='腰身',flare='衣摆',build='圆润度',head='头身比')
RIG={'leftArm':[-.185,.875,0],'rightArm':[.185,.875,0],'leftLeg':[-.115,.505,0],'rightLeg':[.115,.505,0]}
CATALOG=json.load(open(os.path.join(HERE,'outfits.json')))

def mat(name,color):
 m=bpy.data.materials.new(name)
 rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)];m.diffuse_color=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color;bs.inputs['Roughness'].default_value=.9;bs.inputs['Specular IOR Level'].default_value=.2
 return m

def mesh(name,verts,faces,material,**tags):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(material);o['part']=name
 for k,v in tags.items():o[k]=v
 for p in d.polygons:p.use_smooth=True
 return o

def ellipsoid(name,center,radii,material,**tags):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=center);o=bpy.context.object;o.name=name;o.scale=radii;o.data.transform(o.matrix_basis);o.matrix_world=Matrix.Identity(4);o.data.materials.append(material);o['part']=name
 for k,v in tags.items():o[k]=v
 for p in o.data.polygons:p.use_smooth=True
 return o

def loft(name,rings,material,**tags):
 n=32;v=[];f=[]
 for z,rx,ry in rings:
  for j in range(n):
   a=j*math.tau/n;fold=1+.012*math.cos(8*a);v.append((rx*math.cos(a)*fold,ry*math.sin(a)*fold,z))
 for i in range(len(rings)-1):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
 f.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))]);return mesh(name,v,f,material,**tags)

def lock(name,points,width,depth,material,**tags):
 """Soft solid leaf-shaped clay lock, broad through its middle, tapered rounded tip."""
 pts=list(map(Vector,points));v=[];f=[];steps=14;sections=8
 def point(t):return pts[0]*(1-t)**3+pts[1]*3*t*(1-t)**2+pts[2]*3*t*t*(1-t)+pts[3]*t**3
 for i in range(steps+1):
  t=i/steps;p=point(t);tan=(point(min(1,t+.001))-point(max(0,t-.001))).normalized();normal=Vector((p.x,p.y-.035,max(.025,p.z-1.23)))
  normal-=tan*normal.dot(tan)
  if normal.length<.001:normal=Vector((0,-1,0))
  normal.normalize();across=tan.cross(normal).normalized();r=max(.015,math.sin(math.pi*(.12+.88*t))**.7)
  for j in range(sections):
   a=j*math.tau/sections;v.append(p+across*(math.cos(a)*width*r)+normal*(math.sin(a)*depth*r))
 for i in range(steps):
  for j in range(sections):a=i*sections+j;b=i*sections+(j+1)%sections;f.append((a,b,b+sections,a+sections))
 f.extend([tuple(reversed(range(sections))),tuple(steps*sections+j for j in range(sections))]);return mesh(name,v,f,material,**tags)

def clothes(base):
 import sculpt_clothes, sys
 return sculpt_clothes.build(sys.modules[__name__],base)

def deform(p,o,key):
 p=p.copy();n=o.get('deformPart',o['part']);head=n.startswith('hair.') or n=='Face';z=p.z
 if key=='height':p.z+=.36*max(0,min(1,(z-.135)/.37))
 elif key=='head' and head:p=Vector((0,.015,.945))+(p-Vector((0,.015,.945)))*2
 elif key=='shoulder' and not head:
  if o.get('rigPart','').endswith('Arm'):p.x+=math.copysign(.185,p.x)
  elif n=='Tunic body' or n.startswith(('Cream','Satchel')):p.x*=1+max(0,min(1,(z-.65)/.22))
 elif key=='waist' and not head and not o.get('rigPart'):
  weight=max(0,1-abs(z-.70)/.22);p.x*=1+weight;p.y*=1+weight*.65
 elif key=='flare' and not head and not o.get('rigPart'):
  weight=max(0,min(1,(.77-z)/.30));p.x*=1+weight;p.y*=1+weight*.45
 elif key=='build' and not head and not n.startswith('Rounded'):
  p.x*=1.65;p.y*=1.55
 elif key=='seated' and o.get('outfit') and not o.get('rigPart') and z<.55:
  weight=min(1,(.55-z)/.20);p.y-=(.55-z)*weight*.9;p.z+=(.55-z)*weight*.68
 return p

def build():
 import fresh_doll, sys
 D=sys.modules[__name__]
 base=fresh_doll.body(D);objs=base+fresh_doll.hairs(D)+clothes(base)
 for o in objs:
  # Retain broad smooth volume with subtle clay facets at polygon boundaries.
  if o.get('part')=='hair.korean' or (o.get('outfit')=='traveler' and o.get('colorSlot')=='cloth'):
   o.data.update()
   smooth=[n.vector.copy() for n in o.data.corner_normals]
   normals=[None]*len(o.data.loops)
   for poly in o.data.polygons:
    for i in poly.loop_indices:normals[i]=(smooth[i]*.76+poly.normal*.24).normalized()
   o.data.normals_split_custom_set(normals)
  basis=o.shape_key_add(name='Basis')
  for key in [*LIMITS,'seated']:
   coords=[deform(v.co,o,key) for v in basis.data]
   if all((v.co-p).length<1e-6 for v,p in zip(basis.data,coords)):continue
   target=o.shape_key_add(name=key);target.slider_min=-1;target.slider_max=1;target.value=0
   for dst,p in zip(target.data,coords):dst.co=p
  o.name=o['part'].replace('hair.','hair_');o['clayReference']=True;o['geometryOrigin']='blender-from-scratch'
 # Rig metadata is authored alongside the geometry, in glTF Y-up coordinates.
 anchor=bpy.data.objects.new('ClayDollRig',None);bpy.context.collection.objects.link(anchor);anchor['dollRig']=RIG
 morphs={}
 for label,xyz in RIG.items():
  p=Vector((xyz[0],-xyz[2],xyz[1]));dummy={'part':'Left sleeve' if label.endswith('Arm') else 'Linen leggings','rigPart':label}
  morphs[label]={}
  for key in LIMITS:
   q=deform(p,dummy,key)-p;morphs[label][key]=[q.x,q.z,-q.y]
 anchor['rigMorphs']=morphs;anchor['style']='clay-2026-09'
 return objs+[anchor]

def export(out):
 objs=build();bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0]
 bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_morph=True,export_morph_normal=False,export_extras=True,export_image_format='WEBP',export_image_quality=86)
 hair=json.load(open(os.path.join(HERE,'hairstyles.json')))
 ends=dict(height=('短一点','长一点'),shoulder=('窄一点','宽一点'),waist=('纤细','丰盈'),flare=('收拢','蓬松'),build=('轻巧','圆润'),head=('小一点','大一点'))
 dims=[dict(key=k,label=LABELS[k],min=v[0],max=v[1],low=ends[k][0],high=ends[k][1]) for k,v in LIMITS.items()]
 with open(os.path.join(os.path.dirname(out),'doll.json'),'w') as f:json.dump(dict(hair=hair,dims=dims,outfits=CATALOG,style='clay-2026-09'),f,ensure_ascii=False,indent=1);f.write('\n')
 with open(os.path.join(os.path.dirname(out),'outfits.mjs'),'w') as f:f.write('// Generated by art/fairy-garden/export_traveler.py.\nexport const OUTFITS = '+json.dumps(CATALOG,ensure_ascii=False)+';\n')
 artout=os.environ.get('DOLL_ART_OUT','/tmp/garden-new-doll');os.makedirs(artout,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(artout,'clay-doll.blend'))
 print('CLAY_EXPORTED',out,os.path.getsize(out))
