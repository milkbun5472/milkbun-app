"""Blender-authored sleeper carriage. All coordinates metres, Blender Z up.
Run: Blender -b --python art/train-carriage/build.py [-- --no-render]
"""
import bpy, math, json, random, sys, hashlib
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
random.seed(42)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for dat in list(bpy.data.materials): bpy.data.materials.remove(dat)
scene=bpy.context.scene
COL={}
for name in ['Interior','ShellFront','ShellEnd','Roof','WindowGlass','Staging']:
 c=bpy.data.collections.new(name);scene.collection.children.link(c);COL[name]=c
GROUP='Interior'
def assign(o,name,mat):
 o.name=name
 for c in list(o.users_collection): c.objects.unlink(o)
 COL[GROUP].objects.link(o)
 if mat:o.data.materials.append(mat)
 o['carriageGroup']=GROUP
 return o
def mat(name,color,rough=.65,metal=0,grain=False):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if grain:
  n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=95;n.inputs['Detail'].default_value=2
  bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.012
  m.node_tree.links.new(n.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 return m
wood=mat('Honey oak',(.34,.17,.072),grain=True);edge=mat('Dark walnut',(.115,.055,.031),grain=True)
cream=mat('Warm ivory enamel',(.79,.71,.55));green=mat('Deep forest velvet',(.055,.15,.115),grain=True)
sage=mat('Sage woven blanket',(.27,.38,.29),grain=True);linen=mat('Linen bedding',(.84,.78,.64),grain=True)
rose=mat('Dusty rust blanket',(.48,.22,.15),grain=True);brass=mat('Brushed antique brass',(.53,.32,.105),.3,.72)
black=mat('Underframe charcoal',(.042,.053,.05),.6,.35);paper=mat('Warm paper',(.9,.85,.71));blue=mat('Book blue',(.11,.23,.27))
ceramic=mat('Cream ceramic',(.9,.81,.64),.25);tea=mat('Tea',(.12,.047,.014),.18)
glow=mat('Milk glass lamp',(.99,.83,.47),.3);p=glow.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.62,.23,1);p.inputs['Emission Strength'].default_value=.55
floors=[mat('Oak floor %s'%i,tuple(c*v for c in (.35,.20,.105)),grain=True) for i,v in enumerate([.91,1,1.08,1.15])]
def bevel(o,r,segments=3):
 if r:
  m=o.modifiers.new('Soft crafted edges','BEVEL');m.width=r;m.segments=segments
  m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def box(name,loc,size,ma,r=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return bevel(assign(o,name,ma),r)
def mesh(name,verts,faces,ma):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);COL[GROUP].objects.link(o);o['carriageGroup']=GROUP
 if ma:d.materials.append(ma)
 return o
def rod(name,a,b,r,ma,vertices=12):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=(b-a).length,location=(a+b)/2)
 o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();assign(o,name,ma)
 for f in o.data.polygons:f.use_smooth=True
 return bevel(o,min(r*.3,.009),2)
def curve(name,pts,r,ma,cyclic=False):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=1;d.bevel_depth=r;d.bevel_resolution=2
 s=d.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*co,1)
 s.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,d);COL[GROUP].objects.link(o);o['carriageGroup']=GROUP;d.materials.append(ma);return o
def sphere(name,loc,size,ma):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);assign(o,name,ma)
 for f in o.data.polygons:f.use_smooth=True
 return o
def roundrect(cx,cy,w,h,r,z):
 pts=[]
 for x,y,start in [(cx+w/2-r,cy+h/2-r,0),(cx-w/2+r,cy+h/2-r,90),(cx-w/2+r,cy-h/2+r,180),(cx+w/2-r,cy-h/2+r,270)]:
  for i in range(9):
   a=math.radians(start+i*90/8);pts.append((x+r*math.cos(a),y+r*math.sin(a),z))
 return pts
def frame(name,x,y,z,w,h,ma,r=.035):
 # Rounded continuous rail in the X/Z plane.
 pts=roundrect(x,z,w,h,min(.15,w/5,h/5),0)
 return curve(name,[(a,y,b) for a,b,_ in pts],r,ma,True)
def pillow(name,loc,size,ma):
 o=box(name,loc,size,ma,min(size)*.37)
 return o
# A complete floor sits above a shallow carriage underframe.
box('Carriage foundation',(0,0,-.12),(6.8,3.2,.25),edge,.09)
box('Exterior green skirt',(0,0,-.23),(6.9,3.25,.14),green,.055)
for j in range(14):
 for i in range(4):
  x=-3.35+i*1.68
  box('Oak floor plank %02d_%02d'%(j,i),(x+.83,-1.48+j*.226,.024),(1.672,.221,.045),random.choice(floors),.007)
