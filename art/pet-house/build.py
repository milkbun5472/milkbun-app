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
parser.add_argument('--cat', required=True)
parser.add_argument('--evidence', required=True)
parser.add_argument('--skip-render', action='store_true')
opt = parser.parse_args(args)
EVIDENCE = Path(opt.evidence); EVIDENCE.mkdir(parents=True, exist_ok=True)
layout = json.loads((HERE/'layout.json').read_text())
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
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat)

def cyl(name,loc,radius,depth,mat,vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    return finish(bpy.context.object,name,mat,.02)

def path(name,pts,r,mat):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=2
    spline=data.splines.new('POLY');spline.points.add(len(pts)-1)
    for p,co in zip(spline.points,pts):p.co=(*co,1)
    data.bevel_depth=r;data.bevel_resolution=2
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

# Room shell is cut away at the front and right; the window is a real opening.
before=start();box('圆角地台',(0,0,-.18),(6.7,5.8,.36),edge,.13)
for row in range(19):
    y=-2.67+row*.287
    cuts=[-3.22,-1.10,1.02,3.22] if row%2==0 else [-3.22,-2.1,.02,2.14,3.22]
    for i in range(len(cuts)-1):
        box('木地板',( (cuts[i]+cuts[i+1])/2,y,.015),(cuts[i+1]-cuts[i]-.012,.276,.05),floor_mats[(row+i)%4],.009)
box('左墙',(-3.22,.02,1.99),(.16,5.55,3.97),cream,.045)
box('窗下墙',(0,2.72,.87),(6.55,.16,1.74),cream,.04)
box('窗上墙',(0,2.72,3.79),(6.55,.16,.42),cream,.04)
box('后墙右侧',(1.39,2.72,2.65),(3.77,.16,1.87),cream,.04)
box('后墙左侧',(-2.995,2.72,2.65),(.57,.16,1.87),cream,.025)
box('左踢脚线',(-3.1,.02,.13),(.09,5.5,.21),trim,.025)
box('后踢脚线',(0,2.6,.13),(6.32,.09,.21),trim,.025)
box('左墙顶木边',(-3.22,.02,3.97),(.23,5.62,.10),trim,.035)
box('后墙顶木边',(0,2.72,3.97),(6.65,.23,.10),trim,.035)
box('墙角封头',(-3.22,2.72,4.005),(.25,.25,.11),trim,.03)
tag_group('shell',before)

before=start();wx=-1.60
box('窗外天空',(wx,2.83,2.62),(2.15,.025,1.82),sky,.02)
for x,z,s in [(-2.2,1.96,.48),(-1.35,2.06,.57),(-.82,1.91,.4)]:
    ball('窗外树冠',(x,2.8,z),(s,.055,s*.85),leaf_light)
for x in [-2.7,-.5]:box('窗立框',(x,2.62,2.63),(.11,.22,1.96),trim,.04)
for z in [1.69,3.57]:box('窗横框',(wx,2.62,z),(2.3,.22,.12),trim,.035)
box('窗中竖框',(wx,2.59,2.62),(.055,.15,1.84),trim,.02)
box('窗中横框',(wx,2.59,2.66),(2.15,.15,.055),trim,.02)
box('加宽窗台',(wx,2.46,1.67),(2.53,.63,.12),wood,.04)
# Pleated curtains are geometry, with simple tiebacks rather than a flat painted strip.
for cx in [-2.61,-.59]:
    for j in range(6):
        x=cx+(j-2.5)*.064
        path('窗帘褶',[(x,2.40,3.5),(cx+(x-cx)*.52,2.38,2.57),(x,2.40,1.88)],.053,ivory)
    ring('窗帘束带',(cx,2.38,2.56),.13,.07,.012,peach)
rod=cyl('窗帘杆',(wx,2.42,3.67),.035,2.70,gold);rod.rotation_euler.y=math.pi/2
for x in [-2.99,-.21]:ball('杆端圆头',(x,2.42,3.67),(.06,.06,.06),gold)
tag_group('window',before)

# Sofa: upholstered separate cushions, wood legs, two pillows and a folded throw.
before=start();sx=1.52;sy=1.76
for x in [sx-.94,sx+.94]:
    for y in [sy-.39,sy+.39]:cyl('沙发木脚',(x,y,.20),.085,.34,wood)
box('沙发底座',(sx,sy,.43),(2.56,1.27,.36),sage,.16)
box('沙发靠背',(sx,sy+.43,.91),(2.49,.29,1.00),sofa_mat,.13)
for x in [sx-.63,sx+.63]:
    box('座垫',(x,sy-.055,.67),(1.13,.92,.24),sofa_mat,.105)
    path('座垫滚边',[(x-.50,sy-.44,.67),(x+.50,sy-.44,.67)],.011,sage_dark)
for x in [sx-1.18,sx+1.18]:box('圆扶手',(x,sy,.77),(.30,1.24,.60),sofa_mat,.14)
for name,x,mat,ang in [('桃粉抱枕',sx-.74,peach,-.14),('奶油抱枕',sx+.65,ivory,.13)]:
    p=box(name,(x,sy+.21,1.0),(.59,.24,.58),mat,.105);p.rotation_euler.y=ang;p.rotation_euler.x=-.16
box('搭在扶手的毯子',(sx+1.08,sy-.09,1.02),(.37,.67,.08),peach,.025)
box('垂下来的毯子',(sx+1.27,sy-.09,.73),(.07,.67,.57),peach,.025)
for i in range(12):path('毯子短流苏',[(sx+1.28,sy-.39+i*.05,.45),(sx+1.28,sy-.39+i*.05,.37)],.008,ivory)
tag_group('sofa',before)

# Raised botanical wall art, not an invented photo or user record.
before=start();box('画框',(1.45,2.595,2.79),(1.27,.09,.96),wood,.04)
box('画纸',(1.45,2.53,2.79),(1.10,.04,.79),ivory,.025)
for i,(x,z) in enumerate([(1.23,2.76),(1.64,2.83)]):
    path('画中枝',[(x,2.49,2.46),(x-.04,2.49,z+.12)],.018,leaf)
    for j in range(5):
        a=j*math.tau/5;ball('画中花瓣',(x+.105*math.cos(a),2.47,z+.105*math.sin(a)),(.076,.022,.076),peach if i else rose)
    ball('画中花心',(x,2.44,z),(.055,.027,.055),gold)
    leaf_o=ball('画中叶',(x-.07,2.48,z-.17),(.09,.02,.04),leaf);leaf_o.rotation_euler.y=-.45
tag_group('picture',before)

# Reading side table / lamp / actual empty frames for later shared photographs.
before=start();tx=.10;ty=1.94
cyl('边桌脚',(tx,ty,.38),.055,.66,wood);cyl('边桌底',(tx,ty,.08),.27,.08,wood)
cyl('边桌台面',(tx,ty,.75),.40,.11,wood)
cyl('灯脚',(tx,ty,.84),.12,.08,gold);cyl('灯杆',(tx,ty,1.08),.025,.47,gold)
bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.26,radius2=.15,depth=.29,location=(tx,ty,1.38))
finish(bpy.context.object,'布灯罩',ivory,.012)
ball('灯泡',(tx,ty,1.30),(.07,.07,.08),trim)
box('边桌书',(tx+.16,ty-.07,.84),(.28,.34,.055),book,.012)
tag_group('lamp',before)

