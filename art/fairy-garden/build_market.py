"""Build the lantern market and remove its retired counters from the hall.
Blender --background --python art/fairy-garden/build_market.py -- ART_ROOT OUTPUT_DIR
Geometry and routing share MAPS.garden.market. Output blends/images stay outside the repo.
"""
import bpy,bmesh,math,random,json,subprocess,sys,ast
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
plan=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS.garden.market))"],cwd=repo))
source=ast.parse((Path(__file__).with_name('build_architecture.py')).read_text())
def shared(names):
 for n in source.body:
  if isinstance(n,ast.FunctionDef) and n.name in names:exec(compile(ast.Module(body=[n],type_ignores=[]),'<architecture>', 'exec'),globals())
shared({'remove_legacy_market'})
bpy.ops.wm.open_mainfile(filepath=str(base/'architecture-v2/village-hall.blend'))
remove_legacy_market();bpy.ops.wm.save_as_mainfile(filepath=str(out/'village-hall.blend'))
# Only the new district is exported; context is enabled later for its preview.
for o in bpy.data.objects:
 if o.type in {'MESH','CURVE'}:o.hide_render=True
shared({'material'})
wood=material('Market walnut wood',(.22,.13,.095));oak=material('Market honey wood',(.52,.32,.17));stone=material('Market warm stone',(.52,.50,.40));leaf=material('Market herb foliage',(.29,.42,.28));cream=material('Market linen cloth',(.86,.76,.56));sage=material('Market sage cloth',(.32,.51,.43));plum=material('Market plum cloth',(.40,.28,.41));rose=material('Market rose cloth',(.66,.37,.31));brass=material('Market antique brass',(.55,.37,.15),.5,.45);glow=material('Market lantern honey glow',(.98,.63,.23),.5,0,1.4);blue=material('Market teal bottles',(.23,.49,.49),.3);paper=material('Market parchment',(.82,.70,.47));petal=material('Market blossom petals',(.83,.49,.48));dark=material('Market dark fittings',(.14,.17,.16));current='market'
shared({'xyz','mesh','box','rod','line','sphere','cylinder'})
random.seed(917)
def jar(x,z,h,color=blue,r=.12):
 cylinder('Small glazed jar',x,z,h,r,.24,color,12,top=r*.75);cylinder('Cork lid',x,z,h+.24,r*.63,.05,oak,12)
def lantern(x,z,h,size=.15):
 cylinder('Lantern glowing panes',x,z,h,size,.30,glow,8)
 cylinder('Lantern copper cap',x,z,h+.30,size*1.3,.08,brass,8,top=.025)
 cylinder('Lantern copper base',x,z,h-.04,size*1.14,.055,brass,8)
 for a in range(4):
  dx,dz=size*math.cos(a*math.pi/2),size*math.sin(a*math.pi/2)
  rod('Lantern cage',(x+dx,z+dz,h),(x+dx,z+dz,h+.30),.012,brass)
def canopy(q,color):
 w,d=q['w'],q['d'];curved=q['kind']=='herbs';eave=2.13;ridge=2.8 if curved else 3.02
 for x in [-w/2+.10,w/2-.10]:
  for z in [-d/2+.08,d/2-.08]:
   rod('Canopy carved post',(x,z,.05),(x,z,eave+.10),.06,wood)
   box('Post brass shoe',x,z,.17,.15,.15,.22,brass)
 for z in [-d/2,d/2]:
  rod('Canopy front beam',(-w/2,z,eave),(w/2,z,eave),.055,oak)
 # Long segmented panels give the cloth a curved or pointed silhouette and an open front.
 for i in range(12):
  a,b=-w/2+w*i/12,-w/2+w*(i+1)/12
  def height(t):return eave+(ridge-eave)*(max(0,1-(2*t/w)**2)**.5 if curved else 1-abs(2*t/w))
  mat=color if i%3!=1 else cream
  mesh('Striped cloth roof',[(a,-d/2-.16,height(a)),(b,-d/2-.16,height(b)),(b,d/2+.20,height(b)),(a,d/2+.20,height(a))],[(0,1,2,3)],mat)
  # Scalloped valance hangs from the same sloping roof edge.
  pts=[(a,d/2+.20,height(a)),(b,d/2+.20,height(b))]+[(b-(b-a)*j/6,d/2+.20,height(b-(b-a)*j/6)-.13-.08*math.sin(j*math.pi/6)) for j in range(7)]
  mesh('Scalloped cloth hem',pts,[tuple(range(len(pts)))],mat)
 line('Ridge seam',[(0,-d/2-.17,ridge+.02),(0,d/2+.22,ridge+.02)],.022,cream)
 lantern(-w/2+.2,d/2+.10,1.65,.115)
