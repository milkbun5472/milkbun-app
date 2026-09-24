# 原 GLB 基础小人

2026-09-23，Lisa 否定独立重建稿的方脸，明确改为复用原 GLB 可用数据。本目录取代 `reference-study` 作为后续换装工作的基础；旧稿保留历史，不再把它当作造型目标。

`source-traveler.blend` 直接导入 `../clay-reference.glb`，完整保留原网格、原材质、UV、法线和三张 4096×4096 贴图，已全部打包。原件 33,634 顶点、50,010 三角面；只通过父级统一缩放显示身高至 1.707，没有压扁、重塑头脸、切割或重采样。摄影灯和相机为新增预览设施。它是原件保全基础文件，不是重新建模成果。

`preservation.json` 记录原 GLB 的 SHA256、导入后各项数据指纹，并在保存后重新打开 `.blend` 核对顶点坐标、面索引、法线、UV 和打包图像一致。原文件 SHA256 为 `b2fe2232ecb845d98036f8c6c03f5ccae68d76d4d2815b3c01b8c04b01952848`。

生成与验证：

```sh
SOURCE_BASE_OUT=/tmp/garden-source-base /Applications/Blender.app/Contents/MacOS/Blender -b --python art/fairy-garden/source-base/build.py
```

输出为 `.blend`、保全校验 JSON 和正面、四分之三、侧面、背面四张真实 Blender 渲染。渲染光照与例图不同，不宣称与例图像素一致。

原件保全文件仍为单网格。后续适配文件单独派生，不能用粗糙颜色分类删除面后重造脸。

## 六项体型拉条

`traveler-sliders.blend` 与 `traveler-sliders.glb` 是本轮体型适配文件，包含腿长、肩宽、腰身、衣摆、圆润度、头身比六个形态键。参数名、范围取自现有 `apps/fairy-garden/doll.json`，仍用「数值减 1」作为形态键权重，100% 恢复原比例。头发、脸和耳朵整体等比缩放；腿长向上推移身体，鞋底固定；腰身、衣摆、圆润度向躯干收敛，肩宽带动手臂，避免把手掌拉斜。

原始 33,634 个顶点位置全部保留，身体较长的边在原表面内加细，UV 与角法线插值。适配文件为 64,358 顶点、108,251 三角面；没有重塑头脸。细长三角面用局部形变约束防止折叠。三张贴图在导出 GLB 后仍与原件逐字节相同。原始保全 `.blend` 和 GLB 没有改动。

生成（默认输出 `/tmp/garden-source-sliders`）：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/fairy-garden/source-base/build_sliders.py
```

从仓库根目录运行静态服务器，打开 `/art/fairy-garden/source-base/preview.html` 可试调六根拉条、旋转、切换正侧背面和复位。预览使用庭院实际 `createTraveler().setLook()` 读取形态键，不另写一套网页形变。此页不写入庭院存档。

验证：`slider-validation.json` 检查 64 种端点组合；有效三角面最小面积比 0.425、与原面法线点积最小 0.694，均未翻面。头部维持相似变换、鞋底固定。浏览器检查真实导出 GLB 的 64 种组合、六项输入、手掌形状、复位、三张贴图字节和 390px 窄屏：

```sh
PLAYWRIGHT_MODULE=/path/to/playwright GARDEN_TEST_URL=http://127.0.0.1:18897 node art/fairy-garden/source-base/check-preview.cjs
```

本轮仅完成原件的体型适配与可交互预览，尚未拆分换发型/服装或绑定动作。**没有替换运行时 `apps/fairy-garden/doll.glb`，没有发布应用版本。** 后续仍须完成换装和动作适配，不能直接覆盖正在使用的游戏模型。

## 后续发型适配

十二款发型与原体型共用的试换预览见 [source-hairstyles](../source-hairstyles/README.md)。本目录保全原件、体型网格与原体型页仍保留；仅预览控件抽成共用样式／模块。发型派生件没有覆盖这里的源 `.blend` 或 `.glb`。