# Pet's sunny nook, reusable freestanding basket and cushioned resting surface.
before=start();bx=-1.89;by=1.64
bed=ball('椭圆窝底',(bx,by,.19),(.66,.49,.14),wood)
for i in range(6):ring('窝的编织圈',(bx,by,.16+i*.031),.62,.46,.018,wood)
for i in range(48):
    a=i*math.tau/48;path('窝竖编',[(bx+.62*math.cos(a),by+.46*math.sin(a),.12),(bx+.63*math.cos(a),by+.47*math.sin(a),.32)],.009,ivory)
ball('窝垫',(bx,by,.28),(.56,.39,.075),ivory)
ball('窝内小枕',(bx-.22,by+.13,.36),(.21,.14,.10),peach)
tag_group('bed',before)

# Scratching tree with a rope-wrapped post, a step and a perch.
before=start();cx=-2.51;cy=.25
box('猫架底座',(cx,cy,.11),(.88,.82,.16),wood,.07)
cyl('抓柱',(cx,cy,.72),.12,1.12,ivory)
for i in range(39):ring('麻绳抓纹',(cx,cy,.21+i*.026),.122,.122,.012,wood,n=24)
box('猫架中踏板',(cx+.20,cy-.10,.78),(.65,.62,.11),wood,.055)
box('猫架顶台',(cx-.04,cy,1.34),(.93,.82,.13),wood,.07)
box('猫架软垫',(cx-.04,cy,1.42),(.83,.73,.09),sage,.06)
path('吊球绳',[(cx+.36,cy-.26,1.34),(cx+.36,cy-.26,1.05)],.008,ivory)
ball('吊球',(cx+.36,cy-.26,1.02),(.075,.075,.075),peach)
tag_group('tree',before)

