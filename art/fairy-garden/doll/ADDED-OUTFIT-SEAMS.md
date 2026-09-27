# 新夹克、西装的侧缝

`repair_added_outfits.py` 接在 `add_outfit()` 的袖口适配之后，只处理 C05/C06 的衣身。已有连续袖子、完整手掌及其他服装保持原样。

原生成器按整张三角面裁袖，留下腋下缺口和挂在衣身上的旧袖残片。新流程先按几何连通片保留口袋、翻领等原细节，再精确裁切口袋边界；沿内侧原衣身的前后边界重建弧形侧面，并把新面焊入衣身。侧面在口袋后方内收，避免挡住袋盖；新面使用单独小图集衔接原布料颜色，保留原始贴图。侧面的颜色属性必须写入正确的字节颜色空间及两层颜色属性，否则会漏掉换色。

新顶点使用原六项体型函数和躯干权重。`closedFlankVersion=2` 防止重复执行叠出第二层衣服。

手工重建：

```sh
blender -b --python-exit-code 1 --python art/fairy-garden/doll/repair_added_outfits.py -- source.glb output.glb
```

修复后的 full 母版仍放在 `art/fairy-garden/doll/v2/doll-full.glb`。网页只更新 `outfits/jacket.glb`、`outfits/suit.glb` 两个按需加载文件；不要用 full 母版覆盖不带衣服的 `apps/fairy-garden/doll.glb`。

验证使用 `scripts/checks/new-outfits-assets.py`（修改前母版、修改后母版、报告路径三个参数）和 `new-outfits-browser.cjs`。前者检查其他网格及 morph 的几何保留、原贴图、64 个体型端点和幂等；后者生成 144 个角度/姿态/体型/改色视图，并实际读取侧面像素检查换色。还需目视口袋、领口和接缝，以及运行共享手臂、情绪、按需加载回归。像素检查不等于视觉质量自动通过。
