"""Public hall and separate upstairs cutaway. MAPS owns furniture/room footprints.
Blender --background --python art/fairy-garden/build_public_hall.py -- ART_ROOT OUTPUT_DIR
"""
import bpy,math,random,sys,ast,json,subprocess
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
cfg=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');process.stdout.write(JSON.stringify(FairyGardenRules.MAPS))"],cwd=repo))
bpy.ops.wm.open_mainfile(filepath=str(base/'village-v2/fairy-village-v2.blend'))
M=bpy.data.materials;wood=M['Walnut beams'];oak=M['Honey oak'];stone=M['Old stepping stones'];cream=M['Warm lime plaster'];gold=M['Old brass'];paper=M['Parchment'];glow=M['Honey window glow'];green=M['Sunlit foliage']
for path in [base/'build.py',repo/'art/fairy-garden/build_places.py',repo/'art/fairy-garden/build_house.py']:
 for n in ast.parse(path.read_text()).body:
  if isinstance(n,ast.FunctionDef) and n.name!='flower':exec(compile(ast.Module(body=[n],type_ignores=[]),str(path),'exec'))
random.seed(44)
sage=pigment('Hall sage velvet',(.24,.38,.30));rose=pigment('Hall muted rose linen',(.48,.28,.26));blue=pigment('Hall midnight blue',(.09,.18,.23));soft=pigment('Hall cream linen',(.77,.68,.49));rug=pigment('Hall warm woven rug',(.46,.30,.18))
def shell(name,m):
 empty();w,d=m['plan']['w'],m['plan']['d']
 block(name+' stone foundation',0,0,-.02,w+.2,d+.2,.24,stone)
 rows=math.ceil(d/.31);cols=math.ceil(w/1.55);dx=w/cols;dz=d/rows
 for row in range(rows):
  for col in range(cols):block(name+' oak floorboard',-w/2+dx*(col+.5),-d/2+dz*(row+.5),.105,dx-.03,dz-.015,.07,oak)
 block(name+' rear plaster',0,-d/2,1.85,w,.18,3.5,cream);block(name+' west plaster',-w/2,0,1.85,.18,d,3.5,cream)
 for x in [-w/2+.1,-w/4,0,w/4,w/2-.1]:block(name+' oak wall post',x,-d/2+.15,1.85,.14,.16,3.5,wood)
 for h in [.23,3.48]:block(name+' rear beam',0,-d/2+.19,h,w,.18,.14,wood);block(name+' west beam',-w/2+.19,0,h,.18,d,.14,wood)
 # Front wall stays cut away; a narrow sill makes the building edge legible.
 for x in [-(w/4+.55),w/4+.55]:block(name+' low front sill',x,d/2-.05,.3,w/2-1.2,.12,.28,wood)
def window(x,z,h=2.5,w=1.3):
 block('Leaded window oak frame',x,z,h,w+.16,.12,1.34,wood);block('Leaded window amber panes',x,z+.08,h,w,.05,1.16,glow)
 for dx in [-w/2,0,w/2]:block('Window upright',x+dx,z+.13,h,.05,.06,1.22,oak)
 block('Window crosspiece',x,z+.13,h,w,.07,.05,oak)
 block('Window stone sill',x,z+.14,h-.72,w+.24,.27,.09,stone)
def tabletop(x,z,w,d,h=.94):
 block('Long table top',x,z,h,w,d,.12,oak)
 for dx in [-w/2+.22,w/2-.22]:
  for dz in [-d/2+.15,d/2-.15]:rod('Table foot',(x+dx,z+dz,.14),(x+dx,z+dz,h),.055,wood)
 rod('Table lower stretcher',(x-w/2+.2,z,.4),(x+w/2-.2,z,.4),.045,wood)
def books(x,z,h,width):
 for i in range(int(width/.16)):
  m=[sage,rose,blue,paper][i%4];bw=.10+(i%3)*.025;bh=.30+(i%4)*.08
  block('Old clothbound book',x-width/2+.1+i*.16,z,h+bh/2,bw,.27,bh,m)
  block('Book spine gold band',x-width/2+.1+i*.16,z+.148,h+bh*.8,bw,.013,.018,gold)
