# 共用衣柜分区配色

2026-09-27：修复六套衣服换色串到裤脚、鞋、包，以及通用控件名称与实际区域不符的问题。庭院、陪伴、列车使用同一套 `traveler.mjs`、衣柜数据及 `DressControls`。

- `dye_regions.json` 是控件名和新增默认值的唯一来源；`dye_regions.py` 同步 `doll.json` / `outfits.mjs`，组装和新增衣服也调用它。
- `outfit-dye.mjs` 在未变形坐标与原贴图中判定分区。UV 连通片的范围区分重叠的外套下摆和裤子，避免一条高度线把口袋、衣摆涂成裤色。原贴图亮度、褶皱、徽章和口袋细节保留；选色不再被原贴图的色相污染。
- 学院装：背心与徽章、衬衫与衣领、短裤、领带、袜子、鞋。裙装：裙身/包/肩带、衬衫与衣领、蝴蝶结、小熊脸部、袜子、鞋。卫衣：卫衣、工装裤、包与肩带、鞋。毛衣：毛衣、长裤、包与肩带、鞋。夹克：夹克、内搭、工装裤、鞋。西装：外套、衬衫、短裤、领带、袜子、皮鞋。
- 衣柜按钮“恢复本套默认配色”通过既有 `pushLook → mergeLook` 写入完整默认调色板；保留其他衣服、肤色、发色、眼睛与体型。旧鞋色仍从原 trim/bottom 槽继承，直到明确设置新鞋色；不批量改旧存档。
- 毛衣鞋从 C04 原件重建：先焊接 UV 接缝再减面、平面切上边界，保留纹理；直接求共用体型变形场，避免邻近点插值造成折面。`sourceFootwearVersion=2`。卫衣鞋口在裤腿内连续收进，鞋底和鞋头保留，`insetBootVersion=1`。长裤遮挡下方身体，鞋扣随鞋色。
- 不改变原手、整臂抬手、袖子、肩线和其他服装网格。源模型原有几何纹理细节仍保留；分区不是重新生成所有衣服。

验证入口：`test/outfit-dye-controls.test.js`、`scripts/checks/outfit-dye-browser.cjs`（实际 WebGL 单区换色、相邻区不变、复位像素一致）、`scripts/checks/outfit-dye-assets.py`（无关网格/贴图保全、极端体型、幂等）；另跑共用动作与衣柜回归。

## Edge follow-up (2026-09-27)

- Retained ranger trousers contain the original ribbed hoodie hem: classify its UV islands as cloth. `clean_ranger_edges.py` trims the overlapping top and ragged underside at the boot opening, preserving the rolled cuff, original UVs and interpolated morph layers. The migration is idempotent and called by `clean_hoodie`.
- Garden bear ownership includes both ears and the recessed face edges, using whole source islands instead of a front-depth/brightness cutoff. The control is now 小熊装饰.
- Cardigan pouch shadows keep the bag dye; below-hem trouser shadows no longer inherit sweater colour. Jacket shirt/collar panels keep their trim dye through shaded texels.
- Long-trouser skin coverage excludes arm-weighted vertices in colour, depth and distance passes. The old rest-height cutoff removed fingertips, visible as dark holes after raising the arms. Original hand geometry is unchanged.
- `outfit-dye-browser.cjs` checks 30 slots, resets and boundary probes; old shader fails at the left bear ear. `hand-coverage-browser.cjs` compares fingertip pixels with/without lower-body coverage in 81 outfit/pose/angle/body combinations; old shader differs by 147, fixed shader by 0. `cloth-edge-assets.py` checks unchanged meshes/textures and all 64 morph endpoints against the original fold inversion area.
