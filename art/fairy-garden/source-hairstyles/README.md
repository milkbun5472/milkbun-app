# 原件小人 · 十二款发型

基于 `../source-base/traveler-sliders.blend`，保留已适配六项体型的原件身体、眼睛、脸颊、下巴、耳朵与三张 4K 贴图。M01 自然碎发来自原件，其余十一款在 Blender 中用完整的圆形发帽、厚实闭合发束、长发、马尾、三股编织和发饰制作。发型编号沿用 `../hairstyles.json`，不迁移存档键。

原 GLB 是一张连续网格。`source_split.py` 定位材质边界、沿原三角面插值拆分 UV／法线／六个形态键，并以连通区域保护两只眼睛；保留全部 64,358 个来源顶点，两部分并回去恢复原件表面。换发型所露出的额头由 `scalp.py` 补成连续曲面，接在去除旧刘海接触暗边后的皮肤上。它是新增的头皮／额头支持面，不宣称原件本来就有完整可拆的光头。

`traveler-hairstyles.blend` 打包全部贴图，默认只显示原自然碎发；其余 `hair_<id>` 网格在大纲视图中，隐藏 `hair_korean`、显示所选发型和 `ScalpSupport` 即可检查。`traveler-hairstyles.glb` 同时包含十二款，网页只显示选中的一款。新增发型（包括长发末端）与头部保持整体等比缩放，腿长同时向上推移；身体继续沿用上轮经过验证的六个形态键。没有对脸进行横向压扁或改成方脸。

从仓库根运行静态服务器，打开本目录 `preview.html`。预览与原体型页共用 `../source-base/preview.mjs` 和实际庭院 `createTraveler().setLook()`，可以试换十二款、拖动旋转、看正侧背面、调整六项体型并复位。`gallery.html` 为同一导出 GLB 的真实浏览器截图总览。

## 生成与验证

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/fairy-garden/source-hairstyles/build.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/fairy-garden/source-hairstyles/verify_saved.py
PLAYWRIGHT_MODULE=/path/to/playwright node art/fairy-garden/source-hairstyles/check-preview.cjs
PLAYWRIGHT_MODULE=/path/to/playwright node art/fairy-garden/source-base/check-preview.cjs
PLAYWRIGHT_MODULE=/path/to/playwright node art/fairy-garden/source-hairstyles/capture-gallery.cjs
```

构建默认写入 `/tmp/garden-source-hair`，可用 `SOURCE_HAIR_OUT` 改目录。`RENDER_STYLES=curtains,wavy` 只渲染指定款式，空字符串跳过渲染。拆分缓存按源 `.blend` 和脚本内容失效。`pack_glb.py` 逐字节复核并共享重复缓冲区，不量化几何、不重新压缩贴图。验证后复制 `.blend`、`.glb` 和 `asset-validation.json`，同时更新预览页的资源指纹。

`asset-validation.json` 记录来源表面、形态键、原贴图 SHA256 和无损缓冲区整理。`browser-validation.json` 检查十二款切换、六项共 64 种端点组合、原件还原画面、60 条面部遮挡射线、复位和 390px 控件；三张原贴图的二进制保持一致。实际近景与组合端点截图仍需人工检查，数值通过不等于与例图完全一致。

**本目录交付发型和体型独立预览，没有覆盖庭院现役 `apps/fairy-garden/doll.glb`，没有发布新的应用版本。** 衣服拆分、染色、动作绑定和游戏内替换仍待后续接入；原件衣服本轮保持原样。新发型是按例图制作的三维解释，不宣称像素级复刻。原始保全文件和原体型文件未修改。
