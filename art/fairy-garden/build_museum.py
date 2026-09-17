"""Blender --background --python art/fairy-garden/build_museum.py -- ART_ROOT OUTPUT_DIR.
Empty museum fixtures and exterior; actual collections are added by museum-view.mjs.
"""
import bpy,math,random,sys,ast,json,subprocess
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True);repo=Path(__file__).resolve().parents[2]
cfg=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');process.stdout.write(JSON.stringify(FairyGardenRules.MAPS))"],cwd=repo))
bpy.ops.wm.open_mainfile(filepath=str(base/'village-v2/fairy-village-v2.blend'))
M=bpy.data.materials;wood=M['Walnut beams'];oak=M['Honey oak'];stone=M['Old stepping stones'];cream=M['Warm lime plaster'];gold=M['Old brass'];paper=M['Parchment'];glow=M['Honey window glow'];green=M['Sunlit foliage']
for source in [base/'build.py',repo/'art/fairy-garden/build_places.py',repo/'art/fairy-garden/build_house.py',repo/'art/fairy-garden/build_public_hall.py']:
 for n in ast.parse(source.read_text()).body:
  if isinstance(n,ast.FunctionDef) and n.name!='flower':exec(compile(ast.Module(body=[n],type_ignores=[]),str(source),'exec'))
sage=pigment('Museum deep teal velvet',(.13,.30,.29));rose=pigment('Museum rose velvet',(.44,.25,.25));blue=pigment('Museum blue glazed roof',(.17,.30,.37));soft=pigment('Museum ivory linen',(.78,.69,.51));rug=pigment('Museum faded gold rug',(.48,.37,.22))
random.seed(612)
empty();e=cfg['garden']['museum'];x,z,w,d=e['x'],e['z'],e['w'],e['d']
block('Museum stone footing',x,z,.18,w+.1,d+.1,.30,stone)
block('Museum cream walls',x,z,1.45,w,d,2.45,cream)
for dx in [-w/2+.06,w/2-.06]:
 for dz in [-d/2+.06,d/2-.06]:block('Museum corner timber',x+dx,z+dz,1.45,.14,.14,2.5,wood)
# Gabled roof with separate overlapping hand-painted blue shingle strips.
for side in [-1,1]:
 verts=[pos(x-w/2-.18,z,3.7),pos(x+w/2+.18,z,3.7),pos(x+w/2+.18,z+side*(d/2+.25),2.7),pos(x-w/2-.18,z+side*(d/2+.25),2.7)]
 mesh('Museum roof slope',verts,[(0,1,2,3)],blue)
 for j in range(6):
  t=(j+.5)/6;zz=z+side*t*(d/2+.25);h=3.7-t
  for i in range(12):
   tile=block('Museum layered blue shingle',x-w/2-.1+i*(w+.2)/11,zz,h+.045,(w+.2)/11-.018,.33,.055,blue);tile.rotation_euler.x=side*.53
for dx in [-w/2,w/2]:
 mesh('Museum gable plaster',[pos(x+dx,z-d/2,2.67),pos(x+dx,z+d/2,2.67),pos(x+dx,z,3.7)],[(0,1,2)],cream)
 rod('Museum gable trim',(x+dx,z-d/2-.12,2.65),(x+dx,z,3.75),.055,wood);rod('Museum gable trim',(x+dx,z+d/2+.12,2.65),(x+dx,z,3.75),.055,wood)
