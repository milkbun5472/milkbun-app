"""Blender --background --python art/fairy-garden/build_wishing_tree.py -- ART_ROOT OUTPUT_DIR.
Shared hill comes from MAPS; ornaments are blank scenery, never saved player wishes.
"""
import bpy, math, random, sys, ast, json, subprocess
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
hill=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');process.stdout.write(JSON.stringify(FairyGardenRules.MAPS.forest.surfaces[0]))"],cwd=repo))
bpy.ops.wm.open_mainfile(filepath=str(base/'scene-expansion/wishing-tree.blend'))
for n in ast.parse((base/'build.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name!='flower':exec(compile(ast.Module(body=[n],type_ignores=[]),'primitives','exec'))
for o in list(bpy.data.objects):
 if o.type in {'MESH','CURVE','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
random.seed(916)
M=bpy.data.materials
bark=mat('Ancient walnut silver bark',(.24,.18,.13));ridge=mat('Ancient oak golden ridges',(.43,.32,.19));gold=mat('Wish antique gold',(.68,.45,.16),metal=.45)
leaves=[mat('Wish foliage '+str(i),c) for i,c in enumerate([(.12,.32,.27),(.22,.43,.34),(.35,.52,.37),(.43,.58,.46),(.25,.39,.40)])]
light=mat('Wish star amber',(.95,.64,.25),emit=1.5);paper=mat('Wish blank ivory',(.88,.77,.53));ribbon=mat('Wish muted rose ribbon',(.48,.23,.25))
def pos(x,z,h):return Vector((x,-z,h))
def surf(x,z):
 r=((x-hill['x'])/hill['rx'])**2+((z-hill['z'])/hill['rz'])**2
 return .08+hill['height']*max(0,1-r)**2
# Continuous tapered sculptural branches, no stacked cylinder seams.
def tube(name,points,radii,material,sides=9):
 pts=[pos(*p) for p in points];verts=[];faces=[]
 for i,p in enumerate(pts):
  tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized();axis=tangent.cross(Vector((0,1,0))).normalized();other=tangent.cross(axis).normalized()
  for j in range(sides):verts.append(p+radii[i]*(axis*math.cos(j*math.tau/sides)+other*math.sin(j*math.tau/sides)))
  if i:
   for j in range(sides):a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
 o=mesh(name,verts,faces,material);o.modifiers.clear()
 for f in o.data.polygons:f.use_smooth=True
 return o
# Meadow reuses the exact walking-surface formula.
N=64;R=14;v=[pos(0,-6,surf(0,-6))];f=[]
for ring in range(1,R+1):
 for i in range(N):a=i*math.tau/N;r=ring/R;x=math.cos(a)*hill['rx']*r;z=-6+math.sin(a)*hill['rz']*r;v.append(pos(x,z,surf(x,z)))
for i in range(N):f.append((0,1+(i+1)%N,1+i))
for ring in range(1,R):
 for i in range(N):a=1+(ring-1)*N+i;b=1+(ring-1)*N+(i+1)%N;f.append((a,b,b+N,a+N))
o=mesh('Wish hill shared surface',v,f,M['Village • moss & grass']);o.modifiers.clear()
for f in o.data.polygons:f.use_smooth=True
trunk=[(0,-6,.96),(-.22,-6,1.65),(-.28,-6.07,2.35),(.05,-6.12,3.05),(.28,-6.03,3.85),(.12,-6,4.55),(-.3,-6.04,5.4),(-.7,-6,6.2)]
tube('Ancient twisting heartwood',trunk,[.63,.53,.46,.39,.33,.27,.19,.06],bark,14)
# Flaring roots hug the earth; keep the visitor approach (0,-4.9) clear.
for j in range(9):
 a=j*math.tau/9;dx=math.cos(a);dz=math.sin(a);length=1.6 if dz<.4 else 1.0
 pts=[(0,-6,1.45),(dx*.55,-6+dz*.5,1.02),(dx*length*.72,-6+dz*length*.65,surf(dx*length*.72,-6+dz*length*.65)+.08),(dx*length,-6+dz*length*.9,surf(dx*length,-6+dz*length*.9)+.015)]
 tube('Spreading ancient root',pts,[.22,.18,.095,.008],bark)
for j in range(8):
 a=j*math.tau/8;pts=[]
 for i,p in enumerate(trunk[:-1]):r=[.63,.53,.46,.39,.33,.27,.19][i];angle=a+i*.34;pts.append((p[0]+math.cos(angle)*r,p[1]+math.sin(angle)*r,p[2]))
 tube('Fine spiralling bark grain',pts,[.018]*len(pts),ridge,5)
# Hand-shaped pointed leaf, gently folded along a central vein.
def leaf(name,x,z,h,size,angle,material):
 verts=[(0,0,0),(-.22,-.2,.04),(-.3,-.48,.07),(-.18,-.73,.1),(0,-.95,.13),(.18,-.73,.1),(.3,-.48,.07),(.22,-.2,.04),(0,-.43,.14)];faces=[(i,(i+1)%8,8) for i in range(8)]
 o=mesh(name,[(a*size,b*size,c*size) for a,b,c in verts],faces,material);o.modifiers.clear();o.location=pos(x,z,h);o.rotation_euler=(random.uniform(-.35,.35),random.uniform(-.25,.25),angle);return o
# Broad tiered canopy with clear windows between boughs and cascading leaf strands.
for j in range(12):
 a=j*2.399;reach=2.6+(j%3)*.35;h=4.6+(j%4)*.55;dx=math.cos(a);dz=math.sin(a)*.82
 end=(dx*reach,-6+dz*reach,h)
 tube('Sweeping crown bough',[(.12,-6,3.4+(j%3)*.4),(dx*.9,-6+dz*.9,h-.5),(dx*reach*.72,-6+dz*reach*.72,h+.18),end],[.21,.16,.075,.016],bark)
 for k in range(5):
  t=.4+k*.15;x=dx*reach*t;z=-6+dz*reach*t;ch=h+.24+math.sin(t*math.pi)*.35
  # Small flattened masses support a scalloped leaf silhouette rather than spherical blobs.
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=pos(x,z,ch));o=bpy.context.object;o.name='Layered foliage cushion';o.scale=(.8,.62,.30);finish(o,o.name,leaves[(j+k)%len(leaves)])
  for polygon in o.data.polygons:polygon.use_smooth=True
  for n in range(8):
   ang=n*math.tau/8+random.random()*.3
   leaf('Canopy painted leaf',x+math.cos(ang)*.62,z+math.sin(ang)*.49,ch+random.uniform(.08,.25),random.uniform(.36,.58),ang,leaves[(n+j)%len(leaves)])
 for k in range(3):
  sx=end[0]+(k-1)*.36;sz=end[1]+math.cos(a+k)*.23;length=1.25+(j%3)*.35
  pts=[(sx,sz,h+.1),(sx+.1,sz+.05,h-.5),(sx+.04,sz+.12,h-length)]
  tube('Drooping willow filament',pts,[.015,.011,.003],ridge,5)
  for n in range(7):
   t=n/7;leaf('Hanging foliage',sx+(.14 if n%2 else -.14),sz+.1*t,h-length*t,.36,n*.9,leaves[(j+n)%len(leaves)])
# A small crescent cradled in the tree's central opening.
pts=[(.1+math.cos(a)*.47,-4.6,3.85+math.sin(a)*.47) for a in [math.radians(55+i*250/30) for i in range(31)]]
tube('Golden crescent among branches',pts,[.016+.065*math.sin(i*math.pi/30) for i in range(31)],gold,8)
def star(x,z,h,r=.13):
 verts=[pos(x,z-.025,h)]
 for i in range(10):a=i*math.pi/5+math.pi/2;rr=r if i%2==0 else r*.43;verts.append(pos(x+math.cos(a)*rr,z,h+math.sin(a)*rr))
 o=mesh('Small luminous wishing star',verts,[(0,1+i,1+(i+1)%10) for i in range(10)],light);o.modifiers.clear()
for j in range(11):
 a=j*2.399;rr=1.45+(j%3)*.48;x=math.cos(a)*rr;z=-6+math.sin(a)*rr*.77;top=4.8+(j%3)*.37;bottom=top-.9-(j%2)*.25
 tube('Fine wish cord',[(x,z,top),(x+.035,z,bottom)],[.009,.008],gold,5);star(x+.035,z,bottom,.12)
 if j%2==0:
  cube('Blank hanging wish plaque',pos(x+.035,z,bottom-.25),(.12,.035,.2),paper,.02)
  tube('Rose wish ribbon',[(x+.08,z,bottom-.24),(x+.14,z,bottom-.45),(x+.10,z,bottom-.61)],[.018,.017,.006],ribbon,5)
# Low ring of old marker stones, with a generous front opening.
for j in range(13):
 a=math.radians(15+j*330/12)
 if math.sin(a)>.55:continue
 x=math.cos(a)*1.8;z=-6+math.sin(a)*1.36
 uv('Moss softened standing stone',pos(x,z,surf(x,z)+.12),(.15,.14,.22),M['Old stepping stones'])
# A few gold seeds of light, kept as a single static batch in exported material.
for j in range(18):
 a=j*2.4;r=1.0+(j%4)*.35;x=math.cos(a)*r;z=-6+math.sin(a)*r*.7
 uv('Tiny floating wish light',pos(x,z,1.5+(j%5)*.42),(.028,.028,.028),light)
bpy.ops.object.camera_add(location=pos(11,10,10));c=bpy.context.object;c.rotation_euler=(pos(0,-6,3.7)-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=10.5;bpy.context.scene.camera=c
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=1200;sc.render.resolution_y=1200;sc.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(out/'wishing-tree.blend'));sc.render.filepath=str(out/'wishing-tree.png');bpy.ops.render.render(write_still=True)
print('WISHING_TREE_READY',flush=True)
