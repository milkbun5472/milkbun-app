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

5 张有透明背景的缓存景片（远山/山谷/中景/林岸/近景）以 7 / 24 / 68 / 170 / 390 像素/行程秒循环，天空、日月星光、云、雾、雨线、玻璃水滴、雪粒叠加。所有路线用确定种子绘制，不下载外部图片。片边地形使用周期曲线；树和栅栏跨边时补到另一侧。

景片合成到一张 CanvasTexture，固定在后窗玻璃外侧，圆角透明裁切、单面显示、受车体深度遮挡；雨雪不会成为盖住整页的屏幕特效。此方案是 2D 分层视差窗景，尚非可进入的 3D 地图，也不随相机绕行生成侧向新景物。新增一个平面（2 三角形）、一张 GPU 纹理；移动设备初次加载 960×480，桌面 1440×720，CPU 景片缓存共 5 张 1600×600。30fps 上限；页面隐藏不推进，返回时不追补离开时间。GLB 保持 e87085ce 开头的原件。

实例 API：`set({route, season, weather, hour, playing, autoTime, speed})`、`step(dt)`、`lighting()`、`dispose()`；`state`/`layers` 供预览和验证读取。时间、天气、灯光共用同一实例状态。未接真实时钟、天气服务、聊天、存档或自动旅程路线切换。

验证：`check-scenery.cjs` 实际浏览器检查 240 组合、图像差异、远近移动速比、暂停/继续、午夜回绕、夜雨亮度、场景对象不增长、透明角、reduced-motion、390×844 和 844×390 布局；证据 `scenery-validation.json`。`check-preview.cjs` 保留模型/四旧视角回归并增加窗景视角。截图保存在 `/Users/lisa/.codex/visualizations/2026/09/24/train-scenery/`，不入 Git。


### 四季

`season` 可选 spring / summer / autumn / winter，默认春天，独立于天气和时刻。春天新绿、花树、路边花点、晴阴天飘花瓣；夏天浓绿和草穗；秋天金棕树色、落叶地面及晴阴天飘叶；冬天落叶树露枝、地面积雪、常绿树枝与村屋屋顶覆雪。冬季晴天保持积雪，其他季节选择飘雪也会展示临时雪景；这里是预览切换，不模拟积雪融化。季节调整植被颜色和绘制形状，沿用同一组景片缓存/同一张纹理，不新增模型或画布。日长仍沿用共用昼夜曲线，未模拟地理纬度和季节日出日落。

四季 × 三路线 × 五天气 × 四时刻 = 240 组实际渲染逐项检查，240 个不同图像签名；四季晴天对照图在截图目录 `season-{spring,summer,autumn,winter}.png`。手机季节控件、竖屏与横屏检查通过。


### 沿途段落与速度（2026-09-24）

Lisa反馈窗景太慢、单调后，加入 `journey.mjs`：每条线路是按行进距离推进的 120 秒演示环（1倍速），7 个沿途段落，间隔保留开阔路段。林线为道口/村落/木桥/松林站/隧道/湖面/会车；海线为港口/海镇/高架桥/海风站/海岬隧道/海湾/会车；田野为道口/风车/村落/麦田站/铁桥/河岸牧场/会车。包含等候车辆、站台人影/行李/猫、晾衣与炊烟、风车转动、船、羊群、飞鸟、电线杆、迎面列车。均为窗内2D绘制，未新增3D模型，也不是可下车互动的小站。

近景从48提升至390像素/行程秒（约8.1倍），远山仍显著慢于近处。车速控件0.5–2倍；暂停冻结行程和环境动画。`下一段`跳到下一段35%处，暂停也可看；末段跳到下一圈首段。默认视角改为看窗外，原四视角保留。靠近村落/小站/湖岸时前排树木渐渐让开，桥梁有快速移动的梁架，隧道入口/出口平滑明暗过渡并联动车内灯光。手动四季/天气/时间保持独立；不会离开页面后补跑旅程。

新增公开预览接口：`scenery.journey`、`scenery.nextStop()`、`scenery.seekJourney(distance)`（确定性回放和截图）；既有`state.distance`仍为统一行程轴。`journey.test.mjs`验证段落顺序/回绕/跳转可见度/隧道渐变，`check-journey.cjs`验证三线21段实际图像、灯光进入与恢复、倍速/暂停跳段、对象数稳定及390px控制可达性。证据 `journey-validation.json`；截图 `/Users/lisa/.codex/visualizations/2026/09/24/train-journey/`。240组合和原模型预览也回归。此版仍为两分钟固定演示环，未实现长途路线存档、音效、摄影或互动事件。
