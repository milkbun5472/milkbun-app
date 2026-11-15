# 卷袖衬衫

独立整套衣服 `linen`，通过 `prepared_outfits.json` 与 `dye_regions.py` 注册到公共衣柜。
发布模型 `apps/fairy-garden/outfits/linen.glb` 为袖口校正 sleeve-v4：2037224 字节，50170 三角面，SHA256 `97cb5bc02b43b5697499e27c31eb0f84ea76f130394f179889c742bea3f67dde`。

原始输入 `/Users/lisa/Downloads/ef998bafeb99b6ce7a9fa19ddd8293a8.glb`。
本机制作与核验目录 `/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/hunyuan-ef998b/sleeve-v4/`，源文件 `linen-ready.blend`，制作步骤见该目录 README.md、align-sleeves.py、stabilize.py，压缩见 compressed/pack-morphs.py。

继承 collar-v2 降领与 shoulder-v3 顺肩成果，袖口按两侧实际手臂截面校正中心与方向；保留六个体型 morph、现役骨架与六区纹理染色。身体、动作和用户体型均未改动。使用 WebP 贴图与标准 SHORT morph 量化，非无损压缩。完整环复测袖口法线偏差 0.64°/0.10°，中心偏差 0.00177/0.00043。额外中心补偿为零。

压缩产物已核验 64 个体型端点零翻面；Chrome/WebKit 下六区换色、92% 肩宽及默认/极端体型、走坐抬手正侧通过。继承两处极小近零面积三角面；未作全身碰撞穷举或实体 iPhone 测试。正式衣柜选择、切换、刷新保存与重置结果见 release/ui-report.json。