for y in [-1.56,1.56]:box('Brass floor threshold',(0,y,.05),(6.66,.025,.025),brass,.005)
# Rear wall: actual opening 2.70 m wide (no fake painted window).
for name,x,w,z,h in [('Window lower wall',0,6.8,.48,.86),('Window upper wall',0,6.8,2.57,.34),('Sleeping wall',-1.93,2.94,1.66,1.54),('Window right pier',3.14,.52,1.66,1.54)]:
 box(name,(x,1.60,z),(w,.14,h),cream,.03)
box('Rear walnut wainscot',(0,1.50,.44),(6.65,.10,.77),wood,.02)
for x in [-3.15,-2.5,-1.85,-1.2,-.55,.1,.75,1.4,2.05,2.7,3.15]:box('Wainscot narrow stile',(x,1.433,.45),(.035,.028,.66),edge,.006)
for z in [.13,.81]:box('Wainscot horizontal moulding',(0,1.418,z),(6.62,.055,.045),edge,.008)
# Left end includes a believable inset sliding door.
box('Left end wall',(-3.4,0,1.38),(.13,3.2,2.7),cream,.045)
box('Entry door walnut surround',(-3.312,-.65,1.16),(.075,1.10,2.20),edge,.045)
box('Entry sliding door',(-3.263,-.65,1.16),(.04,.96,2.05),green,.045)
box('Entry frosted glass',(-3.237,-.65,1.66),(.012,.66,.70),linen,.04)
for z in [.48,.91]:box('Door inset panel',(-3.234,-.65,z),(.025,.74,.32),wood,.018)
rod('Door pull',(-3.20,-1.02,1.02),(-3.20,-1.02,1.32),.018,brass)
box('Door top rail',(-3.22,-.65,2.28),(.055,1.26,.04),brass,.009)
# Panorama glazing and a substantial timber sill.
frame('Panorama outer walnut rim',1.19,1.482,1.65,2.91,1.60,edge,.075)
frame('Panorama brass reveal',1.19,1.448,1.65,2.76,1.45,brass,.025)
box('Deep window sill',(1.19,1.31,.924),(3.05,.49,.095),wood,.04)
GROUP='WindowGlass'
glass=mat('Clear window glass',(.70,.87,.88),.13);p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Alpha'].default_value=.13;glass.diffuse_color=(.7,.87,.88,.13);glass.surface_render_method='DITHERED'
box('Panorama glass',(1.19,1.57,1.65),(2.69,.018,1.37),glass,.07)
GROUP='Interior'
# Continuous gathered linen panels, not stacks of strips.
def curtain(name,x,w):
 verts=[];faces=[];cols=32;rows=18
 for j in range(rows+1):
  t=j/rows
  for i in range(cols+1):
   u=i/cols;xx=x+(u-.5)*w*(1-.22*math.sin(t*math.pi));yy=1.29+.055*math.cos(u*math.pi*12)
   verts.append((xx,yy,2.43-t*1.46+.017*math.sin(u*math.pi*12)*t))
 for j in range(rows):
  for i in range(cols):k=j*(cols+1)+i;faces.append((k,k+1,k+cols+2,k+cols+1))
 o=mesh(name,verts,faces,linen)
 for p in o.data.polygons:p.use_smooth=True
 s=o.modifiers.new('Cloth thickness','SOLIDIFY');s.thickness=.006
 rod(name+' tie',(x-w*.39,1.215,1.45),(x+w*.39,1.215,1.45),.023,sage)
 for i in range(6):
  xx=x-w*.42+i*w*.168
  curve(name+' ring',[(xx,1.32+.045*math.cos(a*math.tau/20),2.48+.045*math.sin(a*math.tau/20)) for a in range(20)],.008,brass,True)
