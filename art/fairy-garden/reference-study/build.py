"""Blender image-reference sculpture study. Pixel landmarks from Lisa's 1024x1536 reference.
No imported meshes. Separate from the deployed avatar while silhouette/materials are reviewed.
Blender front = -Y; X/Z project to source image at 700 px per unit.
"""
import bpy, math, os, random
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon
OUT=os.environ.get('STUDY_OUT','/tmp/garden-reference-study')
os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def linear(c):
 return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4

def material(name,color,grain=0,scale=150):
 m=bpy.data.materials.new(name);m.use_nodes=True
 rgb=tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5))
 m.diffuse_color=(*rgb,1);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1)
 bs.inputs['Roughness'].default_value=.86;bs.inputs['Specular IOR Level'].default_value=.22
 if grain:
  nodes=m.node_tree.nodes;links=m.node_tree.links
  noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2.4;noise.inputs['Roughness'].default_value=.72
  bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=grain;bump.inputs['Distance'].default_value=.003
  links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])
 return m
skin=material('Warm peach porcelain','#f8c596',.09,190)
hair=material('Chestnut clay','#4f3223',.18,110)
shirt=material('Washed coral woven cloth','#b54a34',.20,210)
cream=material('Ivory woven collar','#eee6d4',.16,240)
linen=material('Natural linen trousers','#e9d4b6',.23,225)
leather=material('Caramel leather','#683b1c',.16,155)
shoes=material('Cocoa leather shoes','#66584b',.14,165)
eye=material('Dark cocoa eyes','#4c382b')
blush=material('Soft peach cheek pigment','#e9a17d')

def xyz(px,py,y=0):return Vector(((px-512)/700,y,(1387-py)/700))
def mesh(name,v,f,mat,smooth=True):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(mat)
 for p in d.polygons:p.use_smooth=smooth
 return o

def apply(o,mod):
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)

def ellipsoid(name,center,radii,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=center);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return o

def catmull(points,steps=5):
 pts=list(map(Vector,points));out=[]
 for i,b in enumerate(pts):
  a=pts[(i-1)%len(pts)];c=pts[(i+1)%len(pts)];d=pts[(i+2)%len(pts)]
  for j in range(steps):
   t=j/steps;out.append((2*b+(c-a)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t**3)/2)
 return out

def pillow(name,outline,base,depth,mat,back=.018,center=None,facet=.0):
 """Closed curved volume with measured image silhouette, not a flat decal."""
 boundary=catmull(outline,4);center=Vector(center) if center else sum(boundary,Vector((0,0)))/len(boundary)
 n=len(boundary);v=[];f=[];rows=10
 for side in [0,1]:
  for i in range(rows+1):
   r=.0001+(1-.0001)*i/rows
   for j,pt in enumerate(boundary):
    p=center+(pt-center)*r;x,z=xyz(p.x,p.y).xz
    yy=base(x,z) if callable(base) else base
    bulge=max(0,1-r*r)**.85
    yy+=(-depth if side==0 else back)*bulge
    v.append((x,yy,z))
 for side in [0,1]:
  off=side*(rows+1)*n
  for i in range(rows):
   for j in range(n):
    a=off+i*n+j;b=off+i*n+(j+1)%n
    f.append((a,b,b+n,a+n) if side==0 else (a,a+n,b+n,b))
  f.append(tuple(off+j for j in range(n)))
 backoff=(rows+1)*n
 for j in range(n):a=rows*n+j;b=rows*n+(j+1)%n;f.append((a,backoff+a,backoff+b,b))
 o=mesh(name,v,f,mat)
 # Correct orientation from connected closed volumes.
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
 if facet:
  mod=o.modifiers.new('Irregular sculpt facets','DECIMATE');mod.ratio=.32;apply(o,mod);facets(o,facet)
 return o

def facets(o,amount):
 mod=o.modifiers.new('Hand shaped triangular planes','TRIANGULATE');mod.quad_method='BEAUTY';apply(o,mod)
 o.data.update();norms=[n.vector.copy() for n in o.data.corner_normals]
 for p in o.data.polygons:
  for i in p.loop_indices:norms[i]=(norms[i]*(1-amount)+p.normal*amount).normalized()
 o.data.normals_split_custom_set(norms)

