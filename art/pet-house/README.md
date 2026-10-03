# 宠物小屋 · 场景第一稿

一个独立的3D美术场景预览，未接入秋秋机的养宠玩法或存档。第二只猫是静态造型示意，没有骨骼或动画；点家具显示场景说明，拖动转视角、双指或滚轮缩放，可切白天和傍晚。

- `preview.html`：浏览器入口，复用庭院的 Three.js、GLTFLoader 和 Draco 解码器。
- `room.glb`：奶油墙面、木地板、窗台与窗帘、绿沙发、阅读灯、编织窝、猫爬架、椭圆地毯、玩具篮、水粮碗。每个区域保留 `zone` 标记，玩具与两只碗保留独立 `item` 节点。
- `cat.glb`：Lisa 提供的 `e7667bb2460bb44cd3f56ba8645e00f5.glb` 的手机用派生副本。约2.6万三角面，贴图最大1K，WebP与Draco压缩。原始下载文件未改动，原件 SHA256 见 `asset-report.json`。
- `build.py`：可复建的 Blender 美术源。编辑源保留细节物件；仅在导出时按区域和材质合并静态部件，减少网页绘制次数。
- `layout.json`：预览相机、猫的摆位和区域说明的共同来源。Blender 坐标为 Z 向上，浏览器坐标映射为 `(x,z,-y)`。

重建（替换路径为本机原件与证据目录）：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python art/pet-house/build.py -- \
  --cat /path/to/e7667bb2460bb44cd3f56ba8645e00f5.glb \
  --evidence /path/to/pet-house-evidence
```

输出网页资产至本目录，预览图及可编辑 `pet-house.blend` 至证据目录。只需重新导出时加 `--skip-render`。每次源或素材改变后更新本目录预览脚本/资产的 `pet-house-1` 指纹，不影响现有 App 版本或庭院素材。

浏览器验证（先在仓库根启动本机 HTTP 服务）：

```sh
PET_HOUSE_URL=http://127.0.0.1:18952 \
PET_HOUSE_EVIDENCE=/path/to/browser-evidence \
node art/pet-house/check-preview.cjs
```

验证模型加载、区域点击、光照切换、拖动/缩放/复位、刷新，以及320/390/430宽度的布局。实体iPhone性能未测。行走寻路、照料动作、角色参与、养育事件和手机小世界入口尚未实现。
