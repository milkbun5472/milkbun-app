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

## 2026-11-18 肩顶贴合第二版

`fit_ranger_strap.py::fit_shoulder_arc` 为共同修形函数。旧版肩顶弧段埋入拟合后的袖根；仅269个上部顶点平滑外移/抬升，两端及其余603点固定，保留连续截面、原索引、躯干权重和六形态。原生数据仍有少量动作绑定权重，因此不能只更新GLB；对应ranger动作数据的同序rest/normal也同步，其他绑定字段保持。

已有生产件用`repair_collar_strap.py <source-dir> <output-dir> <ranger.bin.gz>`，需要NumPy；输入SHA有守卫。source目录包含旧garden/ranger.glb、GLTFLoader解码的strap-decoded.json、decodeMotion解码的ranger-motion.json。原件与导出脚本保存在本聊天collar-strap/source；旧模型也可从41235b28c恢复。迁移保留其他压缩网格、贴图和骨架字节，仅肩带使用明确的Float32属性以保顶点顺序；卫衣文件增加72,788字节（约5.7%），没有降纹理或几何精度。禁止整套重新导出后继续沿用旧顶点绑定。

`verify-collar-strap.py`比对非目标网格、贴图、骨架、原索引/颜色/权重、603固定点与64体型端点；`MOTION_COLLAR_STRAP=1`浏览器回归用公共prepare入口，检查两套三体型、四姿态、正侧背与独立改色，像素断言定位本次皮肤片和被挡肩带。旧strap-browser直接加载GLB，不能作为新身体动作的验收依据。
