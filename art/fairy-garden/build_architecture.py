"""Replace six building silhouettes while retaining the spacious village and usable doorways.
Blender --background --python art/fairy-garden/build_architecture.py -- ART_ROOT OUTPUT_DIR
MAPS.garden.architecture owns footprints. Outputs .blend and previews outside the app bundle.
"""
import bpy,bmesh,math,random,json,subprocess,sys
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
plan=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS.garden))"],cwd=repo))
bpy.ops.wm.open_mainfile(filepath=str(base/'spacious-village/village-spacious.blend'))
random.seed(920)
# Retain wells, planters, paths, market and the real noticeboard; replace building fabric.
replace_collections={'01','02','03','04','07','13'}
for o in list(bpy.data.objects):
 cols={c.name[:2] for c in o.users_collection}
 if (cols & replace_collections) or o.get('district')=='museum' or o.name.startswith(('Hall extra','Hall window')):bpy.data.objects.remove(o,do_unlink=True)
def remove_legacy_market():
 for o in list(bpy.data.objects):
  if o.name.startswith(('Market ', 'Folded market')):bpy.data.objects.remove(o,do_unlink=True)
if plan.get('market'):remove_legacy_market()
M=bpy.data.materials

def material(name,color,rough=.85,metal=0,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emit:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=7;n.inputs['Detail'].default_value=2
 ramp=m.node_tree.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=tuple(c*.87 for c in color)+(1,);ramp.color_ramp.elements[1].color=tuple(min(1,c*1.08) for c in color)+(1,)
 m.node_tree.links.new(n.outputs['Fac'],ramp.inputs[0]);m.node_tree.links.new(ramp.outputs['Color'],p.inputs['Base Color']);return m
wood=material('Architecture walnut wood',(.20,.13,.105));oak=material('Architecture warm oak',(.43,.29,.16));ivory=material('Architecture ivory plaster',(.79,.71,.55));rose=material('Architecture apricot plaster',(.69,.46,.34));stone=material('Architecture limestone',(.49,.49,.39));stone2=material('Architecture warm limestone',(.63,.59,.47));brass=material('Architecture aged brass',(.49,.35,.14),.55,.5);dark=material('Architecture deep recess',(.09,.125,.12));glass=material('Architecture honey glass',(.78,.57,.26),.35,0,.18);leaf=material('Architecture vine foliage',(.25,.40,.25));leaf2=material('Architecture soft foliage',(.39,.49,.28));petal=material('Architecture dusty rose blossom',(.75,.44,.43));sage=material('Architecture painted sage wood',(.28,.42,.36));blue=material('Architecture blue glass roof',(.30,.49,.50),.3,.12);blueLight=material('Architecture pale blue glass roof',(.53,.67,.63),.3,.12)
roofs={k:[material('Architecture '+k+' roof '+str(i),tuple(c*f for c in color)) for i,f in enumerate([.85,.93,1,1.08])] for k,color in {'moss':(.21,.35,.29),'plum':(.32,.24,.34),'clay':(.48,.27,.20),'blue':(.21,.32,.40),'straw':(.48,.43,.25)}.items()}
current='home'
def xyz(x,z,h):return (x,-z,h)
def mesh(name,verts,faces,mat,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata([xyz(*v) for v in verts],[],faces);d.update();bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();
 if name in {'Curved tower roof shingles','Conservatory glass roof panel','Curved roof lining'}:
  for f in d.polygons:
   if f.normal.z<0:f.flip()
 o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.data.materials.append(mat);o['district']=current
 if bevel:mod=o.modifiers.new('Rounded painted edge','BEVEL');mod.width=bevel;mod.segments=2
 return o

def box(name,x,z,h,w,d,t,mat=wood,bevel=.025):
 v=[(x+a*w/2,z+b*d/2,h+c*t/2) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 return mesh(name,v,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],mat,bevel)

def rod(name,a,b,r=.04,mat=wood):
 av,bv=Vector(a),Vector(b);axis=(bv-av).normalized();ref=Vector((0,0,1)) if abs(axis.z)<.9 else Vector((1,0,0));u=axis.cross(ref).normalized()*r;v=axis.cross(u).normalized()*r
 verts=[tuple(p+u*math.cos(j*math.tau/8)+v*math.sin(j*math.tau/8)) for p in [av,bv] for j in range(8)];faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)];return mesh(name,verts,faces,mat)

