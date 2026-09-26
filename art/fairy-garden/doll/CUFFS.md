# 共用手腕、袖口与卫衣衣面

`fit_cuffs.py` 统一适配四套衣服：原手臂在袖口处比圆袖宽，遮皮肤的轴线和圆袖的轴线也不同。现在沿圆袖的真实轴线收顺腕部，保留掌端与握点，袖口增加少量内径；遮挡边界藏进袖内。短袖和长袖各自取真实末端的内侧位置，不再用水平高度截断手腕。六项体型形态、上下臂权重沿用共用模型。

`clean_hoodie.py` 从 C03 适配前源壳恢复领口、帽兜与抽绳。移除粘在衣身上的旧袖面，以圆滑衣面补齐腋下至下摆，合并重叠表面后烘焙一张 1024 JPEG。侧面清理原袖子留下的阴影，前领与口袋保留源细节。原工装裤、前包/前带另存为保留部件，沿用原贴图与形态；后带、鞋和其他衣服不重做。

两个构建函数都从 `restore_other_outfits.py` 的全量组装末尾调用；单独更新现有模型：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/fairy-garden/doll/clean_hoodie.py -- before.glb candidate.glb
```

检查：

- `scripts/checks/verify-cuffs.py`（Blender）：非目标网格、原贴图、形态默认值、袖内遮挡面与皮肤的实际截面、重复执行不改变资产。
- `scripts/checks/shared-cloth-browser.cjs`：四套衣服、大小体型、十种动作与四方向，以及每套默认/极值/改色近景，共 591 视图。支持 `MODEL` 指定候选模型。
- `scripts/checks/strap-browser.cjs`：前包、后带在主色变化时保持原色，配饰色变化时响应。
- `scripts/checks/shared-arm-rig-browser.cjs`：动作握点、实例隔离与陪伴/小世界真实入口。

图库必须实际看图。截面/绑定通过不代表所有衣服的原始破面、裤脚、极值动作穿插已修好；本批针对共用手腕和卫衣领口/侧面。