# A rounded jaw with a broad, nearly level chin. The scalp is hidden under the hair.
profile=[(.984,.065,.045),(.990,.127,.080),(1.006,.180,.112),(1.030,.212,.134),(1.070,.238,.151),(1.125,.253,.163),(1.20,.255,.175),(1.30,.244,.182),(1.39,.212,.165),(1.46,.132,.112),(1.485,.001,.001)]
def shape_at(z):
 # Monotone cubic Hermite interpolation preserves a continuous cheek tangent.
 def slope(k,c):
  if k==0:return (profile[1][c]-profile[0][c])/(profile[1][0]-profile[0][0])
  if k==len(profile)-1:return (profile[k][c]-profile[k-1][c])/(profile[k][0]-profile[k-1][0])
  left=(profile[k][c]-profile[k-1][c])/(profile[k][0]-profile[k-1][0]);right=(profile[k+1][c]-profile[k][c])/(profile[k+1][0]-profile[k][0])
  return 0 if left*right<=0 else 2*left*right/(left+right)
 for k,(p,q) in enumerate(zip(profile,profile[1:])):
  if z<=q[0]:
   h=q[0]-p[0];t=max(0,(z-p[0])/h)
   return tuple((2*t**3-3*t*t+1)*p[c]+(t**3-2*t*t+t)*h*slope(k,c)+(-2*t**3+3*t*t)*q[c]+(t**3-t*t)*h*slope(k+1,c) for c in [1,2])
 return profile[-1][1:]
v=[];f=[];n=80;rows=70
for i in range(rows+1):
 z=profile[0][0]+(profile[-1][0]-profile[0][0])*i/rows;rx,ry=shape_at(z)
 for j in range(n):
  a=j*math.tau/n;v.append((-.010+rx*math.cos(a),.025+ry*math.sin(a),z))
for i in range(rows):
 for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
f.extend([tuple(reversed(range(n))),tuple(rows*n+j for j in range(n))])
face=mesh('Continuous sculpted head',v,f,skin)
# Remove ring interpolation artifacts with a gentle subdivision surface.
mod=face.modifiers.new('Porcelain smooth skin','SUBSURF');mod.levels=1;apply(face,mod)
ellipsoid('Left ear',xyz(337,605,.012),(.057,.049,.068),skin)
ellipsoid('Right ear',xyz(668,603,.012),(.055,.048,.066),skin)
ellipsoid('Neck',xyz(505,708,.026),(.048,.047,.055),skin)

def face_y(x,z):
 rx,ry=shape_at(z);return .025-ry*math.sqrt(max(.005,1-((x+.01)/rx)**2))
# Eyes are long rounded capsules whose surfaces follow the cheek plane.
for name,px,py in [('Left',432,603),('Right',574,600)]:
 outline=[(px-14,py-14),(px-12,py-24),(px-6,py-29),(px+3,py-29),(px+11,py-23),(px+14,py-10),(px+14,py+15),(px+10,py+27),(px+2,py+31),(px-7,py+29),(px-12,py+21)]
 pillow(name+' capsule eye',outline,lambda x,z:face_y(x,z)-.002,.002,eye,back=.001)
# Blush is pigment on a conforming surface, with a feathered edge.
for name,px,py in [('Left',410,643),('Right',598,637)]:
 center=xyz(px,py);v=[];f=[];n=48;rows=8
 for i in range(rows+1):
  r=.001+(1-.001)*i/rows
  for j in range(n):
   a=j*math.tau/n;x=center.x+.032*r*math.cos(a);z=center.z+.024*r*math.sin(a);v.append((x,face_y(x,z)-.001,z))
 for i in range(rows):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
 o=mesh(name+' painted blush',v,f,blush)
 # Eight concentric pigments make a soft edge without transparent sorting.
 for i in range(rows):
  m=blush.copy();m.name=name+' blush edge '+str(i);t=(i/rows)**3
  bs=m.node_tree.nodes.get('Principled BSDF');bc=tuple(blush.diffuse_color[k]*(1-t)+skin.diffuse_color[k]*t for k in range(3));bs.inputs['Base Color'].default_value=(*bc,1);o.data.materials.append(m)
 for poly in o.data.polygons:poly.material_index=min(rows,int(poly.index/n)+1)

# Hair silhouettes traced as separate authored volumes. Back to front ordering.
crown=ellipsoid('Closed hair crown',xyz(504,420,.065),(.315,.238,.250),hair)
for vertex in crown.data.vertices:
 p=vertex.co;factor=(max(.01,1-(p.z/.250)**2))**(-.12);p.x*=factor

