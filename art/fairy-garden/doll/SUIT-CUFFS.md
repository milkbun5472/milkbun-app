# 西装袖口与原手腕

西装以前只经过 `round_sleeves` 和肩线修整，未进入 `fit_cuffs` 的五套名单，窄袖口仍位于旧轴心，遮挡边界也未同步。现在六套都走同一个连续袖型适配，保留原手掌，袖子整体绑定手臂。

- 西装使用原布料图集、主色槽和材质；读取导入的颜色属性时跳过全白显示层，取真正的染色槽。
- 袖口沿原手腕中心偏移，外沿到轴向 .214，内壁回到 .196；皮肤遮挡从 .198 开始，与袖内壁重叠。
- `smooth_shoulders` 对已适配西装使用共用斜肩；旧西装迁移前仍可识别原袖型。`fittedCuffVersion=3` 保证重复构建不改现有袖子。
- 母版只改变西装两袖及袖子覆盖参数，网页只替换 lazy suit；身体、其他五套、衣身口袋和已修复鞋保持不变。

验证：`scripts/checks/suit-cuffs-assets.py -- before.glb after.glb report.json` 在 Blender 下检查手腕截面完整包在袖口内、连续袖径、其他网格与全部形态、原贴图、128体型端点及幂等。浏览器使用 `all-shoulders-browser.cjs`，共用动作使用 `shared-arm-rig-browser.cjs`。
