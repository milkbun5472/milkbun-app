# 微光庭院 · 可调布偶美术源

发型参考和十二款轮廓说明见 [HAIR_REFERENCES.md](HAIR_REFERENCES.md)。

此目录的美术源是 `base_traveler.glb`（只进不出）。预览脚本只出图；
`export_traveler.py` 是唯一给运行时用的一支，导出 `apps/fairy-garden/doll.glb`（只出不进）。
源脚本留在 `art/`，避免触发 `apps/fairy-garden/` 整包缓存指纹变化。
原稿保存在 Git 提交 `d6cb63c`；图和 `.blend` 输出到仓库之外。

## 这一稿

- 保留原 `base_traveler.glb` 的竖蛋形脸、五官、四肢与布料材质。
- 将两颗相交的圆形上衣重做为一个连续衣身：肩、腰、衣摆分别成形。
- 共用一份身体拓扑，通过六组形态键调节；短发、长发均能配任何体型。
- 十二款发型分别设计发际、头顶、鬓侧和后颈；用贴头的发量底层承接细分发束。
- 中分和逗号刘海沿头骨走向展开，长发使用连续后发主体；加了左右小耳朵，便于辨认短侧与长尾。
- 头发保留沿发流方向的 UV 与细纹材质，每款合成一个网格，原始构造统一在脚本中维护。
- 每个实例的网格、衣服和头发材质独立，改一个人不会改变其他人。
- 原复制逻辑会截断 `.001`，混掉另一条腿、眼睛等身份；现在保存准确的 `part` 属性。

## 生成与检查

本机已经安装 Blender，无需再安装 `bpy`：

```sh
DOLL_OUT=/tmp/fairy-doll-trends /Applications/Blender.app/Contents/MacOS/Blender --background --python art/fairy-garden/preview.py -- focus trends tied
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/fairy-garden/check_model.py
python3 art/fairy-garden/contact_sheet.py /tmp/fairy-doll-trends
```

其他系统用自己的 Blender 可执行文件替换上述路径。
已有兼容 `bpy` 的 Python 环境，也可直接 `python3 art/fairy-garden/preview.py`。
默认输出 `/tmp/fairy-doll`，可用 `DOLL_OUT` 指定持久目录。

默认预览任务输出重点三款的 `focus-front` / `focus-profile`，及十二款的 `catalog-1` 至 `catalog-4`，
每张都有同名 `.blend`；`tied` 另渲长卷、盘发和马尾侧面。`contact_sheet.py` 用 Pillow 排入中文标题，不重绘模型像素；
中文字体可通过 `DOLL_FONT` 指定，默认使用本机宋体。图不进 Git。

`dims` 仍可渲同一身体的两组参数交换长短发；`face` 渲单人近景；`hair` 等同十二款目录。

打开 `.blend`，选择 `Doll korean` 等空物体，在“物体属性 → 自定义属性”调节。
其子物体的形态键通过驱动器跟随，保存的不是一次性的静态摆拍。

| 参数 | 支持范围 | 含义 |
|---|---|---|
| shoulder | .85–1.20 | 肩宽，袖子与手一起移动 |
| waist | .85–1.15 | 衣身腰线 |
| flare | .78–1.22 | 衣摆宽度，独立于体型性别 |
| height | .85–1.25 | 腿长，上半身整体升降，鞋底固定 |
| head | .88–1.10 | 头身比，五官、耳朵与全部头发一起缩放 |
| build | .85–1.15 | 穿衣身体的丰满程度 |

所有参数以 1 为中性值，范围外显式报错，重复应用不会累计变形。
这是穿衣的童话布偶，不是写实人体解剖模型，也没有独立裸体。
十二款键和中文名由 `HAIR` 与共用 `hairstyles.json` 定义；旧五个键保留，色号独立设置。

## 坐标与脸部边界

Blender Z 向上、面向 -Y。导入后烘焙零件局部变换，不带旧场景的摆放根变换。
原脸宽 .478、深 .380、高 .520；眼睛原上沿 1.264。
中性底模把躯干以上提高 .075，头发同步提高，避免改腿长后头发错位。
刘海最低处在眼睛上方，发片根部埋入头壳，不依赖额前球体遮挡。

## 检查范围与后续接入

`check_model.py` 实际调用 Blender 检查：六个参数各自两端与组合两端、鞋底固定、
重复应用、恢复中性、直接修改自定义属性的驱动效果、左右零件完整、网格与材质隔离、
十二种发型共用身体拓扑、发型单网格/UV/有限顶点以及非法参数报错。预览另需目视检查；数学通过不代表美术满意。

### 2026-09-16 已经接进运行时

`export_traveler.py` 导出 `apps/fairy-garden/doll.glb`（一个身体 ＋ 十二款头发，
每款一个网格 `hair_<style>`），`game.mjs` 改读它，`traveler.mjs` 按名字显示其中一款。

