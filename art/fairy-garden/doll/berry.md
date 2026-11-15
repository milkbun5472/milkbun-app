# 莓粉卫衣裙：保留原褶皱的袖根试修稿

Lisa 提供 `993c05918b88e427787836d7439a45aa.glb`，要求套到现有小人，先看适配再发版。源为莓粉小花卫衣、白内搭、奶油短裙、袜子和拼色运动鞋。**初稿被指出领口高、抬手腋下怪；切片修法失败。round-sleeves-v3 又被指出袖根尖、磨平原版褶皱，不能当作认可稿。当前 authored-folds-v5 仍待 Lisa 看，未注册衣柜、未发布。**

- 最新文件：`authored-folds-v5/compressed/berry.glb`，3814756 字节／69545 三角面，SHA256 `6bcc1bf7971571dcb5f0bb01421f8d9d1bcc81a0126f3821e4f7bba2fe0b616c`。
- 可编辑源：同目录 `berry-ready.blend`；真实对比 `review.html`／`comparison.png`，最终 Chrome/WebKit 实图与报告在 `chrome/`、`webkit/`；身份见 `delivery.json`。
- 本机证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db4d-1d00-7601-b3b9-bc46958d51bf/hunyuan-993c-berry/`。该目录不会随 Git 同步；其他机器读不到须重新获取，不能当作已查看。
- 独立树 `/private/tmp/lisa-berry-993c`，分支 `codex/berry-outfit-993c`，基线 `66d6d036a`；未改生产身体、动作、发型或衣柜。

## 最新反馈与修订

Lisa明确保留原版自然垂手的褶皱，不接受整件磨平；抬手根部也不能尖。soft-root-v4仅加宽并混合body权重会产生新折角，废弃；authored-folds-v5/restore-sleeves.py直接切接原袖仍收尖，也废弃。

当前仅 project-folds.py：读取原始完整试穿 berry-ready.blend，从原袖身外表面恢复鼓起、堆褶和罗纹，根部保留较宽完整圆截面。必须取射线最外层交点，首交点会误取袖口内层导致破碎；袖口按原align-report的真实中心与方向复现。原低领口、连续衣身、裙子、小花、内搭和鞋袜保持上轮状态。不是逐顶点复制原袖，不能声称原版完全无差异；自然度和还原程度仍等Lisa对照看稿。

## 复现与检查

Blender authored-folds-v5/project-folds.py → KEEP_FLOAT='Berry cloth' python3 compressed/pack-morphs.py。当前可编辑源为同目录berry-ready.blend；restore-sleeves.py只留失败证据，禁止用于发布。最终压缩稿重新导入64体型零翻面、零退化面；Chrome/WebKit各四体型走坐左右抬手及六区换色零页错，32组与garden骨骼对比差异零。原身体、公共动作、生产资源及其他衣发未改。

未实机iPhone／全动作碰撞穷举；先看自然垂手褶皱，再看左右抬手正侧的袖根体积、上肩衔接与袖口。获Lisa认可后才接prepared_outfits.json／dye_regions.py，验证正式衣柜存档并发版。