# Large oval rug: clear central walk/play space, gently scalloped stitched edge.
before=start();ball('地毯',(0,-.54,.067),(1.86,1.32,.039),rug_mat)
ring('地毯外滚边',(0,-.54,.071),1.78,1.26,.012,ivory)
ring('地毯内缝线',(0,-.54,.073),1.67,1.16,.007,wood)
for side in [-1,1]:
    for i in range(25):
        y=-1.35+i*.071;x=side*1.80*math.sqrt(max(.01,1-((y+.54)/1.32)**2))
        path('地毯穗',[(x,y,.068),(x+side*.115,y+.008,.049)],.010,ivory)
tag_group('rug',before)

# Feed station has separated bowls, water surface and individual kibble.
before=start();fx=2.36;fy=-1.12
box('饭盆垫',(fx,fy,.095),(.87,1.08,.08),sage,.12)
def bowl(name,x,y,mat):
    # Lathed open bowl; no solid block pretending to be an interior.
    profile=[(.0,.115),(.19,.115),(.235,.14),(.267,.24),(.264,.28),(.232,.28),(.205,.16),(.0,.16)]
    verts=[];faces=[];n=40
    for r,z in profile:
        for i in range(n):
            a=i*math.tau/n;verts.append((x+r*math.cos(a),y+r*math.sin(a),z))
    for j in range(len(profile)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,mat)
bowl('陶瓷粮碗',fx,fy-.28,rose);bowl('陶瓷水碗',fx,fy+.28,ivory)
cyl('碗中水',(fx,fy+.28,.194),.21,.012,water,40)
for i in range(34):
    a=random.random()*math.tau;r=math.sqrt(random.random())*.18
    grain=ball('颗粒猫粮',(fx+r*math.cos(a),fy-.28+r*math.sin(a),.181+random.random()*.02),(.025,.018,.012),food)
    grain.rotation_euler.z=a
tag_group('feeding',before)

# Toy basket, yarn, tiny frog and a loose mouse on the rug.
before=start();qx=-2.45;qy=-1.75
box('玩具篮底',(qx,qy,.20),(.69,.57,.22),wood,.07)
for x in [qx-.33,qx+.33]:box('玩具篮侧',(x,qy,.35),(.065,.62,.32),wood,.025)
for y in [qy-.27,qy+.27]:box('玩具篮边',(qx,y,.35),(.65,.065,.32),wood,.025)
for i in range(6):
    z=.24+i*.048
    for y in [qy-.312,qy+.312]:path('篮编横纹',[(qx-.31,y,z),(qx+.31,y,z)],.010,ivory)
ball('篮内毛线球',(qx-.14,qy,.45),(.15,.15,.15),peach)
for i in range(6):ring('毛线圈',(qx-.14,qy,.45+(i-3)*.035),.145,.145,.008,ivory,n=32)
ball('青蛙玩具身体',(qx+.18,qy-.05,.46),(.12,.105,.12),leaf_light)
for x in [qx+.115,qx+.245]:
    ball('青蛙眼凸',(x,qy-.08,.56),(.045,.045,.05),leaf_light)
    ball('青蛙眼白',(x,qy-.12,.565),(.023,.015,.023),ivory)
    ball('青蛙眼珠',(x,qy-.132,.564),(.010,.006,.012),dark)
for x in [qx+.095,qx+.265]:ball('青蛙脚',(x,qy-.1,.38),(.07,.07,.027),leaf_light)
mx=.72;my=-1.58
ball('布老鼠',(mx,my,.15),(.12,.075,.068),peach)
for x in [mx-.025,mx+.025]:ball('老鼠耳',(x,my-.025,.21),(.035,.022,.036),ivory)
path('老鼠尾',[(mx+.11,my,.14),(mx+.19,my+.02,.12),(mx+.25,my-.04,.10)],.011,ivory)
tag_group('toys',before)

# A narrow wall shelf and plant; leave the frame blank until real photographs exist.
before=start();box('左墙置物板',(-2.96,-.28,2.61),(.45,1.69,.09),wood,.025)
for y in [-.92,.26]:box('置物板托',(-3.00,y,2.46),(.26,.06,.28),gold,.02)
for i in range(3):
    box('架上书',(-2.90,-.76+i*.11,2.82),(.23,.09,.34),[book,peach,sage][i],.008)
cyl('花盆',(-2.88,.24,2.79),.14,.26,rose)
cyl('盆土',(-2.88,.24,2.915),.125,.012,soil)
for i in range(7):
    a=i*math.tau/7;dx=math.cos(a)*.13;dy=math.sin(a)*.13;z=3.06+(i%3)*.08
    path('植物茎',[(-2.88,.24,2.91),(-2.88+dx,.24+dy,z)],.009,leaf)
    l=ball('植物叶',(-2.88+dx,.24+dy,z),(.10,.043,.023),leaf_light if i%2 else leaf)
    l.rotation_euler.z=a;l.rotation_euler.y=.45