def line(name,pts,r=.04,mat=wood):
 for a,b in zip(pts,pts[1:]):rod(name,a,b,r,mat)

def sphere(name,x,z,h,sx,sz,sy,mat=leaf):
 verts=[(x+sx*math.sin(j*math.pi/6)*math.cos(i*math.tau/10),z+sz*math.sin(j*math.pi/6)*math.sin(i*math.tau/10),h+sy*math.cos(j*math.pi/6)) for j in range(7) for i in range(10)]
 faces=[(j*10+i,j*10+(i+1)%10,(j+1)*10+(i+1)%10,(j+1)*10+i) for j in range(6) for i in range(10)];o=mesh(name,verts,faces,mat)
 for p in o.data.polygons:p.use_smooth=True
 return o

def cylinder(name,x,z,bottom,r,h,mat=stone,n=20,top=None):
 top=r if top is None else top
 v=[(x+rad*math.cos(i*math.tau/n),z+rad*math.sin(i*math.tau/n),y) for rad,y in [(r,bottom),(top,bottom+h)] for i in range(n)]
 return mesh(name,v,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)

def arch(name,x,z,bottom,w,h,mat,depth=.09):
 r=w/2;spring=bottom+h-r;outline=[(x-r,bottom),(x+r,bottom)]+[(x+r*math.cos(a*math.pi/12),spring+r*math.sin(a*math.pi/12)) for a in range(13)]
 verts=[(xx,z+side*depth/2,yy) for side in [-1,1] for xx,yy in outline];n=len(outline);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh(name,verts,faces,mat,.012)

def arch_trim(x,z,b,w,h,mat=wood,r=.055):
 y=b+h-w/2;line('Arched moulding',[(x-w/2,z,b),(x-w/2,z,y)]+[(x+w/2*math.cos(math.pi-i*math.pi/16),z,y+w/2*math.sin(math.pi-i*math.pi/16)) for i in range(17)]+[(x+w/2,z,b)],r,mat)

def window(x,z,b,w=.72,h=1.12,shutters=False):
 arch('Recessed window shadow',x,z,b-.055,w+.14,h+.13,dark);arch('Amber leaded window',x,z+.055,b,w,h,glass);arch_trim(x,z+.10,b,w,h)
 rod('Window upright',(x,z+.12,b+.04),(x,z+.12,b+h-.04),.021,wood);rod('Window transom',(x-w*.45,z+.12,b+h*.44),(x+w*.45,z+.12,b+h*.44),.023,wood)
 box('Carved window sill',x,z+.13,b-.055,w+.22,.27,.11,oak)
 if shutters:
  for sign in [-1,1]:
   box('Weathered hinged shutter',x+sign*(w/2+.18),z+.045,b+h*.44,.27,.09,h*.88,sage)
   for dy in [.18,.65]:box('Shutter strap',x+sign*(w/2+.18),z+.105,b+h*dy,.26,.04,.05,wood)

def side_window(x,z,b,w=.9,h=1.2):
 before=set(bpy.data.objects);window(0,0,b,w,h)
 for o in set(bpy.data.objects)-before:
  for v in o.data.vertices:
   xx,yy=v.co.x,v.co.y;v.co.x=x-yy;v.co.y=xx-z
  o.data.update()

def round_window(x,z,h,r=.35):
 pts=[(x+r*math.cos(a*math.tau/32),z,h+r*math.sin(a*math.tau/32)) for a in range(33)];mesh('Round glowing window',[(x,z-.015,h)]+pts,[(0,i,i+1) for i in range(1,33)],glass);line('Round window timber',pts,.045,wood)
 rod('Round window cross',(x-r,z+.03,h),(x+r,z+.03,h),.025,wood);rod('Round window cross',(x,z+.03,h-r),(x,z+.03,h+r),.025,wood)

def door(x,z,w=1,h=1.85):
 arch('Deep door recess',x,z,.1,w+.2,h+.17,dark);arch('Painted arched oak door',x,z+.07,.12,w,h,oak);arch_trim(x,z+.13,.12,w+.10,h+.08,stone2,.085)
 for i in [-1.5,-.5,.5,1.5]:rod('Door plank seam',(x+i*w/5,z+.125,.18),(x+i*w/5,z+.125,1.38),.009,wood)
 for yy in [.45,1.18]:box('Door iron hinge',x-w*.2,z+.15,yy,w*.36,.04,.045,brass)
 sphere('Door brass handle',x+w*.3,z+.17,.99,.052,.035,.052,brass)