# Rear locks sweep over the crown, tapering toward the nape.
def swept_lock(name,points,width,depth):
 pts=list(map(Vector,points));v=[];f=[];steps=22;sections=12
 def point(t):return pts[0]*(1-t)**3+3*pts[1]*t*(1-t)**2+3*pts[2]*t*t*(1-t)+pts[3]*t**3
 for i in range(steps+1):
  t=i/steps;p=point(t);tan=(point(min(1,t+.001))-point(max(0,t-.001))).normalized()
  normal=Vector((p.x,p.y-.045,(p.z-1.37)*.5));normal-=tan*normal.dot(tan);normal.normalize();cross=tan.cross(normal).normalized()
  radius=max(.008,math.sin(math.pi*t)**.58)
  for j in range(sections):
   a=j*math.tau/sections;v.append(p+cross*math.cos(a)*width*radius+normal*math.sin(a)*depth*radius)
 for i in range(steps):
  for j in range(sections):a=i*sections+j;b=i*sections+(j+1)%sections;f.append((a,a+sections,b+sections,b))
 f.extend([tuple(range(sections)),tuple(reversed([steps*sections+j for j in range(sections)]))]);o=mesh(name,v,f,hair);facets(o,.4)
# Staggered layers lie on a rounded scalp, continuing over the crown to the nape.
def scalp_point(a,t,drop=0):
 return Vector((.324*math.sin(t)*math.cos(a),.065+.232*math.sin(t)*math.sin(a),1.372+.263*math.cos(t)-drop))
for layer,count,start,end,width in [(0,7,.12,1.78,.077),(1,9,.78,2.28,.070),(2,10,1.45,2.84,.058)]:
 for j in range(count):
  a=.04+j*(math.pi-.08)/(count-1)+(layer%2)*.19
  t1=end+.06*math.sin(j*1.7);twist=.10*math.sin(j*1.9+layer)
  # Curved Bezier handles extend beyond the scalp rather than cutting through it.
  p0=scalp_point(a,start);p3=scalp_point(a+twist,t1,.080 if layer==2 else .01)
  p1=scalp_point(a+.03,start+(t1-start)*.30);p2=scalp_point(a+twist*.6,start+(t1-start)*.72,.022 if layer==2 else 0)
  if layer==2:p3=Vector((.225*math.cos(a+twist),.035+.188*math.sin(a+twist),1.022+.014*math.sin(j*1.8)))
  for p in [p1,p2]:
   p.x*=1.10;p.y=.065+(p.y-.065)*1.15
  offset=.038 if layer==0 else .016 if layer==1 else 0
  for p in [p1,p2,p3]:
   p.x+=offset*math.cos(a);p.y+=offset*math.sin(a)
  swept_lock('Rear layered lock '+str(layer)+' '+str(j),[p0,p1,p2,p3],width,.029)
def hair_surface(x,z,b):
 return .065-.235*math.sqrt(max(.012,1-((max(1.33,z)-1.385)/.26)**2-(x/.37)**2))+(b+.18)*max(0,min(1,(1.64-z)/.22))
