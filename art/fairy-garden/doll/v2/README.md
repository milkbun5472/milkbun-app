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
