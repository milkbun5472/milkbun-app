"""Original Blender garments with curved cloth panels and fused sleeve geometry.
Baked Z-up coordinates; shares existing wardrobe and body morph conventions.
"""
import bpy, math
from mathutils import Vector

def build(D,base):
 out=[]
 for style in D.CATALOG:
  mats={k:D.mat(style+' '+k,c) for k,c in D.CATALOG[style]['colors'].items()};mats['leather']=D.mat('Saddle leather','#a66b3f')
  hem=.49 if style in ('traveler','academy','cardigan','ranger') else .30 if style=='alchemist' else .37
  hemwidth=.245 if style in ('garden','alchemist') else .198
  stations=[(hem,hemwidth,.146),(hem+.035,hemwidth+.005,.151),(.61,.189,.143),(.71,.176,.133),(.81,.181,.132),(.875,.195,.131),(.914,.178,.115),(.952,.09,.068)]
  stations=sorted({z:(z,x,y) for z,x,y in stations}.values())
  def tag(slot='cloth',rig=None,part='Tunic body'):
   return dict(outfit=style,**({'colorSlot':slot} if slot!='leather' else {}),deformPart=part,**({'rigPart':rig} if rig else {}))
  def keep(o):out.append(o);return o
  def dims(z):
   if z<=stations[0][0]:return stations[0][1:]
   for (a,x,y),(b,X,Y) in zip(stations,stations[1:]):
    if z<=b:
     t=(z-a)/(b-a);t=t*t*(3-2*t);return x+(X-x)*t,y+(Y-y)*t
   return stations[-1][1:]
  def surface(x,z,offset=.008):
   rx,ry=dims(z);q=min(.995,abs(x)/rx);return -ry*max(.001,1-q**2.8)**(1/2.8)-offset
  # A softly squared chest carries the loose fabric volume.
  v=[];f=[];cols=40;rows=20
  for i in range(rows+1):
   z=hem+(.952-hem)*i/rows;rx,ry=dims(z)
   for j in range(cols):
    a=j*math.tau/cols;c=math.cos(a);sn=math.sin(a);fold=.010*math.cos(a*7+.4)*(max(0,(.77-z)/(.77-hem))**1.4)
    x=math.copysign(abs(c)**(2/2.8),c)*(rx+fold)
    y=math.copysign(abs(sn)**(2/2.8),sn)*(ry+fold*.48)
    zz=z+.0035*math.sin(a*3+.8)*max(0,(.72-z)/.3)
    v.append((x,y,zz))
  for i in range(rows):
   for j in range(cols):a=i*cols+j;b=i*cols+(j+1)%cols;f.append((a,b,b+cols,a+cols))
  body=keep(D.mesh('outfit_'+style+'_draped_body',v,f,mats['cloth'],**tag()))
  # Real inward thickness at neck and hem; no flat plate across the bottom.
  mod=body.modifiers.new('turned fabric hem','SOLIDIFY');mod.thickness=.008;mod.offset=-1;bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name)
  # Closed sleeves begin inside the shoulder and taper toward the wrist.
  for side in [-1,1]:
   arm='leftArm' if side<0 else 'rightArm'
   for cuff in [False,True]:
    slot='trim' if cuff or style=='garden' else 'cloth';verts=[];faces=[];n=32;nr=10
    for i in range(nr+1):
     t=(.88+.14*i/nr) if cuff else .91*i/nr
     center=Vector((side*(.10+.208*t),-.018*t*t,.897-.334*t))
     tangent=Vector((side*.208,-.036*t,-.334)).normalized();across=Vector((0,1,0));normal=tangent.cross(across).normalized()
     r=(.075 if cuff else .079+.005*math.sin(min(1,t)*math.pi*.8))
     if style=='garden' and not cuff:r+=.012*math.sin(math.pi*t)**2
     for j in range(n):
      a=j*math.tau/n;fold=1+.035*math.cos(a*5+.4)*math.sin(t*math.pi)
      verts.append(center+across*math.cos(a)*r*.92*fold+normal*math.sin(a)*r*fold)
    for i in range(nr):
     for j in range(n):a=i*n+j;b=i*n+(j+1)%n;faces.append((a,b,b+n,a+n))
    faces.extend([tuple(reversed(range(n))),tuple(nr*n+j for j in range(n))])
    keep(D.mesh('outfit_'+style+'_'+arm+('_cuff' if cuff else '_sleeve'),verts,faces,mats[slot],**tag(slot,arm,('Left' if side<0 else 'Right')+' sleeve')))
  # Remesh the sleeve into a smooth garment piece.
  for arm in ['leftArm','rightArm']:
   pieces=[o for o in out if o.get('outfit')==style and o.get('rigPart')==arm and not o.name.endswith('_cuff')]
   bpy.ops.object.select_all(action='DESELECT')
   for o in pieces:o.select_set(True)
   bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();o=pieces[0]
   for removed in pieces[1:]:out.remove(removed)
   mod=o.modifiers.new('continuous sewn shoulder','REMESH');mod.mode='VOXEL';mod.voxel_size=.008;bpy.ops.object.modifier_apply(modifier=mod.name)
   mod=o.modifiers.new('soft fabric shoulder','SMOOTH');mod.factor=1;mod.iterations=4;bpy.ops.object.modifier_apply(modifier=mod.name)
   mod=o.modifiers.new('mobile sleeve topology','DECIMATE');mod.ratio=.35;bpy.ops.object.modifier_apply(modifier=mod.name)
   for poly in o.data.polygons:poly.use_smooth=True
  def patch(name,outline,slot='trim',offset=.012,bulge=.006):
   # Smooth closed outline; concentric quilted rings follow the chest/skirts.
   points=[Vector(p) for p in outline];boundary=points[:]
   # Corner cutting stays inside the pattern; cubic overshoot made long plackets
   # and narrow belts balloon past the hem or intersect the body.
   for _ in range(2):
    boundary=[q for a,b in zip(boundary,boundary[1:]+boundary[:1]) for q in (.75*a+.25*b,.25*a+.75*b)]
   center=sum(points,Vector((0,0)))/len(points);verts=[];faces=[];n=len(boundary)
   rings=[.001]+[i/6 for i in range(1,7)]
   for r in rings:
    for pt in boundary:
     x,z=center+(pt-center)*r
     y=(-.082-(.974-z)*.78-bulge*(1-r*r)) if name=='turned_collar' else surface(x,z,offset+bulge*(1-r*r))
     verts.append((x,y,z))
   for k in range(len(rings)-1):
    for j in range(n):a=k*n+j;b=k*n+(j+1)%n;faces.append((a,b,b+n,a+n))
   faces.append(tuple(range(n)))
   signed=sum(a.x*b.y-b.x*a.y for a,b in zip(boundary,boundary[1:]+boundary[:1]))
   if signed>0:faces=[tuple(reversed(f)) for f in faces]
   o=keep(D.mesh('outfit_'+style+'_'+name,verts,faces,mats[slot],**tag(slot)))
   mod=o.modifiers.new('rounded cloth thickness','SOLIDIFY');mod.thickness=.006;mod.offset=-1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
   return o
  def button(name,x,z,r=.014,slot='trim',offset=.026):return keep(D.ellipsoid('outfit_'+style+'_'+name,(x,surface(x,z,offset),z),(r,.009,r),mats[slot],**tag(slot)))
  def cord(name,coords,r=.0025,slot='trim'):
   curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=r;curve.bevel_resolution=2
   spl=curve.splines.new('POLY');spl.points.add(len(coords)-1)
   for p,q in zip(spl.points,coords):p.co=(*q,1)
   o=bpy.data.objects.new('outfit_'+style+'_'+name,curve);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.data.materials.append(mats[slot]);o['part']=o.name
   for k,v in tag(slot).items():o[k]=v
   keep(o)
  # A turned collar has a neck edge, volume and a soft point resting on the chest.
  for side in [-1,1]:
   patch('turned_collar',[(side*.002,.954),(side*.060,.974),(side*.126,.935),(side*.131,.899),(side*.076,.854),(side*.030,.887)],offset=.035,bulge=.014)
  if style=='traveler':
   # Broad leather strap and softly rounded satchel, independently modeled.
   patch('satchel_strap',[(-.16,.923),(-.115,.939),(.164,.56),(.127,.529)],'leather',.025,.004)
   keep(D.ellipsoid('outfit_traveler_satchel',(.197,-.137,.49),(.075,.049,.115),mats['leather'],**tag('leather')))
   keep(D.ellipsoid('outfit_traveler_satchel_flap',(.197,-.175,.526),(.069,.018,.065),mats['leather'],**tag('leather')))
   keep(D.ellipsoid('outfit_traveler_satchel_button',(.197,-.195,.509),(.008,.006,.012),mats['trim'],**tag('trim')))
  elif style=='academy':
   patch('front_overlap',[(-.022,.89),(.039,.89),(.04,.522),(-.023,.516)],'cloth',.01,.004)
   for x in [-.049,.049]:
    for z in [.61,.71,.81]:button('brass_button',x,z,.012)
   for side in [-1,1]:
    x=side*.12;patch('pocket_flap',[(x-.038,.66),(x+.038,.66),(x+.037,.635),(x-.035,.633)],'cloth',.018,.004)
    cord('pocket_stitch',[(x-.029+i*.0058,surface(x-.029+i*.0058,.642,.025),.642) for i in range(11)],.0015)
  elif style=='garden':
   patch('apron_bib',[(-.079,.878),(.079,.878),(.063,.702),(-.063,.702)],offset=.019)
   patch('gathered_apron',[(-.076,.706),(.076,.706),(.179,.438),(.15,.405),(-.15,.405),(-.179,.438)],offset=.021,bulge=.007)
   patch('apron_pocket',[(-.055,.618),(.055,.618),(.055,.552),(.039,.535),(-.039,.535),(-.055,.552)],'cloth',.033,.005)
   for side in [-1,1]:
    patch('shoulder_strap',[(side*.07,.924),(side*.096,.91),(side*.071,.759),(side*.05,.76)],offset=.016)
    button('strap_button',side*.062,.855,.013,'cloth',.036)
   cord('waist_tie',[(x/100,surface(x/100,.706,.03),.706) for x in range(-17,18)],.006)
  elif style=='alchemist':
   patch('robe_placket',[(-.021,.885),(.025,.883),(.027,.335),(-.029,.335)],offset=.016,bulge=.002)
   for side in [-1,1]:
    for z in [.47,.62]:
     x=side*.137;patch('embroidered_star',[(x,z+.022),(x+.006,z+.006),(x+.019,z),(x+.006,z-.006),(x,z-.022),(x-.006,z-.006),(x-.019,z),(x-.006,z+.006)],offset=.012,bulge=.001)
   for z in [.74,.81]:button('robe_fastening',0,z,.009)
  elif style=='ranger':
   # Cape is a continuous shoulder drape, with curved cutaway front and soft hem.
   verts=[];faces=[];n=64;nr=18
   for i in range(nr+1):
    t=i/nr
    for j in range(n+1):
     a=-.87+j*(math.pi+1.74)/n;rx=.084+.24*math.sin(t*math.pi/2);ry=.075+.135*math.sin(t*math.pi/2)
     edge=abs(j-n/2)/(n/2);z=.966-.255*t+.025*t*edge**3;wrinkle=.007*math.cos(a*8+.3)*t*t
     verts.append(((rx+wrinkle)*math.cos(a),(ry+wrinkle)*math.sin(a),z))
   for i in range(nr):
    for j in range(n):a=i*(n+1)+j;faces.append((a,a+1,a+n+2,a+n+1))
   cape=keep(D.mesh('outfit_ranger_shoulder_cape',verts,faces,mats['cloth'],**tag()));mod=cape.modifiers.new('cape lining','SOLIDIFY');mod.thickness=.009;bpy.context.view_layer.objects.active=cape;bpy.ops.object.modifier_apply(modifier=mod.name)
   cord('cape_edge',[verts[nr*(n+1)+j] for j in range(n+1)],.004)
   button('cloak_clasp',0,.919,.024)
   patch('waist_belt',[(-.168,.698),(.168,.698),(.169,.667),(-.169,.667)],offset=.012,bulge=.002)
  elif style=='cardigan':
   patch('knit_shirt',[(-.063,.90),(.063,.90),(.063,.529),(-.063,.529)],offset=.009,bulge=.002)
   for side in [-1,1]:
    patch('knit_lapel',[(side*.043,.90),(side*.084,.902),(side*.033,.528),(side*.007,.523)],'cloth',.025,.006)
    x=side*.12;patch('knit_pocket',[(x-.034,.65),(x+.034,.65),(x+.034,.571),(x+.02,.558),(x-.022,.558),(x-.034,.571)],'cloth',.018,.004)
    for dx in [-.02,-.01,0,.01,.02]:
     cord('pocket_rib',[(x+dx,surface(x+dx,z,.028),z) for z in [.57,.59,.61,.63,.645]],.0012,'cloth')
   for z in [.556,.637,.718,.799]:button('wood_button',.014,z,.010,offset=.04)
   # Fine parallel ribs at the lower hem keep the knit tactile, not striped paint.
   for i in range(31):
    x=-.18+i*.012;cord('hem_rib',[(x,surface(x,z,.012),z) for z in [.509,.52,.531]],.0014,'cloth')
 return out