pillow('Curved hair understructure',[(504,250),(412,271),(334,349),(295,454),(326,536),(390,533),(450,532),(551,530),(641,537),(712,478),(680,357),(590,275)],lambda x,z:hair_surface(x,z,-.19),.005,hair,back=.080)
# Outline dimensions are measured in the original image, not copied from a GLB.
locks=[
('left crown underlayer',[(493,246),(445,247),(394,267),(350,306),(321,361),(340,390),(391,345),(439,307),(478,277)],-.148,.020),
('upper left sweep',[(504,250),(437,241),(356,257),(296,299),(251,361),(237,394),(245,406),(281,391),(351,327),(435,277)],-.072,.044),
('outer left sweep',[(398,274),(338,300),(287,354),(257,422),(243,487),(250,525),(268,516),(296,457),(337,409),(369,343)],-.087,.047),
('left lower outer',[(326,390),(298,421),(278,482),(273,542),(283,573),(305,561),(333,499),(349,440)],-.085,.045),
('left temple',[(351,462),(326,491),(327,551),(344,601),(360,619),(371,601),(369,540)],-.076,.031),
('upper right sweep',[(542,252),(599,259),(650,283),(704,338),(735,401),(738,455),(752,474),(751,489),(727,487),(688,436),(647,357),(584,290)],-.078,.047),
('right outer lower',[(686,376),(725,409),(734,460),(728,509),(728,551),(715,566),(689,534),(667,463)],-.105,.037),
('right temple',[(660,478),(684,495),(686,542),(668,601),(651,618),(642,604),(647,546)],-.09,.032),
('left fringe outer',[(383,381),(353,421),(337,473),(342,541),(359,584),(375,593),(385,574),(386,508),(406,443)],-.187,.040),
('left fringe inner',[(427,361),(402,408),(382,473),(385,543),(398,578),(410,567),(433,517),(453,451)],-.203,.038),
('right fringe outer',[(645,394),(667,443),(675,505),(664,554),(650,576),(637,566),(629,520),(614,460)],-.181,.043),
('right fringe inner',[(574,369),(612,409),(636,466),(634,522),(622,561),(609,565),(585,530),(559,465)],-.205,.045),
('inner fringe small',[(545,385),(566,429),(576,493),(565,551),(549,574),(535,564),(518,510)],-.229,.038),
('broad left fringe',[(506,275),(469,270),(425,292),(389,334),(354,393),(320,465),(313,497),(325,507),(366,487),(409,452),(446,410),(475,351)],-.233,.046),
('central broad fringe',[(505,285),(534,294),(555,333),(571,389),(576,446),(565,506),(542,552),(511,581),(487,585),(465,557),(449,521),(443,474),(446,414),(466,347)],-.259,.051),
('broad right fringe',[(514,277),(549,268),(585,275),(623,298),(659,338),(682,388),(700,450),(701,482),(690,494),(660,488),(618,465),(581,421),(559,371),(547,330)],-.239,.049),
('little crown tuft',[(527,263),(511,247),(484,226),(461,207),(460,197),(474,192),(501,196),(523,207),(536,228),(538,246)],-.008,.025),
]
for name,outline,base,depth in locks:
 pillow(name,outline,lambda x,z,b=base:hair_surface(x,z,b),depth*.78,hair,back=.024,facet=.52)

# Independent source inspection found depth/width ~1.01; this draft was ~0.82.
# Expand the new head's depth around its own center; no source vertices are copied.
for o in list(bpy.data.objects):
 if o.type=='MESH':
  o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4)
  o.data.transform(Matrix.Translation((0,-.00625,0)) @ Matrix.Diagonal((1,1.25,1,1)))
  o['region']='head'

# Torso and sleeves are fused as one cloth shell, with no spherical shoulder pads.
def loft(name,rings,mat,n=48,center_x=0,center_y=0,exponent=1):
 v=[];f=[]
 for k,(z,rx,ry) in enumerate(rings):
  for j in range(n):
   a=j*math.tau/n;c=math.cos(a);sn=math.sin(a)
   fold=.003*math.sin(7*a+.5)*max(0,1-k/(len(rings)-1))
   v.append((center_x+math.copysign(abs(c)**exponent,c)*(rx+fold),center_y+math.copysign(abs(sn)**exponent,sn)*(ry+fold*.6),z))
 for i in range(len(rings)-1):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
 f.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))]);return mesh(name,v,f,mat)
body=loft('Loose shirt',[(.505,.174,.115),(.52,.184,.126),(.59,.182,.129),(.70,.164,.122),(.81,.154,.117),(.885,.145,.107),(.933,.107,.077),(.961,.053,.049)],shirt,exponent=.78)
shirtparts=[body]
for side in [-1,1]:
 for cuff in [False,True]:
  v=[];f=[];n=32;rows=20
  for i in range(rows+1):
   t=(.87+.16*i/rows) if cuff else .93*i/rows
   x=side*(.07+.20*t);z=.880-.310*t;y=-.006-.026*t
   tangent=Vector((side*.20,-.026,-.310)).normalized();across=Vector((0,1,0));normal=tangent.cross(across).normalized()
   rad=.074 if cuff else .071+.009*math.sin(t*math.pi*.8)
   for j in range(n):
    a=j*math.tau/n;fold=1+.035*math.cos(5*a+t*4)*math.sin(t*math.pi)
    v.append(Vector((x,y,z))+across*(math.cos(a)*rad*.87*fold)+normal*(math.sin(a)*rad*fold))
  for i in range(rows):
   for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,b,b+n,a+n))
  f.extend([tuple(reversed(range(n))),tuple(rows*n+j for j in range(n))])
  o=mesh(('Left' if side<0 else 'Right')+(' folded cuff' if cuff else ' sleeve'),v,f,cream if cuff else shirt)
  if not cuff:shirtparts.append(o)
  else:
   mod=o.modifiers.new('Soft cuff edge','BEVEL');mod.width=.004;mod.segments=2;apply(o,mod)
 ellipsoid(('Left' if side<0 else 'Right')+' mitten hand',(side*.292,-.030,.537),(.048,.047,.068),skin)
