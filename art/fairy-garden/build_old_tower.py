"""Continuous northern woodland and ruined observatory, in three streamed GLBs.
Blender --background --python art/fairy-garden/build_old_tower.py -- OUTPUT_DIR
MAPS.garden.oldTower supplies trunks, thickets, the winding trail, tower and collision rocks.
"""
import bpy,bmesh,math,random,json,subprocess,sys,ast
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
plan=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS.garden.oldTower))"],cwd=repo))
bpy.ops.wm.read_factory_settings(use_empty=True)
source=ast.parse((Path(__file__).with_name('build_architecture.py')).read_text())
def shared(names):
 for n in source.body:
  if isinstance(n,ast.FunctionDef) and n.name in names:exec(compile(ast.Module(body=[n],type_ignores=[]),'<architecture>','exec'),globals())
shared({'material'})
wood=material('Old tower charcoal walnut wood',(.18,.17,.135));oak=material('Old tower silver oak wood',(.33,.30,.22));stone=material('Old tower blue grey stone',(.35,.40,.38));stone2=material('Old tower light weathered stone',(.51,.53,.46));dark=material('Old tower deep window',(.065,.10,.10));brass=material('Old tower aged copper',(.32,.41,.33),.62,.35);moss=material('Old tower moss foliage',(.27,.36,.21));leaf=material('Northern fern foliage',(.23,.36,.26));earth=material('Northern shaded grass earth',(.29,.37,.23));trailmat=material('Northern path earth',(.39,.37,.27));edge=material('Northern path moss foliage',(.28,.36,.22));blue=material('Old tower moon glass',(.27,.48,.49),.3,0,.18)
leaves=[material('Northern canopy foliage '+str(i),c) for i,c in enumerate([(.13,.26,.22),(.19,.33,.25),(.24,.37,.27),(.31,.42,.30)])]
current='old-tower';shared({'xyz','mesh','box','rod','line','sphere','cylinder','arch','arch_trim'})
# Reuse the lake's open-surface orientation fix for the new path too.
for n in ast.parse(Path(__file__).with_name('build_lake.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name=='upward':exec(compile(ast.Module(body=[n],type_ignores=[]),'<lake-surface>','exec'),globals())
random.seed(91745)
def zone(z):return 'northwood-edge' if z>-29 else 'northwood-deep' if z>-40 else 'old-tower'
def distance_path(x,z):
 distances=[]
 for a,b in zip(plan['trail'],plan['trail'][1:]):
  dx,dz=b['x']-a['x'],b['z']-a['z'];t=max(0,min(1,((x-a['x'])*dx+(z-a['z'])*dz)/(dx*dx+dz*dz)));distances.append(math.hypot(x-a['x']-dx*t,z-a['z']-dz*t))
 return min(distances)
# Ground is continuous, not a raised rectangular diorama. Exact adjoining seams per stream zone.
for current,z0,z1 in [('northwood-edge',-29,-19),('northwood-deep',-40,-29),('old-tower',-57,-40)]:
 # Blend the initial edge into the existing meadow with a gently irregular lip.
 verts=[];faces=[]
 for row in range(13):
  z=z0+(z1-z0)*row/12
  for col in range(21):
   x=-19+col*1.9;h=.08 if abs(x)<15 else .04
   verts.append((x,z,h))
 for row in range(12):
  for col in range(20):i=row*21+col;faces.append((i,i+1,i+22,i+21))
 upward(mesh('Unbroken woodland ground',verts,faces,earth))['district']='preview-ground'  # Runtime already has the continuous village meadow.
# One joined ribbon, with shared cross-sections at bends: no overlapping flat strips.
points=[]
for a,b in zip(plan['trail'],plan['trail'][1:]):
 n=max(1,int(math.hypot(b['x']-a['x'],b['z']-a['z'])/.28))
 for i in range(n):points.append((a['x']+(b['x']-a['x'])*i/n,a['z']+(b['z']-a['z'])*i/n))
points.append((plan['trail'][-1]['x'],plan['trail'][-1]['z']))
edges=[]
for i,(x,z) in enumerate(points):
 a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)];dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);nx,nz=-dz/length,dx/length;w=.55+.08*math.sin(i*.37)
 edges.append([(x-nx*w,z-nz*w,.097),(x+nx*w,z+nz*w,.097)])
 if i%9==1:
  current=zone(z);sphere('Half buried old path stone',x+nx*.23,z+nz*.23,.105,.15,.11,.025,stone2)
