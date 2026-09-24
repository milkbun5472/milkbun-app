"""Reference clay traveler: segment the supplied GLB, sculpt interchangeable hair/clothes.
Blender Z-up, front -Y. Source stays immutable; all runtime parts use baked coordinates.
Run through export_traveler.py. No external packages beyond Blender's numpy.
"""
import bpy, math, os, json, numpy as np
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

def source_parts():
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=os.path.join(HERE,'clay-reference.glb'))
 src=next(o for o in bpy.data.objects if o.type=='MESH');src.data.transform(src.matrix_world);src.matrix_world=Matrix.Identity(4);d=src.data
 material=src.data.materials[0];image=next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name and 'roughness' not in n.image.name)
 w,h=image.size;pixels=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
 # One 1K source texture; retain baked facial details and cloth shading. Neutralize
 # the texture per dye region, so runtime colors remain independent and predictable.
 groups={}
 for p in d.polygons:
  x,y,z=p.center;uv=sum((d.uv_layers.active.data[i].uv for i in p.loop_indices),Vector((0,0)))/len(p.loop_indices);r,g,b=pixels[min(h-1,int(uv.y*h)),min(w-1,int(uv.x*w)),:3]
  side='Left' if x<0 else 'Right'
  if .29<z<.367 and abs(x)>.155:continue
  if z>.653:
   eye=y<-.11 and abs(x)<.13 and z<.748
   hair=z>.815 or (r<.70 and g/max(r,.001)<.79 and not eye)
   if y<-.11 and z<.785 and (-.12<x<-.04 or .028<x<.105):hair=False
   name='hair.korean' if hair else 'Face'
  elif z<.095:name='Rounded boots '+side
  elif z<.345:
   name='Satchel' if z>.25 and r>g*1.4 else 'Linen leggings '+side
  elif abs(x)>.128+(.60-z)*.32 and z<.605:
   name=side+' hand' if z<.367 else side+' sleeve cuff' if z<.41 and g>r*.76 else side+' sleeve'
  elif z>.625 and g<r*.73:name='Neck'
  elif z>.598 and g>r*.78:name='Cream collar'
  elif g*1.25<r<g*1.85 and b<g*.72:name='Satchel'
  else:name='Tunic body'
  groups.setdefault(name,[]).append(p)
 out=[]
 for name,polys in groups.items():
  if name.startswith('Linen'):
   # UV seams duplicate vertices. Join by position for component classification,
   # retaining the leg and dropping isolated wrist/bag fragments from the scan.
   parent=list(range(len(polys)));owner={}
   def find(i):
    while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
    return i
   for i,p in enumerate(polys):
    for vi in p.vertices:
     key=tuple(round(c,5) for c in d.vertices[vi].co)
     if key in owner:parent[find(i)]=find(owner[key])
     else:owner[key]=i
   pieces={}
   for i,p in enumerate(polys):pieces.setdefault(find(i),[]).append(p)
   polys=max(pieces.values(),key=lambda ps:sum(p.area for p in ps))
  inds=sorted({i for p in polys for i in p.vertices});remap={old:i for i,old in enumerate(inds)};verts=[d.vertices[i].co*S for i in inds];faces=[[remap[i] for i in p.vertices] for p in polys]
  o=mesh(name,verts,faces,material.copy());uv=o.data.uv_layers.new()
  for dest,p in zip(o.data.polygons,polys):
   for a,b in zip(dest.loop_indices,p.loop_indices):uv.data[a].uv=d.uv_layers.active.data[b].uv
  o.data.normals_split_custom_set([d.corner_normals[i].vector[:] for p in polys for i in p.loop_indices])
  slot=None;skin=name in ('Face','Neck','Left hand','Right hand');hair=name.startswith('hair.')
  if name.startswith('Rounded'):slot='boots'
  elif name.startswith('Linen'):slot='bottom'
  elif name=='Cream collar' or 'cuff' in name:slot='trim'
  elif name=='Tunic body' or 'sleeve' in name:slot='cloth'
  if skin:o['skin']=True
  if slot:o['colorSlot']=slot
  if name.startswith(('Tunic','Cream','Satchel')) or 'sleeve' in name:o['outfit']='traveler'
  if name.startswith(('Left','Right')):o['rigPart']='leftArm' if name.startswith('Left') else 'rightArm'
  if slot in ('boots','bottom'):o['rigPart']='leftLeg' if name.endswith('Left') else 'rightLeg'
  # Color textures are normalized in sRGB. Eye/blush detail stays in the face map.
  if skin or slot or hair:
   neutral=image.copy();neutral.scale(1024,1024);arr=np.empty(1024*1024*4,dtype=np.float32);neutral.pixels.foreach_get(arr);arr=arr.reshape(-1,4)
   base=np.array([.94,.81,.70] if skin else [.43,.29,.21] if hair else [.76,.37,.27] if slot=='cloth' else [.88,.84,.77] if slot in ('trim','bottom') else [.34,.28,.24])
   if name=='Face':
    # The same map includes eyes, blush and skin; preserve their relative pigment.
    arr[:,:3]=np.clip(arr[:,:3]/base,0,1)
   else:
    gray=np.clip(np.mean(arr[:,:3]/base,axis=1),0,1);arr[:,:3]=gray[:,None]
   neutral.pixels.foreach_set(arr.ravel());neutral.pack();o['dyeTexture']=True
  teximage=neutral if skin or slot or hair else image
  if not (skin or slot or hair):
   teximage=image.copy();teximage.scale(1024,1024);teximage.pack()
  clean=mat(name+' clay','#ffffff');node=clean.node_tree.nodes.new('ShaderNodeTexImage');node.image=teximage
  clean.node_tree.links.new(node.outputs['Color'],clean.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
  o.data.materials.clear();o.data.materials.append(clean)
  out.append(o)
 bpy.data.objects.remove(src,do_unlink=True)
 # The source has no closed forehead behind its fringe. Rebuild that shared
 # surface and its small clay facial features; retain the supplied hair/body mesh.
 for o in list(out):
  if o['part'] in ('Face','Neck','Left hand','Right hand'):out.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 skinmat=mat('Face skin','#f2cbb4');eye=mat('Soft cocoa eyes','#493124');blush=mat('Peach cheeks','#e7a17f')
 out.append(ellipsoid('Face',(-.014,.017,1.10),(.28,.22,.172),skinmat,skin=True))
 out.append(ellipsoid('Neck',(0,0,.945),(.055,.05,.072),skinmat,skin=True))
 for side in [-1,1]:
  out.append(ellipsoid(('Left' if side<0 else 'Right')+' hand',(side*.303,-.015,.527),(.041,.044,.061),skinmat,skin=True,rigPart='leftArm' if side<0 else 'rightArm'))
  out.append(ellipsoid('Ear.'+str(side),(side*.266,.005,1.094),(.052,.039,.066),skinmat,skin=True,deformPart='Face'))
  out.append(ellipsoid('Dark embroidered eye '+str(side),(side*.102-.014,-.194,1.089),(.019,.01,.039),eye,deformPart='Face'))
  out.append(ellipsoid('Soft cheek '+str(side),(side*.163-.014,-.164,1.047),(.034,.008,.022),blush,deformPart='Face'))

 return out

def hair_styles(base):
 material=mat('Clay hair','#79523b');out=[];center=Vector((-.014,.045,1.27))
 styles=['curtains','comma','wolf','pixie','mullet','airbang','bob','ponytail','hush','bun','wavy']
 for style in styles:
  parts=[];name='hair.'+style
  # Scalp only covers the crown/back, leaving the round face completely open.
  v=[];f=[];n=40;rows=14
  for i in range(rows+1):
   for j in range(n):
    a=j*math.tau/n;front=max(0,-math.sin(a));end=1.95-.9*front;p=.02+(end-.02)*i/rows
    v.append(center+Vector((.345*math.sin(p)*math.cos(a),.325*math.sin(p)*math.sin(a),.31*math.cos(p))))
  for i in range(rows):
   for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
  parts.append(mesh(name,v,f,material))
  def strand(points,width=.067,depth=.027):parts.append(lock(name,points,width,depth,material))
  # Layered crown locks wrap around the entire head, not just a front billboard.
  for j in range(22 if style=='pixie' else 15):
   a=j*math.tau/(22 if style=='pixie' else 15);front=max(0,-math.sin(a));end=1.8-.55*front
   if style=='pixie':end-=.23
   def pos(p,offset=0):return center+Vector(((.35+offset)*math.sin(p)*math.cos(a),(.335+offset)*math.sin(p)*math.sin(a),.32*math.cos(p)))
   strand([pos(.18),pos(.65,.025),pos(end-.2,.018),pos(end)],.041 if style=='pixie' else .082,.035)
  # Bangs use distinct partings and sweep directions from the supplied chart.
  split=style in ('curtains','comma','ponytail','hush','bun','wavy')
  for j in range(9 if style=='pixie' else 7):
   x=(j-4)*.063 if style=='pixie' else (j-3)*.081;side=-1 if x<0 else 1
   rootx=x*.28;endx=x
   endz=1.135+.13*abs(j-3)/3
   if split:rootx=side*.025;endx=x+side*.038;endz+=.17 if abs(j-3)<1.5 else .005
   if style=='comma':rootx=-.10+x*.24;endx=x+.05;endz+=.05
   if style=='pixie':endz+=.08
   if style=='mullet':endx+=.026*math.sin(j*3);endz-=.025*math.sin(j*2)
   if style=='curtains':
    rootx=side*.02;endx=x+side*.045;endz=1.17+.19*(1-abs(x)/.3)
   if style=='mullet':
    rootx=x*.6;endx=x+math.sin(j*2.2)*.045
   strand([(rootx,-.16,1.56),(x*.75+(.065 if style=='comma' else -.035 if style=='mullet' else 0),-.32,1.5),(endx+(.035*math.sin(j*2) if style=='mullet' else 0),-.335,1.36),(endx,-.285,endz)],.038 if style=='pixie' else .089 if style=='mullet' else .079,.04)
  if style in ('wolf','airbang','bob','hush','bun','wavy'):
   bottom=1.04 if style=='wolf' else 1.07 if style=='bob' else .89 if style=='bun' else .99 if style=='hush' else .77
   for j in range(13):
    a=.08+j*(math.pi-.16)/12;x=.32*math.cos(a);y=.045+.24*math.sin(a);wave=.065 if style=='wavy' else .025
    strand([(x*.88,y,1.4),(x*1.12,y+.045,1.2),(x+math.copysign(wave,x),y+.025,bottom+.15),(x*.96,y-.015,bottom)],.077,.035)
   for side in ([] if style=='hush' else [-1,1]):
    for k in range(2):
     x=side*(.26+k*.037);z=bottom+.03*k
     if style=='wavy':
      for q in range(3):
       top=1.35-q*.19;bx=x+side*.02*q
       strand([(bx,-.15,top),(bx+side*.12,-.18,top-.04),(bx-side*.09,-.20,top-.12),(bx+side*.02,-.16,top-.22)],.07,.035)
     else:strand([(x,-.15,1.38),(x+side*.05,-.19,1.2),(x+side*.055,-.12,z+.12),(x+side*.015,-.16,z)],.06,.027)
  if style=='hush':
   for side in [-1,1]:
    for k in range(7):
     z=1.10-k*.047;x=side*(.275+.016*math.sin(k*2));parts.append(ellipsoid(name,(x,-.02,z),(.058,.053,.045),material))
    strand([(side*.28,0,.81),(side*.31,0,.78),(side*.30,0,.75),(side*.29,0,.72)],.03,.024)
  if style=='ponytail':
   for k in range(5):strand([(.12+k*.017,.25,1.34),(.36,.37,1.25),(.33,.33,1.02),(.30-k*.016,.29,.93)],.047,.031)
  if style=='bun':
   for k in range(5):
    a=k*math.tau/5;parts.append(ellipsoid(name,(.075*math.cos(a),.10+.06*math.sin(a),1.61),(.088,.073,.10),material))
  if style in ('wolf','mullet','pixie'):
   strand([(0,.01,1.53),(-.04,.015,1.65),(.025,.02,1.68),(.07,.02,1.65)],.042,.027)
  # One named mesh per style avoids visibility drift and minimizes draw calls.
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();parts[0]['part']=name;out.append(parts[0])
 return out

def clothes(base):
 out=[]
 for style in list(CATALOG)[1:]:
  mats={k:mat(style+' '+k,c) for k,c in CATALOG[style]['colors'].items()}
  def tags(slot='cloth',rig=None):return dict(outfit=style,colorSlot=slot,deformPart='Tunic body',**({'rigPart':rig} if rig else {}))
  def body(name,rings,slot='cloth'):o=loft('outfit_'+style+'_'+name,rings,mats[slot],**tags(slot));out.append(o);return o
  def panel(name,points,slot='trim'):
   o=mesh('outfit_'+style+'_'+name,points,[tuple(range(len(points)))],mats[slot],**tags(slot));mod=o.modifiers.new('soft cloth edge','SOLIDIFY');mod.thickness=.009;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
   bevel=o.modifiers.new('rounded hem','BEVEL');bevel.width=.009;bevel.segments=3;bpy.ops.object.modifier_apply(modifier=bevel.name);out.append(o)
  def bead(name,pos,r=.014,slot='trim'):out.append(ellipsoid('outfit_'+style+'_'+name,pos,(r,r*.55,r),mats[slot],**tags(slot)))
  for side in [-1,1]:
   arm='leftArm' if side<0 else 'rightArm'
   for cuff in [False,True]:
    slot='trim' if cuff or style=='garden' else 'cloth'
    start=Vector((side*.177,0,.875));end=Vector((side*.298,-.011,.568))
    axis=(end-start).normalized();across=Vector((0,1,0));normal=axis.cross(across).normalized();v=[];f=[];n=20
    rings=[(.87,.077),(1.,.077),(1.04,.074)] if cuff else [(0,.058),(.09,.066),(.5,.075),(.90,.079)]
    for t,r in rings:
     center=start+(end-start)*t
     for j in range(n):
      a=j*math.tau/n;v.append(center+across*math.cos(a)*r+normal*math.sin(a)*r)
    for k in range(len(rings)-1):
     for j in range(n):a=k*n+j;b=k*n+(j+1)%n;f.append((a,b,b+n,a+n))
    f.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))])
    tag=tags(slot,arm);tag['deformPart']=('Left' if side<0 else 'Right')+' sleeve'
    out.append(mesh('outfit_'+style+'_'+arm+('_cuff' if cuff else '_sleeve'),v,f,mats[slot],**tag))
  hem=.49 if style in ('academy','cardigan','ranger') else .32 if style=='alchemist' else .38
  width=.235 if style in ('garden','alchemist') else .198
  body('body',[(hem,width*.96,.139),(hem+.02,width,.145),(.62,.184,.143),(.74,.173,.137),(.86,.182,.131),(.92,.13,.108),(.949,.085,.073)])
  for side in [-1,1]:
   panel('petal_collar',[(side*.008,-.09,.95),(side*.083,-.082,.948),(side*.129,-.118,.902),(side*.091,-.151,.875),(side*.045,-.149,.895)])
  if style=='academy':
   for x in [-.045,.045]:
    for z in [.6,.7,.8]:bead('button',(x,-.148,z))
   for x in [-.11,.11]:panel('pocket',[(x-.035,-.153,.64),(x+.035,-.153,.64),(x+.03,-.156,.61),(x-.03,-.156,.61)])
  elif style=='garden':
   panel('apron',[(-.079,-.142,.87),(.079,-.142,.87),(.071,-.151,.68),(.177,-.157,.42),(-.177,-.157,.42),(-.071,-.151,.68)])
   panel('pocket',[(-.052,-.167,.62),(.052,-.167,.62),(.048,-.17,.54),(-.048,-.17,.54)],'cloth')
   for side in [-1,1]:bead('strap',(side*.059,-.155,.84),.014,'cloth')
  elif style=='alchemist':
   panel('robe_edge',[(-.024,-.146,.88),(.024,-.146,.88),(.035,-.154,.35),(-.035,-.154,.35)])
   for side in [-1,1]:
    for z in [.46,.63]:
     x=side*.13;panel('star',[(x,-.156,z+.025),(x+.009,-.159,z+.008),(x+.025,-.156,z),(x+.008,-.159,z-.009),(x,-.156,z-.025),(x-.008,-.159,z-.009),(x-.025,-.156,z),(x-.009,-.159,z+.008)])
  elif style=='ranger':
   v=[];f=[];n=36
   for z,rx,ry in [(.959,.087,.075),(.92,.195,.139),(.8,.29,.186),(.7,.29,.18)]:
    for j in range(n+1):a=-.6+j*(math.pi+1.2)/n;v.append((rx*math.cos(a),ry*math.sin(a),z))
   for k in range(3):
    for j in range(n):a=k*(n+1)+j;f.append((a,a+1,a+n+2,a+n+1))
   out.append(mesh('outfit_ranger_cape',v,f,mats['cloth'],**tags()));bead('clasp',(0,-.116,.915),.025)
   panel('belt',[(-.17,-.15,.67),(.17,-.15,.67),(.17,-.15,.64),(-.17,-.15,.64)])
  else:
   panel('knit_insert',[(-.07,-.141,.88),(.07,-.141,.88),(.05,-.155,.53),(-.05,-.155,.53)])
   for side in [-1,1]:
    panel('knit_edge',[(side*.06,-.149,.89),(side*.08,-.15,.88),(side*.036,-.165,.51),(side*.012,-.165,.51)])
    x=side*.12;panel('pocket',[(x-.035,-.157,.65),(x+.035,-.157,.65),(x+.033,-.161,.57),(x-.033,-.161,.57)],'cloth')
   for z in [.55,.62,.69]:bead('button',(0,-.17,z),.012)
 return out

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
 base=source_parts();objs=base+hair_styles(base)+clothes(base)
 for o in objs:
  basis=o.shape_key_add(name='Basis')
  for key in [*LIMITS,'seated']:
   coords=[deform(v.co,o,key) for v in basis.data]
   if all((v.co-p).length<1e-6 for v,p in zip(basis.data,coords)):continue
   target=o.shape_key_add(name=key);target.slider_min=-1;target.slider_max=1;target.value=0
   for dst,p in zip(target.data,coords):dst.co=p
  o.name=o['part'].replace('hair.','hair_');o['clayReference']=True
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
