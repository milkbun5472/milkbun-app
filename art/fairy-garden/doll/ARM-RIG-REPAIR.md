# 共用手臂修复（2026-09-26）

陪伴、小世界和列车继续使用同一份 `apps/fairy-garden/doll.glb` 与 `traveler.mjs`。

- `add_elbows.py` 在两根上臂下增加前臂骨骼；按沿手臂的位置平滑分配权重。先恢复袖子区域中误绑躯干的小碎片权重，再分配肘关节。脸、发型、衣服造型、贴图与六项体型形态键保留。
- `assemble_v2.py` 导出前调用同一个 `add_elbows()`，以后重新组装也保留修复。也可以用 Blender 单独迁移旧的成品 GLB：`Blender --background --python add_elbows.py -- 旧模型.glb 新模型.glb`。不要对已有肘关节的模型重复运行。
- 共用动作把抬手分配给肩和肘，并平滑衔接；喝茶和拥抱的向内转动仍保留。握点挂在实际骨骼上，取握点前同步当前帧，避免道具跟着未受约束的旧枢轴飘走。
- 两个入口的宿主、模型和模块由 `build-fairy-garden.mjs` 一起生成指纹。发版仍需 `bump-version.mjs`。

验证：`scripts/checks/shared-arm-rig-browser.cjs` 使用真实 Draco 模型，覆盖 4 套衣服 × 5 款头发 × 5 个体型组合 × 10 种动作 × 5 个进度；检查握点、道具、实例隔离、头部中央碰撞和动作收回连续性，并实际进入陪伴与小世界。头部采样不代表完整布料/头发物理碰撞；正面和侧面另做截图检查。静止及形态键对照用 `scripts/checks/verify-arm-asset.py`。

这次修复肩肘运动与袖片随动，不是重做服装拓扑。源模型领边、袖口的碎边仍存在，长发也没有布料物理模拟。
