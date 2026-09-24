# 原 GLB 基础小人

2026-09-23，Lisa 否定独立重建稿的方脸，明确改为复用原 GLB 可用数据。本目录取代 `reference-study` 作为后续换装工作的基础；旧稿保留历史，不再把它当作造型目标。

`source-traveler.blend` 直接导入 `../clay-reference.glb`，完整保留原网格、原材质、UV、法线和三张 4096×4096 贴图，已全部打包。原件 33,634 顶点、50,010 三角面；只通过父级统一缩放显示身高至 1.707，没有压扁、重塑头脸、切割或重采样。摄影灯和相机为新增预览设施。它是原件保全基础文件，不是重新建模成果。

`preservation.json` 记录原 GLB 的 SHA256、导入后各项数据指纹，并在保存后重新打开 `.blend` 核对顶点坐标、面索引、法线、UV 和打包图像一致。原文件 SHA256 为 `b2fe2232ecb845d98036f8c6c03f5ccae68d76d4d2815b3c01b8c04b01952848`。

生成与验证：

```sh
SOURCE_BASE_OUT=/tmp/garden-source-base /Applications/Blender.app/Contents/MacOS/Blender -b --python art/fairy-garden/source-base/build.py
```

输出为 `.blend`、保全校验 JSON 和正面、四分之三、侧面、背面四张真实 Blender 渲染。渲染光照与例图不同，不宣称与例图像素一致。

目前仍为原件的单网格，尚未重新拆分可换发型/服装、添加体型形态键或动作绑定；没有替换运行时 `doll.glb`，没有发布应用版本。后续拆分须从此保全副本派生，并保持圆脸、后脑体积和贴图连续，不能用粗糙颜色分类删除面后重造脸。
