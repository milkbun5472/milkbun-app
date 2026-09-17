"""Author the shared, walkable storybook interiors from MAPS (game x/z/height).
Blender --background --python art/fairy-garden/build_interiors.py -- OUTPUT_DIR [home hall dormitory museum]
Art/preview files stay outside the app. Export each .blend with export-fairy-village.py --detail.
"""
import bpy,bmesh,math,random,ast,json,subprocess,sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];out=Path(args[0]);out.mkdir(parents=True,exist_ok=True);targets=args[1:] or ['home','hall','dormitory','museum']
repo=Path(__file__).resolve().parents[2];cfg=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');process.stdout.write(JSON.stringify(FairyGardenRules.MAPS))"],cwd=repo))
# Same mesh/material primitives as the village architecture and lake, not another geometry implementation.
source=repo/'art/fairy-garden/build_architecture.py'
for n in ast.parse(source.read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name=='material':exec(compile(ast.Module(body=[n],type_ignores=[]),str(source),'exec'))
current='interior';wood=material('Interior dark walnut wood',(.18,.115,.085));oak=material('Interior honey oak wood',(.46,.29,.16));cream=material('Interior warm ivory plaster',(.76,.69,.56));stone=material('Interior warm cut limestone',(.57,.53,.43));brass=material('Interior antique brass',(.57,.38,.15),.38,.45);paper=material('Interior warm linen',(.83,.75,.61));sage=material('Interior sage velvet',(.24,.40,.32));rose=material('Interior old rose velvet',(.56,.28,.27));blue=material('Interior dusty blue velvet',(.19,.32,.39));dark=material('Interior shadow recess',(.075,.09,.08));glass=material('Interior morning glass',(.62,.78,.73),.28,.06,.18);glow=material('Interior fire and lamp glow',(.93,.56,.20),.6,0,.6);leaf=material('Interior fern green',(.22,.38,.22));terracotta=material('Interior clay',(.51,.26,.17));boards=[material('Interior oak wood board '+str(i),tuple(c*v for c in (.44,.28,.155))) for i,v in enumerate([.9,.98,1.05,1.12])]

for n in ast.parse(source.read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name in ['xyz','mesh','box','rod','line','sphere','cylinder','arch','arch_trim']:exec(compile(ast.Module(body=[n],type_ignores=[]),str(source),'exec'))

def inside(x,z,outline):
 hit=False
 for i,a in enumerate(outline):
  b=outline[i-1]
  if (a['z']>z)!=(b['z']>z) and x<(b['x']-a['x'])*(z-a['z'])/(b['z']-a['z'])+a['x']:hit=not hit
 return hit

def clipped(points,x0,x1,z0,z1):
 for axis,edge,sign in [(0,x0,1),(0,x1,-1),(1,z0,1),(1,z1,-1)]:
  result=[]
  for i,b in enumerate(points):
   a=points[i-1];ia=(a[axis]-edge)*sign>=0;ib=(b[axis]-edge)*sign>=0
   if ia!=ib:
    t=(edge-a[axis])/(b[axis]-a[axis]);result.append(tuple(a[k]+(b[k]-a[k])*t for k in range(2)))
   if ib:result.append(b)
  points=result
  if not points:break
 return points

def floor_height(m,x,z):
 for s in m.get('surfaces',[]):
  if abs(x-s['x'])<s['w']/2 and abs(z-s['z'])<s['d']/2:return s['height']
 return m.get('floor',.14)

def plate(name,poly,h,mat,thick=0):
 if len(poly)<3:return
 verts=[(x,z,h) for x,z in poly];faces=[tuple(range(len(poly)))]
 if thick:
  n=len(poly);verts += [(x,z,h-thick) for x,z in poly];faces += [tuple(range(n*2-1,n-1,-1))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 return mesh(name,verts,faces,mat)

def ellipse(name,x,z,h,rx,rz,mat,thick=.025):
 return plate(name,[(x+math.cos(i*math.tau/48)*rx,z+math.sin(i*math.tau/48)*rz) for i in range(48)],h,mat,thick)

def place(fn,x,z,angle=0):
 before=set(bpy.data.objects);fn();c,s=math.cos(angle),math.sin(angle)
 for o in set(bpy.data.objects)-before:
  if o.type=='MESH':
   for v in o.data.vertices:
    xx,zz=v.co.x,-v.co.y;v.co.x=x+xx*c-zz*s;v.co.y=-(z+xx*s+zz*c)
   o.data.update()

def curtain(x,z,b,w,h,mat):
 # Gathered fabric with an open centre and pleats, rather than solid rectangular drapes.
 for side in [-1,1]:
  verts=[];faces=[];cols=12;rows=12
  for j in range(rows+1):
   t=j/rows;outer=x+side*w*.60;inner=x+side*w*(.34+.16*math.sin(t*math.pi));
   for i in range(cols+1):
    u=i/cols;verts.append((outer*(1-u)+inner*u,z+.12+math.sin(u*math.pi*8)*.065,b+h*(1-t)))
  for j in range(rows):
   for i in range(cols):k=j*(cols+1)+i;faces.append((k,k+1,k+cols+2,k+cols+1))
  mesh('Gathered linen curtain',verts,faces,mat)
  rod('Curtain silk tie',(x+side*w*.56,z+.21,b+h*.42),(x+side*w*.48,z+.21,b+h*.42),.035,brass)
 rod('Brass curtain pole',(x-w*.66,z,b+h+.07),(x+w*.66,z,b+h+.07),.026,brass)
 for side in [-1,1]:sphere('Curtain finial',x+side*w*.69,z,b+h+.07,.075,.07,.07,brass)

def window(x,z,b=1.15,w=1.8,h=2.1,cloth=None):
 arch('Deep window recess',x,z,b-.04,w+.2,h+.16,wood,.14);arch('Soft morning pane',x,z+.10,b,w,h,glass,.035);arch_trim(x,z+.16,b,w,h,oak,.048)
 rod('Window central mullion',(x,z+.18,b),(x,z+.18,b+h-.02),.024,oak)
 for f in [.32,.66]:rod('Window horizontal lead',(x-w*.47,z+.18,b+h*f),(x+w*.47,z+.18,b+h*f),.018,oak)
 box('Window carved sill',x,z+.12,b-.08,w+.4,.4,.12,stone)
 if cloth:curtain(x,z+.18,b-.2,w,h+.24,cloth)

def portal(x,z,w,h,base=.14):
 arch_trim(x,z,base,w,h,oak,.10)
 for side in [-1,1]:
  xx=x+side*w/2;box('Portal panelled column',xx,z,base+h*.34,.21,.3,h*.68,cream);box('Portal brass foot',xx,z,base+.14,.30,.37,.22,oak)
  for level in [.32,h*.64]:box('Carved column band',xx,z,base+level,.27,.34,.065,brass)
 arch_trim(x,z+.12,base,w+.18,h+.1,cream,.065)

def books(x,z,h,w):
 for i in range(max(2,int(w/.17))):
  xx=x-w/2+.12+i*.17;hh=.25+(i*7%5)*.07;m=[sage,rose,blue,oak][i%4]
  box('Clothbound volume',xx,z,h+hh/2,.115,.30,hh,m,.008)
  for y in [.07,hh-.055]:box('Gilt book band',xx,z+.157,h+y,.115,.014,.015,brass,.002)

def shelf(w,d,h=2.8,fill=True,back=True):
 for x in [-w/2,w/2]:box('Bookcase carved upright',x,0,.14+h/2,.15,d,h,wood)
 if back:box('Bookcase backing',0,-d/2+.03,.14+h/2,w,.06,h,sage)
 for y in [.22,.9,1.58,2.26,2.94]:
  if y>h+.2:continue
  box('Bookcase shelf',0,0,y,w,d,.075,oak)
  if fill and y<h-.3:books(0,.03,y+.05,w-.25)
 box('Bookcase cornice',0,0,.2+h,w+.22,d+.16,.13,oak)

def plant(x,z,h=.14,size=1):
 cylinder('Terracotta plant pot',x,z,h,.20*size,.34*size,terracotta,16,.28*size)
 for i in range(7):
  a=i*2.4;dx=math.cos(a)*.33*size;dz=math.sin(a)*.33*size;top=h+(.7+(i%3)*.14)*size
  rod('Fern stem',(x,z,h+.25*size),(x+dx,z+dz,top),.012*size,leaf)
  for t in [.48,.72,1]:sphere('Painted fern frond',x+dx*t,z+dz*t,h+.25*size+(top-h-.25*size)*t,.13*size,.25*size,.035*size,leaf)

def lamp(x,z,h=1.2):
 cylinder('Lamp brass foot',x,z,h,.17,.055,brass);rod('Lamp turned stem',(x,z,h),(x,z,h+.4),.028,brass)
 cylinder('Pleated linen lampshade',x,z,h+.3,.28,.32,paper,20,.16);cylinder('Shade brass rim',x,z,h+.3,.285,.025,brass)

def rug(x,z,w,d,mat):
 ellipse('Shaped woven rug',x,z,.166,w/2,d/2,mat)
 for f in [.89,.77]:line('Woven rug border',[(x+math.cos(i*math.tau/64)*w/2*f,z+math.sin(i*math.tau/64)*d/2*f,.183) for i in range(65)],.016,paper)
 for i in range(12):
  a=i*math.tau/12;xx=x+math.cos(a)*w*.24;zz=z+math.sin(a)*d*.24
  line('Embroidered leaf motif',[(xx-.07,zz,.185),(xx,zz-.16,.185),(xx+.07,zz,.185),(xx,zz+.16,.185),(xx-.07,zz,.185)],.013,brass)
 ellipse('Rug centre medallion',x,z,.187,.28,.34,paper,.012)

def table(w,d,h=.9,roundtop=False):
 if roundtop:ellipse('Oval carved table top',0,0,h,w/2,d/2,oak,.12)
 else:box('Carved table top',0,0,h,w,d,.12,oak,.06)
 for x in [-w*.34,w*.34]:
  for z in [-d*.32,d*.32]:
   cylinder('Turned table foot',x,z,.14,.055,h-.2,wood,10,.07)
   sphere('Turned table leg collar',x,z,h-.26,.095,.095,.075,oak)

def chair(w=1,d=1,cloth=sage,sofa=False):
 for x in [-w*.36,w*.36]:
  for z in [-d*.3,d*.3]:cylinder('Chair tapered leg',x,z,.14,.045,.27,wood,10,.075)
 box('Upholstered cushion',0,0,.55,w,d*.8,.22,cloth,.13)
 box('Soft curved chair back',0,-d*.37,.94,w,.22,.75,cloth,.16)
 for side in [-1,1]:box('Rounded chair arm',side*(w/2-.08),0,.75,.18,d*.94,.35,cloth,.09)
 for xx in ([i*w/5-w*.3 for i in range(4)] if sofa else [0]):sphere('Upholstery button',xx,-d*.23,1.0,.026,.018,.026,brass)
 if sofa:
  for xx in [-w*.3,w*.3]:sphere('Loose embroidered cushion',xx,-d*.14,.86,.3,.13,.29,paper)

def hearth():
 box('Hearth limestone apron',0,0,.25,2.45,1.12,.2,stone);arch('Fireplace soot recess',0,-.32,.3,1.5,1.5,dark,.12)
 for sign in [-1,1]:
  x=sign*.92;box('Carved hearth pier',x,0,.9,.30,.75,1.3,stone)
  for h in [.42,1.44]:box('Hearth moulded band',x,.04,h,.42,.83,.12,cream)
 box('Hearth carved mantel',0,0,1.72,2.55,1,.18,oak)
 for x in [-.65,0,.65]:sphere('Mantel floral carving',x,.52,1.72,.13,.025,.07,brass)
 arch('Chimney plaster silhouette',0,-.28,1.78,2.05,2.1,cream,.5);arch_trim(0,.02,1.9,1.68,1.8,stone,.04)
 for i in range(4):rod('Hearth log',(-.6+i*.32,0,.36),(-.4+i*.32,.24,.4),.10,wood)
 for x in [-.44,-.15,.16,.43]:sphere('Quiet flame',x,.04,.61,.12,.09,.3,glow)
 cylinder('Mantel clay vase',-.8,0,1.82,.15,.36,sage,16,.11);lamp(.74,0,1.83)

def bed(b):
 x,z,w,d,h=b['x'],b['z'],b['w'],b['d'],b.get('base',.14);cloth=rose if b['palette']=='rose' else sage
 def draw():
  for xx in [-w*.43,w*.43]:
   for zz in [-d*.42,d*.42]:cylinder('Bed turned brass foot',xx,zz,h,.075,.28,brass,10)
  box('Bed walnut frame',0,0,h+.34,w,d,.24,wood,.06);box('Deep linen mattress',0,0,h+.55,w-.1,d-.08,.25,paper,.12)
  box('Soft quilt with rolled edge',0,.55,h+.73,w-.04,d*.47,.13,cloth,.1)
  for xx in [-.6,.6]:sphere('Bed feather pillow',xx,-d*.29,h+.78,.49,.33,.13,paper)
  arch('Scalloped padded headboard',0,-d/2,h+.24,w,1.65,cloth,.18);arch_trim(0,-d/2+.12,h+.24,w,1.65,oak,.045)
  for xx in [-.85,-.4,0,.4,.85]:sphere('Headboard upholstered button',xx,-d/2+.14,h+1.27,.025,.025,.025,brass)
  for xx in [-w/2-.09,w/2+.09]:
   rod('Canopy turned post',(xx,-d/2,h),(xx,-d/2,h+2.9),.055,wood);sphere('Canopy acorn finial',xx,-d/2,h+2.98,.09,.09,.12,brass)
  rod('Canopy crown rail',(-w/2-.09,-d/2,h+2.9),(w/2+.09,-d/2,h+2.9),.065,wood)
  curtain(0,-d/2-.10,h+.35,w+1,2.55,cloth)
  for i in range(9):
   xx=-w*.4+i*w*.1;line('Quilt stitched diamond',[(xx-.075,.87,h+.80),(xx,1.01,h+.805),(xx+.075,.87,h+.80),(xx,.73,h+.805),(xx-.075,.87,h+.80)],.012,paper)
 place(draw,x,z)
 # Nightstands sit beyond the double mattress; collision footprints are declared with the bed assembly.
 for sign in [-1,1]:
  xx=x+sign*(w/2+.35);place(lambda:table(.52,.54,h+.61),xx,z-1.0);lamp(xx,z-1,h+.64)

def shell(m,name):
 outline=m['plan']['outline'];poly=[(p['x'],p['z']) for p in outline];plate(name+' shaped foundation',poly,.12,stone,.32);plate(name+' continuous oak subfloor',poly,.145,oak)
 for s in m.get('surfaces',[]):plate('Raised room platform',clipped(poly,s['x']-s['w']/2,s['x']+s['w']/2,s['z']-s['d']/2,s['z']+s['d']/2),s['height'],oak,s['height']-.13)
 batches=[([],[]) for _ in boards]
 # Alternating board lengths leave a readable join pattern at phone scale.
 for j in range(-25,26):
  zz=j*.36
  for i in range(-12,13):
   xx=i*1.12+(j%2)*.56;corners=[(xx-.55,zz-.172),(xx+.55,zz-.172),(xx+.55,zz+.172),(xx-.55,zz+.172)]
   if not all(inside(x,z,outline) for x,z in corners):continue
   h=floor_height(m,xx,zz)+.012;v,f=batches[(j*7+i*3)%4];n=len(v);v.extend([(x,z,h) for x,z in corners]);f.append(tuple(range(n,n+4)))
 for mat,(v,f) in zip(boards,batches):mesh(name+' fitted floorboards',v,f,mat)
 for i,a in enumerate(outline):
  b=outline[i-1];dx=b['x']-a['x'];dz=b['z']-a['z'];length=math.hypot(dx,dz);x=(a['x']+b['x'])/2;z=(a['z']+b['z'])/2;angle=math.atan2(dz,dx)
  high=(z<-4.5 or x<-m['plan']['w']*.42);height=3.75 if high else .35
  def wall():
   box('Limewashed outer wall',0,0,.14+height/2,length,.18,height,cream)
   for h in [.26, .92 if high else .38]:box('Wall dado moulding',0,.115,h,length,.055,.055,oak,.008)
   if high:
    box('Carved wall cornice',0,.13,3.76,length,.20,.13,oak)
    for xx in [-length/2+.1,length/2-.1]:box('Wall upright trim',xx,.12,1.94,.11,.14,3.65,wood)
  place(wall,x,z,angle)
 for wall in m.get('walls',[]):
  x,z,w,d,h=wall['x'],wall['z'],wall['w'],wall['d'],wall['h'];base=floor_height(m,x,z)
  box('Low cutaway room partition',x,z,base+h/2,w,d,h,cream);box('Partition polished cap',x,z,base+h,w+.06,d+.06,.09,oak)
 for a in m['plan'].get('arches',[]):portal(**a)
 for p in m['plan'].get('plants',[]):plant(p['x'],p['z'],floor_height(m,p['x'],p['z']),p['size'])

def furnish(q,base=.14):
 x,z,w,d,kind=q['x'],q['z'],q['w'],q['d'],q['kind']
 if kind=='hearth':place(hearth,x,z,-math.pi/2)
 elif kind in ['sofa','armchair','chair']:place(lambda:chair(w,d,sage if kind!='chair' else rose,kind=='sofa'),x,z)
 elif kind in ['table','dining','desk','roundtable','console']:
  place(lambda:table(w,d,.64 if kind=='table' else base+.8,kind in ['table','dining','roundtable']),x,z)
  if kind=='dining':
   for dx in [-.64,.64]:cylinder('Stoneware plate',x+dx,z,base+.89,.22,.03,paper);cylinder('Handmade dining cup',x+dx,z-.32,base+.9,.07,.15,sage)
   cylinder('Dining flower vase',x,z,base+.9,.10,.27,terracotta)
  elif kind in ['desk','console']:box('Desk open journal',x,z,base+.91,.45,.33,.025,paper);lamp(x,z-.5,base+.85)
  else:box('Coffee table clothbound book',x-.25,z,.73,.46,.32,.06,rose)
 elif kind in ['shelf','wardrobe']:place(lambda:shelf(d,w,2.9,kind=='shelf'),x,z,math.pi/2)
 elif kind in ['kitchen','island','vanity']:
  box('Sage fitted cabinet',x,z,base+.47,w,d,.92,sage,.045);box('Cream marble worktop',x,z,base+.98,w+.08,d+.08,.13,stone)
  for xx in [-w*.33,0,w*.33]:
   box('Panelled cabinet front',x+xx,z+d/2+.025,base+.46,w*.26,.06,.65,oak,.015);box('Cabinet recessed panel',x+xx,z+d/2+.06,base+.46,w*.2,.035,.49,sage,.008);sphere('Cabinet brass knob',x+xx,z+d/2+.10,base+.66,.038,.026,.035,brass)
  for dx in [-w*.28,w*.28]:cylinder('Kitchen ceramic jar',x+dx,z,base+1.05,.12,.25,paper,16,.09)
  if kind=='vanity':arch('Vanity oval mirror',x,z-.3,base+1.13,w*.75,1.35,glass,.06);arch_trim(x,z-.25,base+1.13,w*.75,1.35,brass,.035)
 elif kind=='bath':
  ellipse('Bath shadow feet',x,z,base+.15,w*.52,d*.46,brass,.13);ellipse('Porcelain bath outer rim',x,z,base+.76,w*.55,d*.49,paper,.48);ellipse('Porcelain basin recess',x,z,base+.775,w*.43,d*.39,glass,.008)
  rod('Bath brass tap',(x-w*.48,z-d*.28,base+.2),(x-w*.48,z-d*.28,base+1.03),.035,brass);rod('Bath swan neck',(x-w*.48,z-d*.28,base+1.03),(x-w*.20,z-d*.28,base+1.03),.035,brass)
 elif kind=='bench':
  box('Shared upholstered bench',x,z,.58,w,d,.18,sage,.07)
  for xx in [-w*.4,w*.4]:box('Bench trestle foot',x+xx,z,.33,.18,d*.8,.4,wood)
 elif kind=='stool':place(lambda:chair(w,d,blue),x,z)
 elif kind=='lectern':
  place(lambda:table(w,d,1.1),x,z);box('Open folio on lectern',x,z,1.18,w*.7,d*.75,.05,paper)
 elif kind=='stairs':
  for i in range(10):box('Timber stair tread',x,z+d/2-(i+.5)*d/10,.14+(i+1)*.07,w,d/10-.008,(i+1)*.14,oak)
  for sign in [-1,1]:rod('Stair banister',(x+sign*w*.5,z+d/2,.95),(x+sign*w*.5,z-d/2,2.2),.045,wood)

def home(m):
 shell(m,'Home')
 for b in m['beds'].values():bed(b)
 for q in m['furniture']:furnish(q,floor_height(m,q['x'],q['z']))
 window(-7,-6.69,1.5,2.5,2.0,rose);window(.2,-8.49,1.45,2.8,2.3,sage);window(3.7,-8.49,1.65,1.2,1.9)
 # Bay windows and a conservatory wing create different silhouettes instead of more rectangles.
 for x in [7.1,9.5]:window(x,-5.69,.6,1.75,2.9)
 for z in [-3.7,-1.1,1.05]:place(lambda:window(0,0,.6,1.8,2.9),12.0,z,math.pi/2)
 # Partial roof ribs mark the tall glass room while keeping the player visible.
 rug(-7.2,2.8,6.4,4.2,rose);rug(0,3.1,3,4.2,sage)
 # Dado panelling and small botanical pictures enrich the walls at close range.
 for xx in [-9.2,-7.5,-5.8]:
  box('Bedroom botanical frame',xx,-6.65,2.75,.50,.07,.68,oak);box('Pressed botanical paper',xx,-6.60,2.75,.39,.025,.56,paper);rod('Pressed flower stem',(xx,-6.57,2.52),(xx+.04,-6.57,2.92),.01,leaf);sphere('Pressed blossom',xx+.04,-6.55,2.92,.08,.015,.07,rose)
 curtain(2.45,-5.25,.5,2.15,2.45,paper)
 # Separate stone-tile vestibule, bounded by the actual entry projection.
 for i in range(-4,5):
  for j in range(8):
   xx=i*.55;zz=5.9+j*.27
   box('Vestibule inset limestone tile',xx,zz,.165,.52,.25,.035,stone if (i+j)%2 else cream,.008)


def hall(m):
 shell(m,'Hall')
 for q in m['furniture']:
  if q['kind']=='shelf':place(lambda:shelf(q['w'],q['d']),q['x'],q['z'])
  else:furnish(q)
 for x in [-7,-3,1,5]:window(x,-6.86,1.1,2.1,2.5,rose if x==-7 else None)
 rug(-3,1.65,8.2,5.9,sage)
 box('Lectern embroidered backdrop',7.3,-6.82,2.35,1.5,.05,2.4,blue)
 for i in range(7):sphere('Gold constellation emblem',6.8+i*.16,-6.77,2.4+math.sin(i*1.7)*.64,.05,.02,.05,brass)
 for x in [-5.5,-1,4]:lamp(x,1.8,3.6)


def dormitory(m):
 shell(m,'Dormitory')
 for i,r in enumerate(m['rooms']):
  cloth=[sage,blue,rose,paper][i];x,z=r['bedX'],r['z'];w,d=r['w'],r['d']
  box('Dorm walnut bed',x,z,.38,w,d,.45,wood,.06);box('Dorm linen mattress',x,z,.66,w-.08,d-.1,.24,paper,.1);box('Dorm coloured quilt',x,z+.48,.82,w,1.25,.12,cloth,.08);sphere('Dorm feather pillow',x,z-.8,.84,.5,.3,.12,paper)
  arch('Dorm scalloped headboard',x,z-d/2,.35,w,1.1,cloth,.12);window(r['x'],-6.86,1.3,2.0,2.15,cloth)
  furnish({'kind':'desk','x':r['x']+1.45,'z':-5.5,'w':.8,'d':1.5})
  rug(r['x'], -1.9,3.4,2.1,cloth)
  box('Unassigned brass doorplate',r['x']-1.4,.51,1.0,.3,.045,.25,brass)
 rug(-.5,2.8,17,2.5,sage)
 for x in [-7.8,-2.6,2.6,7.8]:lamp(x,2.6,3.3)


def museum(m):
 shell(m,'Gallery')
 for x in [-4,0,4]:window(x,-6.36,1.4,2.3,2.4)
 for id,d in m['displays'].items():
  q=d['cabinet'];x,z,w,depth=q['x'],q['z'],q['w'],q['d']
  if id=='flowers':
   box('Flower gallery linen wall',x,z,1.82,w,.16,2.6,sage)
   for p in d['slots']:
    box('Empty flower frame',p['x'],p['z']-.018,p['y'],.72,.04,.85,oak);box('Empty linen mounting',p['x'],p['z']+.01,p['y'],.62,.018,.75,paper)
  else:
   place(lambda:shelf(depth,w,2.5,False,False),x,z,math.pi/2)
   for h in [1.0,1.8]:box('Collection display shelf',x,z,h,w,depth,.045,oak)
 ellipse('Central octagonal plinth',0,-.1,.30,.8,.65,stone,.16)
 rug(0,2,6.7,4.0,blue)


def render(name,m):
 sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True;sc.world.color=(.35,.35,.35)
 sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.81,.77,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.65
 for location,energy,size in [((4,-3,17),1900,10),((-10,-6,10),1000,10)]:
  bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(24,-32,29));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=31 if name=='home' else 29;sc.camera=camera
 sc.render.resolution_x=1500;sc.render.resolution_y=1100;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX';sc.render.image_settings.file_format='PNG';sc.render.filepath=str(out/(name+'.png'))
 filename={'home':'home-interior','hall':'public-hall','dormitory':'hall-dormitory','museum':'museum-interior'}[name]
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(filename+'.blend')));bpy.ops.render.render(write_still=True);print('INTERIOR_READY',name,flush=True)
for name in targets:
 for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
 random.seed(911);m=cfg[name];globals()[name](m);render(name,m)