# Continuous curved roof surfaces, with batched hand-laid scalloped tile courses.
def roof(x,z,w,d,eave,rise,palette='moss',axis='z',skew=0,rows=8):
 half=w/2+.30;length=d+.52;colors=roofs[palette];batches=[([],[]) for _ in colors]
 def point(u,v,lift=0):
  ratio=min(1,abs(u)/half);y=eave+rise*(1-ratio)**.88+.13*ratio**7-.075*math.sin((v/length+.5)*math.pi)+lift
  return (x+(u+skew*(1-ratio) if axis=='z' else v),z+(v if axis=='z' else u+skew*(1-ratio)),y)
 for sign in [-1,1]:
  verts=[point(sign*half*j/rows,v,-.16) for v in [-length/2,length/2] for j in range(rows+1)];faces=[(j,j+1,j+rows+2,j+rows+1) for j in range(rows)];mesh('Curved roof lining',verts,faces,wood)
  for j in range(rows):
   count=max(3,round(length/.43));step=length/count
   for i in range(count):
    a=-length/2+i*step;b=a+step*.98;u0=sign*half*j/rows;u1=sign*min(half,half*(j+1.09)/rows)
    vertices=[point(u0,a,.04),point(u0,b,.04),point(u1,b,.045),point(u1,(a+b)/2,.035),point(u1,a,.045)]
    k=random.choices(range(4),[1,3,5,1])[0];vs,fs=batches[k];n=len(vs);vs.extend(vertices);vs.extend([(xx,zz,yy-.045) for xx,zz,yy in vertices]);fs.extend([(n,n+1,n+2,n+3,n+4),(n+9,n+8,n+7,n+6,n+5)]+[(n+a,n+(a+1)%5,n+(a+1)%5+5,n+a+5) for a in range(5)])
  for v in [-length/2-.02,length/2+.02]:line('Swept gable fascia',[point(sign*half*j/20,v,.03) for j in range(21)],.065,wood)
  line('Deep overhanging eave',[point(sign*half,v,.025) for v in [-length/2,length/2]],.075,wood)
 for i,(verts,faces) in enumerate(batches):mesh('Hand-painted '+palette+' roof tiles',verts,faces,colors[i])
 line('Rounded roof ridge',[point(0,-length/2+i*length/18,.08) for i in range(19)],.09,colors[1])
 # Filled front and rear gables match the roof curvature instead of leaving a hollow silhouette.
 for v in [-d/2-.02,d/2+.02]:
  arc=[point(-half+2*half*j/24,v,-.055) for j in range(25)]
  bottom=[(a,b,eave-.1) for a,b,_ in arc]
  mesh('Curved plaster gable',bottom+arc,[(j,j+1,j+26,j+25) for j in range(24)],ivory)

def mill_wheel(name,x,z,h,r,d,timber,band,paddles=True):
 # Reused by the exterior waterwheel and the workshop drive wheel. Axis follows game z.
 for side in [-1,1]:
  zz=z+side*d/2;verts=[];faces=[]
  for j in range(49):
   a=j*math.tau/48
   for radius in [r*.83,r]:verts.append((x+math.cos(a)*radius,zz,h+math.sin(a)*radius))
   if j:faces.append((j*2-2,j*2,j*2+1,j*2-1))
  mesh(name+' wooden rim',verts,faces,timber)
  line(name+' iron hoop',[(x+math.cos(j*math.tau/48)*r*.94,zz,h+math.sin(j*math.tau/48)*r*.94) for j in range(49)],.025,band)
  for j in range(8):
   a=j*math.tau/8;rod(name+' spoke',(x,zz,h),(x+math.cos(a)*r*.88,zz,h+math.sin(a)*r*.88),r*.055,timber)
 if paddles:
  for j in range(20):
   a=j*math.tau/20;vertices=[]
   for zz in [z-d*.6,z+d*.6]:
    for radius in [r*.82,r*1.04]:vertices.append((x+math.cos(a)*radius,zz,h+math.sin(a)*radius))
   mesh(name+' scoop paddle',vertices,[(0,1,3,2)],timber,.01)
 rod(name+' axle',(x,z-d*.85,h),(x,z+d*.85,h),r*.13,timber)

