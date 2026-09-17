"""Two-bedroom cutaway house. Geometry reads the game's room/bed/wall registry.
Blender --background --python art/fairy-garden/build_house.py -- ART_SOURCE OUTPUT_DIRECTORY
"""
import bpy,math,random,sys,ast,json,subprocess
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
cfg=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');process.stdout.write(JSON.stringify(globalThis.FairyGardenRules.MAPS.home))"],cwd=repo))
bpy.ops.wm.open_mainfile(filepath=str(base/'scene-expansion/home-interior.blend'))
M=bpy.data.materials;wood=M['Walnut beams'];oak=M['Honey oak'];stone=M['Old stepping stones'];cream=M['Warm lime plaster'];gold=M['Old brass'];paper=M['Parchment'];glow=M['Honey window glow'];green=M['Sunlit foliage']
for path in [base/'build.py',repo/'art/fairy-garden/build_places.py']:
 for n in ast.parse(path.read_text()).body:
  if isinstance(n,ast.FunctionDef) and n.name!='flower':exec(compile(ast.Module(body=[n],type_ignores=[]),str(path),'exec'))
empty();random.seed(218)
def pigment(name,rgb):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.9
 noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=15;noise.inputs['Detail'].default_value=2
 ramp=m.node_tree.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*(v*.82 for v in rgb),1);ramp.color_ramp.elements[1].color=(*(min(1,v*1.12) for v in rgb),1);m.node_tree.links.new(noise.outputs['Fac'],ramp.inputs[0]);m.node_tree.links.new(ramp.outputs[0],bs.inputs['Base Color']);return m
rose=pigment('House rose woven linen',(.53,.31,.32));sage=pigment('House sage woven linen',(.33,.46,.37));tile=pigment('House warm kitchen tile',(.58,.57,.43));rug=pigment('House oatmeal wool',(.63,.48,.31));soft=pigment('House cream cushions',(.79,.69,.51))
w,d=cfg['plan']['w'],cfg['plan']['d'];block('House stone foundation',0,0,-.05,w+.2,d+.2,.30,stone)
for row in range(31):
 for col in range(8):
  x=-5.23+col*1.49;z=-4.78+row*.315
  block('House honey floorboard',x,z,.095,1.46,.3,.08,oak)
# Exposed near sides and lowered internal partitions let both bedrooms remain visible.
block('House back plaster',0,-d/2,1.55,w,.18,3,cream);block('House west plaster',-w/2,0,1.55,.18,d,3,cream)
for x in [-5.9,0,5.9]:block('House back oak upright',x,-4.85,1.55,.13,.13,3,wood)
for h in [.2,2.95]:block('House back beam',0,-4.83,h,w,.15,.13,wood);block('House west beam',-5.83,0,h,.15,d,.13,wood)
for wall in cfg['walls']:
 block('House cutaway partition',wall['x'],wall['z'],.14+wall['h']/2,wall['w'],wall['d'],wall['h'],cream)
 block('House partition timber cap',wall['x'],wall['z'],.17+wall['h'],wall['w']+.035,wall['d']+.035,.065,wood)
for x in cfg['plan']['doorCenters']:
 for sign in [-1,1]:block('Bedroom door post',x+sign*.99,-.6,1.05,.105,.17,1.85,oak)
 block('Bedroom threshold',x,-.6,.17,1.8,.23,.055,oak)
for id,b in cfg['beds'].items():
 x,z=b['x'],b['z'];bw,bd=b['w'],b['d'];cloth=rose if b['palette']=='rose' else sage
 block(id+' double bed frame',x,z,.44,bw,bd,.35,wood)
 block(id+' double mattress',x,z,.69,bw-.10,bd-.1,.26,soft)
 block(id+' folded quilt',x,z+.60,.85,bw-.08,1.2,.10,cloth)
 for q in [-.57,.57]:pebble(id+' pillow',x+q,z-.95,.91,.46,.27,.12,soft)
 block(id+' tall carved headboard',x,z-bd/2+.02,1.01,bw,.14,.94,oak)
 for q in [-bw/2+.08,bw/2-.08]:
  rod(id+' bedpost',(x+q,z-bd/2,.2),(x+q,z-bd/2,1.58),.055,wood)
  pebble(id+' bedpost finial',x+q,z-bd/2,1.64,.085,.085,.085,gold)
 for k in range(9):block(id+' quilt stitch',x-1.02+k*.255,z+1.12,.91,.08,.026,.012,soft)
 block(id+' woven bedside rug',x,z+1.87,.155,2.25,.60,.027,cloth)
 # Window, curtains and bedside lamp (outside the walking corridor).
 block(id+' warm window frame',x,-4.86,2.23,1.7,.12,1.03,wood);block(id+' honey window',x,-4.76,2.23,1.53,.055,.86,glow)
 for q in [-.8,.8]:block(id+' curtain',x+q,-4.65,2.14,.30,.12,1.16,cloth)
 block(id+' window crossbar',x,-4.69,2.23,.055,.05,.9,oak)