curtain('Left gathered curtain',-.28,.43);curtain('Right gathered curtain',2.66,.43)
rod('Curtain pole',(-.58,1.32,2.49),(2.95,1.32,2.49),.025,brass)
for x in [-.62,2.99]:sphere('Curtain pole finial',(x,1.32,2.49),(.055,.045,.045),brass)
# Two bunks to the left; clear access from the front aisle.
for level,z in enumerate([.47,1.55]):
 box('Berth %s oak frame'%level,(-1.91,.90,z),(2.42,1.11,.15),wood,.065)
 box('Berth %s mattress'%level,(-1.91,.90,z+.145),(2.28,1.00,.19),linen,.085)
 pillow('Berth %s pillow'%level,(-2.72,.88,z+.29),(.49,.74,.15),linen)
 # A draped blanket with continuous surface over mattress and down the foot end.
 ma=sage if level==0 else rose
 verts=[];faces=[];nx=24;ny=20
 for i in range(nx+1):
  t=i/nx
  if t<=.72:
   x=-2.15+(t/.72)*1.29;zz=z+.265
  elif t<=.86:
   a=(1-(t-.72)/.14)*math.pi/2;x=-.86+.115*math.cos(a);zz=z+.15+.115*math.sin(a)
  else:
   x=-.745+(t-.86)*.10;zz=z+.15-(t-.86)/.14*.30
  for j in range(ny+1):
   u=j/ny;y=.9+(u-.5)*.91;h=zz+.004*math.sin(u*math.pi*10+t*2)
   verts.append((x,y,h))
 for i in range(nx):
  for j in range(ny):k=i*(ny+1)+j;faces.append((k,k+ny+1,k+ny+2,k+1))
 o=mesh('Berth %s draped blanket'%level,verts,faces,ma)
 for p in o.data.polygons:p.use_smooth=True
 m=o.modifiers.new('Blanket hem thickness','SOLIDIFY');m.thickness=.009
 # Thin edging along the visible side of each wooden bed.
 box('Berth brass edge',(-1.91,.334,z+.01),(2.27,.017,.025),brass,.006)
for x in [-3.15,-.67]:box('Bunk upright',(x,1.36,1.14),(.09,.13,2.15),edge,.018)
# Upper berth guard only along foot half, leaving ladder access at head.
for x in [-1.82,-.73]:rod('Upper guard upright',(x,.32,1.58),(x,.32,1.99),.022,brass)
rod('Upper berth guard',(-1.82,.32,1.98),(-.73,.32,1.98),.023,brass)
for x in [-2.86,-2.43]:rod('Ladder rail',(x,-.03,.08),(x,.31,1.70),.028,wood)
for z in [.28,.56,.84,1.12,1.4]:
 y=-.03+(z-.08)/1.62*.34;rod('Ladder brass tread',(-2.86,y,z),(-2.43,y,z),.024,brass)
# Bedside shelf and lamps on the back wall.
for z in [1.14,2.16]:
 box('Reading lamp plate',(-2.89,1.39,z),(.15,.065,.20),brass,.025)
 rod('Reading lamp arm',(-2.89,1.34,z),(-2.89,1.17,z+.06),.02,brass)
 sphere('Reading lamp shade',(-2.89,1.10,z+.045),(.10,.10,.085),glow)
box('Bedside pocket',(-.53,1.34,1.22),(.20,.24,.35),wood,.025)
# Face-to-face dinette; chairs face along X. Seat height suits the existing ~1.4m dolls.
for side,x in [('Left',.02),('Right',2.53)]:
 sign=-1 if side=='Left' else 1
 box(side+' seat plinth',(x,.32,.26),(.67,1.63,.40),wood,.055)
 box(side+' velvet seat',(x,.32,.51),(.73,1.65,.18),green,.085)
 box(side+' upholstered back',(x+sign*.32,.32,.99),(.18,1.66,.94),green,.085)
 for y in [-.53,1.17]:box(side+' armrest',(x,y,.76),(.76,.10,.13),wood,.05)
 # Welt follows the cushion perimeter, slight contrast.
 curve(side+' seat piping',roundrect(x,.32,.70,1.61,.09,.56),.008,sage,True)
 for y in [-.15,.36,.87]:
  sphere(side+' back button',(x+sign*.215,y,1.04),(.01,.026,.026),sage)
 for y in [-.36,.99]:rod(side+' foot',(x,y,.05),(x,y,.19),.032,brass)
# Spacious clear puzzle tabletop: 1.58 x 1.42.
box('Puzzle table oak rim',(1.27,.32,.858),(1.60,1.47,.11),wood,.075)
box('Puzzle table green felt',(1.27,.32,.919),(1.44,1.31,.015),sage,.055)
box('Puzzle table pedestal',(1.27,.32,.45),(.17,.19,.77),edge,.025)
box('Puzzle table pedestal foot',(1.27,.32,.13),(.75,.60,.075),brass,.035)
# Slim storage trays under the top, removable independently later.
for x in [.86,1.68]:
 box('Puzzle piece drawer',(x,-.20,.77),(.64,.48,.08),wood,.02)
 rod('Drawer pull',(x-.10,-.46,.77),(x+.10,-.46,.77),.012,brass)
