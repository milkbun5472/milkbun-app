# 双人卧铺 · Blender 第一稿

双人列车内景美术源。两张上下卧铺、梯子、大幅全景窗、亚麻窗帘、面对面墨绿软座、留空拼图桌、桌下收纳抽屉、行李架和相机小托台。家具比例以庭院约 1.4 米的小旅人为参考；真实坐姿/上下床动作适配尚未做。

- `carriage.blend`：完整可编辑源，部件命名，保留倒角/织物厚度修改器、材质与渲染相机。默认剖面视图，车顶/前墙/右端墙在视口和渲染中隐藏，勾选集合内物体可恢复。
- `carriage.glb`：包含完整壳体的静态模型，glTF Y 向上；约 2.2 MB、6.4 万三角形。不含摄影/拼图/角色行为。
- `preview.html`：独立 Three.js 预览；拖动、双指/滚轮/滑杆缩放、四个视角、外壳开合、暖灯夜色。使用仓库现有 vendor，无外部 CDN。
- `overview.png` / `table.png` / `berths.png`：直接由上述 Blender 几何渲染，无生成图片替代模型；复建时生成，图片不入 Git。
- `asset-validation.json` / `browser-validation.json`：几何计数、当前 GLB 哈希、浏览器验证记录。

## 复建

在仓库根执行（本机 Blender 5.2.2）：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/train-carriage/build.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/train-carriage/verify_saved.py
python3 -m http.server 18924 --bind 127.0.0.1
# 另一终端，已装 playwright 时：
node art/train-carriage/check-preview.cjs
```

`build.py -- --no-render` 可跳过三张渲染。输出仅写本目录；不读取或覆盖庭院人物/场景资产。材质噪声用于 Blender 近景织物质感；GLB 采用基础 PBR 颜色/粗糙度，未烘焙程序噪声，所以网页会比 Cycles 渲染更平滑。

## 后续接入约定

Blender 源 Z 向上；GLB 导出自动转为 Y 向上。所有坐标表 `anchors_blender_z_up` 是源坐标，不可直接作为 Three 坐标（转换 x,y,z → x,z,-y）。运行时优先读 GLB 的 `anchor_*` 节点世界坐标。

分组通过节点 extras `carriageGroup` 标记，包含 `Interior`、`Roof`、`ShellFront`、`ShellEnd`、`WindowGlass`。仅预览隐藏后三个实心外壳组；不从 GLB 删除。7 个 anchor 供未来座位、床、进门、拍照及拼图定位。左座朝 +X，右座朝 -X。桌面可用 1.44 × 1.31 米，桌面 anchor 在表面上方。

范围：一节静态车厢内景，不是含车头/车轮的完整列车；门、梯子、抽屉目前均无行为。还没有窗外景片、人物入座、摄影、拼图、聊天或庭院车站入口。未改应用版本与现役庭院。手机窄屏已浏览器检查，实体 iPhone GPU 尚未验证；模型仍保留约 250 个独立几何部件，游戏集成前应按静态材质批次合并，保留将来需要动作的部件。
