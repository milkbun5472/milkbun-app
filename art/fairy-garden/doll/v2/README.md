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