# Rug keeps front circulation visually distinct.
box('Aisle woven runner',(-.3,-1.02,.065),(4.55,.73,.018),linen,.08)
for y in [-1.31,-.73]:box('Runner green border',(-.3,y,.077),(4.35,.028,.003),sage,.006)
for x in [-2.48,1.88]:
 for i in range(16):rod('Runner fringe',(x,-1.29+i*.036,.076),(x+(-.08 if x<0 else .08),-1.29+i*.036,.076),.004,linen,6)
# Sill props leave the puzzle felt completely clear.
def mug(x,y):
 z=1.08
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.071,depth=.125,location=(x,y,z));o=assign(bpy.context.object,'Tea cup',ceramic);bevel(o,.012)
 rod('Tea surface',(x,y,z+.062),(x,y,z+.064),.059,tea,32)
 curve('Cup handle',[(x+.071+.049*math.cos(a),y,z+.005+.047*math.sin(a)) for a in [(-math.pi/2+i*math.pi/16) for i in range(17)]],.011,ceramic)
 rod('Saucer',(x,y,1.005),(x,y,1.018),.105,ceramic,32)
mug(.38,1.28);mug(2.04,1.28)
for i,ma in enumerate([rose,blue,linen]):box('Sill travel book',(2.39,1.30,1.01+i*.037),(.24,.21,.033),ma,.008)
# Tiny camera on a shelf rather than table. It is a scene prop, no photography behavior yet.
box('Camera shelf',(-.38,-.62,.99),(.34,.47,.065),wood,.035)
box('Travel camera body',(-.38,-.65,1.12),(.25,.14,.17),black,.025)
box('Camera leather grip',(-.46,-.73,1.12),(.06,.018,.14),edge,.014)
rod('Camera silver lens',(-.34,-.72,1.12),(-.34,-.78,1.12),.052,brass,24)
rod('Camera dark lens',(-.34,-.783,1.12),(-.34,-.79,1.12),.04,blue,24)
# Luggage above bunks.
box('Luggage rack',(-1.88,1.04,2.43),(2.39,.76,.06),wood,.02)
for x in [-2.71,-1.55]:
 box('Leather suitcase',(x,1.05,2.61),(.73,.49,.31),edge if x< -2 else rose,.07)
 for dx in [-.21,.21]:box('Suitcase strap',(x+dx,.798,2.61),(.045,.014,.27),brass,.009)
 curve('Suitcase handle',[(x-.10,.79,2.72),(x-.1,.75,2.79),(x+.10,.75,2.79),(x+.1,.79,2.72)],.012,brass)
# Rear overhead trim, clock, and framed travel keepsakes.
box('Rear cornice',(0,1.43,2.76),(6.75,.16,.10),wood,.03)
rod('Clock brass bezel',(-.68,1.40,2.48),(-.68,1.33,2.48),.147,brass,40)
rod('Clock face',(-.68,1.32,2.48),(-.68,1.313,2.48),.127,paper,40)
rod('Clock hour hand',(-.68,1.30,2.48),(-.73,1.30,2.53),.007,edge)
rod('Clock minute hand',(-.68,1.30,2.48),(-.60,1.30,2.50),.005,edge)
# Shell closes the front and right end; cutaway is a visibility choice, not missing geometry.
GROUP='ShellFront'
box('Front lower panel',(0,-1.63,.49),(6.8,.14,.91),green,.035)
box('Front upper panel',(0,-1.63,2.56),(6.8,.14,.39),cream,.03)
for x in [-3.27,-.95,1.00,3.27]:box('Front window pillar',(x,-1.63,1.61),(.22,.14,1.36),cream,.025)
for x,w in [(-2.11,2.08),(.025,1.73),(2.135,2.05)]:frame('Front window rim',x,-1.64,1.62,w,1.38,brass,.028)
box('Front exterior gold stripe',(0,-1.713,.78),(6.65,.014,.038),brass,.006)
GROUP='ShellEnd'
box('Right end wall',(3.4,0,1.4),(.14,3.2,2.76),green,.055)
box('Right end interior panel',(3.316,0,1.41),(.025,2.99,2.57),cream,.035)
# Barrel roof in one continuous quad mesh, full width, with separate arch ribs.
GROUP='Roof'
verts=[];faces=[]
for x in [-3.48,3.48]:
 for i in range(33):
  a=math.pi*i/32;verts.append((x,1.69*math.cos(a),2.72+.52*math.sin(a)))
