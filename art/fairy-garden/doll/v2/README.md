# 玩偶 v2（2026-09-25，Lisa 新生成的光头，头比 v1 小一圈）

同一套「发型＝帽子」流程，但头小了，混元的头发直接罩在头外，不再陷进头皮。
第一次试套（`m02-m03-first-fit.png`）用的是**最精简**的参数：只按身体对齐，
不推、不拔、不借发束、不删小碎块：

`ALIGN=body HAIR_DY=0 NO_REAR_LIFT=1 NO_LOCK_LIFT=1 MIN_ISLAND=0 FACE_CRUMB=0 FACE_CLEAR=0 HAIR_ONLY_ABOVE=.93 FRINGE_K=1 HAIR_SCALE=1.0 FILL_N=0 BASE_FLAT=.92 TAN_Y=-.05`（皮肤阈值 M02 `.62/.34`，M03 `.80/.70`）

待办：表情贴到 v2 的脸上；M02 刘海盖眼，要上收；体型拉条。

## 2026-09-25 定下来的参数

- 表情：`fill_eyes.py` 用 `EYE_X=.089 EYE_Z=.86` 填眼坑 → `doll-blank-face.glb`；`bake_face.py` 用 `NECK_FLAT=.775 FACE_S=.00152 FACE_CZ=.915`，腮红 (±78,78) 19×14、透明度 0.7（肤色自动取新脸）。`doll-anchored.glb` 目前贴的是默认表情；十张总览 `ten-faces.png`。
- 发型通用：`EAR_SKIN=0 EAR_CLEAR=0 JAW_OFF=1 TAN_L=9 EYE_X=.089 EYE_Z=.86 ALIGN=body HAIR_DY=0 NO_REAR_LIFT=1 NO_LOCK_LIFT=1 MIN_ISLAND=0 FACE_CRUMB=0 FACE_CLEAR=0 HAIR_ONLY_ABOVE=.93 HAIR_SCALE=0.93 FILL_N=0 BASE_FLAT=.92 ANCHOR=v2/head-anchor.json`
  - M02：`FRINGE_K=.80 SKIN_R=.62 NECK_RING=.12`
  - M03：`NO_EYE_CLEAR=1 FRINGE_K=.85 SKIN_R=.80 NECK_RING=.12`（眼前清理会把刘海挖成碎块，关掉；刘海略上收露眼；脖子圈放大会误删后颈头发）
- 预览：`../hat-preview-v2.html`，截图 `m02-m03.png`。

## 头发壳（2026-09-25，Lisa 试的新做法，效果最好）

混元直接生成**只有头发、里面是空的壳**，不带头和身体。`fit_shell.py` 从壳的空腔往外打射线，找到内表面，拟合一个球，再把这个球对到玩偶的头骨上（M01 用 `INNER=0.90`；1.02 偏蓬、盖住耳朵）。不用切、不用清理皮肤碎片。

`python3 fit_shell.py hunyuan-m01-shell.glb v2/head-anchor.json v2/hats/hair_m01.glb`

以后每款发型都建议这样生成（M02、M03 也换成壳）。
- M02 头发壳：`COMPRESS=.7 CONFORM_DOLL=<光头> GAP=.003 DZ=-.40 INNER=.95`。实测侧面头发外缘离头 8 cm、头顶 4.4 cm，壳内还有一层在头里面——不是悬空，是发量本身厚；COMPRESS 把露在头外的部分沿半径压到 70%（0.5 会在后脑裂缝）。位移按焊接后的顶点平滑，避免接缝裂开。

## 2026-09-25 晚：让娃娃迁就发型（Lisa 定）

- **不再变形发型。** M02 恢复为混元原始发壳，只做等比缩放和平移：`DY=.42 DZ=-.40 INNER=.95`；另加 `BACK_K=.15`：只把耳后（y>0.10）的后半区沿前后轴渐进压 15%，越靠后越多，前面、顶部、两侧不动。
  DY 往后挪是为了让两侧长发垂在**耳朵后面**（之前挂在脸颊前，像两根须）。