def body(part,mat=ivory):
 x,z,w,d,h=[part[k] for k in ['x','z','w','d','h']];box('Limestone footing',x,z,.24,w+.1,d+.1,.34,stone,.06);box('Hand plastered wall',x,z,h/2+.22,w,d,h,mat,.065)
 for dx in [-w/2+.04,w/2-.04]:
  for dz in [-d/2+.04,d/2-.04]:box('Structural corner post',x+dx,z+dz,h/2+.2,.14,.14,h+.08,wood)
 for y in [.48,h+.16]:box('Front timber course',x,z+d/2+.035,y,w+.07,.11,.12,wood)
 # Intermittent foundation stones make the plinth less perfectly uniform.
 for i in range(max(3,int(w/.46))):box('Weathered foundation block',x-w/2+.25+i*.46,z+d/2+.065,.26,.41,.09,.19,stone2,.028)

def chimney(x,z,baseh,h=1.3):
 box('Tall crooked chimney',x,z,baseh+h/2,.53,.56,h,ivory,.04)
 for j in range(5):box('Chimney exposed brick',x+(.07 if j%2 else -.07),z+.29,baseh+.15+j*h/5,.31,.04,.095,stone)
 box('Chimney stone crown',x,z,baseh+h,.77,.77,.17,stone2);box('Chimney soot opening',x,z,baseh+h+.09,.39,.4,.025,dark,0)

def boxflowers(x,z,b,w=1.0):
 box('Window planter',x,z,b,w,.30,.23,oak);box('Planter soil',x,z,b+.125,w-.1,.24,.03,dark,0)
 for i in range(5):
  xx=x-w*.4+i*w*.2;sphere('Planter soft leaves',xx,z,b+.24,.14,.15,.11,leaf)
  if i%2==0:
   for j in range(4):sphere('Planter blossom',xx+.05*math.cos(j*math.pi/2),z+.05*math.sin(j*math.pi/2),b+.34,.052,.052,.034,petal)

def vine(x,z,b,h,spread=.4):
 pts=[(x+math.sin(i*.8)*spread,z,b+h*i/12) for i in range(13)];line('Climbing vine stem',pts,.015,wood)
 for i,(xx,zz,yy) in enumerate(pts):
  for sign in [-1,1]:sphere('Vine ivy foliage',xx+sign*.1,zz+.03,yy+.025,.12,.035,.07,leaf if i%3 else leaf2)

def canopy(x,z,w=1.65,d=.9,h=2.2,palette='moss',posts=True):
 roof(x,z,w,d,h,.5,palette,rows=4)
 for xx in ([x-w/2+.06,x+w/2-.06] if posts else []):
  rod('Porch timber post',(xx,z+d/2-.07,.08),(xx,z+d/2-.07,h+.1),.055,wood)
  rod('Porch curved knee brace',(xx,z+d/2-.07,h-.45),(xx+(.3 if xx<x else -.3),z+d/2-.07,h-.06),.043,oak)

def lantern(x,z,h):
 rod('Wall lantern bracket',(x,z-.1,h+.3),(x,z+.23,h+.3),.025,brass)
 box('Lantern warm glass',x,z+.23,h,.18,.18,.27,glass)
 for yy in [h-.16,h+.16]:box('Lantern brass cap',x,z+.23,yy,.26,.25,.045,brass)

def home(cfg):
 a,b=cfg['parts'];body(a);body(b);roof(a['x'],a['z'],a['w'],a['d'],2.84,1.9,'moss',skew=-.18);roof(b['x'],b['z'],b['d'],b['w'],2.40,1.3,'clay',axis='x')
 front=a['z']+a['d']/2;door(cfg['door']['x'],front+.045);canopy(cfg['door']['x'],front+.27,1.55,.68,2.18,'moss');round_window(a['x']+.1,front+.06,3.62,.34)
 window(a['x']+1.01,front+.06,.92,.57,1.05);boxflowers(a['x']+1.01,front+.20,.76,.77)
 # The side wing has its own broad arched window and a visibly lower roofline.
 window(b['x'],b['z']+b['d']/2+.055,.65,1.4,1.5);boxflowers(b['x'],b['z']+b['d']/2+.21,.52,1.65)
 side_window(b['x']+b['w']/2+.045,b['z'],.75,1.2,1.15)
 chimney(a['x']-1.02,a['z']-.85,3.5,1.65);chimney(b['x']+.85,b['z']-.65,2.7,.95)
 vine(a['x']-1.48,front+.1,.36,2.1,.14);lantern(cfg['door']['x']-.69,front+.12,1.75)
 p=cfg['porch'];box('Home broad threshold',p['x'],p['z'],p['height']-.065,p['w'],p['d'],.13,stone2)

