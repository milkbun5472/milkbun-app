# 卫衣挎包和完整肩带

`ranger_bag.py` 替换从 C03 衣身裁出的旧包、旧前带和只有半截的后带。包体、翻盖、扣子为闭合圆角网格；肩带是一条有厚度的连续带，从包的内侧顶角，经前胸、帽兜下、后背和侧腰，接入包的外侧顶角。全部只绑定躯干，沿用六项体型形态。

旧衣身仍含源肩带的浮雕和纹理，因此先在它的空间范围内压平旧凸起、清理专属衣面图集；不重建领口、帽兜、抽绳和袖子。裤腰上的旧包底残片裁除后，只补包后方局部开口。新包与带使用独立皮革材质和配饰染色槽；扣子保留金属色。`cleanBagVersion=1` 防止重复迁移。

共享组装在 `restore_other_outfits.py` 中按旧衣面修复、连续袖形、包与完整肩带的顺序调用。已有模型可单独迁移：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/fairy-garden/doll/ranger_bag.py -- /tmp/before.glb /tmp/repaired.glb
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python scripts/checks/verify-ranger-bag.py -- /tmp/before.glb /tmp/repaired.glb /tmp/bag-report.json
```

验证包括非目标网格及六形态保留、仅卫衣图集变化、四个部件闭合、躯干权重、64 组体型端点下两端接合、重复组装不变。`strap-browser.cjs` 用真实 traveler 渲染默认/最小/最大/衣服改色/配饰改色，站立/抬手/坐下、六方向，共 90 视图；图必须实际查看。还要跑 `shared-arm-rig-browser.cjs` 的小世界和陪伴真实入口。

本次只修挎包、肩带及其残留；原裤腰、源衣面和其他衣服的既有瑕疵不等于全部解决。
