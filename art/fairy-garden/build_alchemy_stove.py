"""把 Codex 做的那口炼金炉，从房子底下整组搬到 brew 点上。

Blender/bpy --python art/fairy-garden/build_alchemy_stove.py -- SOURCE.blend DEST.blend X Y [SCALE]

她 2026-09-18：「我的锅看不见啊能不能移动一下」。查下来不是锅做得不对，是它
整个埋在房子里：锅在 (-11.6, 8)，而「扩建童话大宅」之后小屋本体占到
x∈[-14.75,-11.25]、z∈[3.55,8.05]，正好把它罩住。旁边那口井看得见，只是因为
它恰好落在房子外面。

⚠️她 2026-09-19 看过我另画的一口之后：「你这个炉好丑能不能用回 codex 的啊」。
所以这里只搬不画——锅、锅沿、药汤是 Codex 的原件，造型一个点都不动。
想让它更显眼，只许整组等比放大（她同一天：「能不能放大点放井右边」），
不许在这儿重新造型。放大是绕着锅底的落地点做的，锅不会浮起来也不会陷进土里。

⚠️「避开碰撞盒」不等于「避开墙」。只查 `MAPS.garden` 的房屋碰撞盒，锅还是会啃在
墙上——房子的可见墙比碰撞盒大一圈。选位置要拿实际顶点量（取齐腰那一段高度，
0.1~1.5 米；锅只有 1.3 米高，够不着屋檐），别拿碰撞盒当墙。

⚠️⚠️锅住在 **`village-home.glb`（小屋分区块）**里，不在地景 `village-ground.glb` 里。
源文件是 `blend/architecture-v2/village-home.blend`，`--detail` 导出。
我照着名字去改 `village-ground.blend` 连错两版：那份是**整场装配稿**，
5684 个网格里 4143 个标着 `hide_render`（井、锅全在内），导出脚本正是靠这个
只把地面导出来——所以在那份里搬锅，搬了也永远进不了游戏，而且不会有任何报错。
以后改村落里任何一件东西，先确认它归哪个分区块，再去改那个块的源。

锅是随 home 区整体平移搬的，brew 站位是另一条路搬的，房子一撑大两边就错开了，
没有任何一处报错。所以位置以后只有一个来源：调用方把 `MAPS.garden` 里 brew
交互点的坐标传进来，brew 搬到哪儿锅就跟到哪儿。

同一份搬运器给两个坐标系用：上游 `scene-expansion/village-expanded.blend` 是分区
平移前的旧坐标系，出图用的 `village-ground.blend` 是平移后的新坐标系，
两边只是传进来的点不同。
"""
import bpy,sys
from pathlib import Path
from mathutils import Vector

# Codex 那口炉子的三件；名字就是分组依据，别按坐标猜。
PARTS=('Cottage round cauldron','Cauldron lip','Glowing brew')

def group():
 """场上属于这口炉子的全部对象。"""
 return [o for o in bpy.data.objects if o.type=='MESH' and o.name.split('.')[0] in PARTS]

def move(x,y,scale=1):
 """把整组平移到 (x, y)，锅底那件的水平位置当基准，相对关系原样保留。"""
 pieces=group()
 if not pieces:raise SystemExit('找不到 Codex 那口炉子，名字八成动过了：'+','.join(PARTS))
 anchor=next(o for o in pieces if o.name.split('.')[0]==PARTS[0])
 dx,dy=x-anchor.location.x,y-anchor.location.y
 for o in pieces:o.location.x+=dx;o.location.y+=dy
 if scale!=1:
  # 绕锅底的落地点等比放大：水平以 (x, y) 为心，竖直以地面为底。
  ground=min((o.matrix_world @ Vector(c)).z for o in pieces for c in o.bound_box)
  for o in pieces:
   o.scale*=scale
   o.location.x=x+(o.location.x-x)*scale
   o.location.y=y+(o.location.y-y)*scale
   o.location.z=ground+(o.location.z-ground)*scale
 return pieces

def main():
 args=sys.argv[sys.argv.index('--')+1:]
 source,dest=map(Path,args[:2]);x,y=float(args[2]),float(args[3])
 scale=float(args[4]) if len(args)>4 else 1
 bpy.ops.wm.open_mainfile(filepath=str(source))
 pieces=move(x,y,scale)
 dest.parent.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(dest))
 print('ALCHEMY_STOVE',dest,len(pieces),'->',x,y,'x%.2f'%scale,flush=True)

if __name__=='__main__':main()