def stall(q):
 before=set(bpy.data.objects);w,d=q['w'],q['d'];kind=q['kind'];cloth={'herbs':sage,'curios':plum,'tea':rose,'flowers':sage}[kind]
 if kind!='flowers':canopy(q,cloth)
 # All props fit inside the declared footprint, apart from overhead cloth.
 box('Stall boarded counter',0,.18,.91,w-.20,.62,.13,oak)
 for x in [-w/2+.2,w/2-.2]:
  for z in [-.06,.43]:box('Counter turned legs',x,z,.46,.11,.11,.85,wood)
 for i in range(9):box('Counter painted front',(-w/2+.15)+(w-.3)*i/8,.46,.56,(w-.3)/9-.012,.055,.56,cloth)
 if kind=='herbs':
  box('Apothecary back shelf',0,-d/2+.17,1.25,w-.36,.27,.075,oak)
  for i in range(7):jar(-w/2+.35+i*.34,-d/2+.17,1.3,blue if i%2 else cream,.10)
  for x in [-.85,-.30,.40,.85]:
   cylinder('Earthen herb pot',x,.16,.985,.16,.23,rose,12,top=.21)
   for j in range(5):
    a=j*math.tau/5;sphere('Herb leaves',x+.12*math.cos(a),.16+.10*math.sin(a),1.26,.075,.055,.16,leaf)
  for x in [-.75,0,.75]:
   rod('Hanging herb cord',(x,-.43,2.35),(x,-.43,1.76),.013,cream)
   for dx in [-.06,0,.06]:sphere('Dried herb bundle',x+dx,-.43,1.69,.055,.075,.20,leaf)
 elif kind=='curios':
  for x,z in [(-.9,.18),(-.45,.12),(.72,.13)]:jar(x,z,.985,blue,.14)
  cylinder('Brass astrolabe pedestal',.18,.15,.985,.17,.12,brass)
  pts=[(.18+.24*math.cos(i*math.tau/24),.15,1.4+.24*math.sin(i*math.tau/24)) for i in range(25)]
  line('Astrolabe orbit',pts,.025,brass);sphere('Astrolabe star',.18,.15,1.4,.07,.07,.07,glow)
  for i in range(4):box('Stacked notebooks',-.72,-.48,.40+i*.095,.42,.35,.075,paper)
  for x in [-.8,0,.8]:
   rod('Suspended charm thread',(x,-.55,2.24),(x,-.55,1.66),.009,brass)
   mesh('Four pointed hanging star',[(x-.13,-.55,1.63),(x,-.55,1.84),(x+.13,-.55,1.63),(x,-.55,1.43)],[(0,1,2,3)],brass)
 elif kind=='tea':
  sphere('Hammered copper kettle',-.42,.12,1.2,.25,.22,.22,brass)
  line('Teapot spout',[(-.26,.10,1.24),(-.03,.10,1.30),(.05,.10,1.42)],.05,brass)
  cylinder('Teapot lid',-.42,.12,1.37,.14,.05,brass)
  line('Kettle hoop',[(-.68+.26*math.cos(i*math.pi/12),.12,1.26+.3*math.sin(i*math.pi/12)) for i in range(13)],.025,wood)
  for x in [.36,.75]:cylinder('Tea cup',x,.17,.99,.11,.15,cream,12,top=.14)
  box('Tea towel',.68,.18,.992,.70,.50,.013,cream)
 else:
  # A low open flower cart, deliberately a different silhouette from the tents.
  box('Flower cart box',0,-.25,.68,w-.15,.7,.55,sage)
  for x in [-w/2+.17,w/2-.17]:
   for z in [-.51,.36]:sphere('Cart wheel',x,z,.31,.08,.27,.27,wood)
  for i in range(6):
   x=-.82+i*.32;z=-.25
   cylinder('Flower pot',x,z,.98,.13,.22,rose,10,top=.17)
   for j in range(3):
    dx=.10*math.cos(j*2.1);dz=.08*math.sin(j*2.1);h=1.38+random.random()*.25
    rod('Flower stem',(x,z,1.14),(x+dx,z+dz,h),.013,leaf)
    for a in range(5):sphere('Bellflower petals',x+dx+.055*math.cos(a*math.tau/5),z+dz+.055*math.sin(a*math.tau/5),h,.048,.048,.045,petal)
  line('Flower cart pulling handle',[(-.55,-.55,.65),(-.55,-.65,1.25),(.55,-.65,1.25),(.55,-.55,.65)],.035,oak)
 # Game headings rotate x/z; Blender maps game z to -y.
 c,s=math.cos(q['heading']),math.sin(q['heading'])
 for o in set(bpy.data.objects)-before:
  for v in o.data.vertices:
   x,z=v.co.x,-v.co.y;v.co.x=q['x']+c*x-s*z;v.co.y=-(q['z']+s*x+c*z)
  o.data.update()
