"""把这一版布偶导成运行时模型 apps/fairy-garden/doll.glb（她 2026-09-16 让接进来）。

⚠️这一支是目录里唯一【给运行时用】的脚本，preview/check 照旧只出图。

三条定死的规矩：

1. **不覆盖 traveler.glb。** 那一份是这套美术脚本自己的输入（doll_hair.SRC 读它），
   覆盖了就再也重建不出来——第一次跑就踩了这个坑，靠 git 才捞回来。
   运行时另开一个文件 doll.glb，两边互不相干。
2. **一份 GLB 带一个身体 ＋ 十二款头发**（hair.<style> 各自成网格，运行时显示一款）。
   十二个文件＝十二份要同步的东西，改一处永远漏十一处。
3. **导出用物体名认零件。** make/copy 出来的物体名全带 .001，甚至叫 Sphere.024；
   运行时是按名字找 Left sleeve / hair_korean 的，导出前必须改回 part。
   ⚠️头发在这里改名成 `hair_<style>`：three.js 的 GLTFLoader 会把节点名里的点洗掉
   （PropertyBinding.sanitizeNodeName），`hair.korean` 到了网页里就不叫这个名字了——
   第一次接进去十二款头发全都显示、糊成一颗白球，就是这么来的。

关于减面：原稿每款头发 2.4~5.8 万顶点，十二款导出来 25MB——手机上打不开。
这里在导出这一步按面数封顶减面（美术源一个字不动，属于接入侧的事）。
头发的程序化噪声材质本来也进不了 GLB，颜色一律由 traveler.mjs 每个实例自己给。
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import doll_hair as D

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'apps', 'fairy-garden', 'doll.glb'))
FACE_BUDGET = 6000          # 每款头发的面数上限
RISE = .075                 # load() 把躯干以上抬过这么多，头发要跟上


def trim(o, budget=FACE_BUDGET):
    if len(o.data.polygons) <= budget:
        return
    m = o.modifiers.new('budget', 'DECIMATE')
    m.ratio = budget / len(o.data.polygons)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)


def build():
    # ⚠️props 要留着：小挎包、药草袋、手里那株草是这个小人原本的样子，
    #   traveler.mjs 还按名字把「Held herb」绑在右手上。preview 那几支剥掉它们是为了看发型，
    #   接进运行时不能照抄那个参数。
    objs = list(D.load(strip_hair=True, strip_props=False))
    for style in D.HAIR:
        for o in D.put_hair(style):
            for v in o.data.vertices:
                v.co.z += RISE
            trim(o)
            objs.append(o)
    return objs


def measure(objs):
    """量出运行时那几个枢轴，别照旧尺寸猜。"""
    def box(pred):
        pts = [v.co for o in objs if pred(o.get('part', o.name)) for v in o.data.vertices]
        if not pts:
            return None
        return {a: [round(min(p[i] for p in pts), 4), round(max(p[i] for p in pts), 4)] for i, a in enumerate('xyz')}
    return {
        'sleeve': box(lambda n: 'sleeve' in n),
        'hand': box(lambda n: 'hand' in n),
        'leg': box(lambda n: n.startswith(('Linen leggings', 'Rounded boots'))),
        'tunic': box(lambda n: n.startswith('Tunic')),
        'head': box(lambda n: n in ('Face',) or n.startswith('hair.')),
        'all': box(lambda n: True)
    }


def main():
    objs = build()
    info = measure(objs)
    seen = {}
    for o in objs:
        want = o.get('part', o.name)
        if want.startswith('hair.'):
            want = 'hair_' + want[5:]
        seen[want] = seen.get(want, 0) + 1
        o.name = want if seen[want] == 1 else want + '.%03d' % (seen[want] - 1)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        o.hide_render = False
        o.hide_viewport = False
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True)
    # 发型名单也从这儿出一份给运行时：名单只有 hairstyles.json 这一个源头，
    # 界面上那十二个名字和模型里那十二款网格保证是同一批（test/garden-doll 钉了这条）。
    labels = os.path.abspath(os.path.join(HERE, '..', '..', 'apps', 'fairy-garden', 'hairstyles.json'))
    with open(os.path.join(HERE, 'hairstyles.json'), encoding='utf-8') as src, open(labels, 'w', encoding='utf-8') as dst:
        dst.write(src.read())
    print('WROTE ' + OUT + ' ' + str(round(os.path.getsize(OUT) / 1048576, 2)) + 'MB')
    print('FACES ' + str(sum(len(o.data.polygons) for o in objs)))
    print('MESHES ' + json.dumps(sorted(o.name for o in objs), ensure_ascii=False))
    print('PIVOTS ' + json.dumps(info))


main()