def lamp(x,z,h=2.75):
 # Hanging static fixtures share emissive material; no extra realtime light per lantern.
 rod('Lamp ceiling cord',(x,z,h+.58),(x,z,h+.17),.015,gold)
 cyl('Lamp lower brass rim',pos(x,z,h-.16),.23,.055,gold)
 uv('Lamp warm globe',pos(x,z,h),(.18,.18,.21),glow)
 cyl('Lamp upper brass rim',pos(x,z,h+.18),.19,.055,gold)
 for a in range(4):
  dx=math.cos(a*math.pi/2)*.2;dz=math.sin(a*math.pi/2)*.2;rod('Lamp fine cage',(x+dx,z+dz,h-.17),(x+dx,z+dz,h+.2),.011,gold)
# Downstairs: shared dining, hearth, books and a modest classroom.
m=cfg['hall'];shell('Public hall',m)
for x in [-5.2,-2.2,.6,5.25]:window(x,-4.36)
for q in m['furniture']:
 x,z,w,d=q['x'],q['z'],q['w'],q['d'];kind=q['kind']
 if kind=='table':
  tabletop(x,z,w,d)
  block('Woven sage table runner',x,z,1.012,w-.3,.35,.022,sage)
  for dx in [-1.65,-.65,.65,1.65]:
   for dz in [-.36,.36]:
    cyl('Handmade supper plate',pos(x+dx,z+dz,1.03),.16,.023,soft)
    cyl('Clay drinking cup',pos(x+dx+.18,z+dz,1.12),.057,.15,paper)
  uv('Woven bread bowl',pos(x,z,1.085),(.38,.21,.09),rug)
  for dx in [-.17,0,.17]:uv('Small bread loaf',pos(x+dx,z,1.18),(.12,.14,.085),paper)
 elif kind=='bench':
  block('Shared timber bench',x,z,.53,w,d,.11,oak)
  for dx in [-w/2+.25,w/2-.25]:block('Bench end support',x+dx,z,.31,.17,d-.05,.34,wood)
 elif kind=='hearth':
  block('Broad hearth stone apron',x,z,.22,w,d,.16,stone)
  block('Hearth iron darkness',x-.35,z,.84,.15,1.75,1.3,M['Cauldron iron'])
  for dz in [-.96,.96]:
   for i in range(4):block('Hearth fitted stone',x,z+dz,.39+i*.29,.75,.3,.26,stone)
  block('Hearth oak mantel',x,z,1.65,1.0,2.45,.18,oak)
  block('Tall plaster chimney',x-.30,z,2.48,.56,1.9,1.5,cream)
  for i in range(3):rod('Hearth stacked log',(x-.03,z-.6+i*.37,.32),(x+.24,z-.38+i*.37,.37),.09,wood)
  for dz in [-.45,-.15,.2,.45]:uv('Gentle hearth coals',pos(x+.14,z+dz,.51),(.12,.12,.19),glow)
  cyl('Copper kettle body',pos(x+.10,z+.52,1.9),.14,.29,gold)
 elif kind=='shelf':
  for dx in [-w/2,w/2]:block('Library shelf end',x+dx,z,1.25,.12,d,2.15,wood)
  for h in [.23,.9,1.57,2.24]:
   block('Library shelf board',x,z,h,w,d,.075,oak)
   if h<2:books(x,z+.07,h+.04,w-.3)
 elif kind=='lectern':
  block('Tutor lectern foot',x,z,.2,w,d,.12,wood);block('Tutor lectern pedestal',x,z,.65,.36,.4,.9,oak)
  o=block('Tutor sloped reading desk',x,z,1.19,w,d,.10,oak);o.rotation_euler.x=.18
  block('Open teaching book',x,z+.02,1.28,.55,.39,.035,paper)
 elif kind=='stool':
  cyl('Classroom stool seat',pos(x,z,.55),.28,.12,oak)
  for a in range(3):
   dx=math.cos(a*math.tau/3)*.18;dz=math.sin(a*math.tau/3)*.18;rod('Stool leg',(x+dx,z+dz,.14),(x+dx*.7,z+dz*.7,.53),.035,wood)
 elif kind=='stairs':
  for i in range(9):
   h=.18+i*.135;zz=z+d/2-(i+.5)*d/9
   block('Upstairs timber step',x,zz,.14+h/2,w,d/9-.012,h,oak)
  for dx in [-w/2,w/2]:
   rod('Stair rising rail',(x+dx,z+d/2,.96),(x+dx,z-d/2,2.15),.04,wood)
   for t in [0,.5,1]:rod('Stair baluster',(x+dx,z+d/2-t*d,.2+t*1.2),(x+dx,z+d/2-t*d,.96+t*1.19),.025,wood)
