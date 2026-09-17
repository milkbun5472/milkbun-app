"""Extend the existing village and build a room + wishing-tree asset.
Blender --background --python art/fairy-garden/build_places.py -- BASE_DIRECTORY OUTPUT_DIRECTORY
Editable originals and previews stay outside the game fingerprint; exported GLBs go through export-fairy-village.py.
Coordinates below use game (x, z, height), converted once to Blender.
"""
import bpy, math, random, sys, ast
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
random.seed(827)
bpy.ops.wm.open_mainfile(filepath=str(base/'village-v2/fairy-village-v2.blend'))
for n in ast.parse((base/'build.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name!='flower':exec(compile(ast.Module(body=[n],type_ignores=[]),'primitives','exec'))
M=bpy.data.materials
wood=M['Walnut beams'];oak=M['Honey oak'];stone=M['Old stepping stones'];cream=M['Warm lime plaster'];gold=M['Old brass'];paper=M['Parchment'];glow=M['Honey window glow'];water=M['Moon pond • reflected dusk'];green=M['Sunlit foliage']
def pos(x,z,h):return (x,-z,h)
def block(n,x,z,h,w,d,t,m=oak):return cube(n,pos(x,z,h),(w,d,t),m,.025)
def pebble(n,x,z,h,w,d,t,m=stone):return uv(n,pos(x,z,h),(w,d,t),m)
def rod(n,a,b,r=.035,m=wood):return beam(n,pos(*a),pos(*b),r,m)
def path(points):
 for a,b in zip(points,points[1:]):
  steps=max(1,int(math.dist(a,b)/.4))
  for j in range(steps):
   t=j/steps;x=a[0]+(b[0]-a[0])*t;z=a[1]+(b[1]-a[1])*t
   pebble('Old path addition',x+random.uniform(-.1,.1),z,.105,.28,.23,.055)
def lantern(x,z,h=.0):
 rod('Lantern post',(x,z,h),(x,z,h+1.45),.055)
 block('Lantern copper base',x,z,h+1.42,.28,.25,.065,gold)
 block('Lantern honey glass',x,z,h+1.61,.19,.17,.31,glow)
 for dx in [-.115,.115]:rod('Lantern frame',(x+dx,z-.1,h+1.42),(x+dx,z-.1,h+1.78),.013,gold)
 o=cyl('Lantern cap',pos(x,z,h+1.82),.2,.14,wood,r2=.025)
def camera(name,target,eye,scale=12):
 bpy.ops.object.camera_add(location=pos(*eye));c=bpy.context.object;c.name=name;c.rotation_euler=(Vector(pos(*target))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=scale;bpy.context.scene.camera=c
 sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=16;sc.render.resolution_x=1300;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
 return sc
def save_render(name,sc):
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')));sc.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
# Public forecourt: an open paved circle and a board, no occupants or fake player notes.
for ring in range(1,5):
 for i in range(ring*9):
  a=i*math.tau/(ring*9);r=ring*.36
  pebble('Forecourt worn paver',-1+math.cos(a)*r,-.65+math.sin(a)*r,.11,.22,.17,.04)
for x in [-2.9,-1.9]:rod('Noticeboard post',(x,-1.6,.08),(x,-1.6,1.75),.07)
block('Noticeboard cork',-2.4,-1.6,1.18,1.08,.13,.88,wood)
for x in [-2.94,-1.86]:block('Noticeboard trim',x,-1.68,1.18,.06,.06,.9,oak)
for h in [.73,1.63]:block('Noticeboard trim',-2.4,-1.68,h,1.16,.06,.075,oak)
for x,h in [(-2.7,1.32),(-2.3,1.38),(-2.15,1.03)]:block('Blank paper on board',x,-1.69,h,.22,.012,.28,paper)
# Empty market furniture at the west side of the square, ready for a later schedule.
for x,z in [(-.7,2.1),(-2.3,1.45)]:
 block('Market empty counter',x,z,.74,1.25,.55,.12,oak)
 for dx in [-.5,.5]:
  for dz in [-.2,.2]:rod('Market legs',(x+dx,z+dz,.08),(x+dx,z+dz,.74),.04)
 for dx in [-.59,.59]:rod('Market canopy support',(x+dx,z+.22,.08),(x+dx,z+.22,1.93),.045)
 block('Folded market cloth',x,z+.12,.84,.55,.35,.09,M['Weathered sage'])
 rod('Market overhead rail',(x-.65,z+.22,1.94),(x+.65,z+.22,1.94),.045)
lantern(-.1,1.6)
# A creek leaves the existing pond on its eastern edge and heads beyond the clearing.
verts=[];faces=[]
for i in range(27):
 x=7.2+i*.29;zc=3+.15*math.sin(i*.21)
 for side in [-1,1]:verts.append(pos(x,zc+side*.64,.09))
 if i:faces.append((i*2-2,i*2-1,i*2+1,i*2))
mesh('Moon creek ribbon',verts,faces,water)
for i in range(27):
 x=7.3+i*.3;zc=3+.15*math.sin(i*.21)
 for side in [-1,1]:
  if abs(x-10)<.8:continue
  pebble('Creek moss bank',x,zc+side*.74,.11,.22,.18,.11,M['Village • moss & grass'])
for j in range(13):block('Footbridge honey plank',10,1.9+j*.19,.33,1.7,.175,.1,oak)
for x in [9.15,10.85]:
 for z in [1.9,3.1,4.2]:rod('Bridge railing post',(x,z,.1),(x,z,.99),.05)
 for a,b in [(1.9,3.1),(3.1,4.2)]:rod('Bridge handrail',(x,a,.92),(x,b,.92),.045)
lantern(11.2,4.4);path([(5.5,6.5),(8,6),(10,4.6)]);path([(10,1.6),(10,-.7)])
sc=camera('Camera village expanded',(1,1,1),(19,26,24),29);save_render('village-expanded',sc)
# Keep materials and lighting but remove geometry to author separate streaming scenes.
def empty():
 for o in list(bpy.data.objects):
  if o.type in {'MESH','CURVE','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
empty()
# Small cutaway interior: open near sides, a clear central walking lane.
block('Room stone foundation',0,0,-.08,6.2,6.2,.3,stone)
for j in range(19):
 for i in range(4):block('Room oak floorboard',-2.3+i*1.53,-2.83+j*.315,.085,1.5,.30,.10,oak)
block('Room back plaster',0,-3,1.55,6.1,.18,3,cream);block('Room left plaster',-3,0,1.55,.18,6,3,cream)
for x in [-2.9,0,2.9]:block('Room back upright',x,-2.86,1.55,.12,.15,3,wood)
for h in [.18,2.95]:block('Room back crossbeam',0,-2.84,h,6,.15,.13,wood);block('Room side crossbeam',-2.84,0,h,.15,6,.13,wood)
# Bed, pillows and a woven rug.
block('Bed wooden base',-1.8,-1.55,.36,1.45,2.35,.32,wood)
block('Bed cream mattress',-1.8,-1.55,.58,1.38,2.25,.27,paper)
block('Bed sage quilt',-1.8,-1.05,.77,1.4,1.25,.13,M['Weathered sage'])
pebble('Soft bed pillow',-1.8,-2.34,.77,.48,.28,.12,paper)
for x in [-2.5,-1.1]:rod('Bed end post',(x,-2.73,.08),(x,-2.73,1.2),.055)
block('Bed headboard',-1.8,-2.74,.93,1.4,.1,.55,oak)
block('Room woven rug',0,.65,.155,2.7,2.0,.035,M['Sage enamel shingles'])
for i in range(13):block('Rug cream stitching',-1.2+i*.2,1.57,.18,.09,.03,.009,paper)
# Fireplace at the back, with low warm coals instead of a giant flame.
block('Hearth stone apron',.1,-2.2,.17,1.3,.95,.13,stone)
block('Hearth dark recess',.1,-2.75,.62,.82,.13,.95,M['Cauldron iron'])
for x in [-.48,.68]:block('Hearth stone upright',x,-2.52,.66,.3,.55,1.06,stone)
block('Hearth mantel',.1,-2.52,1.25,1.5,.68,.16,oak)
for j in range(3):rod('Hearth logs',(-.12+j*.15,-2.31,.25),(.28+j*.1,-2.62,.27),.07,wood)
for x in [-.12,.1,.29]:pebble('Hearth honey ember',x,-2.45,.35,.08,.065,.12,glow)
# Writing desk, folded paper, glass bottle and an empty display bookcase.
block('Writing desk top',1.98,-1.65,.97,1.5,.85,.12,oak)
for x in [1.35,2.6]:
 for z in [-1.98,-1.33]:rod('Writing desk leg',(x,z,.08),(x,z,.95),.045)
block('Desk blank paper',1.8,-1.6,1.045,.42,.32,.012,paper);cyl('Desk ink bottle',pos(2.37,-1.82,1.13),.07,.17,M['Potion jade'])
block('Desk stool seat',1.9,-.73,.52,.57,.55,.12,oak)
for x in [1.69,2.11]:rod('Stool leg',(x,-.73,.1),(x,-.73,.52),.045)
for h in [.2,.83,1.46,2.1]:block('Empty collection shelf',-2.66,1.03,h,.5,1.52,.09,oak)
for z in [.24,1.82]:block('Shelf side',-2.66,z,1.15,.52,.08,2.1,wood)
# Amber leaded window with wooden mullions.
block('Interior window glow',1.91,-2.88,2.05,1.05,.06,1.08,glow)
for x in [1.35,1.91,2.47]:block('Interior window vertical',x,-2.82,2.05,.065,.09,1.21,wood)
for h in [1.45,2.05,2.65]:block('Interior window horizontal',1.91,-2.82,h,1.18,.09,.065,wood)
# Door threshold at the open front provides a legible exit.
block('Home threshold',0,2.82,.12,1.2,.32,.1,stone)
lantern(2.52,1.9)
sc=camera('Camera home interior',(0,0,1),(9,12,10),10.4);save_render('home-interior',sc)
empty()
# An organically shaped hill and old wishing tree, authored in forest coordinates.
N=48;R=10;v=[pos(0,-6,.98)];f=[]
for ring in range(1,R+1):
 r=ring/R
 for i in range(N):
  a=i*math.tau/N;v.append(pos(math.cos(a)*2.5*r,-6+math.sin(a)*1.85*r,.08+.9*(1-r*r)**2))
for i in range(N):f.append((0,1+i,1+(i+1)%N))
for ring in range(1,R):
 for i in range(N):
  a=1+(ring-1)*N+i;b=1+(ring-1)*N+(i+1)%N;f.append((a,b,b+N,a+N))
mesh('Wish hill meadow',v,[tuple(reversed(face)) for face in f],M['Village • moss & grass'])
trunk=[(0,-6,.98),(-.18,-5.95,2.0),(.12,-6.05,3.2),(-.1,-6,4.3)]
for i in range(3):rod('Old wishing trunk',trunk[i],trunk[i+1],.34-i*.07,wood)
for j in range(7):
 a=j*2.4;x=math.cos(a)*1.5;z=-6+math.sin(a)*1.22;h=4.4+(j%3)*.35
 rod('Wish reaching branch',(.03,-6,2.8+(j%2)*.4),(x,z,h),.12,wood)
 for k in range(3):pebble('Wish foliage',x+math.sin(k*2+j)*.46,z+math.cos(k*2+j)*.4,h+k*.36,.92,.78,.69,green if j%2 else M['Deep foliage'])
for j in range(8):
 a=j*math.tau/8;x=math.cos(a)*.95;z=-6+math.sin(a)*.85
 rod('Old tree root',(0,-6,1.04),(x,z,.08+.9*(1-(x/2.5)**2-((z+6)/1.85)**2)**2+.05),.095,wood)
for j in range(9):
 a=j*2.4;x=math.cos(a)*1.3;z=-6+math.sin(a)*1.1;h=3.5+(j%3)*.23
 rod('Wish empty hanging thread',(x,z,h),(x+.04,z,h-.55),.009,gold)
 block('Wish blank wooden tag',x+.04,z,h-.62,.11,.025,.18,paper)
lantern(-1.55,-5.0,.31);path([(-1.35,-3.8),(-1.65,-4.45)])
sc=camera('Camera wishing tree',(0,-6,2.7),(10,8,10),10.8);save_render('wishing-tree',sc)
print('SCENES_READY',out,flush=True)