def hall(cfg):
 a=cfg['parts'][0];body(a);x,z,w,d=a['x'],a['z'],a['w'],a['d'];front=z+d/2
 roof(x,z,d,w,3.55,1.85,'plum',axis='x');door(x,front+.05,1.25,2.3)
 # Central cross-gable and a timber bell lantern interrupt the long roof, rather than a scaled cottage.
 canopy(x,front+.35,2.2,1.05,2.8,'plum');round_window(x,front+.11,3.39,.38)
 for dx in [-3,-1.85,1.85,3]:window(x+dx,front+.06,.85,.70,1.43)
 for dx in [-3.15,3.15]:window(x+dx,front+.06,2.59,.53,.67)
 for dx in [-3.72,3.72]:
  box('Longhouse veranda plinth',x+dx,front+.2,.14,.48,.68,.14,stone2)
  rod('Longhouse veranda pillar',(x+dx,front+.3,.1),(x+dx,front+.3,2.55),.07,wood)
 box('Bell lantern base',x+.85,z,5.13,1.12,1.07,.16,wood)
 for dx in [-.43,.43]:
  for dz in [-.4,.4]:rod('Bell lantern upright',(x+.85+dx,z+dz,5.15),(x+.85+dx,z+dz,6.04),.05,wood)
 cylinder('Old brass village bell',x+.85,z,5.36,.27,.38,brass,16,top=.13);sphere('Bell clapper',x+.85,z,5.34,.055,.055,.055,brass)
 roof(x+.85,z,1.2,1.1,6.0,.67,'plum',rows=4);rod('Bell finial',(x+.85,z,6.66),(x+.85,z,7.05),.025,brass)
 side_window(x+w/2+.035,z,.90,1.55,1.6)
 for sign in [-1,1]:rod('Longhouse end truss',(x+w/2+.05,z+sign*d/2,3.58),(x+w/2+.05,z,5.3),.055,wood)
 chimney(x-3.0,z-.6,3.95,1.5)
 for dx in [-2.65,2.65]:boxflowers(x+dx,front+.19,.61,1.17)
 lantern(x-1.08,front+.12,2.2);lantern(x+1.08,front+.12,2.2)

def attic(cfg):
 a=cfg['parts'][0];body(a,rose);x,z,w,d=a['x'],a['z'],a['w'],a['d'];front=z+d/2;roof(x,z,w,d,2.48,2.55,'clay',skew=.22)
 door(cfg['door']['x'],front+.05,.87,1.72);window(x,front+.075,3.0,.68,1.12,True)
 for dx in [-1.07,1.07]:window(x+dx,front+.07,.86,.48,.89)
 # A high projecting eyebrow roof over the attic window, and diagonal timber below it.
 canopy(x,front+.03,1.35,.38,4.1,'clay',posts=False)
 for sign in [-1,1]:rod('Attic diagonal timber',(x+sign*1.5,front+.045,2.5),(x+sign*.42,front+.045,3.65),.052,wood)
 side_window(x+w/2+.035,z,.95,1.2,1.15)
 chimney(x-1.05,z-.7,3.65,1.65);boxflowers(x+1.04,front+.20,.68,.73);lantern(x-.63,front+.10,1.77)

