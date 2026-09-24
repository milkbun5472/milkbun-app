# 图片参考重建的小旅人

2026-09-23 按 Lisa 要求在 Blender 中从零生成。没有导入旧 GLB、扫描脸片或旧头发网格。

- `clay-doll.blend`：含 12 款发型、6 套衣服、6 维体型与坐姿形态键，运行时按名字选择显示。
- 几何源：`../../fresh_doll.py`、`../../sculpt_clothes.py`。
- 导出入口：`../../export_traveler.py`；调用 Blender 后输出 `apps/fairy-garden/doll.glb`。
- 材质和变形接口保留既有存档约定；原参考 GLB 仅归档，不参与构建。

这是按图片重建的程序化陶土造型，不是原图逐点复刻。