# Star chart behind the teacher: graphic in geometry, no generated-text texture.
block('Star chart wooden frame',3.1,-4.23,2.13,2.25,.1,1.8,oak);block('Star chart blue cloth',3.1,-4.15,2.13,2.08,.025,1.64,blue)
points=[(2.35,-4.11,2.45),(2.9,-4.11,2.65),(3.5,-4.11,2.3),(3.75,-4.11,1.73),(2.8,-4.11,1.85)]
for a,b in zip(points,points[1:]):rod('Constellation golden line',a,b,.011,gold)
for pt in points:uv('Star chart pin',pos(*pt),(.045,.025,.045),paper)
for x,z in [(-3.8,1.1),(-.3,1.1),(3.2,-.8)]:lamp(x,z)
block('Hall entry welcome mat',0,3.72,.16,1.45,.70,.026,sage)
sc=camera('Public hall overview',(0,0,1.1),(16,21,19),20);save_render('public-hall',sc)
# Upstairs is streamed separately so its floor never covers the hall below.
m=cfg['dormitory'];shell('Dormitory',m)
for wall in m['walls']:
 block('Dorm room low partition',wall['x'],wall['z'],.14+wall['h']/2,wall['w'],wall['d'],wall['h'],cream)
 block('Dorm partition oak cap',wall['x'],wall['z'],.17+wall['h'],wall['w']+.03,wall['d']+.03,.055,wood)
for i,r in enumerate(m['rooms']):
 x,z=r['bedX'],r['z'];cloth=sage if r['palette']=='sage' else rose;w,d=r['w'],r['d']
 window(r['x'],-4.36,2.55,1.15)
 for dx in [-.71,.71]:block('Room linen curtain',r['x']+dx,-4.18,2.44,.25,.11,1.45,cloth)
 block('Apprentice bed oak base',x,z,.4,w,d,.38,wood);block('Apprentice cream mattress',x,z,.67,w-.08,d-.06,.21,soft)
 block('Apprentice woven blanket',x,z+.45,.82,w-.06,1.15,.11,cloth);uv('Apprentice pillow',pos(x,z-.71,.85),(.46,.25,.12),soft)
 block('Apprentice headboard',x,z-d/2,1.0,w,.12,.84,oak)
 for j in range(5):block('Blanket cream stitch',x-.5+j*.25,z+.95,.884,.09,.02,.012,paper)
 tabletop(r['x']+.95,-3.7,.75,.7,.92)
 block('Dorm desk notebook',r['x']+.95,-3.7,1.0,.28,.35,.035,blue)
 cyl('Dorm desk ink pot',pos(r['x']+1.13,-3.91,1.04),.047,.15,gold)
 block('Room bedside rug',r['x'],z+1.45,.154,2.1,.48,.026,cloth)
 # Doorway markers are four different botanical emblems, never fabricated occupants.
 for dx in [-.62,.62]:block('Open dorm door jamb',r['x']+dx,.12,.92,.07,.15,1.55,oak)
 block('Dorm empty nameplate',r['x']-.95,.225,.77,.27,.025,.2,oak)
 for j in range(i+1):uv('Small door emblem',pos(r['x']-.95+(j-i/2)*.045,.25,.78),(.018,.01,.04),paper)
# A runner links all four doorways. The return landing has matching timber edging.
block('Upstairs woven corridor runner',-.5,1.6,.157,11.8,1.15,.03,sage)
for j in range(39):block('Corridor embroidered edge',-6.13+j*.3,2.1,.18,.10,.025,.009,paper)
for x in [-5.2,-1.75,1.75,5.2]:lamp(x,1.45,2.8)
block('Downstairs landing threshold',5.7,3.9,.17,1.65,.32,.07,oak)
for dx in [-.9,.9]:rod('Landing short newel',(5.7+dx,3.96,.14),(5.7+dx,3.96,1.1),.045,wood)
sc=camera('Dormitory overview',(0,0,1.1),(16,21,19),20);save_render('hall-dormitory',sc)
print('PUBLIC_HALL_READY',flush=True)
