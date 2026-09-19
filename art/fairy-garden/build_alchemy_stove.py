"""炼金炉：一口看得见的锅。

Blender/bpy --python art/fairy-garden/build_alchemy_stove.py -- SOURCE.blend DEST.blend X Y

她 2026-09-18：「我的锅看不见啊能不能移动一下」。查下来是两件事叠在一起：
1. 旧的 `Cottage round cauldron` 只有 0.72 宽、0.68 高，平放在草地上。村落改成
   radius 32 的镜头以后，它在草里就是一个点；旁边那口井看得见，是因为井有 1.95
   高的立柱和顶棚。
2. 「扩建童话大宅」之后小屋本体占到 x∈[-14.75,-11.25]、z∈[3.55,8.05]，而锅在
   (-11.6, 8)——整个埋在房子里。锅和 brew 站位是各自平移的，没人把它们绑在一起。

所以炉子的位置只有这一个来源：调用方把 `MAPS.garden` 里 brew 交互点的坐标传进来。
以后 brew 搬到哪儿，锅就跟到哪儿，不会再各走各的。

同一份构建器给两个坐标系用：
- 上游 `scene-expansion/village-expanded.blend` 是旧坐标系（未分区平移）；
- 出图用的 `village-ground.blend` 是平移后的新坐标系。
两边只是传进来的点不同，炉子本身不写第二份。
"""
import bpy,sys,math
from pathlib import Path

# 旧炉子的三件；重建前先整份删掉，不留半成品。
LEGACY=('Cottage round cauldron','Cauldron lip','Glowing brew')
# 她从 +z（blend 的 -y）那边走过来，炉门朝她开。
MOUTH_Y=-1

# 上游的旧场景比出图用的地景少几种材质，缺了就退到同色系的那一种，不新建。
FALLBACK={'Architecture deep recess':'Cauldron iron'}

def _mat(name):
 while name not in bpy.data.materials and name in FALLBACK:name=FALLBACK[name]
 return bpy.data.materials[name]

def _mesh(name,material):
 o=bpy.context.object;o.name=name
 o.data.materials.clear();o.data.materials.append(_mat(material))
 return o

def _cyl(name,material,x,y,z,r1,r2,depth,verts=16):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=(x,y,z))
 return _mesh(name,material)

def _box(name,material,x,y,z,w,d,h):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z))
 o=_mesh(name,material);o.scale=(w,d,h)
 bpy.ops.object.transform_apply(scale=True)
 return o

def _torus(name,material,x,y,z,major,minor):
 bpy.ops.mesh.primitive_torus_add(location=(x,y,z),major_radius=major,minor_radius=minor,major_segments=16,minor_segments=6)
 return _mesh(name,material)

def build(x,y):
 """在 (x, y) 处立一口 2.4 米高的炼金炉，返回建出来的对象。"""
 for name in LEGACY:
  for o in [o for o in bpy.data.objects if o.name.split('.')[0]==name]:
   bpy.data.objects.remove(o,do_unlink=True)
 made=[]
 # 炉膛：石砌的矮鼓，锅坐在上面，不再直接放地上。
 made.append(_cyl('Alchemy stove drum','Warm sandstone',x,y,.26,.66,.58,.52,12))
 made.append(_cyl('Alchemy stove capstone','Warm sandstone',x,y,.55,.68,.66,.09,12))
 # 炉门和火光：朝她走来的那一面，远看也认得出这是在烧火。
 made.append(_box('Alchemy fire mouth','Architecture deep recess',x,y+MOUTH_Y*.55,.24,.44,.16,.34))
 made.append(_box('Alchemy stove ember','Honey window glow',x,y+MOUTH_Y*.6,.22,.34,.06,.24))
 # 锅：上宽下窄的铁锅，锅沿在 1.25 米左右。
 made.append(_cyl('Cottage round cauldron','Cauldron iron',x,y,.92,.36,.54,.64,16))
 made.append(_torus('Cauldron lip','Cauldron iron',x,y,1.23,.52,.055))
 made.append(_cyl('Glowing brew','Potion jade',x,y,1.21,.46,.46,.02,16))
 # 吊臂：整个炉子看得见靠这根立柱，和井的立柱同一种木头。
 post_x=x-.8
 made.append(_box('Alchemy hanging post','Walnut beams',post_x,y,1.17,.16,.16,2.34))
 made.append(_box('Alchemy post cap','Sage enamel shingles',post_x,y,2.38,.26,.26,.08))
 made.append(_box('Alchemy hook arm','Old brass',post_x+.42,y,2.2,.9,.09,.09))
 made.append(_box('Alchemy hanging chain','Old brass',x,y,1.9,.05,.05,.52))
 # 一束晾着的草药，给这一块一点颜色。
 made.append(_cyl('Alchemy herb bundle','Village • lavender foliage',post_x+.46,y,1.94,.13,.04,.42,8))
 # 脚边几块石头，免得炉子像凭空长出来的。
 for i,(dx,dy,r) in enumerate([(.78,.34,.17),(-.36,-.74,.14),(.24,.8,.12)]):
  made.append(_cyl('Alchemy hearth stone' if not i else 'Alchemy hearth stone.%03d'%i,'Old stepping stones',x+dx,y+dy,.06,r,r*.7,.13,8))
 return made

def main():
 args=sys.argv[sys.argv.index('--')+1:]
 source,dest=map(Path,args[:2]);x,y=float(args[2]),float(args[3])
 bpy.ops.wm.open_mainfile(filepath=str(source))
 made=build(x,y)
 dest.parent.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(dest))
 print('ALCHEMY_STOVE',dest,len(made),'at',x,y,flush=True)

if __name__=='__main__':main()