bpy.ops.object.select_all(action='DESELECT')
for o in shirtparts:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
mod=body.modifiers.new('Sewn shoulder continuity','REMESH');mod.mode='VOXEL';mod.voxel_size=.005;apply(body,mod)
mod=body.modifiers.new('Cloth seam relaxation','SMOOTH');mod.factor=.8;mod.iterations=4;apply(body,mod)
mod=body.modifiers.new('Broad fabric facets','DECIMATE');mod.ratio=.12;apply(body,mod)
for p in body.data.polygons:p.use_smooth=True
facets(body,.25)
# Two actual turned petals, attached at the neck and resting on the chest.
pillow('Left ivory collar',[(502,734),(477,708),(452,699),(439,704),(425,733),(435,752),(462,772),(477,765),(492,746)],lambda x,z:-.074-(.98-z)*.48,.010,cream,back=.007)
pillow('Right ivory collar',[(503,734),(526,709),(548,700),(564,703),(582,731),(571,751),(547,771),(532,765),(515,746)],lambda x,z:-.074-(.98-z)*.48,.010,cream,back=.007)

# Collar continues around the back of the neck.
v=[];f=[];n=40
for k in range(3):
 t=k/2
 for j in range(n+1):
  a=j*math.pi/n;v.append(((.071+.024*t)*math.cos(a),.025+(.052+.028*t)*math.sin(a),.977-.048*t))
for k in range(2):
 for j in range(n):a=k*(n+1)+j;f.append((a,a+1,a+n+2,a+n+1))
o=mesh('Turned back collar',v,f,cream);mod=o.modifiers.new('Back collar thickness','SOLIDIFY');mod.thickness=.007;apply(o,mod)
mod=o.modifiers.new('Soft back collar edge','BEVEL');mod.width=.003;mod.segments=2;apply(o,mod)

# Linen legs have a wider, gathered ankle; boots are separate volumes with soles.
for side in [-1,1]:
 name='Left' if side<0 else 'Right'
 pant=loft(name+' loose linen leg',[(.142,.082,.078),(.151,.094,.086),(.174,.099,.088),(.205,.091,.084),(.29,.084,.081),(.38,.078,.078),(.48,.071,.075),(.512,.075,.08)],linen,40,side*.108,.008,.80)
 mod=pant.modifiers.new('Relaxed linen','SUBSURF');mod.levels=1;apply(pant,mod)
 mod=pant.modifiers.new('Linen planes','DECIMATE');mod.ratio=.28;apply(pant,mod);facets(pant,.30)
 boot=loft(name+' rounded boot',[(.029,.089,.111),(.052,.098,.125),(.090,.097,.128),(.120,.086,.118),(.150,.065,.090),(.157,.044,.062)],shoes,32,side*.124,-.025,.76)
 mod=boot.modifiers.new('Rounded toe edge','BEVEL');mod.width=.008;mod.segments=2;apply(boot,mod);facets(boot,.22)
 sole=loft(name+' stitched sole',[(.001,.09,.115),(.010,.099,.129),(.031,.099,.128),(.036,.094,.121)],shoes,40,side*.124,-.025,.77)
 mod=sole.modifiers.new('Sole edge','BEVEL');mod.width=.003;mod.segments=2;apply(sole,mod)

# Cross-body strap follows the convex front, wide enough to read at game scale.
# Constant-width curved leather ribbon, rather than a swollen elongated pillow.
points=[Vector(p) for p in [(417,740),(469,829),(535,916),(595,982)]]
v=[];f=[];steps=48;across=8
for i in range(steps+1):
 t=i/steps;p=points[0]*(1-t)**3+3*points[1]*t*(1-t)**2+3*points[2]*t*t*(1-t)+points[3]*t**3
 tangent=3*(points[1]-points[0])*(1-t)**2+6*(points[2]-points[1])*(1-t)*t+3*(points[3]-points[2])*t*t
 normal=Vector((-tangent.y,tangent.x)).normalized()
 for j in range(across+1):
  u=-1+2*j/across;q=p+normal*u*19;x,z=xyz(q.x,q.y).xz
  v.append((x,-.133+.15*x*x+.75*max(0,z-.86)-.006*(1-u*u),z))
for i in range(steps):
 for j in range(across):
  a=i*(across+1)+j;f.append((a,a+1,a+across+2,a+across+1))
