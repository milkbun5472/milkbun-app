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
- 背心、衬衫身这类从不伸出躯干侧边的碎片（`|x|` 最大值 < `ARM_X=.2`）不吃手臂权重，否则挥手时背心下摆会被手拽走。
- **C01 学院背心**（衬衫 + 领带 + 针织背心 + 短裤）：`S=.53 SY=1.25 Z0=.19 python3 skin_outfit.py v2/doll-rigged.glb v2/outfits/hunyuan-c01-shell.glb v2/outfits/outfit_c01.glb`。动作图 `c01.png`。已知：侧面走路时袖窿处会露一点点皮肤。