def cone_roof(x,z,bottom,r,h,palette='blue'):
 colors=roofs[palette]
 # Ring courses curve gently inward; the lower lip flares outward.
 for j in range(10):
  t=j/10;t2=(j+1)/10;r1=r*(1-t)**.8;r2=r*(1-t2)**.8;hh=bottom+h*t;hh2=bottom+h*t2;n=20
  for i in range(n):
   a=i*math.tau/n;b=(i+1)*math.tau/n
   mesh('Curved tower roof shingles',[(x+r1*math.cos(a),z+r1*math.sin(a),hh),(x+r1*math.cos(b),z+r1*math.sin(b),hh),(x+r2*math.cos(b),z+r2*math.sin(b),hh2),(x+r2*math.cos(a),z+r2*math.sin(a),hh2)],[(0,1,2,3)],random.choice(colors))
 sphere('Tower brass finial',x,z,bottom+h+.06,.075,.075,.105,brass)

def study(cfg):
 a,b=cfg['parts'];x,z,r,h=a['x'],a['z'],a['r'],a['h'];cylinder('Round study stone footing',x,z,.06,r+.1,.42,stone2);cylinder('Round limewashed study',x,z,.32,r,h-.12,ivory,24)
 for level in [.55,2.35,3.65]:
  pts=[(x+(r+.025)*math.cos(i*math.tau/32),z+(r+.025)*math.sin(i*math.tau/32),level) for i in range(33)];line('Tower timber belt',pts,.045,wood)
 cone_roof(x,z,3.8,r+.38,2.45,'blue');body(b,sage);roof(b['x'],b['z'],b['w'],b['d'],2.30,.9,'blue')
 door(x,z+r+.025,.86,1.8);round_window(x,z+r+.04,2.91,.39);window(b['x']+.2,b['z']+b['d']/2+.04,.79,.71,1.1)
 side_window(b['x']+b['w']/2+.04,b['z'],.72,1.05,1.15)
 lantern(x-.72,z+r*.9,1.75)
 # A crescent weather vane gives the tower an astronomical identity.
 pts=[(x+.18*math.cos(.4+i*5.1/20),z,6.47+.23*math.sin(.4+i*5.1/20)) for i in range(21)];line('Study crescent vane',pts,.028,brass)

def barrel(x,z,w,d,eave,rise):
 half=w/2;segments=16
 for i in range(segments):
  a=math.pi*i/segments;b=math.pi*(i+1)/segments
  mesh('Conservatory glass roof panel',[(x+half*math.cos(a),z-d/2,eave+rise*math.sin(a)),(x+half*math.cos(b),z-d/2,eave+rise*math.sin(b)),(x+half*math.cos(b),z+d/2,eave+rise*math.sin(b)),(x+half*math.cos(a),z+d/2,eave+rise*math.sin(a))],[(0,1,2,3)],blue if i%4 else blueLight)
 for k in range(7):
  zz=z-d/2+d*k/6;line('Conservatory arched brass rib',[(x+half*math.cos(i*math.pi/24),zz,eave+rise*math.sin(i*math.pi/24)+.018) for i in range(25)],.035,brass)
 for i in [0,4,8,12,16]:
  a=math.pi*i/16;rod('Conservatory long glazing rail',(x+half*math.cos(a),z-d/2,eave+rise*math.sin(a)+.03),(x+half*math.cos(a),z+d/2,eave+rise*math.sin(a)+.03),.024,brass)

def gardener(cfg):
 a,b=cfg['parts'];body(a);x,z,w,d=a['x'],a['z'],a['w'],a['d'];front=z+d/2
 roof(x,z,w+.22,d,2.55,1.12,'straw',skew=-.3,rows=9);door(cfg['door']['x'],front+.05,.94,1.8);round_window(x-.05,front+.06,2.9,.23)
 for dx in [-1.12,1.12]:window(x+dx,front+.08,.9,.5,.97,True);boxflowers(x+dx,front+.24,.70,.72)
 body(b,sage);barrel(b['x'],b['z'],b['w']+.13,b['d']+.16,1.86,.65)
 window(b['x'],b['z']+b['d']/2+.06,.49,1.35,1.27)
 side_window(b['x']+b['w']/2+.04,b['z'],.55,1.6,1.1)
 chimney(x-.93,z-.62,2.95,1.25);vine(x+1.38,front+.15,.42,1.98,.13);lantern(x-.64,front+.09,1.78)

