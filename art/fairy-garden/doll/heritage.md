# 复古三件套（heritage）

2026-11-15 用户确认 shoulder-v6 并要求发版。整套穿戴，六区独立染色；沿用公共衣柜、存档、按需加载和 DollRig。

已定稿的独立资产：`apps/fairy-garden/outfits/heritage.glb`，SHA256 `69456edb2c35ccb7a6d89baa8050d4349702fa0c60046ca785127f352d0f9ac2`，2,619,940 字节，57,602 三角面。六个形体 morph；抬高颈侧低肩线，顺接袖根，袖身宽厚不变，袖口和原鞋保留。源图色彩中和后以纹理保留布纹，`dyeTexture` 防止运行时丢贴图。

`prepared_outfits.json` 为定稿独立服装目录，`dye_regions.py` 同步生成两个应用目录；完整 assemble 也调用它。`split_outfits.py` 保留这些文件，不把它们当作母包里失踪的衣服删除或重导出。更新本套时提交 GLB 与目录一起；不要用旧的 `add_outfit.py` 裁袖流程覆盖。

完整 Blender、拟合/染色脚本、源纹理、各视角和动作检查留在本机：
`/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/hunyuan-c96c8e/shoulder-v6/`
本次从 shoulder-v5/heritage-ready.blend 经 raise-shoulders.py → stabilize.py 修订；最大竖向上提 .02527 模型单位，28 个顶点仅稳定体型插值。64 体型端点重导入无翻面。
最终 Blender 为 `heritage-ready.blend`。原始混元来源 SHA256 `4c9b71998a7c8c526c423a46ee6487dc3bd63f8cb5333906bf2f23375df89d29`。

该定稿服装按需下载约 2.5 MiB；身体+最大发型+本套约 3.41 MiB，首次角色资源上限相应为 3.5 MiB。未压缩或重塑定稿几何来凑旧预算；基础包和已有衣服保持原样。