- **改娃娃的头顶**：`shrink_cap.py`（`CAP=.12 Z0=.93 Z1=1.08`）把眉毛以上的头顶/后上脑沿半径向头骨中心收 12%，平滑过渡；脸、眼、耳、下巴、头最宽处不动。帽托（HeadAnchor）不变，所有发型继续挂同一个点。
- 原因：一个娃娃 + 多个发型，应让娃娃迁就发型的公共最小内腔，而不是每个发型都改自己去贴娃娃。
- M03 已换成头发壳（`hunyuan-m03-shell.glb`）：`INNER=.85 DZ=-.12`（不转向；缩小后要往上抬，否则头顶露头皮）。侧边缝隙待补。
- （旧）M03 第一版：`SHORT_BACK_ONLY=1 SHORT_FROM=1.12 SHORTEN_TO=.74 BACK_K=.08 BACK_KX=.04 DZ=-.212 INNER=.855`，再跑 `fill_side.py`（`FILL_PER_SIDE=5 SWING=18`：从两侧偏后挑最大的 5 缕复制、绕竖轴往前转 18° 补侧边空缺）。
- **M03 定稿（v2 壳）**：换成新的 Hunyuan 头发壳 `hunyuan-m03-shell-v2.glb`，旧壳侧边缝隙不再修。
  `INNER=.9 DZ=-.1 python3 fit_shell.py v2/hunyuan-m03-shell-v2.glb v2/head-anchor.json fit.glb`
  `FRONT_K=.14 WIDEN=.09 python3 shape_hair.py fit.glb v2/hats/hair_m03.glb`
  （`shape_hair.py` 只做仿射：前半边 y 统一收 14% 让刘海贴额头、整体横向放宽 9%；不按高度加权，发束不会被掰弯；头顶不缩，避免饭团头。）对比图 `m03-v2.png`（上旧下新）。
- **F01 刘海长发**（女生款）：Hunyuan 头发壳 `hunyuan-f01-shell.glb`。这个壳的头型比娃娃靠上、靠后，刘海下半截会埋进脸里，所以要大幅往下、往前放。
  `INNER=1.0 DZ=-.7 DY=-.42 python3 fit_shell.py v2/hunyuan-f01-shell.glb v2/head-anchor.json fit.glb`
  `FLAT_K=.25 python3 shape_hair.py fit.glb v2/hats/hair_f01.glb`（眼睛以上压扁 25%，刘海盖到眼睛）。预览图 `f01.png`。

## 能动的娃娃（骨骼）

- 新娃娃是一整块网格，手臂在肩膀处跟身体连在一起，不能像旧旅人那样把手臂切下来整块转（一转肩膀就开洞）。所以改用**骨骼蒙皮**：`python3 rig_doll.py v2/doll-anchored.glb v2/doll-rigged.glb`。
- 骨头名字跟运行时的枢轴名一致：`leftArm/rightArm/leftLeg/rightLeg`（left = -X，同 `apps/fairy-garden/traveler.mjs`），外加不动的 `body`。骨头直接挂在骨架下（没有根骨），所以绕世界 X 轴转就等于旧枢轴的转法。枢轴坐标写在骨架的 extras `dollRig`（three.js Y-up）。
- 权重是程序算的：肩膀外侧 2.5cm、胯下 7cm 平滑过渡，不靠 Blender 自动权重（Hunyuan 网格不闭合，自动权重不可靠）。
- 预览：`../rig-preview-v2.html`（站着 / 走路 / 挥手 / 坐下，动作公式照抄 traveler.mjs），截图 `rig.png`。
- 发型照旧挂在 `HeadAnchor`（骨架的子节点，头不动）。衣服以后也蒙到这副骨架上：从身体把权重传给衣服，袖子、裤腿就会跟着手脚一起弯。
- 还没接进 app：`traveler.mjs` 目前是把网格塞进枢轴组来转，换成新娃娃时要改成转骨头。
- **F02 内扣短发**（女生款）：Hunyuan 头发壳 `hunyuan-f02-shell.glb`。
  `INNER=.82 DZ=.04 python3 fit_shell.py v2/hunyuan-f02-shell.glb v2/head-anchor.json fit.glb`
  `TUCK_K=.35 python3 shape_hair.py fit.glb v2/hats/hair_f02.glb`（整体 82%、往上补一点保持头顶高度；后半边从耳朵高度往下越收越多，发尾内扣 35%）。侧面、后 45° 会露一点耳朵。预览图 `f02.png`。

## 衣服（蒙皮外壳）