for chunk in plan['chunks']:
 current=chunk['id'];verts=[];faces=[]
 for i in range(len(points)-1):
  if zone((points[i][1]+points[i+1][1])/2)!=current:continue
  k=len(verts);verts+=edges[i]+edges[i+1];faces.append((k,k+1,k+3,k+2))
 upward(mesh('Continuous narrow earth trail',verts,faces,trailmat))
# Closed thickets have visible low dense vegetation, not just collider polygons.
for a,b in zip(plan['woods'],plan['woods'][1:]):
 n=max(2,int(math.hypot(b['x']-a['x'],b['z']-a['z'])/.65))
 for i in range(n):
  t=i/n;z=a['z']+(b['z']-a['z'])*t;cx=a['x']+(b['x']-a['x'])*t;current=zone(z)
  for sign in [-1,1]:
   x=cx+sign*(plan['width']/2+.60+random.random()*.70)
   clearing=plan.get('clearing');
   if clearing and abs(x-clearing['x'])<clearing['w']/2+.6 and abs(z-clearing['z'])<clearing['d']/2+.6:continue
   if i%3!=0:sphere('Deep fern bank',x,z,.25+random.random()*.19,.38+random.random()*.32,.38,.22+random.random()*.19,leaves[(i+int(z))%4])
   for j in range(3):
    ang=j*2.3+sign;pts=[(x,z,.31),(x+math.cos(ang)*.3,z+math.sin(ang)*.3,.61),(x+math.cos(ang)*.60,z+math.sin(ang)*.60,.41)]
    line('Fern arched spine',pts,.013,moss)
    for k in range(1,4):
     t=k/4;xx=x+math.cos(ang)*.5*t;zz=z+math.sin(ang)*.5*t
     sphere('Fern frond',xx,zz,.38+.16*math.sin(math.pi*t),.12,.035,.025,leaf)
# Hand-shaped conifer whorls and small spreading oaks provide several silhouettes.
for n,q in enumerate(plan['trees']):
 current=q['zone'];x,z,h=q['x'],q['z'],q['height'];r=q['r']
 cylinder('Northern tapered trunk',x,z,.08,r,h*.82,wood,9,top=r*.40)
 if q['kind']=='fir':
  for level in range(5):
   bottom=1.45+level*h*.115;radius=1.55-level*.24;top=bottom+h*.39
   verts=[];sides=12
   for ring in range(3):
    for j in range(sides):
     a=j*math.tau/sides+(n%3)*.17;rr=[radius*.75,radius,.12][ring]*(1+.075*math.sin(j*3+n));hh=[bottom,bottom+.38,top][ring]+(.10*math.sin(j*2+n) if ring<2 else 0);verts.append((x+rr*math.cos(a),z+rr*math.sin(a),hh))
   faces=[(ring*sides+j,ring*sides+(j+1)%sides,(ring+1)*sides+(j+1)%sides,(ring+1)*sides+j) for ring in range(2) for j in range(sides)];mesh('Layered fir foliage',verts,faces,leaves[(level+n)%4])
 else:
  for j in range(5):
   a=j*2.399+n;dx=math.cos(a)*.9;dz=math.sin(a)*.8
   line('Crooked oak bough',[(x,z,h*.50),(x+dx*.6,z+dz*.6,h*.76),(x+dx,z+dz,h*.9)],.075,wood)
   sphere('Flattened oak foliage',x+dx,z+dz,h*.87,1.03,.92,.66,leaves[(n+j)%4])
 # Shrubs fill sight lines at the ground without encroaching into the open path.
 if n%2==0:sphere('Root moss foliage',x,z,.27,.65,.58,.25,moss)
