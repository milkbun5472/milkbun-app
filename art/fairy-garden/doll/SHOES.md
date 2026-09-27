# 三套共用鞋子

`shoes.py` 是 C01 学院乐福鞋、C02 裙装搭扣鞋、C03 户外系带短靴的唯一构建入口。`assemble_v2.py` 调用同一 builder；`repair_garden_shoes.py` 只保留旧裙装修复流程的兼容入口。C04 保留原模型运动鞋。

鞋面、鞋底、沿条、扣件、袜子分别使用单材质蒙皮网格。只有鞋面使用已有的 `boots` 换色槽，其他部件保留配色。所有部件都包含共用六项体型形变，并绑定各自的腿；以构建时左右脚的顶点范围分配权重，不能用 `x > 0`，因为右鞋内侧存在 `x == 0` 的点。

旧脚部隐藏至原模型高度 `.14`，袜口覆盖到 `.145`；鞋底最低点 `-.003` 保持原落地位置。每双鞋全部部件合计约 4 千三角形，三套共 12176 三角形。

资产迁移（不重建衣服）：

```sh
blender -b --python-exit-code 1 --python art/fairy-garden/doll/shoes.py -- before.glb candidate.glb
blender -b --python-exit-code 1 --python scripts/checks/verify-shoes.py -- before.glb candidate.glb report.json
```

浏览器检查：`scripts/checks/shoes-browser.cjs`，支持 `MODEL` 指向候选 GLB、`CLOTH_TEST_URL`、`CLOTH_TEST_OUT` 和 `PLAYWRIGHT_MODULE`。输出三套鞋的正侧背、体型极值、换色、走路、坐姿、滑冰及全身预览。必须实际看图；拓扑测试不能替代外观检查。