- 衣服是 Hunyuan 生成的「只有衣服的壳」，放在 `v2/outfits/`。`skin_outfit.py` 三步：摆到娃娃身上（居中、缩放 `S`、前后加厚 `SY`、下沿对齐 `Z0`）→ 从身体就近复制骨骼权重 → 连同同一副骨架导出。运行时按骨头名字把衣服绑回娃娃的骨架（见 `rig-preview-v2.html` 的 `dress()`）。
- 摆好后先「贴合」：凡是落在身体里面（或离皮肤不到 `GAP=.006`）的衣服顶点，沿身体法线推到皮肤外面，这样衣服可以往下放、露出脖子，肩膀也不会戳出来。
- 背心、衬衫身这类从不伸出躯干侧边的碎片（`|x|` 最大值 < `ARM_X=.2`）不吃手臂权重，否则挥手时背心下摆会被手拽走。
- **C01 学院背心**（衬衫 + 领带 + 针织背心 + 短裤）：`UNDER_TEX=1 CRUMB=200 UNDER=1 SLEEVE_K=.35 S=.53 SY=1.25 Z0=.15 python3 skin_outfit.py v2/doll-rigged.glb v2/outfits/hunyuan-c01-shell.glb v2/outfits/outfit_c01.glb`。动作图 `c01.png`。袖子缩短 35%（`SLEEVE_K`，只动伸出躯干两侧的碎片，沿肩→手方向往肩膀收）。袖口毛边碎片（小于 `CRUMB=200` 顶点的袖子碎块）收掉；`UNDER=1` 在衣服底下铺一层衬衫色的贴身底衣（身体皮肤复制外推 `UGAP=.004`，躯干 + 手臂到袖口内），腋下、肩膀裂缝看进去是衬衫色不是肉色。

## 网页用压缩版（v2/web/）

- `TRIS=30000 TEX=1024 python3 compress_asset.py <源.glb> v2/web/<名>.glb`：每个网格减到 3 万三角面以内，贴图缩到 1K、存 WEBP，几何用 Draco。骨骼、权重、HeadAnchor、dollRig 照留。
- 七个文件从约 170MB 缩到 1.3MB（每个 130–220KB），画面几乎看不出差别。预览页加 `?web=1` 就读压缩版（`hat-preview-v2.html?web=1`、`rig-preview-v2.html?web=1`）。
- 源文件不动；改了源文件要重新跑一次压缩。

## 进 app：assemble_v2.py（体型、表情、肤色、衣服配色）

- `python3 assemble_v2.py` 从 `v2/web/` 的压缩件组装 `apps/fairy-garden/doll.glb`，并写 `doll.json`、`outfits.mjs`。
- **体型**：六个滑杆是身体和每套衣服上的形态键（同一个 `deform()` 算，衣服跟着身体变）；骨头和 HeadAnchor 的位移写在骨架 extras `rigMorphs`，运行时挪骨头后在静止姿势下重新绑一次（traveler.mjs `rebindBones`），手臂照样绕新肩膀转；头身比让 HeadAnchor 一起缩放，发型跟着变大变小。
- **表情**：`bake_face.py` 把十张脸各烤一张身体贴图（和身体同一套 UV），缩成 1K WEBP 放 `apps/fairy-garden/faces/<id>.webp`；运行时换身体的贴图，存档字段 `face`。以后桌宠按心情换表情也用这个字段。
- **肤色**：身体 extras `skinBase` 是贴图自己的肤色，运行时材质颜色＝选的肤色 ÷ skinBase，眼睛腮红跟着一起变深浅。
- **鞋**：Hunyuan 的学院背心没生成鞋，`make_shoes()` 复制娃娃自己脚踝以下（`SHOE_Z=.085`），沿法线鼓出一点、鞋底压平，同一套骨骼权重，纯色走 `boots` 色槽。
- **衣服配色**：每个面按自己贴图的颜色分到四格（衣服主色 / 衬衫领边 / 裤子 / 领带点缀），格子号存在顶点色里；运行时按「选的颜色 ÷ 这一格原色」上色，针织纹和褶子都留着。
- **C02 背带连衣裙**（ID 沿用旧的 `garden`）：`PAINT_XMIN=.145 COLLAR_LUM=.9 PAINT_COLLAR=.675 COLLAR_OUT=.012 COLLAR_Z=.64 STRAP_OUT=.006 CRUMB=0 SLEEVE_LUM=.45 GAP_TOP=.001 GAP_TOP_Z=.6 CONFORM_TOP=.72 UNDER_TEX=1 PAINT_ARM=.7 SLEEVE_K=.35 ARM_SKIP=1 UREACH=.3 SKIRT_K=.25 UNDER=1 S=.58 SY=1.2 Z0=.185 python3 skin_outfit.py v2/doll-rigged.glb v2/outfits/hunyuan-c02-shell.glb v2/outfits/outfit_c02.glb`。
  - `ARM_SKIP=1`：袖子不做贴合（贴合会把裙子里衬推到袖子表面，出现棕色斑），保持原来粗细；手臂穿出来的地方由衬衫色底衣（`UREACH` 盖到上臂）遮住。`CONFORM_TOP=.55` 同理不贴合领子。
  - `SKIRT_K=.25`：裙摆只跟腿走四分之一，其余跟身体，走路不会裂成两片。
  - 袖子和学院背心一样缩短 35%；缩短后露出来的深色里衬由 `PAINT_ARM` 直接涂成衬衫色（手臂上方、`PAINT_ZMIN=.46` 以上的深色面改指向袖子的浅色贴图），小熊包不受影响。`SLEEVE_ZMIN=.33`：裙片虽然宽，但不算袖子。
  - 连衣裙没有单独的「裤子」「点缀」色槽；鞋照样 `make_shoes()` 补一双深棕的。
