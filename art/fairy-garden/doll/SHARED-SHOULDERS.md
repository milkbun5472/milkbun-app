# 六套服装共用肩线

`smooth_shoulders.py` 把粉色毛衣的斜肩过渡扩展至六套服装，`fit_cuffs.py` 统一调用。
旧的 `smooth_cardigan_shoulders.py` 只是兼容入口，委托同一个实现。

- 学院、卫衣、毛衣、夹克采用相同的连续袖根径向收缩。
- 裙子沿用短袖自己的轴心偏移；西装接入共用袖口后采用同一斜肩曲线，迁移前的旧圆袖仍按原剖面收顺（见 SUIT-CUFFS.md）。
- 只处理轴向 .115 以内的肩头，袖口、手掌、衣身、包、口袋与鞋均不改。
- 保留圆截面、整臂权重和六项体型。`slopedShoulderVersion=1` 阻止重复收缩。

已有母版迁移：

```sh
blender -b --python-exit-code 1 --python art/fairy-garden/doll/smooth_shoulders.py -- before.glb full.glb parts-directory
```

只导出本次改变的 lazy 服装；已完成的粉毛衣直接跳过。
网页 base doll.glb 不变。`all-shoulders-assets.py` 检查其他网格、袖口、贴图、
640 组体型端点与幂等；`all-shoulders-browser.cjs` 覆盖六衣、四体型、六角度、三姿势共432视图。
