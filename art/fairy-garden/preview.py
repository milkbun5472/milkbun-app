# 渲预览图。用法：
#   python3 art/fairy-garden/preview.py            → 三张都渲
#   python3 art/fairy-garden/preview.py hair       → 只渲发型一览
# ⚠️图不进仓库（一张一兆，git 会被撑坏），默认输出到 /tmp/fairy-doll。
import importlib.util, sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("DOLL_OUT", "/tmp/fairy-doll")
os.makedirs(OUT, exist_ok=True)
spec = importlib.util.spec_from_file_location("doll", os.path.join(HERE, "doll_hair.py"))
b = importlib.util.module_from_spec(spec); sys.modules["doll"] = b; spec.loader.exec_module(b)

ISO = dict(loc=(4.35, -5.78, 4.92), rot=(60, 0, 37))   # 跟游戏里同一个机位
def aim(co, scale, loc, rot):
    co.data.ortho_scale = scale
    co.location = loc
    co.rotation_euler = tuple(math.radians(v) for v in rot)

def row(d): return (0.799 * d, 0.602 * d, 0)

def sheet_hair():
    b.load(); co = b.scene()
    base = [o for o in b.bpy.data.objects if o.type == 'MESH']
    for o in base: o.hide_render = True
    tints = ["#3a2f2a", "#8a5a34", "#d8cfc0", "#2f3340", "#6b4a58"]
    for i, (k, t) in enumerate(zip(b.HAIR.keys(), tints)):
        b.make(k, t, {}, row(-1.9 + i * 0.95), base)
    aim(co, 4.6, **ISO)
    b.render(os.path.join(OUT, "hair5.png"), res=(1400, 680))

def sheet_dims():
    b.load(); co = b.scene()
    base = [o for o in b.bpy.data.objects if o.type == 'MESH']
    for o in base: o.hide_render = True
    sets = [("korean", dict()),
            ("mullet", dict(flare=.78, shoulder=1.20, height=1.14)),
            ("wolf",   dict(flare=.70, shoulder=1.12, height=1.24, head=.94)),
            ("bun",    dict(flare=1.16, shoulder=.90, height=.88, head=1.06))]
    for i, (h, d) in enumerate(sets):
        b.make(h, "#3a2f2a", d, row(-1.45 + i * 0.97), base)
    aim(co, 4.3, **ISO)
    b.render(os.path.join(OUT, "dims.png"), res=(1300, 700))

def sheet_face(style="korean"):
    b.load(); co = b.scene()
    b.put_hair(style)
    aim(co, 1.35, (0, -6.0, 1.215), (90, 0, 0))
    b.render(os.path.join(OUT, "face.png"), res=(760, 860))

JOBS = {"hair": sheet_hair, "dims": sheet_dims, "face": sheet_face}
for name in (sys.argv[1:] or JOBS.keys()):
    JOBS[name](); print("渲好了：", os.path.join(OUT, name))
