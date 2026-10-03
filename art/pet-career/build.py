"""Build the pet room as a reusable GLB and editable Blender scene.

Blender -b --python art/pet-house/build.py -- --cat /path/to/source.glb --evidence /path
No gameplay, rigging or user data is authored here. Preview camera and cat placement
are read from layout.json; room geometry is authored in this build script.
"""
import bpy, math, json, argparse, sys, hashlib, random
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--scene', choices=['bakery','florist','alley'], required=True)
parser.add_argument('--evidence', required=True)
parser.add_argument('--skip-render', action='store_true')
opt = parser.parse_args(args)
EVIDENCE = Path(opt.evidence); EVIDENCE.mkdir(parents=True, exist_ok=True)
layout = json.loads((HERE/(opt.scene+'.json')).read_text())
random.seed(41)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def linear(v):
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4

def rgb(s):
    return tuple(linear(int(s[i:i+2],16)/255) for i in (1,3,5))

def material(name, color, rough=.7):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb(color),1)
    p.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*rgb(color),1);return m

cream=material('奶油墙面','#eee3cc');trim=material('米白木框','#fff0d7')
wood=material('浅橡木','#cdaa79');edge=material('地台侧面','#7c9381')
sage=material('沙发鼠尾草绿','#a8b89b');sage_dark=material('沙发滚边','#879b7d')
peach=material('蜜桃织物','#d6a08d');ivory=material('奶油织物','#ede0c8')
rose=material('陶土粉','#c98070');leaf=material('叶片','#78936c');leaf_light=material('嫩叶','#a4b584')
dark=material('胡桃木细节','#806448');water=material('水面','#9ebbc0',.16)
gold=material('灯与五金','#c7a06d',.28);sky=material('窗外蓝','#cadde0')
food=material('粮食','#9c6b42');soil=material('盆土','#705642')
paper=material('书页','#f7ebd2');book=material('书皮','#cfb888')

def texture_material(name, color, mode):
    m=material(name,color);n=256;im=bpy.data.images.new(name+'纹理',width=n,height=n,alpha=False)
    base=tuple(int(color[i:i+2],16)/255 for i in (1,3,5));pix=[]
    for y in range(n):
        for x in range(n):
            if mode=='wood':
                phase=x*.23+math.sin(y*.018)*2+math.sin(y*.053)*.5
                v=.95+.035*math.sin(phase)+.018*math.sin(phase*3)+random.uniform(-.012,.012)
            else:
                v=.95+.04*math.cos(x*math.pi)+.04*math.cos(y*math.pi)+random.uniform(-.02,.02)
            pix.extend([min(1,c*v) for c in base]+[1])
    im.pixels.foreach_set(pix);im.file_format='PNG';im.pack()
    t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im
    m.node_tree.links.new(t.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    return m

floor_mats=[texture_material('木地板'+str(i),c,'wood') for i,c in enumerate(['#d9ba8d','#d5b489','#dec197','#d1af83'])]
rug_mat=texture_material('地毯织纹','#e7d6b4','weave')
sofa_mat=texture_material('沙发织纹','#a8b89b','weave')

def finish(o,name,mat,bevel=0):
    o.name=name;o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('柔圆边','BEVEL');mod.width=bevel;mod.segments=3
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
        mod=o.modifiers.new('平面法线','WEIGHTED_NORMAL');mod.keep_sharp=True
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name,loc,size,mat,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object
    o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,min(bevel,min(size)*.44))

def ball(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat)