# Living room furniture and kitchen share the same footprints used by navigation.
for item in cfg['furniture']:
 x,z,fw,fd=item['x'],item['z'],item['w'],item['d'];kind=item['kind']
 if kind=='hearth':
  block('Living hearth apron',x,z,.18,fw,fd,.14,stone)
  block('Living dark hearth',x-.29,z,.65,.12,1.15,1,M['Cauldron iron'])
  for q in [-.62,.62]:block('Living hearth stone jamb',x,z+q,.72,.7,.28,1.1,stone)
  block('Living timber mantel',x,z,1.36,.9,1.65,.16,oak)
  for j in range(3):pebble('Living warm ember',x+.06,z-.3+j*.3,.39,.12,.10,.18,glow)
 elif kind=='sofa':
  block('Sofa timber feet',x,z,.32,fw,fd,.32,wood);block('Sofa soft seat',x,z,.53,fw-.08,fd-.03,.23,sage)
  block('Sofa upholstered back',x,z-.38,.88,fw,.18,.68,sage)
  for q in [-1.15,1.15]:block('Sofa arm',x+q,z,.75,.2,fd,.48,sage)
  for q in [-.63,.63]:pebble('Sofa loose pillow',x+q,z-.20,.83,.30,.12,.28,soft)
 elif kind in ['table','dining']:
  h=.56 if kind=='table' else .98;block('House '+kind+' top',x,z,h,fw,fd,.12,oak)
  for dx in [-fw/2+.12,fw/2-.12]:
   for dz in [-fd/2+.12,fd/2-.12]:rod(kind+' leg',(x+dx,z+dz,.14),(x+dx,z+dz,h),.04,wood)
  if kind=='dining':
   for q in [-.45,.45]:cyl('Dining handmade cup',pos(x+q,z,h+.15),.075,.17,soft)
  else:block('Closed storybook',x-.2,z,h+.085,.4,.27,.045,rose)
 elif kind=='chair':
  block('Dining stool',x,z,.53,fw,fd,.10,oak)
  for dx in [-.19,.19]:rod('Stool leg',(x+dx,z,.14),(x+dx,z,.53),.05,wood)
 elif kind=='shelf':
  for q in [-fd/2,fd/2]:block('Collection side',x,z+q,1.14,fw,.09,2,wood)
  for h in [.24,.87,1.5,2.1]:block('Collection empty shelf',x,z,h,fw,fd,.065,oak)
 elif kind=='kitchen':
  block('Kitchen sage cabinet',x,z,.59,fw,fd,.9,sage);block('Kitchen stone counter',x,z,1.09,fw+.06,fd+.04,.13,stone)
  for q in [-.95,0,.95]:block('Kitchen cupboard face',x-fw/2-.01,z+q,.63,.04,.78,.65,oak);pebble('Kitchen brass knob',x-fw/2-.05,z+q,.7,.028,.04,.04,gold)
  for q in [-.75,.7]:cyl('Kitchen ceramic jar',pos(x,z+q,1.33),.15,.34,soft)
# Tiled kitchen defines a fourth room. Hallway stays broad and uncluttered.
for x in [1.4+i*.47 for i in range(10)]:
 for z in [-.14+i*.47 for i in range(11)]:block('Kitchen floor tile',x,z,.151,.45,.45,.025,tile)
block('Living oval woven rug',-3.2,2.9,.15,3.55,2.65,.025,rug)
block('Front door threshold',0,4.83,.16,1.6,.34,.08,stone)
# No baked people: the runtime poses its own two adjustable avatars on these beds.
sc=camera('Camera full house',(0,0,1),(15,19,17),18);save_render('home-interior',sc)
print('HOUSE_READY',out,flush=True)
