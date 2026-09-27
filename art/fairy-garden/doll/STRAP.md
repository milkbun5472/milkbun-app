# 卫衣挎包背带

C03 原始资产只画了前面的带子；关闭补色仍没有后背斜带。`restore_ranger_strap.py` 在保留旧网格和贴图的基础上，补闭合的背带续段：从原前带下方绕肩、藏在帽子下、沿背部贴合、绕包侧收进原包。`restore_other_outfits.py` 在全量组装时调用同一入口。

背带绑定 body，包含共用六项体型形态，不跟手臂拉伸。配色用原包的 accent 槽。原卫衣的深色包与前带通过 `textureSlots=ranger` 按实际贴图像素识别；只作用于前侧上衣/包区域，避免混合三角形把配饰误染成衣服主色。

验证：

- `scripts/checks/verify-strap.py before.glb candidate.glb report.json`（Blender `--python-exit-code 1 --python … -- …`）：旧网格/形態/贴图保留，新增带子闭合、body 权重、六形态、幂等。
- `scripts/checks/strap-browser.cjs`：正侧背 × 放手/抬手 × 默认/最小/最大/主色/配饰色，共 30 视图。实际读取前包和后带像素，主色切换像素不变，配饰色切换生效。支持 MODEL、CLOTH_TEST_URL、CLOTH_TEST_OUT、PLAYWRIGHT_MODULE。

原衣服的破面与其他穿插不属于这条背带修复，不能将新增背带的通过结果当作整套衣服无瑕疵。