- **M04 刺刺短发**（ID 沿用旧的 `pixie`）：发壳 `hunyuan-m04-shell.glb` 自带耳朵缺口。`INNER=.9 DZ=-.1 python3 fit_shell.py …`，再 `FRINGE_K=.8 python3 shape_hair.py …`（刘海收短到和 85% 那版一样长，头发其余部分还是 90%）。
- **C03 连帽卫衣工装裤**（ID 沿用旧的 `ranger`）：`UNDER_TEX=1 SLEEVE_K=.35 UREACH=.3 CONFORM_TOP=.55 UNDER=1 CRUMB=200 S=.63 SY=1.3 Z0=.06 python3 skin_outfit.py …`（`UCOL` 底衣换成卫衣色；裤子到脚踝，`Z0` 放低）。补一双浅棕鞋。
- **体积**：web 件按用途减面（身体 `TRIS=20000`、衣服 `15000`、头发 `18000`），组装时 Draco 量化调低、形态键存稀疏。三套衣服 + 五款发型的 `doll.glb` 约 3.9MB（原来 6.2MB），庭院里看不出差别。体积大头是体型滑杆的形态键（没被 Draco 压）。
- **C04 小兔毛衣**（ID 沿用旧的 `cardigan`，自带球鞋，不补鞋）：这件是照腿长、身瘦的人生成的——`LIFT=.1` 把腰以上整体提到肩膀（鞋留在地上），`SX` 控制宽度。`UNDER_TEX=1 ARM_SKIP=1 UREACH=.2 CONFORM_TOP=.68 UNDER=1 CRUMB=200 LIFT=.1 SX=1.0 SY=1.5 S=.63 Z0=-.01`。`CONFORM_TOP` 要盖到胸口，否则粉色底衣会盖住小兔图案。袖子和身体连成一片，压短袖口会皱，所以保持长袖。
  - `UNDER_TEX=1`：底衣不再是纯色，而是用毛衣自己的贴图（取上臂附近布料的中位色那一点），颜色和明暗跟毛衣一样，看不出垫了一层。
  - **背带**：背带在肩上，一不小心就会被当成别的东西处理掉。`CRUMB=0`（背带碎片不能当袖口毛边删）；`PAINT_XMIN=.19`（涂衬衫色只涂肩膀外侧，不涂背带）；贴合后背带和衬衫肩膀离皮肤一样近、衬衫会盖住背带，所以 `STRAP_OUT` 把肩上的深色面再往外抬，`COLLAR_OUT` 把领子抬得更高，背带就像原版一样从领子底下穿过去；`GAP_TOP` 让胸口以上贴得更紧，里衬不会顶穿领子。

## C05 短夹克工装裤（`jacket`，2026-09-26）：之后的新衣服都走 add_outfit.py