def museum(cfg):
 a=cfg['parts'][0];x,z,w,d=a['x'],a['z'],a['w'],a['d'];front=z+d/2
 box('Conservatory limestone base',x,z,.39,w,d,.65,stone2,.06)
 box('Gallery inner shade',x,z,1.35,w-.2,d-.18,1.5,sage,.02)
 for xx in [x-w/2,x+w/2]:
  box('Gallery glass side',xx,z,1.46,.08,d,1.48,blue)
  for yy in [.7,1.38,2.15]:rod('Gallery long wall rail',(xx,z-d/2,yy),(xx,z+d/2,yy),.035,brass)
  for dz in [-d/2,-d/6,d/6,d/2]:rod('Gallery slender wall frame',(xx,z+dz,.66),(xx,z+dz,2.17),.04,brass)
 barrel(x,z,w+.18,d+.26,2.16,1.62)
 # A fan of glazing over a central arched entry; large windows flank it.
 arch('Conservatory front glazing',x,front+.04,.66,w,3.14,blue,.035)
 # Use the actual elliptical roof profile for the upper fan, not the door's semicircle profile.
 verts=[(x,front+.07,2.16)]+[(x+(w/2+.09)*math.cos(i*math.pi/24),front+.07,2.16+1.62*math.sin(i*math.pi/24)) for i in range(25)]
 mesh('Elliptical front fanlight',verts,[(0,i,i+1) for i in range(1,25)],blueLight)
 for i in range(0,25,4):rod('Fanlight radiating brass',(x,front+.09,2.16),verts[i+1],.025,brass)
 door(cfg['door']['x'],front+.11,1.08,2.05)
 for dx in [-1.83,1.83]:window(x+dx,front+.12,.8,1.1,1.32)
 for dx in [-w/2,-.78,.78,w/2]:rod('Conservatory front upright',(x+dx,front+.14,.39),(x+dx,front+.14,2.17),.045,brass)
 box('Gallery stone lintel',x,front+.04,.7,w+.12,.19,.14,stone2)
 # Leaf medallion replaces a generic cottage attic window.
 sphere('Gallery leaf medallion',x,front+.12,3.18,.22,.06,.3,brass);rod('Leaf engraved stem',(x-.10,front+.185,3.0),(x+.1,front+.185,3.35),.012,sage)
 for dx in [-.78,.78]:lantern(x+dx,front+.14,1.75)
 p=cfg['porch'];box('Museum familiar doorstep',p['x'],p['z'],p['height']-.06,p['w'],p['d'],.12,stone2)

builders={'home':home,'hall':hall,'neighbor1':attic,'neighbor2':study,'neighbor3':gardener,'museum':museum}
for current,fn in builders.items():fn(plan['architecture'][current])
# A neutral daylight overview and individual close views for review.
scene=bpy.context.scene
for o in bpy.data.objects:
 if o.type=='LIGHT':
  if o.data.type=='SUN':o.data.energy=2.2;o.data.angle=.35
  else:o.data.energy=min(o.data.energy,200)
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.65,.72,.76,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.6
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_percentage=100

def camera(target,scale,width=1400,height=1100):
 old=scene.camera
 if old is None:
  d=bpy.data.cameras.new('Architecture camera');old=bpy.data.objects.new('Architecture camera',d);scene.collection.objects.link(old)
 tx,tz,th=target;old.location=xyz(tx+13,tz+18,th+15);old.rotation_euler=(Vector(xyz(*target))-old.location).to_track_quat('-Z','Y').to_euler();old.data.type='ORTHO';old.data.ortho_scale=scale;scene.camera=old;scene.render.resolution_x=width;scene.render.resolution_y=height
camera((0,0,1),64,1700,1300)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'village-architecture.blend'));scene.render.filepath=str(out/'village-architecture.png');bpy.ops.render.render(write_still=True)
for current in builders:
 for o in bpy.data.objects:
  if o.type in {'MESH','CURVE'}:o.hide_render=o.get('district') not in {current,'ground'}
 c=plan['architecture'][current]['parts'][0];camera((c['x'],c['z'],2.0),13 if current=='hall' else 9.8)
 scene.render.filepath=str(out/(current+'-exterior.png'));bpy.ops.render.render(write_still=True)
 for o in bpy.data.objects:
  if o.type in {'MESH','CURVE'}:o.hide_render=o.get('district')!=current
 bpy.ops.wm.save_as_mainfile(filepath=str(out/('village-'+current+'.blend')))
print('ARCHITECTURE_READY',flush=True)