def cyl(name,loc,radius,depth,mat,vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    return finish(bpy.context.object,name,mat,.02)

def path(name,pts,r,mat):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=2
    spline=data.splines.new('POLY');spline.points.add(len(pts)-1)
    for p,co in zip(spline.points,pts):p.co=(*co,1)
    data.bevel_depth=r;data.bevel_resolution=1
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
    return o

def ring(name,loc,rx,ry,r,mat,n=72):
    x,y,z=loc;return path(name,[(x+rx*math.cos(i*math.tau/n),y+ry*math.sin(i*math.tau/n),z) for i in range(n+1)],r,mat)

def tag_group(key,before):
    parts=list(set(bpy.data.objects)-before);root=bpy.data.objects.new(key,None);bpy.context.collection.objects.link(root)
    root['zone']=key
    for o in parts:
        if o.parent not in parts:o.parent=root
    return root

def start():return set(bpy.data.objects)


def zone(key,fn):
    before=start();fn();tag_group(key,before)
def flower(x,y,z,color=peach):
    path('细花茎',[(x,y,z-.48),(x,y,z)],.012,leaf)
    for j in range(6):
        a=j*math.tau/6;ball('圆花瓣',(x+.105*math.cos(a),y+.105*math.sin(a),z),(.095,.075,.05),color)
    ball('花心',(x,y,z+.025),(.047,.047,.035),gold)
    ball('小叶',(x+.08,y,z-.25),(.13,.04,.025),leaf)
def pot(x,y,z,r=.24):
    cyl('陶花盆',(x,y,z+r*.55),r,r*1.1,rose);cyl('盆土',(x,y,z+r*1.11),r*.9,.018,soil)
    for i in range(4):flower(x+(i%2-.5)*r,y+(i//2-.5)*r,z+r*1.1+.45,peach if i%2 else ivory)
def shell():
    box('圆角地台',(0,0,-.16),(6.7,5.8,.32),edge,.13)
    for i in range(18):box('地板',(0,-2.6+i*.30,.015),(6.4,.287,.06),floor_mats[i%4],.009)
    box('背墙',(0,2.72,1.65),(6.55,.16,3.3),cream)
    box('左墙',(-3.22,.1,1.65),(.16,5.35,3.3),cream)
    for z in [.15,3.3]:box('背墙木边',(0,2.59,z),(6.5,.1,.13),wood)
zone('shell',shell)
if opt.scene=='bakery':
    def counter():
        box('柜台',(1.25,.72,.6),(3.05,1.08,1.2),sage,.09)
        box('木台面',(1.25,.72,1.24),(3.2,1.2,.12),wood)
        for x in [.18,1.2,2.22]:
            box('面包托盘',(x,.48,1.33),(.86,.62,.055),ivory,.04)
            for j in range(3):
                b=ball('圆面包',(x+(j-1)*.22,.48,1.45),(.12,.19,.12),food)
                for k in range(2):path('面包切纹',[(x+(j-1)*.22-.07,.43+k*.08,1.54),(x+(j-1)*.22+.07,.43+k*.08,1.54)],.009,ivory)
        box('收银机',(2.46,1.03,1.46),(.4,.35,.28),trim)
        box('收银屏',(2.46,1.1,1.73),(.35,.06,.23),dark)
    zone('counter',counter)
    def oven():
        box('奶油烤炉',(-2.25,1.86,.9),(1.32,1.12,1.8),trim,.1)
        for z in [.53,1.15]:
            box('炉门',(-2.25,1.25,z),(1.05,.065,.43),dark)
            box('炉把手',(-2.25,1.16,z+.12),(.69,.08,.05),gold)
        for x in [-2.6,-2.25,-1.9]:cyl('烤炉旋钮',(x,1.25,1.56),.055,.06,gold).rotation_euler.x=math.pi/2
        box('面粉袋',(-2.15,.2,.37),(.58,.44,.74),ivory,.17)
        box('面粉工作台',(-1.38,2.07,1.05),(.6,.88,.1),wood)
    zone('oven',oven)
    def perch():
        box('看板猫小台',(-.85,.45,.38),(.72,.7,.76),wood)
        ball('蹲台软垫',(-.85,.45,.82),(.39,.34,.055),peach)
        cyl('零钱罐',(.15,1.07,1.39),.13,.28,rose)
        box('纸袋',(.64,1.02,1.53),(.3,.2,.48),paper)
    zone('perch',perch)
    def seating():
        for x in [-1.8,1.6]:
            cyl('小圆桌',(x,-1.48,.67),.53,.09,wood);cyl('桌脚',(x,-1.48,.33),.075,.66,wood)
            for dx in [-.7,.7]:
                cyl('圆凳',(x+dx,-1.48,.39),.23,.09,peach);cyl('凳脚',(x+dx,-1.48,.19),.045,.38,wood)
        pot(-2.92,-1.75,0,.2)
    zone('seating',seating)
    def shelves():
        for z in [1.8,2.48]:
            box('面包木架',(.65,2.42,z),(3.6,.52,.1),wood)
            for x in [-.55,.2,.95,1.7]:
                box('篮子',(x,2.33,z+.15),(.6,.36,.22),book)
                for j in range(3):ball('架上面包',(x+(j-1)*.15,2.3,z+.3),(.095,.15,.11),book)
    zone('shelves',shelves)
elif opt.scene=='florist':
    def bouquets():
        for x,y in [(-2.6,1.8),(-1.85,1.8),(-2.6,.9),(-1.85,.9),(-2.6,0)]:
            cyl('花桶',(x,y,.3),.28,.6,sage)
            for j in range(7):
                a=j*math.tau/7;flower(x+.19*math.cos(a),y+.19*math.sin(a),.95+(j%3)*.12,[peach,ivory,rose][j%3])
    zone('bouquets',bouquets)
    def worktable():
        box('包花桌',(1.15,1.22,.89),(2.5,1.03,.13),wood)
        for x in [.13,2.17]:
            for y in [.87,1.57]:box('桌脚',(x,y,.43),(.1,.1,.86),sage)
        box('包装纸',(1.2,1.14,.975),(.92,.62,.025),paper)
        for i in range(4):flower(.9+i*.17,1.1,1.03,peach)
        ring('丝带卷',(2.05,1.35,1.04),.13,.13,.04,rose)
        box('矮猫踏台',(.12,.65,.22),(.6,.6,.44),wood)
    zone('worktable',worktable)
    def plants():
        for z in [.4,1.4,2.4]:
            box('植物木架',(.7,2.35,z),(4.05,.58,.09),wood)
            for x in [-.8,.25,1.3,2.4]:pot(x,2.29,z+.05,.18)
    zone('plants',plants)
    def door():
        box('门口蓝玻璃',(-3.11,-1.5,1.86),(.055,1.27,2.53),sky)
        for y in [-2.15,-.85]:box('门框',(-3.03,y,1.83),(.13,.1,2.7),trim)
        box('门中横框',(-3.03,-1.5,1.9),(.13,1.3,.07),trim)
        ball('门把手',(-2.97,-1.04,1.38),(.07,.05,.05),gold)
        ball('猫猫门边垫',(-2.35,-1.43,.1),(.52,.6,.08),peach)
        for i in range(12):ball('落花瓣',(-1.45+i*.13,-1.2+math.sin(i)*.4,.075),(.045,.028,.015),peach)
    zone('door',door)
    def bench():
        box('邻居等候长凳',(1.75,-1.65,.47),(1.9,.64,.13),sage)
        for x in [.97,2.53]:box('凳脚',(x,-1.65,.23),(.13,.5,.46),wood)
        pot(2.72,-.5,0,.25)
    zone('bench',bench)
else:
    # A little street, rather than a third shop interior.
    for o in list(bpy.data.objects):
        if o.name.startswith(('背墙','左墙')):bpy.data.objects.remove(o,do_unlink=True)
    def facades():
        box('薄荷店屋',(-1.83,2.18,1.55),(2.75,.9,3.1),sage)
        box('蜜桃小屋',(1.43,2.18,1.73),(3.35,.9,3.46),peach)
        for x in [-2.45,-1.2,.6,2.18]:
            box('店窗',(x,1.70,2.16),(.84,.07,.88),sky)
            for dx in [-.45,.45]:box('窗边',(x+dx,1.63,2.16),(.07,.12,1),trim)
            box('窗台',(x,1.58,1.69),(1,.28,.08),wood)
        box('侦探门',(1.34,1.68,.77),(.77,.07,1.54),dark)
        ball('门把手',(1.58,1.59,.75),(.04,.04,.04),gold)
        for i in range(9):box('条纹小雨棚',(-1.8+(i-4)*.31,1.26,1.53),(.30,.88,.12),ivory if i%2 else sage).rotation_euler.x=-.16
    zone('facades',facades)
    def clues():
        box('公告板',(-2.62,.45,1.18),(.98,.13,1.05),wood)
        for i in range(4):box('空白线索纸',(-2.84+(i%2)*.4,.365,.96+(i//2)*.4),(.29,.02,.31),paper)
        box('信箱',(.45,1.52,.83),(.4,.28,.44),rose)
        box('信槽',(.45,1.37,.9),(.27,.015,.035),dark)
        box('掉落信封',(.4,.64,.075),(.27,.18,.015),paper)
        for i in range(5):ball('小脚印',(.6+i*.24,.45-i*.24,.06),(.05,.06,.012),dark)
    zone('clues',clues)
    def stall():
        box('旧物小摊',(1.8,-1.45,.64),(1.7,.8,.13),wood)
        for x in [1.1,2.5]:box('摊脚',(x,-1.45,.3),(.1,.65,.6),wood)
        for i in range(3):box('旧书',(1.25,-1.45,.76+i*.065),(.43,.32,.06),[sage,peach,book][i])
        ball('奇怪玩具',(2.1,-1.45,.86),(.19,.15,.19),sage)
        for dx in [-.12,.12]:ball('玩具眼',(2.1+dx,-1.6,.99),(.045,.035,.05),ivory)
        cyl('换物小碟',(2.45,-1.5,.74),.13,.035,ivory)
    zone('stall',stall)
    def rest():
        box('巷口长凳',(-1.56,-1.44,.44),(1.45,.62,.13),wood)
        for x in [-2.14,-.98]:box('凳脚',(x,-1.44,.21),(.12,.5,.42),dark)
        pot(-2.7,-2.05,0,.23)
        cyl('路灯杆',(-2.75,1.07,1.3),.045,2.6,gold)
        box('路灯灯笼',(-2.75,1.07,2.69),(.35,.35,.44),trim)
        box('灯帽',(-2.75,1.07,2.94),(.43,.43,.08),dark)
        ring('空篮子',(.05,-1.7,.23),.3,.25,.06,wood)
    zone('rest',rest)
# All authored room nodes can be selected independently and retain semantic zone IDs.
room_objects=list(bpy.context.scene.objects)
# Export-only batching: retain individual source objects in the .blend, but avoid
# hundreds of draw calls for planks, rope and wicker. Toys stay separate units.
export_objects=[]
for root in [o for o in room_objects if o.type=='EMPTY']:
    export_root=bpy.data.objects.new(root.name+'-web',None);bpy.context.collection.objects.link(export_root)
    export_root['zone']=root['zone'];export_objects.append(export_root)
    pools={}
    for o in root.children:
        if o.type!='MESH':continue
        unit=''
        if root.name=='toys':
            unit='frog' if o.name.startswith('青蛙') else 'yarn' if o.name.startswith(('篮内毛线','毛线圈')) else 'mouse' if o.name.startswith(('布老鼠','老鼠')) else 'basket'
        elif root.name=='feeding':
            unit='water' if o.name.startswith(('陶瓷水','碗中水')) else 'food' if o.name.startswith(('陶瓷粮','颗粒')) else 'mat'
        pools.setdefault((unit,o.data.materials[0].name),[]).append(o)
    units={}
    for (unit,matname),parts in pools.items():
        parent=export_root
        if unit:
            if unit not in units:
                u=bpy.data.objects.new(unit,None);bpy.context.collection.objects.link(u);u.parent=export_root;u['item']=unit;units[unit]=u;export_objects.append(u)
            parent=units[unit]
        copies=[];bpy.ops.object.select_all(action='DESELECT')
        for original in parts:
            c=original.copy();c.data=original.data.copy();bpy.context.collection.objects.link(c)
            c.parent=None;c.matrix_world=original.matrix_world.copy();c.select_set(True);copies.append(c)
        bpy.context.view_layer.objects.active=copies[0]
        if len(copies)>1:bpy.ops.object.join()
        joined=bpy.context.view_layer.objects.active;joined.name=root.name+'-'+unit+'-'+matname;joined.parent=parent;export_objects.append(joined)
bpy.ops.object.select_all(action='DESELECT')
for o in export_objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(HERE/(opt.scene+'.glb')),export_format='GLB',use_selection=True,
    export_extras=True,export_animations=False,export_image_format='WEBP',
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
for o in export_objects:bpy.data.objects.remove(o,do_unlink=True)


before=start();bpy.ops.import_scene.gltf(filepath=str(HERE.parent/'pet-house'/'cat.glb'));cat_objs=list(set(bpy.data.objects)-before)
cat_root=bpy.data.objects.new('猫猫比例示意',None);bpy.context.collection.objects.link(cat_root)
for o in cat_objs:
    if o.parent not in cat_objs:o.parent=cat_root
bpy.context.view_layer.update()
pts=[o.matrix_world@v.co for o in cat_objs if o.type=='MESH' for v in o.data.vertices]
low=Vector([min(p[i] for p in pts) for i in range(3)]);high=Vector([max(p[i] for p in pts) for i in range(3)])
s=layout['cat']['height']/(high.z-low.z);cat_root.scale=(s,)*3
cat_root.location=Vector(layout['cat']['position'])-Vector(((low.x+high.x)*.5*s,(low.y+high.y)*.5*s,low.z*s));cat_root.rotation_euler.z=layout['cat']['yaw']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.42,.42,.42);scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.33));bpy.context.object.data.materials.append(material('背景','#eee8dc'))
for loc,power in [((-3,-2,7),850),((4,-5,6),650),((0,5,6),500)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=5;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=layout['camera']['position']);cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=layout['camera']['scale'];cam.rotation_euler=(Vector(layout['camera']['target'])-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(EVIDENCE/(opt.scene+'.blend')))
if not opt.skip_render:
    scene.render.filepath=str(EVIDENCE/(opt.scene+'.png'));bpy.ops.render.render(write_still=True)
print('SCENE_READY',opt.scene,(HERE/(opt.scene+'.glb')).stat().st_size)
