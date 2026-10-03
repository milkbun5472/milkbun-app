"""Build pet career scenes as reusable GLBs and editable Blender sources.

Blender -b --python art/pet-career/build.py -- --scene store --evidence /path
No gameplay, rigging or user data is authored here. Preview camera and cat placement
are read from layout.json; room geometry is authored in this build script.
"""
import bpy, math, json, argparse, sys, hashlib, random
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--scene', choices=['outside']+[scene['id'] for scene in json.loads((HERE/'scenes.json').read_text())], required=True)
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
if opt.scene!='outside':zone('shell',shell)
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
elif opt.scene=='alley':
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

elif opt.scene=='store':
    def groceries():
        for z in [.45,1.2,1.95]:
            box('货架板',(.4,2.26,z),(4.8,.74,.1),wood)
            for i in range(9):
                x=-1.6+i*.5
                if z<1:
                    box('食品纸盒',(x,2.21,z+.25),(.3,.31,.4),[peach,sage,book][i%3])
                    box('纸盒标签',(x,2.044,z+.27),(.17,.012,.15),paper)
                else:
                    cyl('饮品瓶',(x,2.2,z+.24),.105,.4,[peach,sage,ivory][i%3],16)
                    cyl('瓶盖',(x,2.2,z+.47),.067,.06,gold,16)
                    box('瓶身纸签',(x,2.095,z+.24),(.13,.02,.12),paper)
        for x in [-2.02,2.82]:box('货架支撑',(x,2.54,1.23),(.1,.12,2.46),sage)
    zone('groceries',groceries)
    def checkout():
        box('矮收银柜',(1.68,.1,.56),(2.12,1,.98),sage,.09)
        box('柜台面',(1.68,.1,1.12),(2.26,1.13,.12),wood)
        box('收银底座',(2.2,.35,1.26),(.42,.34,.16),trim)
        box('收银屏',(2.2,.48,1.48),(.38,.09,.3),dark)
        cyl('小票卷',(1.73,.32,1.32),.105,.25,paper,20).rotation_euler.y=math.pi/2
        box('垂下的小票',(1.7,-.475,1.03),(.16,.02,.3),paper)
        for i in range(4):box('小票灰线',(1.7,-.49,1.1-i*.045),(.11,.008,.009),wood,.002)
        box('贴纸小盘',(1.15,.04,1.21),(.45,.4,.045),peach)
        for i in range(4):ball('圆贴纸',(1.03+(i%2)*.19,-.06+(i//2)*.19,1.245),(.055,.055,.006),[sage,ivory][i%2])
        box('柜台边猫踏台',(.25,.02,.3),(.65,.7,.6),wood)
    zone('checkout',checkout)
    def fridge():
        box('奶油冷柜',(-2.32,1.63,1.15),(1.3,1.03,2.3),trim,.09)
        box('冷柜蓝玻璃',(-2.32,1.085,1.2),(1.09,.07,1.83),sky)
        for z in [.5,1.05,1.6]:
            box('冷柜层板',(-2.32,1.015,z),(.95,.13,.04),ivory)
            for x in [-2.64,-2.31,-1.99]:box('冷藏小盒',(x,1.00,z+.17),(.21,.1,.28),[peach,sage,book][round((x+3)*10)%3])
        box('冰柜把手',(-1.83,.96,1.19),(.06,.06,.55),gold)
    zone('fridge',fridge)
    def delivery():
        for x,y,z in [(-2.41,-.15,.27),(-1.62,.1,.24),(-2.34,-.11,.75)]:
            box('收货纸箱',(x,y,z),(.65,.62,.48),book)
            box('纸箱封带',(x,y-.32,z),(.12,.016,.46),paper)
        box('打开的纸箱',(-1.7,-.85,.16),(.72,.65,.1),wood)
        for x in [-2.04,-1.36]:box('空箱侧边',(x,-.85,.31),(.05,.65,.34),book)
        for y in [-1.15,-.55]:box('空箱前后边',(-1.7,y,.31),(.72,.05,.34),book)
        box('抬起的箱盖',(-1.7,-.47,.59),(.72,.36,.025),book).rotation_euler.x=.65
    zone('delivery',delivery)
    def entrance():
        box('店门玻璃',(-3.1,-1.83,1.39),(.055,1.22,2.32),sky)
        for y in [-2.45,-1.21]:box('店门框',(-3.025,y,1.4),(.13,.07,2.48),trim)
        box('门口地垫',(-2.4,-1.81,.09),(.96,1.04,.055),sage)
        box('狗狗等候垫',(1.88,-1.58,.11),(1.14,.75,.09),peach,.08)
        cyl('门边水碗',(2.77,-1.51,.14),.19,.15,ivory)
        cyl('碗里水',(2.77,-1.51,.224),.16,.014,water)
        box('小篮子',(.85,-1.67,.25),(.53,.37,.39),sage)
        path('篮提手',[(.62,-1.67,.41),(.62,-1.67,.72),(1.08,-1.67,.72),(1.08,-1.67,.41)],.025,wood)
    zone('entrance',entrance)
elif opt.scene=='park':
    # Replace the interior shell with grass and a curving stone path.
    for o in list(bpy.data.objects):
        if o.type=='MESH' and o.parent and o.parent.name=='shell' and not o.name.startswith('圆角地台'):bpy.data.objects.remove(o,do_unlink=True)
    grass=material('柔绿草地','#b7c49a');stone=material('奶油石径','#e3d7be')
    def meadow():
        box('草坪',(0,0,.035),(6.4,5.5,.09),grass,.09)
        for i in range(13):
            y=-2.35+i*.39;x=.25+math.sin(i*.4)*.42
            ball('圆石小路',(x,y,.105),(.66,.28,.06),stone)
        for x,y in [(-2.8,-2.1),(-2.4,.1),(2.7,-1.9),(2.4,1.6)]:
            for j in range(3):flower(x+.15*j,y,.31+(j%2)*.06,peach if j%2 else ivory)
    zone('meadow',meadow)
    def trees():
        for x,y,r in [(-2.25,1.72,.8),(2.31,1.98,.74)]:
            cyl('圆树干',(x,y,.92),.13,1.8,wood,16)
            for dx,dy,z,k in [(0,0,2.1,1),(-.32,.04,2.28,.8),(.3,.1,2.39,.8),(0,.05,2.73,.75)]:ball('软树冠',(x+dx,y+dy,z),(r*k,r*k*.82,r*k*.8),leaf_light if k<1 else leaf)
        for x,y in [(-2.85,1.1),(-1.49,2.34),(2.74,1.02)]:ball('圆灌木',(x,y,.37),(.45,.36,.38),leaf_light)
    zone('trees',trees)
    def bench():
        for z,y in [(.53,.91),(1.02,1.19)]:box('公园长凳',(-1.59,y,z),(1.74,.54 if z<1 else .13,.13 if z<1 else .55),wood)
        for x in [-2.22,-.96]:box('长凳脚',(x,.91,.27),(.12,.44,.54),sage_dark)
        box('同行坐垫',(-1.11,.87,.635),(.56,.43,.065),peach)
    zone('bench',bench)
    def play():
        for x in [1.15,2.1]:box('小跳栏柱',(x,-.28,.41),(.11,.15,.74),wood)
        box('低跳栏',(1.63,-.28,.39),(1.04,.095,.1),sage)
        ball('草地小球',(1.89,-1.12,.23),(.17,.17,.17),peach)
        path('玩具绳',[(1.08,-1.43,.16),(1.23,-1.38,.17),(1.35,-1.49,.17),(1.5,-1.45,.16)],.035,ivory)
        box('宠物饮水台',(2.62,.25,.18),(.58,.64,.2),stone)
        cyl('公共水碗',(2.62,.25,.33),.21,.12,ivory)
        cyl('公共碗水',(2.62,.25,.399),.18,.012,water)
    zone('play',play)
    def picnic():
        box('野餐布',(-1.64,-1.43,.115),(1.66,1.15,.045),peach,.025)
        for i in range(8):box('野餐布细条',(-2.33+i*.2,-1.43,.143),(.035,1.13,.008),ivory,.002)
        box('野餐篮',(-2.04,-1.48,.34),(.48,.4,.4),wood,.08)
        path('篮子弯提手',[(-2.27,-1.48,.47),(-2.22,-1.48,.73),(-1.86,-1.48,.73),(-1.81,-1.48,.47)],.022,book)
        cyl('野餐盘',(-1.26,-1.44,.16),.18,.025,ivory)
        ball('盘里的面包',(-1.26,-1.44,.24),(.12,.09,.08),book)
    zone('picnic',picnic)
elif opt.scene=='cafe':
    def bar():
        box('咖啡吧台',(1.03,1.24,.57),(3.45,1.1,1.14),sage,.08)
        box('吧台木面',(1.03,1.24,1.2),(3.61,1.2,.12),wood)
        box('咖啡机',(.19,1.42,1.56),(.82,.47,.63),trim,.055)
        box('咖啡机面板',(.19,1.16,1.65),(.64,.035,.26),dark)
        for x in [-.01,.37]:
            cyl('咖啡旋钮',(x,1.12,1.72),.038,.06,gold,16).rotation_euler.x=math.pi/2
            path('咖啡嘴',[(x,1.10,1.48),(x,1.02,1.42)],.018,gold)
            cyl('咖啡杯',(x,1.02,1.33),.068,.12,peach,16)
        cyl('咖啡豆罐',(.85,1.47,1.46),.13,.34,dark,20)
        cyl('豆罐盖',(.85,1.47,1.65),.145,.035,gold,20)
        box('收银机',(2.32,1.49,1.37),(.41,.36,.22),trim)
        box('收银屏',(2.32,1.56,1.6),(.34,.065,.23),dark)
        box('猫店长专座',(1.54,1.23,1.3),(.65,.54,.07),peach)
    zone('bar',bar)
    def window():
        box('窗外浅蓝',(-3.12,-.61,2.15),(.04,2.13,1.64),sky)
        for y in [-1.71,.49]:box('窗侧框',(-3.015,y,2.15),(.16,.09,1.78),trim)
        for z in [1.31,2.99]:box('窗横框',(-3.015,-.61,z),(.16,2.24,.09),trim)
        box('窗中框',(-3.0,-.61,2.15),(.16,.05,1.66),trim)
        box('宽窗台',(-2.86,-.61,1.28),(.54,2.35,.11),wood)
        box('窗边长座',(-2.62,-.48,.54),(.82,2.08,.2),wood)
        box('窗边软垫',(-2.62,-.48,.69),(.72,1.95,.13),sofa_mat)
        for y in [-1.13,.2]:box('窗边靠枕',(-2.88,y,.96),(.17,.52,.48),peach,.07)
    zone('window',window)
    def tables():
        for x,y in [(-.73,-1.29),(1.67,-1.35)]:
            cyl('咖啡桌',(x,y,.71),.47,.1,wood)
            cyl('桌脚',(x,y,.34),.07,.68,gold,16)
            cyl('桌脚底座',(x,y,.06),.25,.07,sage,20)
            for dx in [-.62,.62]:
                cyl('圆座',(x+dx,y,.4),.22,.1,peach,20)
                for yy in [-.12,.12]:box('椅腿',(x+dx,y+yy,.19),(.06,.06,.38),wood)
            cyl('桌上杯',(x-.12,y,.845),.067,.15,ivory,16)
            ring('杯柄',(x-.02,y,.85),.06,.06,.013,ivory,n=24)
            box('菜单',(x+.12,y+.05,.78),(.22,.28,.025),paper)
    zone('tables',tables)
    def welcome():
        box('狗狗迎宾软垫',(2.51,-.2,.12),(.78,.95,.12),peach,.09)
        cyl('饮水碗',(2.88,-.92,.13),.18,.13,ivory,24)
        cyl('饮水',(2.88,-.92,.201),.155,.012,water,24)
        box('牵引绳小架',(2.78,2.52,.64),(.25,.13,.7),wood)
        path('挂着的小绳',[(2.77,2.42,.9),(2.65,2.42,.72),(2.78,2.42,.35),(2.9,2.42,.72),(2.77,2.42,.9)],.018,peach)
    zone('welcome',welcome)
    def shelves():
        for z in [1.98,2.61]:
            box('杯子木架',(.59,2.38,z),(3.6,.43,.08),wood)
            for i in range(7):cyl('架上杯',(-.87+i*.46,2.29,z+.12),.09,.17,peach if i%2 else ivory,16)
        pot(-2.4,1.98,0,.22)
        box('店里小黑板',(-1.68,2.57,2.35),(.76,.08,.95),wood)
        box('小黑板面',(-1.68,2.515,2.35),(.64,.03,.82),sage_dark)
        for i in range(3):box('粉笔小横线',(-1.68,2.492,2.59-i*.18),(.37,.012,.024),ivory,.003)
    zone('shelves',shelves)


elif opt.scene=='outside':
    grass=material('街区柔绿','#b9c7a5');street=material('奶油石路','#e3d5bc')
    def at(x,z,h):return (x,-z,h)
    def grounds():
        cyl('圆形街区地台',at(0,0,-.12),32,.30,edge,96)
        cyl('圆形草地',at(0,0,.01),31.85,.10,grass,96)
        box('北边林地地台',at(0,-38,-.12),(30,32,.3),edge,.12)
        box('北边林间草地',at(0,-38,.017),(29.8,31.8,.1),grass,.08)
        box('南北街道',at(0,0,.077),(5,58,.046),street,.025)
        box('林间石路',at(0,-40,.079),(3,26,.046),street,.025)
        for b in layout['buildings']:
            x=b['x'];z=b['approach']['z'];box('通向店门的小路',at(x*.5,z,.078 if x<0 else .080),(abs(x)+2,2.4,.046),street,.025)
        # Low stepping stones at the town's edge are detail, not raised collision surfaces.
        for i in range(15):ball('公园弯石径',at(-6+math.sin(i*.4)*3,11+i*.9,.086),(.65,.48,.014),street)
    zone('ground',grounds)
    for b in layout['buildings']:
        def house(b=b):
            x,z=b['x'],b['z'];wall=material(b['title']+'外墙',b['color']);roofmat=material(b['title']+'屋顶',b['roof'])
            box(b['title']+'房子',at(x,z,2.07),(b['w'],b['d'],4),wall,.14)
            # Two sloped roof planes meet at a ridge running along X.
            for side in [-1,1]:
                roof=box('斜屋顶',at(x,z+side*1.56,4.69),(8.7,3.7,.18),roofmat,.05);roof.rotation_euler.x=side*.4
            box('屋脊',at(x,z,5.4),(8.8,.18,.16),roofmat,.05)
            for dx in [-2.55,2.55]:
                box('外窗',at(x+dx,z+3.035,2.6),(1.4,.06,1.47),sky)
                for xx in [-.75,.75]:box('窗框',at(x+dx+xx,z+3.09,2.6),(.08,.12,1.59),trim)
                for zz in [1.83,3.37]:box('窗横框',at(x+dx,z+3.09,zz),(1.58,.12,.08),trim)
                box('窗台',at(x+dx,z+3.2,1.79),(1.75,.42,.08),wood)
                box('窗中竖框',at(x+dx,z+3.12,2.6),(.055,.12,1.47),trim)
            box('店门',at(x,z+3.05,1.34),(1.34,.09,2.54),dark,.04)
            box('门上玻璃',at(x,z+3.11,1.64),(1.05,.035,1.55),sky)
            ball('门把手',at(x+.43,z+3.18,1.06),(.055,.045,.055),gold)
            # Flat threshold stays on the same walking surface as the shared layout.
            box('门口地垫',at(x,z+3.68,.081),(1.9,1.25,.046),ivory,.025)
            box('门楣招牌',at(x,z+3.16,3.16),(1.86,.12,.59),trim)
            for i in range(9):
                awning=box('条纹门雨棚',at(x+(i-4)*.24,z+3.61,2.73),(.235,1.14,.1),ivory if i%2 else wall);awning.rotation_euler.x=.13
            if b['id']=='bakery':
                for i in range(3):ball('门楣面包',at(x+(i-1)*.42,z+3.25,3.15),(.2,.04,.13),book)
            elif b['id']=='florist':
                for i in range(5):
                    a=i*math.tau/5;ball('门楣小花',at(x+.17*math.cos(a),z+3.25,3.16+.17*math.sin(a)),(.1,.04,.1),peach)
            elif b['id']=='cafe':
                cyl('门楣咖啡杯',at(x,z+3.26,3.16),.18,.28,rose,16)
            elif b['id']=='store':
                for i in range(3):box('门楣小盒',at(x+(i-1)*.38,z+3.25,3.16),(.22,.065,.28),[sage,peach,book][i])
            elif b['id']=='home':
                ball('门楣猫脸',at(x,z+3.26,3.15),(.21,.04,.18),peach)
                for dx in [-.14,.14]:ball('门楣猫耳',at(x+dx,z+3.26,3.34),(.07,.035,.09),peach)
            else:
                ring('门楣放大镜',at(x-.05,z+3.25,3.24),.14,.055,.024,gold,n=24)
                box('放大镜手柄',at(x+.16,z+3.25,3.03),(.07,.07,.28),gold).rotation_euler.y=-.5
            for dx in [-3.36,3.36]:
                cyl('门边盆',at(x+dx,z+3.54,.35),.28,.58,rose,16)
                for j in range(3):ball('门边小叶',at(x+dx+(j-1)*.14,z+3.54,.8+j*.04),(.2,.18,.19),leaf)
        zone('building_'+b['id'],house)
    def woods():
        for i,t in enumerate(layout['trees']):
            x,z,h=t['x'],t['z'],t['height'];cyl('街区树干',at(x,z,h*.35),t['r'],h*.7,wood,12)
            for dx,dz,hh,k in [(0,0,.64,1),(-.52,.12,.77,.8),(.48,-.16,.81,.8),(0,0,.95,.7)]:ball('街区软树冠',at(x+dx,z+dz,h*hh),(1.25*k,1.10*k,h*.24*k),leaf if i%3 else leaf_light)
    zone('woods',woods)
    def park():
        for p in layout['props']:
            x,z=p['x'],p['z']
            if p['id'] in ['bench','forestbench']:
                box('公园长凳座',at(x,z,.59),(3,1,.16),wood)
                box('公园长凳靠背',at(x,z-.4,1.08),(3,.13,.82),wood)
                for dx in [-1.2,1.2]:box('长凳脚',at(x+dx,z,.32),(.14,.7,.64),sage_dark)
            elif p['id']=='picnic':
                box('大野餐布',at(x,z,.08),(3,2,.04),peach)
                for i in range(10):box('野餐布细条',at(x-1.35+i*.3,z,.11),(.06,1.96,.014),ivory,.003)
                box('野餐篮',at(x-.7,z,.38),(.65,.55,.54),wood,.07)
                path('野餐篮把',[(x-1,-z,.6),(x-1,-z,.95),(x-.4,-z,.95),(x-.4,-z,.6)],.03,book)
            elif p['id']=='play':
                for dx in [-1,1]:box('低跳栏柱',at(x+dx,z,.56),(.15,.2,1),wood)
                box('低跳栏横杆',at(x,z,.45),(2.1,.13,.12),sage)
                ball('草地球',at(x,z+1.5,.27),(.21,.21,.21),peach)
            else:
                box('饮水台',at(x,z,.2),(.8,.8,.28),ivory)
                cyl('公园水碗',at(x,z,.43),.27,.16,rose,20);cyl('水',at(x,z,.518),.24,.012,water,20)
    zone('park',park)
    def plaza():
        cyl('街心花台',at(0,0,.4),1.7,.68,wood,48)
        cyl('花台泥土',at(0,0,.75),1.5,.03,soil,48)
        for i in range(12):
            a=i*math.tau/12;flower(math.cos(a)*1.2,-math.sin(a)*1.2,1.2,peach if i%2 else ivory)
    zone('plaza',plaza)

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
# Freeze the imported rest pose for Blender's static art preview. Keeping a
# nested armature and its editor-only bone shapes must not affect cat bounds.
depsgraph=bpy.context.evaluated_depsgraph_get();static=[]
helpers={bone.custom_shape for rig in cat_objs if rig.type=='ARMATURE' for bone in rig.pose.bones if bone.custom_shape}
for original in cat_objs:
    if original.type!='MESH' or original in helpers:continue
    evaluated=original.evaluated_get(depsgraph);mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=depsgraph)
    mesh.transform(evaluated.matrix_world)
    o=bpy.data.objects.new('猫猫静态造型',mesh);bpy.context.collection.objects.link(o);static.append(o)
for original in cat_objs:bpy.data.objects.remove(original,do_unlink=True)
cat_objs=static
cat_root=bpy.data.objects.new('猫猫比例示意',None);bpy.context.collection.objects.link(cat_root)
for o in cat_objs:o.parent=cat_root
bpy.context.view_layer.update()
pts=[o.matrix_world@v.co for o in cat_objs for v in o.data.vertices]
low=Vector([min(p[i] for p in pts) for i in range(3)]);high=Vector([max(p[i] for p in pts) for i in range(3)])
s=layout['cat']['height']/(high.z-low.z);cat_root.scale=(s,)*3
cat_root.location=Vector(layout['cat']['position'])-Vector(((low.x+high.x)*.5*s,(low.y+high.y)*.5*s,low.z*s));cat_root.rotation_euler.z=layout['cat']['yaw']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.42,.42,.42);scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.33));bpy.context.object.data.materials.append(material('背景','#eee8dc'))
lighting=[((-25,-20,55),45000),((30,-40,45),35000),((0,40,45),35000)] if opt.scene=='outside' else [((-3,-2,7),850),((4,-5,6),650),((0,5,6),500)]
for loc,power in lighting:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=40 if opt.scene=='outside' else 5;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=layout['camera']['position']);cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=layout['camera']['scale'];cam.rotation_euler=(Vector(layout['camera']['target'])-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(EVIDENCE/(opt.scene+'.blend')))
if not opt.skip_render:
    scene.render.filepath=str(EVIDENCE/(opt.scene+'.png'));bpy.ops.render.render(write_still=True)
print('SCENE_READY',opt.scene,(HERE/(opt.scene+'.glb')).stat().st_size)