front=z+d/2
block('Museum deep front door',x,front+.025,1.12,1.05,.12,1.9,wood)
for dx in [-.60,.60]:block('Museum door jamb',x+dx,front+.12,1.2,.16,.21,2.15,oak)
block('Museum entrance lintel',x,front+.12,2.28,1.38,.23,.14,oak)
uv('Museum brass door knob',pos(x+.30,front+.11,1.11),(.055,.035,.055),gold)
for dx in [-1.42,1.42]:window(x+dx,front+.04,1.55,.75)
# A golden leaf identifies this house as the collection hall.
rod('Museum sign bracket',(x+.72,front+.06,2.5),(x+.72,front+.5,2.5),.04,wood)
block('Museum blank carved sign',x+.72,front+.5,2.18,.49,.08,.48,sage)
leaf=uv('Museum carved leaf emblem',pos(x+.72,front+.555,2.18),(.095,.018,.17),gold);leaf.rotation_euler.y=.45
step=e['step'];block('Museum doorway step',step['x'],step['z'],step['height']-.06,step['w'],step['d'],.12,stone)
for dx in [-.92,.92]:lantern(x+dx,front+.35,.03)
for o in bpy.data.objects:
 if o.type in {'MESH','CURVE'}:o['district_origin_x']=x;o['district_origin_z']=z
sc=camera('Museum exterior',(x,z,1.6),(x+9,z+12,9),8.7);save_render('museum-exterior',sc)
# Gallery interior, using the same room shell as the public hall.
m=cfg['museum'];shell('Museum',m)
window(.35,-3.86,2.5,1.7)
for dx in [-.8,1.5]:block('Museum window curtain',dx,-3.63,2.4,.35,.14,1.65,sage)
# Empty panel frames are permanent architecture. Real flower notes appear only at runtime.
for p in m['displays']['flowers']['slots']:
 xx,zz,h=p['x'],p['z'],p['y']
 block('Flower frame velvet backing',xx,zz-.045,h,.77,.08,.86,sage)
 for dx in [-.405,.405]:block('Flower frame gold side',xx+dx,zz+.01,h,.045,.10,.92,gold)
 for dh in [-.46,.46]:block('Flower frame gold top',xx,zz+.01,h+dh,.85,.10,.045,gold)
for key,display in m['displays'].items():
 q=display['cabinet'];xx,zz,fw,fd=q['x'],q['z'],q['w'],q['d']
 if key=='flowers':
  block('Flower archive low cabinet',xx,zz,.41,fw,fd,.52,oak)
  for i in range(4):block('Flower archive drawer face',xx-fw/2+.48+i*.93,zz+fd/2+.02,.41,.8,.045,.36,wood);uv('Drawer brass pull',pos(xx-fw/2+.48+i*.93,zz+fd/2+.055,.43),(.045,.018,.025),gold)
 else:
  for h in [.3,.96,1.76]:block('Gallery shelf oak board',xx,zz,h,fw,fd,.10,oak)
  for dz in [-fd/2,fd/2]:block('Gallery shelf carved upright',xx,zz+dz,1.14,fw,.1,2.1,wood)
  for h in [.97,1.77]:block('Gallery shelf velvet lining',xx,zz,h+.06,fw-.06,fd-.1,.022,sage if key=='alchemy' else rose)
# Central display table deliberately stays empty until a future memorial system owns its contents.
block('Central octagonal display foot',0,-.1,.28,1.6,1.3,.25,stone)
block('Central carved display pedestal',0,-.1,.67,1.38,1.08,.58,oak)
block('Central velvet display surface',0,-.1,1.02,1.62,1.32,.12,sage)
# Floor compass and hanging moon make it distinct from the residential interiors.
for i in range(32):
 a=i*math.tau/32;block('Gallery compass floor inlay',math.cos(a)*2.1,-.1+math.sin(a)*1.65,.15,.12,.12,.015,gold)
for xx,zz in [(-2.5,-2.1),(2.7,-1.7),(0,2.5)]:lamp(xx,zz,2.8)
torus('Gallery hanging brass halo',pos(0,-.1,3.0),.62,.025,gold)
for a in [0,math.pi*2/3,math.pi*4/3]:rod('Halo suspension',(.62*math.cos(a),-.1+.62*math.sin(a),3.0),(0,-.1,3.6),.012,gold)
block('Museum threshold',0,3.8,.16,1.5,.35,.08,stone)
sc=camera('Museum interior',(0,0,1),(13,17,15),15);save_render('museum-interior',sc)
print('MUSEUM_READY',flush=True)