current='old-tower';tx,tz=plan['x'],plan['z'];r=plan['r']
# Courses of individually offset wedge stones form an octagonal, roofless ruined tower.
def wedge(name,a,b,ri,ro,bottom,top,mat):
 v=[(tx+rad*math.cos(t),tz+rad*math.sin(t),h) for h in [bottom,top] for rad in [ri,ro] for t in [a,b]]
 return mesh(name,v,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],mat,.018)
# Smooth dark core supplies genuine depth behind separate exterior stonework.
cylinder('Tower dark interior floor',tx,tz,.12,r-.24,6.1,dark,32)
for row in range(23):
 for col in range(24):
  a=(col+(.5 if row%2 else 0))*math.tau/24;b=a+math.tau/24-.014;angle=(a+b)/2;front=abs((angle-math.pi/2+math.pi)%math.tau-math.pi)
  if row<5 and front<.29:continue
  if 8<=row<=12 and (front<.17 or abs((angle+math.pi*.2+math.pi)%math.tau-math.pi)<.15):continue
  # Irregular broken crown, low on one side, tall enough to silhouette the old observatory.
  limit=20+int(2.6*math.sin(angle*2+.4)+1.2*math.cos(angle*5))
  if row>limit:continue
  wedge('Weathered masonry block',a,b,r-.24,r+(.045 if row%5==0 else 0),.12+row*.40,.49+row*.40,stone2 if (row*3+col)%7==0 else stone)
for h in [.36,3.05,5.95,8.42]:
 for j in range(24):wedge('Old carved stone belt',j*math.tau/24,(j+1)*math.tau/24,r-.05,r+.13,h,h+.12,stone2)
# An open arched threshold leads to the shared oldTower interior.
front=tz+r+.08
arch('Open old tower arch',tx,front,.11,1.48,2.18,dark,.14)
arch_trim(tx,front+.13,.1,1.54,2.2,stone2,.13)
# The old door is now open: a narrow timber leaf rests at the side of the dark threshold.
box('Opened old oak door leaf',tx-.65,front-.18,1.04,.09,.70,1.82,oak)
box('Unlatched old iron strap',tx-.59,front-.18,.9,.025,.65,.06,brass)
# Narrow gothic lancet, worn star medallion, and partly surviving copper roof above.
arch('High recessed lancet',tx,front-.03,3.32,.72,1.80,dark,.08);arch_trim(tx,front+.045,3.3,.88,1.91,stone2,.09)
rod('Lancet stone mullion',(tx,front+.1,3.4),(tx,front+.1,4.85),.037,stone2)
for i in range(24):
 if 4<=i<=11:continue
 a=i*math.tau/24;b=(i+1)*math.tau/24
 mesh('Broken verdigris roof',[(tx+2.78*math.cos(a),tz+2.78*math.sin(a),9.22),(tx+2.78*math.cos(b),tz+2.78*math.sin(b),9.22),(tx+.3*math.cos(b),tz+.3*math.sin(b),11.55),(tx+.3*math.cos(a),tz+.3*math.sin(a),11.55)],[(0,1,2,3)],brass)
 if i%3==0:rod('Surviving roof rib',(tx+2.8*math.cos(a),tz+2.8*math.sin(a),9.22),(tx, tz,11.9),.038,wood)
# Open tilted astronomical ring visible through the missing roof; no glowing toy topper.
line('Broken observatory brass ring',[(tx+1.18*math.cos(i*math.pi/24),tz-.35,10.1+1.18*math.sin(i*math.pi/24)) for i in range(39)],.055,brass)
for a in [0,math.pi,math.pi*1.45,math.pi*.55]:
 x,z=tx+math.cos(a)*(r-.1),tz+math.sin(a)*(r-.1)
 # Buttresses remain inside the same physical tower footprint.
 rod('Old stone buttress',(x,z,.15),(x*.97,z+(tz-z)*.03,3.2),.16,stone2)
