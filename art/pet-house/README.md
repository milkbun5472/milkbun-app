# 宠物小屋 · 场景第一稿

一个独立的3D美术场景预览，未接入秋秋机的养宠玩法或角色存档。猫有18根控制骨骼：点「走走」沿地毯缓慢散步，「停一停」减速并落稳抬起的脚。四拍步态、腿部IK、世界坐标落脚和爪子方向锁定配合身体/头/尾的小幅运动；当前路线是预览用的固定安全环线，没有通用寻路。点家具显示场景说明，拖动转视角、双指或滚轮缩放，可切白天和傍晚。

「毛色」可选原色、橘白、奶茶、黑白和浅紫，或分别调整底毛/花纹。UV蒙版保留毛发明暗纹理，保护眼睛、鼻子和内耳；原色直接还原原贴图。仅将毛色写入本浏览器的独立 `lisa-pet-house-cat-look-v1` 设置，刷新可恢复，不修改宠物/角色存档。后台暂停渲染，停止并落稳后按需渲染。

- `preview.html`：浏览器入口，复用庭院的 Three.js、GLTFLoader 和 Draco 解码器。
- `room.glb`：奶油墙面、木地板、窗台与窗帘、绿沙发、阅读灯、编织窝、猫爬架、椭圆地毯、玩具篮、水粮碗。每个区域保留 `zone` 标记，玩具与两只碗保留独立 `item` 节点。
- `cat.glb`：Lisa 提供的 `e7667bb2460bb44cd3f56ba8645e00f5.glb` 的手机用派生副本。约2.6万三角面，贴图最大1K，WebP与Draco压缩，含18根控制骨骼/一套蒙皮；行走由运行时计算，没有烘焙动画片段。原始下载文件未改动，原件 SHA256 见 `asset-report.json`。
- `cat_asset.py` / `cat-rig.json`：按原猫实际关节位置绑定并输出运行时关节/步幅/毛色元数据。UV接缝同位置权重相同，导出四权重归一化。
- `cat-mask.png` / `cat-dye.mjs`：1K毛色蒙版（R花纹/G底毛）和材质染色控制。
- `cat-motion.mjs`：四拍慢步、两段腿IK、落脚锁定及头身尾动作。
- `build.py`：可复建的 Blender 美术源。编辑源保留细节物件；仅在导出时按区域和材质合并静态部件，减少网页绘制次数。
- `layout.json`：预览相机、猫的摆位和区域说明的共同来源。Blender 坐标为 Z 向上，浏览器坐标映射为 `(x,z,-y)`。

重建（替换路径为本机原件与证据目录）：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python art/pet-house/build.py -- \
  --cat /path/to/e7667bb2460bb44cd3f56ba8645e00f5.glb \
  --evidence /path/to/pet-house-evidence
```

输出网页资产至本目录，预览图及可编辑 `pet-house.blend` 至证据目录。只需重新导出时加 `--skip-render`。每次源或素材改变后更新相应预览脚本/资产指纹；本次猫/预览为 `pet-house-2`，房间仍用原 `pet-house-1`，不影响现有 App 版本或庭院素材。

浏览器验证（先在仓库根启动本机 HTTP 服务）：

```sh
PET_HOUSE_URL=http://127.0.0.1:18952 \
PET_HOUSE_EVIDENCE=/path/to/browser-evidence \
node art/pet-house/check-preview.cjs
```

另运行 `node --test art/pet-house/cat-motion.test.mjs` 检查落脚连续性、IK长度/极端目标、蒙皮资产、地面高度与保存值校验。浏览器验证模型加载、区域点击、光照切换、拖动/缩放/复位、刷新、320/390/430宽度的控制布局，以及一分钟散步中真实蒙皮脚底的滑动/高度和骨骼落点，停止落脚、预设/自选毛色及刷新保存。实体iPhone性能未测。通用行走寻路、照料动作、角色参与、养育事件和手机小世界入口尚未实现。