for i in range(32):faces.append((i,i+1,i+34,i+33))
o=mesh('Continuous barrel roof',verts,faces,green)
for p in o.data.polygons:p.use_smooth=True
s=o.modifiers.new('Roof thickness','SOLIDIFY');s.thickness=.055
for x in [-3.26,-1.12,1.12,3.26]:curve('Roof inner oak rib',[(x,1.64*math.cos(math.pi*i/32),2.70+.48*math.sin(math.pi*i/32)) for i in range(33)],.025,wood)
# Metadata anchors exported as empties for later runtime interactions.
GROUP='Interior'
anchors={'seat_user':(.04,.32,.60),'seat_companion':(2.53,.32,.60),'puzzle_surface':(1.27,.32,.934),'photo_window':(1.19,1.40,1.65),'berth_lower':(-1.9,.9,.71),'berth_upper':(-1.9,.9,1.79),'entry':(-2.93,-.75,.07)}
for name,loc in anchors.items():
 o=bpy.data.objects.new('anchor_'+name,None);COL[GROUP].objects.link(o);o.location=loc;o.empty_display_size=.12;o['anchor']=name
# Export evaluated geometry; source keeps named editable components and modifiers.
for o in bpy.context.selected_objects:o.select_set(False)
for k,c in COL.items():
 if k!='Staging':
  for o in c.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'carriage.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_materials='EXPORT')
# Render studio uses no extra downloaded image/texture dependencies.
GROUP='Staging'
backdrop=mat('Studio warm background',(.77,.75,.68))
box('Studio ground',(0,0,-.39),(200,200,.08),backdrop,.0)
world=bpy.data.worlds.new('Soft daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.74,.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
for name,loc,power,size,col in [('Large window daylight',(1,4,6),1000,5,(.8,.9,1)),('Softbox front',(-3,-5,7),1300,7,(1,.86,.69)),('Warm fill',(5,-1,4),450,4,(1,.92,.79))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=col;o=bpy.data.objects.new(name,d);COL[GROUP].objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Carriage camera');camera=bpy.data.objects.new('Carriage camera',d);COL[GROUP].objects.link(camera);scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for g in ['ShellFront','ShellEnd','Roof']:
 for o in COL[g].objects:o.hide_render=True;o.hide_set(True)
def view(loc,target,scale):
 camera.location=loc;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=scale
view((8,-11,8),(0,0,1.0),8.9)
# Helpful opening viewport: material colours and visible cutaway, staging hidden in editor.
for o in COL['Staging'].objects:o.hide_set(True)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_distance=10;area.spaces.active.region_3d.view_location=(0,0,1);area.spaces.active.clip_end=200;area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'carriage.blend'))
# Counts include closed-shell geometry. Validate scene graph before rendering.
meshes=[o for k,c in COL.items() if k!='Staging' for o in c.objects if o.type in {'MESH','CURVE'}]
dg=bpy.context.evaluated_depsgraph_get();tri=0
for o in meshes:
 me=o.evaluated_get(dg).to_mesh();me.calc_loop_triangles();tri+=len(me.loop_triangles)
 assert all(math.isfinite(v) for vert in me.vertices for v in vert.co),o.name
 o.evaluated_get(dg).to_mesh_clear()
report={'source':'build.py','meshes_and_curves':len(meshes),'triangles':tri,'glb_bytes':(OUT/'carriage.glb').stat().st_size,'glb_sha256':hashlib.sha256((OUT/'carriage.glb').read_bytes()).hexdigest(),'anchors_blender_z_up':anchors,'dimensions_m':[6.96,3.4,3.62],'puzzle_surface_m':[1.44,1.31],'groups':{k:len(c.objects) for k,c in COL.items() if k!='Staging'},'scope':'Static art asset; no photography, puzzle, chat, seating animation or garden integration.'}
assert report['glb_bytes']<8_000_000
(OUT/'asset-validation.json').write_text(json.dumps(report,indent=2)+'\n')
if '--no-render' not in sys.argv:
 for name,loc,target,scale in [('overview',(8,-11,8),(0,0,1.0),8.9),('table',(5,-6,4.8),(1.2,.55,1.24),4.9),('berths',(3,-8,4.8),(-1.8,.65,1.4),4.8)]:
  view(loc,target,scale);scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps(report))