接的时候踩平的三个坑，改这一带之前先看一眼：

1. **导出不许覆盖自己的输入。** 原来 `SRC` 指着 `apps/fairy-garden/traveler.glb`，
   一导出就把美术源烧了（真烧过一次，靠 git 捞回来）。现在源是 `base_traveler.glb`
   （只进不出），运行时是 `doll.glb`（只出不进）。
2. **节点名里不能带点。** three.js 的 GLTFLoader 会洗掉点（`sanitizeNodeName`），
   `hair.korean` 到网页里就认不出来——十二款头发全都显示，糊成一颗白球。
   导出这一步统一改名 `hair_<style>`。
3. **`clone(true)` 仍共享材质**，运行时按实例克隆了一份（`traveler.mjs` 的 `mine` 表）。

枢轴已按新体型量过（胳膊 .935、腿 .555、读书那本 .845），`Tunic body` 走原来的
`/Tunic|sleeve/i` 就认得。props（挎包、药草袋、手里那株草）保留，preview 那几支剥掉
它们只是为了看发型，接运行时不能照抄那个参数。

减面在导出这一步做：原稿每款 2.4~5.8 万顶点，十二款导出来 25MB，手机打不开；
现在每款封顶 6000 面、整包 3.4MB。美术源一个字没动。

### 2026-09-16 第二步：样貌与体型都接好了

`export_traveler.py` 现在同时产出两样东西：

- `apps/fairy-garden/doll.glb`——身体 ＋ 十二款头发 ＋ 六个体型参数的形态键。
  形态键由 `apply_dims` 生成，所以**形变规则仍然只写在 `deform` 一处**；网页那头只把
  「值 - 1」送进 `morphTargetInfluences`，和 Blender 那边是同一个算法。
  ⚠️别在 JS 里再实现一遍形变。
  导出时会把【这个网格根本不动】的形态键摘掉（头发只吃 head 和 height）；
  留着的话白涨将近 2MB。带形态键之后整包 3.4MB → 5.2MB，这笔是为了不写第二份公式。
- `apps/fairy-garden/doll.json`——发型中文名单（抄 `hairstyles.json`）＋ 六个参数的
  上下限（抄 `LIMITS`）。界面读它，所以**名字和范围不许在 JS 里另写一份**。

手机那头「样貌」整页可以挑发型、发色、衣色和六根滑杆，分「同行者／我」两份，
存在庭院存档里（`data.look` / `data.companion.look`，`dims` 嵌在里面）。

仍然没做：没有骨骼，行走还是 `traveler.mjs` 那套关节摆动；脸和肤色不可调；
长发从背面看脖子和头发之间有一道缝（美术那边的事）。

## 村落扩建、小屋内景和许愿树（2026-09-16）

`build_places.py` 在已有 `village-v2/fairy-village-v2.blend` 上扩建，不另建第二个家；
输出 `village-expanded.blend`、`home-interior.blend`、`wishing-tree.blend` 及对应预览。
原始图形目录作为第一个参数，输出目录作为第二个参数；脚本复用原始 `build.py` 的造型函数。
输出默认应放仓库外，只有导出的 GLB 进入 app。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/fairy-garden/build_places.py -- "$ART_SOURCE" "$ART_OUTPUT"
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/export-fairy-village.py -- "$ART_OUTPUT/village-expanded.blend" apps/fairy-garden/village.glb
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/export-fairy-village.py -- "$ART_OUTPUT/home-interior.blend" apps/fairy-garden/home-interior.glb --detail
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/export-fairy-village.py -- "$ART_OUTPUT/wishing-tree.blend" apps/fairy-garden/wishing-tree.glb --detail
node scripts/build-fairy-garden.mjs
```

小资产 `--detail` 保留倒角与完整拓扑：薄地板整场减到 28% 会破面。村落仍按原预算减面。
导出 PNG 颜料时将线性色转换为 sRGB，避免原木和叶子导出后变黑。
场景不包含玩家或同行者模型；木牌、告示纸、展架是空的，不伪造玩家收藏。
桥面游戏高度 .38；室内地板 .14；林地缓坡中心 (0,-6)、椭圆半径 (2.5,1.85)，
高度 `.08 + .9 * (1-r²)²`，与规则表/点地寻路共用的 floorHeight 保持一致。

### 双卧室住宅

`build_house.py` 读取 `rules.js` 的 `MAPS.home` 作为墙体、家具和床位的唯一坐标来源；修改布局先改地图表再重建。输入仍是 fairy-cottage 图形源根目录，输出目录置于仓库外：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/fairy-garden/build_house.py -- "$ART_SOURCE" "$ART_OUTPUT"
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/export-fairy-village.py -- "$ART_OUTPUT/home-interior.blend" apps/fairy-garden/home-interior.glb --detail
```