- 源：`v2/outfits/hunyuan-c05-shell.glb`（夹克 + 白衬衫 + 工装裤 + 自带短靴）。
  `S=.7 Z0=0 CRUMB=200 GAP=.002 STRAP_OUT=.006 STRAP_Z=.45 STRAP_X=.3 python3 skin_outfit.py v2/doll-rigged.glb v2/outfits/hunyuan-c05-shell.glb v2/outfits/outfit_c05.glb`
  （全身贴合、间距 2 mm；`STRAP_OUT` 把深色夹克在胸口以上再往外抬 6 mm，衬衫就不会从翻领上透出来。不加 `UNDER`：底衣会把白块顶到夹克外面。）
  `TRIS=8000 TEX=1024 python3 compress_asset.py v2/outfits/outfit_c05.glb v2/web/outfit_c05.glb`（15000 面时 doll.glb 超预算）。
- **进 app 不重跑全量组装**：完整娃娃上已经有手修过的肘骨、袖口、鞋、背带。`add_outfit.py` 直接往成品上加一套：
  `python3 -c "import sys,runpy;sys.argv=['x','--','jacket'];runpy.run_path('add_outfit.py',run_name='__main__')"`
  （改 `v2/doll-full.glb`，写 doll.json / outfits.mjs，再拆出 app 用的文件，见下面「按需加载」。）`assemble_v2.py` 在肘骨之后调用同一个 `add_outfit()`，全量重建不会丢这套。
  - 配色分格：`outfit_slots.py`（从 assemble_v2 抽出来的公共那份）；`trim_lum=.78`（衬衫是米白，达不到 .92）、`sole_z=.075`（鞋跟衬衫一格）。
  - 袖子：原壳的袖子一抬手就撕开，照 C01–C04 换成 `round_sleeves.py` 的圆袖：切掉 |x|>.17（腰以上）/ |x|>.2（手腕边的残片）；夹克取一块纯色贴图（`atlas=(.156,.953,.008,.008)`）；`fit_cuffs.py` 收袖口。
  - `side_lining()`：腋下补一片夹克色的身体侧面复制层（外推 4 mm、绑躯干），抬手时这里不再是洞。
  - 皮肤遮挡：`torsoAbove 0`（长裤到脚）、`coversFeetBelow .12`。
- ⚠️Blender 5（pip `bpy`）里新建颜色属性会让之前拿到的 UV 层失效，`round_sleeves.py` 现在两个都建好再按名字取。
- 验图：`scripts/checks/shared-cloth-browser.cjs` 591 格（默认/最小/最大/改色，十种动作四个方向）。已知：抬手时夹克侧边还有一点细毛边；衬衫在减面后略有棱角。

## C06 小西装短裤（`suit`，2026-09-26）

- 源 `v2/outfits/hunyuan-c06-shell.glb`（黑西装 + 马甲 + 领带 + 白衬衫 + 短裤 + 白袜皮鞋）。
  `S=.69 Z0=0 CRUMB=200 GAP=.002 STRAP_OUT=.006 STRAP_Z=.45 STRAP_X=.3 python3 skin_outfit.py …`，`TRIS=8000` 压缩，`add_outfit.py -- suit`。
- 和夹克同一套：圆袖（西装布料 `atlas=(.031,.859,…)`）、腋下衬里；袖子更长，手腕残片更低（`scrap_z=.25`），切完再删手边的小碎块（<200 顶点、|x|>.14）。
- 配色：`trim_lum=.6`——衬衫背光处只有 .6 左右，阈值高了会被分进西装那一格，改色时衬衫上冒粉斑。

## C07 宽松T恤牛仔裤（`tee`，2026-09-27）

- 源 `v2/outfits/hunyuan-c07-shell.glb`（宽松白 T 恤 + 灰色卷边牛仔中裤 + 白球鞋，自带鞋）。
  `S=.69 Z0=0 CRUMB=200 GAP=.002 STRAP_OUT=.006 STRAP_Z=.45 STRAP_X=.3 python3 skin_outfit.py …`，`TRIS=8000 TEX=1024` 压缩，`add_outfit.py -- tee`。
- 照 Codex 给夹克/西装的那一整套走（她 2026-09-27：「去看看人家 codex 是怎么把衣服修好看的」）：
  - 侧缝：`repair_added_outfits.py` 重建弧形侧面（ADDED-OUTFIT-SEAMS.md）。T 恤没有口袋，跳过口袋保护；宽松款接缝放到 `cut=.11`（.08 会在前胸留两道像背带的竖线），
    侧面补到下摆 `lo=.32`，下面的牛仔布按原贴图颜色保护不删（T 恤下摆盖着裤腰，一条高度线分不开）。
  - 肩线：`smooth_shoulders.py` 名单里加 `tee`，按短袖（和背带裙同一个判据）。
  - 袖子：`fit_cuffs.py` 短袖。切袖 `cut_z=.36, clean=True`（先剖开再删，切口是直线）。
  - 改色：`outfit-dye.mjs` 按原贴图布色分区（白＝T恤、偏蓝灰＝牛仔裤、脚边白＝球鞋），`dye_regions.json` 三个分区名。