tag_group('shelf',before)

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
bpy.ops.export_scene.gltf(filepath=str(HERE/'room.glb'),export_format='GLB',use_selection=True,
    export_extras=True,export_animations=False,export_image_format='WEBP',
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
for o in export_objects:bpy.data.objects.remove(o,do_unlink=True)

# Compress a derivative copy of the user cat, keep the original untouched.
for o in room_objects:o.hide_render=True;o.hide_set(True)
before=start();bpy.ops.import_scene.gltf(filepath=opt.cat);cat_objs=list(set(bpy.data.objects)-before)
for o in cat_objs:
    if o.type!='MESH':continue
    tris=sum(len(p.vertices)-2 for p in o.data.polygons)
    if tris>26000:
        d=o.modifiers.new('手机用减面','DECIMATE');d.ratio=26000/tris;d.use_collapse_triangulate=True
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=d.name)
for im in bpy.data.images:
    if max(im.size)>1024:
        w,h=im.size;s=1024/max(w,h);im.scale(round(w*s),round(h*s))
bpy.ops.object.select_all(action='DESELECT')
for o in cat_objs:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(HERE/'cat.glb'),export_format='GLB',use_selection=True,
    export_extras=True,export_animations=False,export_image_format='WEBP',
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
for o in room_objects:o.hide_render=False;o.hide_set(False)

cat_root=bpy.data.objects.new('猫猫静态预览',None);bpy.context.collection.objects.link(cat_root)
for o in cat_objs:
    if o.parent not in cat_objs:o.parent=cat_root
bpy.context.view_layer.update()
pts=[o.matrix_world@v.co for o in cat_objs if o.type=='MESH' for v in o.data.vertices]
low=Vector([min(p[i] for p in pts) for i in range(3)]);high=Vector([max(p[i] for p in pts) for i in range(3)])
cat_scale=layout['cat']['height']/(high.z-low.z);cat_root.scale=(cat_scale,)*3
cat_root.location=Vector(layout['cat']['position'])-Vector(((low.x+high.x)*.5*cat_scale,(low.y+high.y)*.5*cat_scale,low.z*cat_scale))
cat_root.rotation_euler.z=layout['cat']['yaw']

# Lighting and camera are authored once in layout.json for both render and web preview.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1440;scene.render.resolution_y=1440;scene.render.resolution_percentage=100
scene.world.color=(.42,.42,.42);scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.37));studio=bpy.context.object;studio.name='预览背景'
studio.data.materials.append(material('预览背景色','#eee8dc'))
lights=[]
for name,loc,power,size,col in [('窗边柔光',(-3,0,7),700,5,'#fff0d5'),('前方补光',(3,-5,6),500,6,'#fff7ec'),('后方柔光',(1,5,6),450,4,'#fff1d9')]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=tuple(int(col[i:i+2],16)/255 for i in (1,3,5));o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
bpy.ops.object.light_add(type='POINT',location=(.1,1.94,1.29));lamp_light=bpy.context.object;lamp_light.name='阅读灯光';lamp_light.data.energy=0;lamp_light.data.color=(1,.63,.34);lamp_light.data.shadow_soft_size=.25
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO'
def frame(pos,target,scale):
    camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
def render(name):
    scene.render.filepath=str(EVIDENCE/name);bpy.ops.render.render(write_still=True)
frame(layout['camera']['position'],layout['camera']['target'],layout['camera']['scale'])
if not opt.skip_render:
    render('room-day.png')
    frame((6,-8,5.4),(0,0,1.20),8.9);render('room-front.png')
    frame((4.2,-4.7,3.8),(0,-.4,.63),5.0);render('cat-corner.png')
    lights[0].data.energy=140;lights[0].data.color=(.52,.64,1)
    lights[1].data.energy=180;lights[1].data.color=(1,.78,.58)
    lights[2].data.energy=100;lights[2].data.color=(.57,.65,1)
    lamp_light.data.energy=32
    frame(layout['camera']['position'],layout['camera']['target'],layout['camera']['scale']);render('room-evening.png')
# Editable source includes the compressed cat for convenient visual arrangement.
for o,power in zip(lights,[700,500,450]):o.data.energy=power
lamp_light.data.energy=0
bpy.ops.wm.save_as_mainfile(filepath=str(EVIDENCE/'pet-house.blend'))
report={'catSourceSha256':hashlib.sha256(Path(opt.cat).read_bytes()).hexdigest(),
        'roomBytes':(HERE/'room.glb').stat().st_size,'catBytes':(HERE/'cat.glb').stat().st_size,
        'zones':[o.name for o in room_objects if o.type=='EMPTY'],
        'roomObjects':len(room_objects),'sceneOnly':True,'catRigged':False}
(HERE/'asset-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PET HOUSE',json.dumps(report,ensure_ascii=False))
