# 低双丸子 lowbuns

2026-11-15：Lisa 提供 c1a1cf2f4ec9cd808b1718460f5d42b9.glb，当前为 tilt-v2 后倾收短稿，待看未发布。Lisa 指出首稿前发须过长，要求整顶后倾且发须不超过耳朵下缘。

源是完整发壳：中分弯曲发束、脸侧碎发、后颈两只低丸子及浅奶油发圈。原件 50,000 面；没有脸、身体或衣服。按 v2/head-anchor.json 拟合内腔，INNER=1.12、DZ=-.06，内腔中心约 [.002,-.014,.460]、半径 .411；等比套合，保留源轮廓和发束层次。运行挂在 HeadAnchor，首稿最低点 -1.314，高于长发垂落阈值 -1.65，不参与肩臂避让。

发圈走既有 hairAccessory 元数据与公共衣柜独立颜色，默认 #e5d5b7。首试按三角面平均亮度分色，边界出现锯齿、背光处漏色；现沿源贴图的中性色比例切分跨界三角面，插值保留表面位置、UV 和法线，包含背光发圈。50806 面，其中发圈 820 面。分色后顶点须去重，否则逐面重复顶点会让 Draco 包膨胀到 1.2 MB；不应放宽预算或删除发束来掩盖。

## 后倾收短 tilt-v2

从首稿 prepared.glb 重新处理，整体绕头锚后倾8°，前侧局部以连续纵向映射收短32%，保留原尖端、UV和材质分界；法线按Jacobian逆转置传输。前须最低点约 -.680，实际耳廓下缘约 -.724；整发最低点 -1.395（含低丸子），仍不触发长发垂落。最小Jacobian .6801。50%收短的试算偏短，已弃用；保留 short-trial 图供对照。

## 复现

从仓库根执行，将 Blender 替换为本机可执行文件。SOURCE 是原 GLB；WORK 为本机输出目录。

```sh
INNER=1.12 DZ=-.06 Blender -b --python art/fairy-garden/doll/fit_shell.py -- "$SOURCE" art/fairy-garden/doll/v2/head-anchor.json "$WORK/fitted.glb"
Blender -b --python art/fairy-garden/doll/prepare_lowbuns.py -- "$WORK/fitted.glb" "$WORK/prepared.glb"
Blender -b --python art/fairy-garden/doll/tilt_lowbuns.py -- "$WORK/prepared.glb" "$WORK/tilted.glb"
TRIS=60000 TEX=1024 Blender -b --python art/fairy-garden/doll/compress_asset.py -- "$WORK/tilted.glb" art/fairy-garden/doll/v2/web/hair_lowbuns.glb
Blender -b --python art/fairy-garden/doll/add_hair.py -- lowbuns --lazy
```

最终运行文件 326448 字节，SHA256 `b24eae4504618eb479b4da248ac7a73e48ac03b46e07e55352427bc0dea6813a`；本轮12项发型定向测试通过，首轮35项目录/衣柜测试证据保留。

独立注册 hairstyles.json、add_hair.HAIRS、traveler.HAIR_STYLES 和 wardrobe.HAIR_ACCESSORIES；沿既有懒加载、染色、角色存档，身体及公共动作不改。最终运行文件 apps/fairy-garden/hair/lowbuns.glb；可编辑源由 prepare_lowbuns 自动保存 prepared.blend。

## 复看证据

最新后倾收短稿在下述目录的 tilt-v2/，含 tilted.blend、tilted.json、最终运行文件、双内核实图与验证；父目录保留首稿证据。

本机证据 `/Users/lisa/.codex/visualizations/2026/11/14/01a1db4d-1d00-7601-b3b9-bc46958d51bf/hair-c1a1/`：source 正侧背、prepared.blend、review.html/comparison.png、运行图、runtime-chromium.json/runtime-webkit.json、ui-report.json、delivery.json。跨机器读不到时必须重新验证。

重点复看两侧脸际发尖、后脑中缝、耳后发圈整圈和低丸子到衣领的距离。Chrome/WebKit 各 64 体型×2 头部姿势、四种染发、32组原有动作、全部现役衣服和坐姿；原有身体骨骼对照差异零。实际陪伴衣柜选择、发色/发圈独立配色、切换、刷新保存、角色隔离及320/390宽度检查。未实体 iPhone 或全身碰撞穷举；造型待 Lisa 确认，不能把自动检查等同审美验收。
