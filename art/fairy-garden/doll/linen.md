# 卷袖衬衫

**最新施工状态（2026-11-18，尚未发布）：** v89.783 的扁袖被 Lisa 否定。本轮保留完整裸体动作，把卷袖绑定到最终裸臂表面；肩头另绑定实际身体三角面，顺接袖根。旧 raised-v5 裁切补面和整圈刚性方案仍弃用。正式 GLB sleeve-v4 不换，当前只修改 linen 动作元数据及公共接入。下述早期验收不能替代当前实图复看。

当前制作：`motion/prepare_linen_envelope.py`（NumPy/SciPy/libigl）读取本聊天 `sleeve-volume/source/report.json` 与 `cap-clean-mask.json`，生成 `motion/linen-envelope.json.gz`。输入身体/模型 SHA 锁定；`attach_linen_envelope.py` 仅追加元数据并保留原绑定载荷，重复运行字节一致；`pack_motion.py` 自动接入。原模型或身体更新必须重新制作、验证，不能忽略 SHA 锁。

运行时按最终裸臂的材料坐标铺袖管，肩根使用实际身体表面坐标并局部松弛，范围限轴向 .075 内；袖身与卷边共用同一条身体路径。袖口原内封片移除 1085 面，原归腰带的 97 个袖口补片顶点改归上衣颜色，边界与主袖共点，UV/骨架/形变属性不改。身体、两份原解算矩阵及其他衣服动作数据未改。

回归入口：`scripts/checks/avatar-sleeve-envelope-browser.cjs` 使用真实单面材质、完整裸臂遮挡和八方向包覆；`avatar-sleeve-envelope-transitions.cjs` 保裸体/裤鞋并检查连续动作。旧 `avatar-rolled-sleeve-browser.cjs` 只保护旧刚性卷边，不适用于新包覆验收。本地证据同聊天 `sleeve-volume/`，发布状态和已知不足以公共复盘最新条目为准。

独立整套衣服 `linen`，通过 `prepared_outfits.json` 与 `dye_regions.py` 注册到公共衣柜。
发布模型 `apps/fairy-garden/outfits/linen.glb` 为袖口校正 sleeve-v4：2037224 字节，50170 三角面，SHA256 `97cb5bc02b43b5697499e27c31eb0f84ea76f130394f179889c742bea3f67dde`。

原始输入 `/Users/lisa/Downloads/ef998bafeb99b6ce7a9fa19ddd8293a8.glb`。
本机制作与核验目录 `/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/hunyuan-ef998b/sleeve-v4/`，源文件 `linen-ready.blend`，制作步骤见该目录 README.md、align-sleeves.py、stabilize.py，压缩见 compressed/pack-morphs.py。

继承 collar-v2 降领与 shoulder-v3 顺肩成果，袖口按两侧实际手臂截面校正中心与方向；保留六个体型 morph、现役骨架与六区纹理染色。身体、动作和用户体型均未改动。使用 WebP 贴图与标准 SHORT morph 量化，非无损压缩。完整环复测袖口法线偏差 0.64°/0.10°，中心偏差 0.00177/0.00043。额外中心补偿为零。

压缩产物已核验 64 个体型端点零翻面；Chrome/WebKit 下六区换色、92% 肩宽及默认/极端体型、走坐抬手正侧通过。继承两处极小近零面积三角面；未作全身碰撞穷举或实体 iPhone 测试。正式衣柜选择、切换、刷新保存与重置结果见 release/ui-report.json。