- 已知：领口是原模型自带的罗纹，边缘略碎。

## 衣服按需加载（2026-09-26，她定）

- **母版是 `v2/doll-full.glb`**（身体 + 骨架 + 头发 + 全部衣服）。所有迁移脚本（`add_outfit.py`、`fit_cuffs.py`、`restore_*`…）都读写它，不再直接改 app 里的 doll.glb。
- `split_outfits.py` 从母版拆出 app 用的：`apps/fairy-garden/doll.glb`（不带衣服，约 1.4 MB）和 `apps/fairy-garden/outfits/<id>.glb`（每套一件，带同名骨架，0.6–1.1 MB）。`add_outfit.py`、`assemble_v2.py` 最后都会自动拆；手动改了母版就跑一次 `python3 -c "import sys,runpy;sys.argv=['x'];runpy.run_path('split_outfits.py',run_name='__main__')"`。
- 运行时（`traveler.mjs`）：穿哪套才下哪套，全页每套只下一次；下好后按骨头名字接到这个人自己的骨架上，按当前体型重绑。第一套到之前人先不露面，换装途中照旧穿着上一套。`preloadOutfits()` 给验图脚本先把几套下好。
- 预算：底模 + 最大一套 < 3 MiB（`doll-parts.test.mjs` 把拆开的文件拼回一份给其它测试用）。`scripts/checks/outfit-lazy-browser.cjs` 查按需加载本身。

## 新发型：蓬松卷毛（`fluffy`）、中分长发（`longpart`）（2026-09-27）

- 源：`v2/hunyuan-h07-shell.glb`、`v2/hunyuan-h08-shell.glb`（混元头发壳）。
  `INNER=.9 DZ=-.1 python3 fit_shell.py v2/hunyuan-h07-shell.glb v2/head-anchor.json fit.glb`，
  `FRINGE_K=.7 python3 shape_hair.py fit.glb v2/hats/hair_h07.glb`（h08 同参数；刘海收到露眼）；`TRIS=18000 TEX=1024 compress_asset.py` → `v2/web/`。
- 加进母版：先在 `../hairstyles.json` 写名字，再 `python3 -c "import sys,runpy;sys.argv=['x','--','fluffy'];runpy.run_path('add_hair.py',run_name='__main__')"`。
  发型表（id→文件）只在 `add_hair.py` 的 `HAIRS` 一处，`assemble_v2.py` 也用它；运行时名单 `traveler.mjs` 的 `HAIR_STYLES` 要和 hairstyles.json 一致（测试钉着）。
- ⚠️`outfit_slots.grey()` 改完贴图要先存成 WEBP 再 pack：直接 pack 会变 PNG，一款头发从 190KB 胀到 560KB（头发在每次都要下的 doll.glb 里）。
- 头发不按需加载，都在底模里：底模现在 1.76MB，加最大一套衣服 2.83MB，预算 3MiB。**再加两三款就该把头发也拆成按需加载**（照衣服的做法）。

### C07 continuous cotton refinement

`refine_tee.py`, called by `add_outfit.py`, replaces the patched upper shell with a
continuous relaxed cotton surface: lower crew neck, sloping shoulder transition,
subtle drape and turned hem. The existing fitted short sleeves are retained.
Original denim pockets/seams/rolled hems remain; only the concealed waistband is
trimmed and tucked underneath the tee. The shared `restore_source_footwear` in
`restore_suit_footwear.py` also restores C07 sneakers from the original shell,
welding source UV seams before reduction and preserving sole/tongue detail.
The migration is idempotent and exports only the master and tee lazy asset.
Three dye regions and per-outfit reset continue through the shared wardrobe.

Checks: `refined-tee-assets.py` (unrelated meshes/morphs, denim preservation,
64 cotton morph endpoints, idempotence), `outfit-dye-browser.cjs` (all seven
outfits, independent regions/reset), `hand-coverage-browser.cjs` and the
shared pose gallery. C07 source and body/hands are preserved.