# Ivy climbs in loose spirals; the front door and lancet remain readable.
for j in range(5):
 a=[1.03,2.12,2.6,3.8,5.4][j]
 pts=[]
 for k in range(15):
  h=.35+k*.45;angle=a+.10*math.sin(k*.75);x=tx+(r+.13)*math.cos(angle);z=tz+(r+.13)*math.sin(angle);pts.append((x,z,h))
  for side in [-1,1]:sphere('Ivy painted foliage',x+side*.13,z,h+.04,.15,.09,.13,leaf if k%2 else moss)
 line('Climbing ivy stem',pts,.026,wood)
for q in plan['rocks']:
 sphere('Fallen masonry rubble',q['x'],q['z'],q['r']*.40,q['r'],q['r']*.9,q['r']*.44,stone)
 for j in range(3):sphere('Rubble moss',q['x']+.2*math.cos(j*2),q['z']+.2*math.sin(j*2),q['r']*.7,.22,.20,.08,moss)
# Wind-torn remnants of a high banner and spreading ivy at the entrance.
rod('Forgotten banner bracket',(tx-1.8,tz+2.1,6.4),(tx-3,tz+2.1,6.4),.035,brass)
mesh('Faded torn banner',[(tx-2.1,tz+2.13,6.36),(tx-2.87,tz+2.13,6.36),(tx-2.83,tz+2.16,4.64),(tx-2.58,tz+2.19,4.94),(tx-2.34,tz+2.16,4.52),(tx-2.16,tz+2.13,4.91)],[(0,1,2,3,4,5)],blue)
for j in range(6):
 a=j*math.tau/6
 if .8<a<2.3:continue
 line('Roots embracing old foundations',[(tx+math.cos(a)*2.5,tz+math.sin(a)*2.5,.65),(tx+math.cos(a)*2.9,tz+math.sin(a)*2.9,.22),(tx+math.cos(a)*3.45,tz+math.sin(a)*3.45,.09)],.055,wood)
# Traces of a circular courtyard are flush with the terrain, with weeds through the missing stones.
for ring in range(3):
 rad=3.1+ring*.55
 for j in range(36):
  a=j*math.tau/36
  if (j*7+ring)%9<2:continue
  x=tx+rad*math.cos(a);z=tz+rad*math.sin(a)
  sphere('Sunken courtyard paving',x,z,.095,.29,.24,.025,stone2)
# Lighting and two review views. Actual game seasons/night use the shared outdoor renderer.
scene=bpy.context.scene;world=bpy.data.worlds.new('Woodland overcast');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.62,.57,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55;scene.world=world
sun=bpy.data.lights.new('Soft woodland sun','SUN');sun.energy=2;sun.angle=.25;o=bpy.data.objects.new('Soft woodland sun',sun);scene.collection.objects.link(o);o.rotation_euler=(.45,-.55,-.45)
camdata=bpy.data.cameras.new('Old tower camera');cam=bpy.data.objects.new('Old tower camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO'
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_percentage=100;scene.render.resolution_x=1400;scene.render.resolution_y=1300
for chunk in plan['chunks']:
 for o in bpy.data.objects:
  if o.type in {'MESH','CURVE'}:o.hide_render=o.get('district')!=chunk['id']
 bpy.ops.wm.save_as_mainfile(filepath=str(out/('village-'+chunk['id']+'.blend')))
for o in bpy.data.objects:
 if o.type in {'MESH','CURVE'}:o.hide_render=False
for name,target,offset,scale in [('old-tower',(0,-45,4),(13,19,16),24),('woodland-route',(0,-33,1),(15,32,35),48)]:
 cam.location=xyz(target[0]+offset[0],target[1]+offset[1],target[2]+offset[2]);cam.rotation_euler=(Vector(xyz(*target))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=scale;scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'northern-woodland.blend'));print('OLD_TOWER_READY',flush=True)
