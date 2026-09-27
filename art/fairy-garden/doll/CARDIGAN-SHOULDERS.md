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
