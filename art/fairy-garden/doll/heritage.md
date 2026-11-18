# 复古三件套（heritage）

**最新状态（2026-11-18）：** v89.757已接公共身体材料动作；本轮按Lisa「复古袖子还是太肥」收窄中段，已上线v89.771。原肩头、完整袖口与其余五个网格保留，主布5019点修改／13279点固定。原UV、索引、蒙皮、纹理载荷保持。GLB约2.62→3.29MB；motion约1.225→1.241MB。保编号的Float32通道增量使底模＋最大头发＋本套达4.086MiB，本套下载上限调整到4.1MiB，其他服装仍3.5MiB；未降低纹理或几何精度。下列shoulder-v6为本轮迁移输入，不是新输出SHA。

重建：`repair_heritage_sleeves.py <source> <output>` 调用 `slim_heritage_sleeves.py`，输入需heritage.glb、运行前解码meshes.json及motion.json。证据在本聊天`heritage-sleeves/`；主布rest/normal与六体型同步。完整打包必须用`heritage-sleeves/final/motion.json`的binding替换旧section-guide数据，保留原截面导引与权重。六形态按同侧截面中心位移传递，不能把整项形态当绝对坐标重新收缩：会在极端体型翻面。64端点修改区零翻面、最小面积比约.0622。

2026-11-15 用户确认 shoulder-v6 并要求发版。整套穿戴，六区独立染色；沿用公共衣柜、存档、按需加载和 DollRig。

已定稿的独立资产：`apps/fairy-garden/outfits/heritage.glb`，SHA256 `69456edb2c35ccb7a6d89baa8050d4349702fa0c60046ca785127f352d0f9ac2`，2,619,940 字节，57,602 三角面。六个形体 morph；抬高颈侧低肩线，顺接袖根，袖身宽厚不变，袖口和原鞋保留。源图色彩中和后以纹理保留布纹，`dyeTexture` 防止运行时丢贴图。

`prepared_outfits.json` 为定稿独立服装目录，`dye_regions.py` 同步生成两个应用目录；完整 assemble 也调用它。`split_outfits.py` 保留这些文件，不把它们当作母包里失踪的衣服删除或重导出。更新本套时提交 GLB 与目录一起；不要用旧的 `add_outfit.py` 裁袖流程覆盖。

完整 Blender、拟合/染色脚本、源纹理、各视角和动作检查留在本机：
`/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/hunyuan-c96c8e/shoulder-v6/`
本次从 shoulder-v5/heritage-ready.blend 经 raise-shoulders.py → stabilize.py 修订；最大竖向上提 .02527 模型单位，28 个顶点仅稳定体型插值。64 体型端点重导入无翻面。
最终 Blender 为 `heritage-ready.blend`。原始混元来源 SHA256 `4c9b71998a7c8c526c423a46ee6487dc3bd63f8cb5333906bf2f23375df89d29`。

该定稿服装按需下载约 2.5 MiB；身体+最大发型+本套约 3.41 MiB，首次角色资源上限相应为 3.5 MiB。未压缩或重塑定稿几何来凑旧预算；基础包和已有衣服保持原样。

发布回执：113e22f03be76e498ad8ea7756bdcb8800a0cef0 / fg-aafbc8d2b09d9fb6；80测试过、221线上文件SHA一致；本地Chrome/WebKit各48案例144视图，正式站WebKit同矩阵过，244帧换衣/体型恢复差0。详情与待验收状态只维护在公共复盘。
