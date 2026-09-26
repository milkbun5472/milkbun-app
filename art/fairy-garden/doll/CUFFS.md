# 共用手腕、袖口与卫衣衣面

`fit_cuffs.py` v2 让四套衣服适配原手臂：保留原手掌、拇指、手腕与全部体型形态，袖口按左右源手臂的实际偏心位置平滑移动、扩大内径。v1 收缩腕部会拉坏掌根，已废弃；不能为了袖口截面检查通过而压缩皮肤。短袖和长袖的遮挡面仍藏在袖内。整臂抬起和握点不变。

`clean_hoodie.py` 从 C03 适配前源壳恢复领口、帽兜与抽绳。移除粘在衣身上的旧袖面，以圆滑衣面补齐腋下至下摆，合并重叠表面后烘焙一张 1024 JPEG。侧面清理原袖子留下的阴影，前领与口袋保留源细节。原工装裤、前包/前带另存为保留部件，沿用原贴图与形态；后带、鞋和其他衣服不重做。

构建函数都从 `restore_other_outfits.py` 的全量组装末尾调用；未经过旧腕部改形的模型可直接构建；迁移 v1 已发布模型时，先取回 v74.140 未改形的完整身体，再保留当前服装并适配袖口：

```sh
git show af915a63:apps/fairy-garden/doll.glb > /tmp/original-hands.glb
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/fairy-garden/doll/fit_cuffs.py -- apps/fairy-garden/doll.glb /tmp/original-hands.glb /tmp/fitted-cuffs.glb
```

检查：

- `scripts/checks/verify-cuffs.py`（Blender）：基线为 v74.140，包括手部在内的完整原身体/六形态、非目标网格、原贴图、形态默认值、袖内遮挡面与皮肤的实际截面、重复执行不改变资产。
- `scripts/checks/shared-cloth-browser.cjs`：四套衣服、大小体型、十种动作与四方向，以及每套默认/极值/改色近景，共 591 视图。支持 `MODEL` 指定候选模型。
- `scripts/checks/strap-browser.cjs`：前包、后带在主色变化时保持原色，配饰色变化时响应。
- `scripts/checks/shared-arm-rig-browser.cjs`：动作握点、实例隔离与陪伴/小世界真实入口。

图库必须实际看图。截面/绑定通过不代表所有衣服的原始破面、裤脚、极值动作穿插已修好；本批针对共用手腕和卫衣领口/侧面。