o=mesh('Wide curved leather strap',v,f,leather);mod=o.modifiers.new('Leather thickness','SOLIDIFY');mod.thickness=.007;apply(o,mod)
mod=o.modifiers.new('Soft strap edges','BEVEL');mod.width=.003;mod.segments=2;apply(o,mod)
# Leather wraps over the shoulder between the front and back runs.
v=[];f=[]
for i in range(17):
 t=i/16
 for side in [-1,1]:v.append((-.139+side*.024,-.091+.182*t,.929+.017*math.sin(math.pi*t)))
for i in range(16):a=i*2;f.append((a,a+1,a+3,a+2))
o=mesh('Leather over shoulder',v,f,leather);mod=o.modifiers.new('Shoulder strap thickness','SOLIDIFY');mod.thickness=.007;apply(o,mod)
# The same strap continues across the back to the right hip.
v=[];f=[];steps=40;across=8
for i in range(steps+1):
 t=i/steps;x=-.139+.335*t;z=.929-.377*t
 for j in range(across+1):
  u=-1+2*j/across;xx=x+.021*u;zz=z+.019*u
  yy=.133-.14*xx*xx-.75*max(0,zz-.86)+.006*(1-u*u)
  v.append((xx,yy,zz))
for i in range(steps):
 for j in range(across):a=i*(across+1)+j;f.append((a,a+across+1,a+across+2,a+1))
o=mesh('Continuous back leather strap',v,f,leather);mod=o.modifiers.new('Back strap thickness','SOLIDIFY');mod.thickness=.007;apply(o,mod)
mod=o.modifiers.new('Back strap soft edge','BEVEL');mod.width=.003;mod.segments=2;apply(o,mod)
pillow('Soft satchel body',[(606,954),(626,941),(650,947),(671,971),(682,1005),(680,1044),(666,1079),(642,1094),(619,1088),(602,1066),(593,1033),(593,990)],-.173,.054,leather,back=.110,facet=.10)
pillow('Folded satchel flap',[(608,950),(631,951),(651,967),(668,992),(674,1006),(669,1020),(653,1028),(634,1021),(622,1002)],-.216,.025,leather,back=.014)
p=xyz(665,1003,-.257);ellipsoid('Ivory bag stud',p,(.008,.005,.013),cream)

# Orthographic frame uses exactly the reference pixel-to-world mapping.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24 if os.environ.get('STUDY_QUICK') else 80;scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('Warm studio');scene.world.color=(.16,.16,.16)
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.56,.43,1);world.node_tree.nodes['Background'].inputs[1].default_value=.25

def area(name,position,power,size,color,target=(0,0,.95)):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Large soft key',(-2.3,-3.5,3.5),350,4.0,(1,.95,.88))
area('Soft frontal fill',(2,-3,1.8),180,3.0,(1,.96,.91))
area('Warm rim',(0,2.2,2.2),250,2.0,(1,.78,.56))
camdata=bpy.data.cameras.new('Reference matched camera');cam=bpy.data.objects.new('Reference matched camera',camdata);bpy.context.collection.objects.link(cam);cam.location=(0,-6,619/700);cam.rotation_euler=(Vector((0,0,619/700))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=1536/700;scene.camera=cam
scene.render.resolution_x=1024;scene.render.resolution_y=1536;scene.render.resolution_percentage=75
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=0
# A real studio backdrop keeps all shading in the Blender render.
scene.render.film_transparent=False
backdrop=material('Warm paper backdrop','#e9dfcf')
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,1.2,1));o=bpy.context.object;o.name='Studio backdrop';o.rotation_euler.x=math.pi/2;o.data.materials.append(backdrop)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'reference-traveler.blend'))
scene.render.filepath=os.path.join(OUT,'front.png');bpy.ops.render.render(write_still=True)
# A transparent frontal render supports honest silhouette overlays.
back=bpy.data.objects['Studio backdrop'];back.visible_camera=False;scene.render.film_transparent=True
scene.render.filepath=os.path.join(OUT,'front-transparent.png');bpy.ops.render.render(write_still=True)
scene.render.resolution_percentage=50;scene.cycles.samples=40
for label,angle in [('three-quarter',math.pi/4),('side',math.pi/2),('back',math.pi)]:
 cam.location=(6*math.sin(angle),-6*math.cos(angle),619/700);cam.rotation_euler=(Vector((0,0,619/700))-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=os.path.join(OUT,label+'.png');bpy.ops.render.render(write_still=True)
print('STUDY_SAVED',OUT)