晨光与月色卧室各有两枕双人床，另有壁炉客厅与餐厨。隔墙降低方便俯视，模型不烘焙人物；两侧进床点及床上位置由同一地图表提供。

### 古老许愿树

`build_wishing_tree.py` 单独重建林地地标：连续扭转树干、展开的层叠树冠、垂叶、月牙与空白挂饰。读取 `MAPS.forest.surfaces[0]` 的缓坡参数；人物到访点与树干碰撞保持原值，根部贴地，前方留空。叶材质名称含 foliage，直接参加共享四季染色和冬雪。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/fairy-garden/build_wishing_tree.py -- "$ART_SOURCE" "$ART_OUTPUT"
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/export-fairy-village.py -- "$ART_OUTPUT/wishing-tree.blend" apps/fairy-garden/wishing-tree.glb --detail
```

仍是纯场景美术，空牌不代表用户愿望，没有新增许愿数据或 AI 调用。浏览器验证 `scripts/checks/fairy-wishing-tree-browser.cjs` 使用隔离存档验四季、夜间、320px、读档与到访路径。

### 公共厅两层

`build_public_hall.py` 从 `MAPS.hall`/`MAPS.dormitory` 读取长厅家具、宿舍墙/床/房间布局，复用原 primitives 与 house pigment。输出 public-hall.blend、hall-dormitory.blend 及预览，保存在仓库外；两份均使用 export-fairy-village.py 的 --detail 导出。楼下长桌/壁炉/书架/小讲堂，楼上四间空房。前墙和顶板切开方便浏览，人物由游戏实例显示；独立地图过楼梯，不做重叠多层寻路。

### 拾光收藏馆

`build_museum.py` 读取 MAPS.garden.museum 与 MAPS.museum，生成南侧独立外观和展厅。复用 public_hall 的 shell/window/lamp；shell 已按 plan 尺寸铺地板和木梁，既有14×9长厅也沿用此公共函数。输出 museum-exterior.blend / museum-interior.blend 与预览，分别 --detail 导出同名 GLB。花笺框与陈列架本身为空，运行时 museum-view 根据原收藏实例化陈列，不把用户物品烘焙进模型。

### 松散村落与分区加载

`build_spacious_village.py -- ART_ROOT OUTPUT` 从 scene-expansion/village-expanded.blend 取原始建筑分组，读取 rules.js 的 VILLAGE_ZONES 刚性平移；不拉伸门窗或房屋。月潭连同栈桥/溪流一起移动，草地上的道路重新连接。收藏馆取 museum/museum-exterior.blend；新版源对象记 district_origin_x/z，重复生成也不会二次偏移。

输出 assembled village-spacious.blend/png 和八份 village-{ground,home,hall,neighbor1,neighbor2,neighbor3,pond,museum}.blend。导出仍走 export-fairy-village.py；地景使用 `--ratio=.12`，收藏馆使用 `--detail` 保留薄屋顶，其余默认 .28。地景保持常驻，七区建筑和月潭依镜头范围加载/释放，放大后减少加载范围，缩小看全景时自然加载更多。室内继续沿用进门加载机制。所有输出放仓库外，只有 GLB 进 app。

村落可走半径 14→32；建筑体积保持原值。VILLAGE_ZONES 同时变换门口、交互、碰撞、坐席、台阶、出入口和场景装饰。存档 layout=2 只迁移旧室外位置一次，室内床位与收藏不搬动。以后新增区域继续加地图数据/分区资产，别为了塞进一屏压缩邻里间距。

### 六种建筑轮廓（2026-09-16）

`build_architecture.py -- ART_ROOT OUTPUT_DIR` 读取 `spacious-village/village-spacious.blend`，保留地景、月潭、井、炼药锅、花圃与摊位，替换六栋建筑。布局唯一来源 `MAPS.garden.architecture`：房屋主体和侧翼的碰撞也从这张表生成，门前到达点沿用已有机制。

自家为高低屋顶与侧翼的爬藤小屋，公共厅为铃楼长屋；三邻居分别尖顶阁楼、圆塔书斋、带玻璃花房的弯檐屋；收藏馆为金属框架拱顶温室。共享曲面瓦顶、拱窗、门、侧窗、烟囱与木架函数，区别来自体块/屋顶/窗位组合。手绘色差材质名称保留roof/foliage角色，直接参加运行时四季。

输出整体 `village-architecture.blend/png`，各栋 `*-exterior.png` 与 `village-{home,hall,neighbor1,neighbor2,neighbor3,museum}.blend`。六份GLB均 `export-fairy-village.py --detail` 保留薄瓦片、拱顶和门窗边。完成 spacious 的生成后再运行 architecture，不能只重导旧的spacious建筑。地景和月潭资产本轮不重导；屋内的双人床、公共厅/宿舍、收藏馆内景和用户收藏均不变。
