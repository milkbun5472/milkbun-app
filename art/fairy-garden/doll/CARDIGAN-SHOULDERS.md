# 粉色毛衣肩线

`smooth_cardigan_shoulders.py` 在 `fit_cuffs.py` 的连续袖形之后运行。
原袖根在轴向 0–0.065 的短距离内鼓起；本次只收这段径向轮廓，
缓慢过渡到轴向 0.115 处的原袖形。袖口、手掌、衣身、领口和包不改。
保持每圈圆截面、原整臂绑定和六项体型，不额外加肩垫或覆盖色块。
`slopedShoulderVersion=1` 防止重复收缩。

已有资产迁移（Blender）：

```sh
blender -b --python-exit-code 1 --python art/fairy-garden/doll/smooth_cardigan_shoulders.py -- before.glb full.glb cardigan.glb
```

母版保存 full，网页只替换 lazy cardigan；不要把母版覆盖到网页 base doll.glb。
`scripts/checks/cardigan-shoulder-assets.py` 校验其他网格/体型、全部贴图、
袖口、128 组袖子体型端点及幂等；`cardigan-shoulder-browser.cjs` 渲染
默认、96% 肩宽、最小/最大体型的正侧背和抬手/坐姿，共 72 视图。

## 抬手侧片迁移（2026-11-18）

旧主衣身裁掉融合袖子后留下平封口及前腋深折，抬手会显出硬片。
`fair_cardigan_armholes.py` 是唯一离线修形算法；`repair_cardigan_armholes.py`
同步迁移已发布 GLB 和 motion 数据，不重导整套模型、不改变编号。
`armholeSurfaceVersion=2` 代表这一步已做。只应用85%的平滑位移，防止细小面在强平滑后压成零面积。

```sh
python art/fairy-garden/doll/repair_cardigan_armholes.py "$CARDIGAN_SOURCE_DIR" "$CARDIGAN_CANDIDATE_DIR"
python scripts/checks/verify-cardigan-armholes.py "$CARDIGAN_SOURCE_DIR" "$CARDIGAN_CANDIDATE_DIR" /tmp/cardigan-preservation.json
node --test test/cardigan-armholes.test.mjs
```

输入目录包含原cardigan.glb、GLTFLoader解码的meshes.json、按UV取样的sRGB texels.json及解码motion.json。
基准GLB SHA256为`0fd13d2396b12643a044b8692ac5f99a1b33dfa18b5e5a8cb137ef9a7d29bfbd`。
模型自己的六形态键以GLB targets为准；运行时另加的坐姿形态不能混进源资产校验。
最终1959点改变，8400点及另四网格不动；原Draco索引、UV、颜色、权重和贴图字节保留。
只以Float32独立存储修过的position/normal，原精度形态键同步；GLB约1.01→1.34MB。

证据：本聊天cardigan-slices/source、candidate、preservation.json、final-chrome、final-webkit。
重建母版须在旧fit_cloth_sides和袖形步骤之后应用这一修形，再绑定动作。
全套重打包须从candidate/motion.json提取binding写为wardrobe-fair-bind-cardigan.json.gz；
不能用旧绑定覆盖新曲面。完整母版在本工作区缺失，因此本次只验证发布GLB迁移链。
运行时不追加修补；经验与已知边界见施工规则/model-outfit-review.md。
