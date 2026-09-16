# 微光庭院 · 小人 v3
# ⚠️不再自己捏身体：直接接手 Codex 的 traveler.glb。
#   它的脸是【竖蛋形】（宽 .478 × 高 .520），我上一版捏成正球，所以才「大脸小眼」。
#   身体、脸、材质槽一个字不改；我只负责 ① 换头发 ② 体型维度。
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "apps", "fairy-garden", "traveler.glb")
# 量出来的头骨（Face 的包围盒）
SK   = Vector((0.0, -0.067, 1.210))
SKR  = Vector((0.239, 0.190, 0.260))
CODEX_HAIR = ["Swept fringe", "Swept fringe.001", "Swept fringe.002", "Swept fringe.003",
              "Back hair", "Side hair", "Side hair.001", "Hair bun"]
PROPS = ["Satchel strap", "Little herb bag", "Held herb stem", "Held herb leaf", "Held herb leaf.001"]

def load(strip_hair=True, strip_props=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    kill = (CODEX_HAIR if strip_hair else []) + (PROPS if strip_props else [])
    for n in kill:
        o = bpy.data.objects.get(n)
        if o: bpy.data.objects.remove(o, do_unlink=True)

def hair_mat(hexc="#4a3226", slot="Character chestnut hair"):
    key = slot if slot not in bpy.data.materials else slot + " " + hexc
    m = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    lin = lambda c: c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4
    r,g,bl = (int(hexc[i:i+2],16)/255 for i in (1,3,5))
    b.inputs["Base Color"].default_value = (lin(r), lin(g), lin(bl), 1)
    b.inputs["Roughness"].default_value = .88
    return m

def ball(name, loc, scale, sub=1, seg=20, ring=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    if sub:
        md = o.modifiers.new("s", 'SUBSURF'); md.levels = md.render_levels = sub
    for p in o.data.polygons: p.use_smooth = True
    return o

def cap_shell(name, k=1.055, lift=0.012):
    """贴着头骨的一层壳：头发的底。⚠️比头骨【只大一点点】，大了就是头盔。"""
    return ball(name, (SK.x, SK.y + 0.012, SK.z + lift),
                (SKR.x*k, SKR.y*k, SKR.z*k))

def bang(name, x, z, scale, roll=-6, tilt=0.0, y=None):
    """刘海：挂在额头【前面】的一片，按平面坐标摆，不按球面。"""
    o = ball(name, (x, (SK.y - SKR.y*0.92) if y is None else y, z), scale)
    o.rotation_euler = (math.radians(roll), 0, math.radians(tilt))
    return o

def strand(name, yaw, pitch, scale, out=0.0, drop=0.0):
    y, p = math.radians(yaw), math.radians(pitch)
    r = 1.0 + out
    return ball(name, (SK.x + math.sin(y)*math.cos(p)*SKR.x*r,
                       SK.y - math.cos(y)*math.cos(p)*SKR.y*r,
                       SK.z + math.sin(p)*SKR.z*r - drop), scale)

# 眼睛上沿在 z=1.264 —— 刘海最低点必须高过它，否则又是「小眼」
BROW = 1.352

def hair_korean():      # 韩式碎盖：厚、齐、压眉，两鬓垂过颧骨
    out = [cap_shell("hair.korean.cap")]
    for i,(x,z,w) in enumerate(((-.158,BROW+.022,.056),(-.098,BROW+.004,.062),(-.033,BROW-.002,.058),
                                (.033,BROW+.000,.060),(.098,BROW+.006,.058),(.158,BROW+.024,.052))):
        out.append(bang(f"hair.korean.f{i}", x, z, (w, .070, .078), -8, x*34))
    for s in (-1,1):
        out.append(ball(f"hair.korean.side{'LR'[s>0]}", (s*.216, -.062, 1.115), (.052,.082,.130)))
    return out

def hair_wolf():        # 狼尾：顶上碎、两鬓收、后面一条尾
    out = [cap_shell("hair.wolf.cap", 1.03)]
    for i,(yaw,pit,sc) in enumerate(((-36,46,.070),(-8,58,.082),(24,48,.064),(-64,30,.058),(58,34,.074),(12,32,.052))):
        out.append(strand(f"hair.wolf.t{i}", yaw, pit, (sc, sc*.92, sc*.70), out=.10))
    for i,(x,z,w) in enumerate(((-.150,BROW+.030,.048),(-.076,BROW+.008,.054),(.006,BROW+.016,.044),
                                (.086,BROW+.004,.052),(.154,BROW+.028,.042))):
        out.append(bang(f"hair.wolf.f{i}", x, z, (w, .064, .072), -12, x*42))
    for i,z in enumerate((1.070,.965,.868,.786)):
        w = .092 - i*.017
        out.append(ball(f"hair.wolf.tail{i}", (0, .112 + i*.014, z), (w, w*.80, .072)))
    for s in (-1,1):
        out.append(ball(f"hair.wolf.w{'LR'[s>0]}", (s*.196, .030, 1.030), (.044,.058,.098)))
    return out

def hair_mullet():      # 鲻鱼头：前面短而干净，后面一整片长的
    out = [cap_shell("hair.mullet.cap", 1.03)]
    for i,(x,z) in enumerate(((-.154,BROW+.026),(-.078,BROW+.010),(.004,BROW+.014),(.084,BROW+.010),(.156,BROW+.026))):
        out.append(bang(f"hair.mullet.f{i}", x, z, (.050, .066, .062), -4, x*28))
    out.append(ball("hair.mullet.back", (0, .118, .920), (.196,.104,.300)))
    out.append(ball("hair.mullet.tip",  (0, .130, .690), (.158,.088,.098)))
    return out

def hair_airbang():     # 空气刘海 + 长直发
    out = [cap_shell("hair.air.cap")]
    for i,x in enumerate((-.140,-.084,-.028,.028,.084,.140)):
        out.append(bang(f"hair.air.b{i}", x, BROW+.016, (.044,.056,.060), -3, x*22, y=SK.y-SKR.y*.98))
    for s in (-1,1):
        for i,z in enumerate((1.100,.960,.830)):
            out.append(ball(f"hair.air.fall{'LR'[s>0]}{i}", (s*.196, -.030+i*.020, z), (.078-i*.010,.080,.096)))
    out.append(ball("hair.air.back", (0, .090, 1.040), (.212,.118,.238)))
    return out

def hair_bun():         # 丸子头 + 碎刘海
    out = [cap_shell("hair.bun.cap", 1.035)]
    for i,(x,z) in enumerate(((-.140,BROW+.028),(-.062,BROW+.006),(.024,BROW+.014),(.100,BROW+.020),(.158,BROW+.032))):
        out.append(bang(f"hair.bun.f{i}", x, z, (.050, .070, .068), -8, x*38))
    out.append(ball("hair.bun.knot",  (0, .070, 1.455), (.104,.098,.092)))
    out.append(ball("hair.bun.knot2", (0, .046, 1.398), (.070,.068,.058)))
    for s in (-1,1):
        out.append(ball(f"hair.bun.wisp{'LR'[s>0]}", (s*.208, -.078, 1.090), (.032,.046,.088)))
    return out

HAIR = {"korean": hair_korean, "wolf": hair_wolf, "mullet": hair_mullet,
        "airbang": hair_airbang, "bun": hair_bun}

def put_hair(style, hexc="#4a3226"):
    m = hair_mat(hexc)
    for o in HAIR[style]():
        o.data.materials.clear(); o.data.materials.append(m)

def scene(iso=True):
    w = bpy.data.worlds.new("w"); bpy.context.scene.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (.86,.89,.83,1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.15
    sun = bpy.data.lights.new("s",'SUN'); sun.energy=3.2; sun.angle=math.radians(14)
    so = bpy.data.objects.new("s",sun); bpy.context.collection.objects.link(so)
    so.location=(-4,-6,9); so.rotation_euler=(math.radians(50),0,math.radians(-30))
    f = bpy.data.lights.new("f",'AREA'); f.energy=110; f.size=9
    fo = bpy.data.objects.new("f",f); bpy.context.collection.objects.link(fo)
    fo.location=(5,5,5); fo.rotation_euler=(math.radians(-45),0,math.radians(140))
    cam = bpy.data.cameras.new("c"); cam.type='ORTHO'
    co = bpy.data.objects.new("c",cam); bpy.context.collection.objects.link(co)
    bpy.context.scene.camera = co
    return co

def render(path, res=(900,1000), samples=56):
    s = bpy.context.scene; s.render.engine='CYCLES'
    try: s.cycles.device='CPU'
    except Exception: pass
    s.cycles.samples=samples
    s.render.resolution_x, s.render.resolution_y = res
    s.render.filepath=path
    bpy.ops.render.render(write_still=True)

# ── 体型维度 ────────────────────────────────────────────────────
# 这个头身比下，「男体/女体」不靠肌肉骨骼，靠四样东西，而且都能在现成的零件上调：
#   flare    下摆张开度  ← 观感最强的一样（喇叭裙 vs 直筒衫）
#   shoulder 肩宽（袖子往外挪 + 上身加宽）
#   height   腿长
#   head     头身比
DIMS = dict(flare=1.0, shoulder=1.0, height=1.0, head=1.0)
SKIRT = "Tunic skirt"; UPPER = "Tunic upper body"
SLEEVE = ["Left sleeve", "Right sleeve"]; HAND = ["Left hand", "Right hand"]
LEG = ["Linen leggings", "Linen leggings.001"]; BOOT = ["Rounded boots", "Rounded boots.001"]
HEADISH = ["Face", "Neck", "Dark embroidered eye", "Dark embroidered eye.001",
           "Eye catchlight", "Eye catchlight.001", "Small nose", "Small mouth",
           "Soft cheek", "Soft cheek.001"]

def apply_dims(objs, d):
    d = {**DIMS, **d}
    by = {o.name.split("__")[0]: o for o in objs}
    def get(n): return by.get(n)
    if get(SKIRT):
        s = get(SKIRT); s.scale = (s.scale.x*d["flare"], s.scale.y*d["flare"], s.scale.z)
    if get(UPPER):
        u = get(UPPER); u.scale = (u.scale.x*(1+(d["shoulder"]-1)*.55), u.scale.y, u.scale.z)
    for n in SLEEVE + HAND:
        o = get(n)
        if o: o.location.x *= d["shoulder"]
    for n in LEG + BOOT:
        o = get(n)
        if o: o.location.z += (d["height"]-1)*0.09
    for n in LEG:
        o = get(n)
        if o: o.scale = (o.scale.x, o.scale.y, o.scale.z*d["height"])
    if d["head"] != 1.0:
        for n in HEADISH:
            o = get(n)
            if o:
                o.location.z = 0.95 + (o.location.z-0.95)*d["head"]
                o.scale = tuple(v*d["head"] for v in o.scale)
    # 头发跟着头一起变
    for o in objs:
        if o.name.startswith("hair.") and d["head"] != 1.0:
            o.location.z = 0.95 + (o.location.z-0.95)*d["head"]
            o.scale = tuple(v*d["head"] for v in o.scale)

def make(style, hexc="#4a3226", dims=None, offset=(0,0,0), base=None):
    """复制一份底模 → 换发型 → 调维度 → 挪位。"""
    bpy.ops.object.select_all(action='DESELECT')
    for o in base: o.select_set(True)
    bpy.context.view_layer.objects.active = base[0]
    bpy.ops.object.duplicate()
    objs = list(bpy.context.selected_objects)
    for o in objs:
        o.name = o.name.split(".00")[0] + "__v"
        o.hide_render = False; o.hide_viewport = False
    before = set(bpy.data.objects)
    put_hair(style, hexc)
    hair = [o for o in bpy.data.objects if o not in before]
    objs += hair
    apply_dims(objs, dims or {})
    for o in objs:
        o.location = (o.location.x+offset[0], o.location.y+offset[1], o.location.z+offset[2])
    return objs