for q in plan['stalls']:stall(q)
# Thin, irregular stepping-stone apron; no raised plinth or invisible perimeter.
p=plan['paving']
for row in range(17):
 for col in range(23):
  x=p['x']+(col-11)*.58+(row%2)*.29;z=p['z']+(row-8)*.57
  if ((x-p['x'])/(p['w']/2))**4+((z-p['z'])/(p['d']/2))**4>1:continue
  box('Market worn paving',x,z,.025,.55,.54,.045,stone, .035)
for q in plan['poles']:
 rod('Market lantern post',(q['x'],q['z'],.02),(q['x'],q['z'],3.65),q['r'],wood)
 cylinder('Post stone foot',q['x'],q['z'],.015,q['r'],.25,stone)
 sphere('Post brass finial',q['x'],q['z'],3.72,.13,.13,.17,brass)
for ia,ib in [(0,1),(1,2),(2,3),(3,0)]:
 a,b=plan['poles'][ia],plan['poles'][ib]
 def point(t):return(a['x']+(b['x']-a['x'])*t,a['z']+(b['z']-a['z'])*t,3.61-.42*math.sin(math.pi*t))
 line('Drooping lantern cable',[point(i/32) for i in range(33)],.017,dark)
 for j in range(1,10):
  x,z,h=point(j/10);rod('Lantern short tether',(x,z,h),(x,z,h-.13),.012,dark);lantern(x,z,h-.45,.10)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_percentage=100;scene.render.resolution_x=1500;scene.render.resolution_y=1100
cam=scene.camera;cam.location=xyz(12,14,15);cam.rotation_euler=(Vector(xyz(-.3,-4,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=19
bpy.ops.wm.save_as_mainfile(filepath=str(out/'village-market.blend'))
# Render contextual view so the aisle to the public hall can be inspected.
for o in bpy.data.objects:
 if o.type in {'MESH','CURVE'}:o.hide_render=o.get('district') not in {'market','hall','ground'}
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.55
scene.render.filepath=str(out/'market-day.png');bpy.ops.render.render(write_still=True)
print('MARKET_READY',flush=True)
