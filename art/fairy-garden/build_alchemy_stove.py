"""把 Codex 做的那口炼金炉，从房子底下整组搬到 brew 点上。

Blender/bpy --python art/fairy-garden/build_alchemy_stove.py -- SOURCE.blend DEST.blend X Y

她 2026-09-18：「我的锅看不见啊能不能移动一下」。查下来不是锅做得不对，是它
整个埋在房子里：锅在 (-11.6, 8)，而「扩建童话大宅」之后小屋本体占到
x∈[-14.75,-11.25]、z∈[3.55,8.05]，正好把它罩住。旁边那口井看得见，只是因为
它恰好落在房子外面。

⚠️她 2026-09-19 看过我另画的一口之后：「你这个炉好丑能不能用回 codex 的啊」。
所以这里只搬不画——锅、锅沿、药汤是 Codex 的原件，一个点都不动，
只把整组平移到调用方给的位置。想让它更显眼也不要在这儿重新造型。

锅是随 home 区整体平移搬的，brew 站位是另一条路搬的，房子一撑大两边就错开了，
没有任何一处报错。所以位置以后只有一个来源：调用方把 `MAPS.garden` 里 brew
交互点的坐标传进来，brew 搬到哪儿锅就跟到哪儿。

同一份搬运器给两个坐标系用：上游 `scene-expansion/village-expanded.blend` 是分区
平移前的旧坐标系，出图用的 `village-ground.blend` 是平移后的新坐标系，
两边只是传进来的点不同。
"""
import bpy,sys
from pathlib import Path

# Codex 那口炉子的三件；名字就是分组依据，别按坐标猜。
PARTS=('Cottage round cauldron','Cauldron lip','Glowing brew')

def group():
 """场上属于这口炉子的全部对象。"""
 return [o for o in bpy.data.objects if o.type=='MESH' and o.name.split('.')[0] in PARTS]

def move(x,y):
 """把整组平移到 (x, y)，锅底那件的水平位置当基准，相对关系原样保留。"""
 pieces=group()
 if not pieces:raise SystemExit('找不到 Codex 那口炉子，名字八成动过了：'+','.join(PARTS))
 anchor=next(o for o in pieces if o.name.split('.')[0]==PARTS[0])
 dx,dy=x-anchor.location.x,y-anchor.location.y
 for o in pieces:o.location.x+=dx;o.location.y+=dy
 return pieces

def main():
 args=sys.argv[sys.argv.index('--')+1:]
 source,dest=map(Path,args[:2]);x,y=float(args[2]),float(args[3])
 bpy.ops.wm.open_mainfile(filepath=str(source))
 pieces=move(x,y)
 dest.parent.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(dest))
 print('ALCHEMY_STOVE',dest,len(pieces),'->',x,y,flush=True)

if __name__=='__main__':main()
