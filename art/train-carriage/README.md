# 双人卧铺 · Blender 第一稿

双人列车内景美术源。两张上下卧铺、梯子、大幅全景窗、亚麻窗帘、面对面墨绿软座、留空拼图桌、桌下收纳抽屉、行李架和相机小托台。家具比例以庭院约 1.4 米的小旅人为参考；真实坐姿/上下床动作适配尚未做。

- `carriage.blend`：完整可编辑源，部件命名，保留倒角/织物厚度修改器、材质与渲染相机。默认剖面视图，车顶/前墙/右端墙在视口和渲染中隐藏，勾选集合内物体可恢复。
- `carriage.glb`：包含完整壳体的静态模型，glTF Y 向上；约 2.2 MB、6.4 万三角形。不含摄影/拼图/角色行为。
- `preview.html`：独立 Three.js 预览；拖动、双指/滚轮/滑杆缩放、五个视角、外壳开合、窗景与昼夜灯光。使用仓库现有 vendor，无外部 CDN。
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

范围：一节静态车厢内景，不是含车头/车轮的完整列车；门、梯子、抽屉目前均无行为。已加窗外景片；还没有人物入座、摄影、拼图、聊天或庭院车站入口。未改应用版本与现役庭院。手机窄屏已浏览器检查，实体 iPhone GPU 尚未验证；模型仍保留约 250 个独立几何部件，游戏集成前应按静态材质批次合并，保留将来需要动作的部件。


## 窗外叠层（2026-09-24）

`scenery.mjs` 提供 `createWindowScenery(scene)`，不修改 Blender 源和 GLB。三条线：林间山谷、海岸灯塔、田野村落。五种天气：晴、阴、雨、雪、雾。时间滑杆 0–24 小时，连续插值天空/山色/车内照明；昼夜流转勾选后，240 秒演示一整天。默认手动时间，窗景自动行进；系统 reduced-motion 默认暂停。暂停冻结行程、天气和自动时间，主动改控件仍可预览。

5 张有透明背景的缓存景片（远山/山谷/中景/林岸/近景）以 .7 / 2.3 / 7 / 18 / 48 的相对速度循环，天空、日月星光、云、雾、雨线、玻璃水滴、雪粒叠加。所有路线用确定种子绘制，不下载外部图片。片边地形使用周期曲线；树和栅栏跨边时补到另一侧。

景片合成到一张 CanvasTexture，固定在后窗玻璃外侧，圆角透明裁切、单面显示、受车体深度遮挡；雨雪不会成为盖住整页的屏幕特效。此方案是 2D 分层视差窗景，尚非可进入的 3D 地图，也不随相机绕行生成侧向新景物。新增一个平面（2 三角形）、一张 GPU 纹理；移动设备初次加载 960×480，桌面 1440×720，CPU 景片缓存共 5 张 1600×600。24/20fps 上限；页面隐藏不推进，返回时不追补离开时间。GLB 保持 e87085ce 开头的原件。

实例 API：`set({route, weather, hour, playing, autoTime, speed})`、`step(dt)`、`lighting()`、`dispose()`；`state`/`layers` 供预览和验证读取。时间、天气、灯光共用同一实例状态。未接真实时钟、天气服务、聊天、存档或自动旅程路线切换。

验证：`check-scenery.cjs` 实际浏览器检查 60 组合、图像差异、远近移动速比、暂停/继续、午夜回绕、夜雨亮度、场景对象不增长、透明角、reduced-motion、390×844 和 844×390 布局；证据 `scenery-validation.json`。`check-preview.cjs` 保留模型/四旧视角回归并增加窗景视角。截图保存在 `/Users/lisa/.codex/visualizations/2026/09/24/train-scenery/`，不入 Git。
