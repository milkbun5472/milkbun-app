"""Woodland railway stop; source of positions is MAPS.garden.station.
Blender --background --python art/fairy-garden/build_station.py -- OUTPUT_DIR
Runtime uses the existing continuous meadow. Preview ground is never exported.
"""
import bpy,bmesh,math,random,json,subprocess,sys,ast
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
plan=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS.garden.station))"],cwd=repo))
bpy.ops.wm.read_factory_settings(use_empty=True)
source=ast.parse(Path(__file__).with_name('build_architecture.py').read_text())
def shared(names):
 for n in source.body:
  if isinstance(n,ast.FunctionDef) and n.name in names:exec(compile(ast.Module(body=[n],type_ignores=[]),'<architecture>','exec'),globals())
shared({'material'})
wood=material('Station dark walnut wood',(.20,.15,.12));oak=material('Station warm oak wood',(.48,.34,.20));stone=material('Station warm limestone',(.58,.55,.43));leaf=material('Station sage foliage',(.29,.43,.27));brass=material('Station aged brass',(.49,.35,.17),.55,.45);glass=material('Station lantern honey glass',(.84,.59,.26),.4,0,.35)
cream=material('Station ivory painted wood',(.80,.75,.59));sage=material('Station teal painted wood',(.20,.38,.34));iron=material('Station dark teal iron',(.12,.22,.21),.5,.3);roofmat=material('Station patinated copper roof',(.24,.40,.37),.65,.25);rooflight=material('Station pale copper roof',(.35,.48,.40),.65,.2);gravel=material('Station ballast earth',(.36,.36,.29));grass=material('Station grass earth',(.35,.43,.25));bark=material('Station birch cream bark',(.66,.64,.50));red=material('Station rowan berry',(.55,.22,.12));leather=material('Station old plum leather',(.37,.22,.26));dark=material('Station window recess',(.08,.13,.13));leaves=[leaf,material('Station light foliage',(.43,.53,.30)),material('Station soft foliage',(.35,.48,.30))]
current='station';shared({'xyz','mesh','box','rod','line','sphere','cylinder','arch','arch_trim','lantern'})
for n in ast.parse(Path(__file__).with_name('build_lake.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name=='upward':exec(compile(ast.Module(body=[n],type_ignores=[]),'<lake-surface>','exec'),globals())
random.seed(91786)
# Separate stepping stones follow the plan; no second ribbon/path implementation.
current='station-lane'
for a,b in zip(plan['approach'],plan['approach'][1:]):
 length=math.hypot(b['x']-a['x'],b['z']-a['z']);n=max(1,round(length/.65));dx,dz=(b['x']-a['x'])/length,(b['z']-a['z'])/length
 for i in range(n):
  t=i/n;x=a['x']+(b['x']-a['x'])*t;z=a['z']+(b['z']-a['z'])*t
  for side in [-1,1]:
   o=box('Worn approach paving',x-dz*side*.34,z+dx*side*.34,.086,.58,.54,.045,stone,.055)
   # Bake rotation around this stone's own center (all shared mesh coordinates are world-space).
   angle=math.atan2(-dx,dz)
   for v in o.data.vertices:
    xx,yy=v.co.x-(x-dz*side*.34),v.co.y+(z+dx*side*.34);v.co.x=x-dz*side*.34+xx*math.cos(angle)-yy*math.sin(angle);v.co.y=-(z+dx*side*.34)+xx*math.sin(angle)+yy*math.cos(angle)
# Platform has a very low approach step and ample room around the benches.
current='station';q=plan['platform'];base=q['height']
box('Low masonry platform',q['x'],q['z'],base/2,q['w'],q['d'],base,stone,.035)
q=plan['step'];box('Broad shallow approach step',q['x'],q['z'],q['height']/2,q['w'],q['d'],q['height'],stone,.025)
for row in range(8):
 for col in range(19):
  x=-7.1+col*.78;z=36.72+row*.65
  box('Platform hand laid paver',x,z,base-.012,.755,.62,.025,stone if (row+col)%4 else cream,.014)
# An open barrel-vault canopy: segmented copper, narrow skylight slits and fine iron ribs.
q=plan['canopy'];cx,cz=q['x'],q['z'];half=q['d']/2
for band in range(22):
 x0=cx-q['w']/2+q['w']*band/22;x1=x0+q['w']/22-.025
 for j in range(12):
  z0=-half+q['d']*j/12;z1=-half+q['d']*(j+1)/12
  def height(z):return q['eave']+q['rise']*math.sqrt(max(0,1-(z/half)**2))
  # Slender open strips let the scene breathe rather than a solid chunky roof.
  if band in [5,11,17] and 3<=j<=8:continue
  upward(mesh('Curved copper canopy panel',[(x0,cz+z0,height(z0)),(x1,cz+z0,height(z0)),(x1,cz+z1,height(z1)),(x0,cz+z1,height(z1))],[(0,1,2,3)],roofmat if band%3 else rooflight))
for x in [cx-q['w']/2,cx+q['w']/2,-3.8,1,5.8]:
 pts=[(x,cz-half+q['d']*j/32,q['eave']+q['rise']*math.sqrt(max(0,1-(-1+2*j/32)**2))-.035) for j in range(33)]
 line('Vaulted iron canopy rib',pts,.035,iron)
for z in [cz-half,cz+half]:
 rod('Continuous copper rain gutter',(cx-q['w']/2,z,q['eave']),(cx+q['w']/2,z,q['eave']),.07,rooflight)
 for i in range(37):
  x=cx-q['w']/2+i*q['w']/36
  line('Scalloped ivory canopy valance',[(x-.15,z,q['eave']-.06),(x,z,q['eave']-.24),(x+.15,z,q['eave']-.06)],.025,cream)
for p in plan['posts']:
 cylinder('Station fluted pillar',p['x'],p['z'],base,p['r']*.6,q['eave']-base,iron,10)
 cylinder('Station pillar base',p['x'],p['z'],base,p['r'],.22,sage,10)
 for h in [.38,2.83,3.38]:cylinder('Station pillar collar',p['x'],p['z'],h,p['r']*.9,.07,brass,10)
 for side in [-1,1]:line('Curved pillar knee brace',[(p['x'],p['z'],2.85),(p['x']+side*.14,p['z'],3.12),(p['x']+side*.40,p['z'],3.32),(p['x']+side*.67,p['z'],3.48)],.034,iron)
 if p['z']>38:lantern(p['x'],p['z'],2.65)
# Small octagonal-ish ticket kiosk, distinct from the homes; window faces the open platform.
b=plan['booth'];x,z=b['x'],b['z'];w,d=b['w'],b['d'];h=b['h'];front=z+d/2
box('Ticket kiosk ivory body',x,z,base+h/2,w,d,h,cream,.10)
box('Ticket kiosk teal lower panels',x,z,base+.52,w+.02,d+.02,1.03,sage,.055)
for xx in [x-w/2+.08,x+w/2-.08]:box('Ticket kiosk corner post',xx,front+.02,base+h/2,.13,.13,h,oak)
arch('Ticket window dark recess',x,front+.045,1.11,1.45,1.40,dark,.05);arch_trim(x,front+.09,1.10,1.53,1.45,oak,.05)
box('Ticket counter sill',x,front+.20,1.10,1.7,.45,.12,oak)
for xx in [-.46,0,.46]:rod('Ticket window brass bars',(x+xx,front+.12,1.18),(x+xx,front+.12,2.19),.012,brass)
for xx in [x-w/2-.14,x+w/2+.14]:
 line('Kiosk curved cap edge',[(xx,z-d/2-.16,2.87),(xx,z,3.23),(xx,z+d/2+.16,2.87)],.05,rooflight)
upward(mesh('Ticket booth shallow curved roof',[(x-w/2-.2,z-d/2-.2,2.87),(x+w/2+.2,z-d/2-.2,2.87),(x-w/2-.2,z,3.23),(x+w/2+.2,z,3.23),(x-w/2-.2,z+d/2+.2,2.87),(x+w/2+.2,z+d/2+.2,2.87)],[(0,1,3,2),(2,3,5,4)],roofmat))
# Two waiting benches face the rails (+z), with backs on their village side (-z).
for b in plan['benches']:
 x,z,w,d=b['x'],b['z'],b['w'],b['d']
 for j in range(4):box('Waiting bench seat slat',x,z-d/2+.09+j*.155,.64,w,.135,.075,oak,.025)
 for j in range(3):box('Waiting bench back slat',x,z-d/2+.015,.89+j*.14,w,.075,.115,sage,.025)
 for side in [-1,1]:
  xx=x+side*(w/2-.20)
  for zz in [z-d/2+.06,z+d/2-.06]:rod('Bench iron foot',(xx,zz,base),(xx,zz,.62),.04,iron)
  line('Bench curved arm',[(xx,z-d/2,.66),(xx,z-d/2,1.03),(xx,z+d/2,.95),(xx,z+d/2,.68)],.035,iron)
# Station clock over the open end, with physical face and hands, not a text texture.
x,z,h=5.8,40.23,2.80
line('Clock hanging bracket',[(x,39.7,3.40),(x,z,3.40),(x,z,h+.30)],.025,brass)
pts=[(x+.28*math.cos(j*math.tau/40),z,h+.28*math.sin(j*math.tau/40)) for j in range(41)]
mesh('Station clock ivory dial',[(x,z,h)]+pts,[(0,j,j+1) for j in range(1,41)],cream);line('Station clock brass rim',pts,.025,brass)
for j in range(12):
 a=j*math.tau/12;rod('Clock hour mark',(x+.215*math.cos(a),z+.012,h+.215*math.sin(a)),(x+.24*math.cos(a),z+.012,h+.24*math.sin(a)),.009,iron)
rod('Clock short hand',(x,z+.02,h),(x-.13,z+.02,h+.06),.016,iron);rod('Clock long hand',(x,z+.025,h),(x+.04,z+.025,h+.19),.012,iron)
# Luggage cart is solid at exactly its shared footprint.
b=plan['luggage'];x,z=b['x'],b['z'];box('Luggage trolley deck',x,z,.36,b['w'],b['d'],.09,oak)
for side in [-1,1]:sphere('Trolley iron wheel',x+side*.42,z,.26,.14,.055,.14,iron)
box('Old travelling trunk',x-.13,z,.64,.73,.55,.47,leather,.065);box('Small linen suitcase',x+.10,z,.99,.53,.39,.22,cream,.045)
for dx in [-.23,.23]:box('Trunk leather strap',x-.13+dx,z,.646,.055,.567,.49,oak,.014)
line('Trolley handle',[(x+.45,z-.28,.4),(x+.55,z-.28,.95),(x+.55,z+.28,.95),(x+.45,z+.28,.4)],.027,iron)
for b in plan['planters']:
 box('Station planter wood tub',b['x'],b['z'],.37,b['w'],b['d'],.4,sage)
 for j in range(5):
  zz=b['z']-.5+j*.25;sphere('Planter foliage',b['x'],zz,.63,.29,.28,.21,leaf)
  for k in range(3):sphere('Tiny ivory blossom',b['x']+.12*math.cos(k*2),zz,.80,.055,.05,.045,cream)
# A low continuous fence visibly separates the strollable platform from the ballast.
f=plan['fence']
for i in range(49):
 x=-f['w']/2+i*f['w']/48;rod('Railway boundary fence picket',(x,f['z'],.1),(x,f['z'],.69),.027,iron)
for h in [.30,.63]:rod('Railway boundary horizontal rail',(-f['w']/2,f['z'],h),(f['w']/2,f['z'],h),.026,iron)
# Rails curve away only beyond the platform, disappearing into woodland at each end.
t=plan['track'];points=[(p['x'],p['z']) for p in t['points']]
verts=[]
for x,z in points:verts.extend([(x,z-1.50,.10),(x,z+1.50,.10)])
upward(mesh('Track continuous ballast',verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(120)],gravel))
for side in [-1,1]:line('Railway steel rail',[(x,z+side*.72,.23) for x,z in points],.035,iron)
for i in range(61):
 x,z=points[i*2];box('Weathered oak railway sleeper',x,z,.135,.18,2.05,.10,wood,.01)
# Slender birches and rowan clusters make a lighter approach than the northern fir forest.
for n,t in enumerate(plan['trees']):
 current='station-lane' if t['z']<34 and abs(t['x'])<11 else 'station';x,z,h=t['x'],t['z'],t['height'];r=t['r']
 cylinder('Birch slender trunk',x,z,.08,r,h*.88,bark,9,top=r*.5)
 for j in range(7):
  hh=.5+j*.39;rod('Birch charcoal bark mark',(x-r*.8,z+.10,hh),(x+r*.65,z+.12,hh+.035),.018,wood)
 for j in range(5):
  a=j*2.399+n;dx,dz=math.cos(a)*.75,math.sin(a)*.65
  line('Rowan spreading bough',[(x,z,h*.50),(x+dx*.7,z+dz*.7,h*.79),(x+dx,z+dz,h*.87)],.045,bark)
  sphere('Soft rowan foliage',x+dx,z+dz,h*.85,.94,.80,.67,leaves[(n+j)%3])
  if n%3==0:
   for k in range(3):sphere('Rowan red berry',x+dx+.12*k,z+dz+.32,h*.75,.045,.045,.045,red)
 for j in range(3):sphere('Birch root fern foliage',x+.3*math.cos(j*2),z+.3*math.sin(j*2),.23,.31,.23,.19,leaf)
# Review ground only; actual village remains a single continuous meadow.
current='preview-ground';box('Preview meadow',0,36,-.035,44,34,.09,grass,0)
scene=bpy.context.scene;world=bpy.data.worlds.new('Station afternoon');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.73,.68,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;scene.world=world
sun=bpy.data.lights.new('Soft afternoon sun','SUN');sun.energy=2.1;sun.angle=.28;o=bpy.data.objects.new('Soft afternoon sun',sun);scene.collection.objects.link(o);o.rotation_euler=(.45,-.5,-.4)
camdata=bpy.data.cameras.new('Station review camera');cam=bpy.data.objects.new('Station review camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO'
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_percentage=100;scene.render.resolution_x=1500;scene.render.resolution_y=1100
for chunk in plan['chunks']:
 for o in bpy.data.objects:
  if o.type in {'MESH','CURVE'}:o.hide_render=o.get('district')!=chunk['id']
 bpy.ops.wm.save_as_mainfile(filepath=str(out/('village-'+chunk['id']+'.blend')))
for o in bpy.data.objects:
 if o.type in {'MESH','CURVE'}:o.hide_render=False
for name,target,offset,scale in [('station',(0,39,1),(15,19,16),24),('station-approach',(-2,33,1),(16,28,30),38)]:
 cam.location=xyz(target[0]+offset[0],target[1]+offset[1],target[2]+offset[2]);cam.rotation_euler=(Vector(xyz(*target))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=scale;scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'woodland-station.blend'));print('STATION_READY',flush=True)
