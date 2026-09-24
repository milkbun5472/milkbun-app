# 给 Opus：M02 发型、眼睛、腮红与圆顶返工

Lisa 要求停止当前 Codex 建模，上传给 Opus 接手。**本分支是未完成工作快照，不是造型通过或可以发布的成品。** 用户明确不满意当前质量，不能沿用旧测试报告声称本稿达标。

## 先看这些

- 用户最新正、侧、背参考：`handoff-references/m02-front.jpg`、`m02-side.jpg`、`m02-back.jpg`。
- 本稿真实 GLB 截图：`handoff-preview/m02-front.png`、`m02-side.png`、`m02-back.png`。
- 当前 Blender 源文件和导出：本目录 `traveler-hairstyles.blend` / `.glb`。它们来自最新完整构建，哈希在 `asset-validation.json`。
- 原 GLB 保全件：`../clay-reference.glb`；体型源：`../source-base/traveler-sliders.blend`。这两个资产未动。用户已经允许复用原 GLB 数据。

## 用户要求

用 Blender；M02 参照三视图继续细化。头发要立体、圆润、自然分层，不能是扁片、粗胶条、横压的平顶；头顶发根要隆起。眼睛应更小、边缘干净的竖向圆角形；腮红是贴脸的浅桃色椭圆，不是凸出的肉块。保持体型拉条适配。其他款式还没完成同等精修，衣服/动作/庭院正式替换也未完成。

## 当前改了什么

- `face_study.py`：原 SourceBody 分成身体和 SourceHeadOriginal，保留原 UV、法线、六形态键；M01 显示原头作对照，其他发型显示新 ScalpSupport。新圆脸、耳朵和颈部，2048px 面部贴图画眼睛/腮红。原三贴图不覆盖，新加一张脸部贴图。
- `build.py` 改用上述新脸，不再走 scalp.py/forehead.py 的旧额头补洞。模型为15个网格；默认 SourceBody + SourceHeadOriginal + hair_korean 可见。`source-base/preview.mjs` 切发时切换两套头部。
- `curtains_study.py`：M02 的 C 形前刘海仍是定轮廓的闭合曲面；新 refined_rear 替换了上一版复用原后脑的路径；lift_crown 将上部整体抬高。原 source_back 函数还在文件里但当前没有调用。
- `hair_geometry.py`：M02 恢复完整发帽以遮新发束之间的头皮。新背部使用三层径向发束，目前效果仍差。

## 明确没修好

1. **领口/颈部仍有锯齿碎边**。按高度和肤色拆原头会切进衣领，当前判断不够稳。不能在不复核的情况下继续简单调阈值。
2. **后脑和侧后仍有露皮缝、发束过长过直、排列机械**。完整发帽只遮住了一部分；新后脑目前比上一版原后脑更差。
3. **顶层像一片单独盖上的厚叶子**，虽抬高了，仍没有参考的自然圆顶和发根过渡。前中分上方还露出平整内壳。
4. 新脸已经去掉旧凸眼/凸腮红，但面部、耳朵、颈部比例及着色需要按三视图继续校准，不能把本稿当最终脸型。
5. 新头皮/颈部在极端体型下与衣领是否衔接，尚未验证；其他11款与新脸的适配尚未复核。

## 验证状态与运行方法

最新 Blender 完整构建成功，语法检查通过。**本稿未跑完保存重开、浏览器64端点、原件画面还原或线上验证。** `check-preview.cjs` 和 `verify_saved.py` 已开始适配15网格/新脸/4贴图，但还未用本稿跑过。`browser-validation.json` 仍是上一个 b5360bdbce42 模型的结果，不能用于本稿；旧 m02-*.png / gallery-*.png 也还是上一版。当前图只看 handoff-preview。

从仓库根运行：

```sh
RENDER_STYLES= /Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/fairy-garden/source-hairstyles/build.py
```

产物默认 `/tmp/garden-source-hair`，需要成功后再复制回仓库。REUSE_HAIR=1 仅用于脸部迭代，最终要完整构建。Blender 5.2.2；浏览器测试用 Chrome 和 PLAYWRIGHT_MODULE。当前本机静态服务端口18897。build.py 最后一次只有报告文字的微调晚于模型构建，几何实现与当前产物一致。

原已发布预览在 main 的 bca5c345，艺术提交1a7ad326。这个接手分支未合并 main，未覆盖线上预览或庭院运行时。本批不更新APP版本；现役应用v74.012及其他窗口工作保留。
