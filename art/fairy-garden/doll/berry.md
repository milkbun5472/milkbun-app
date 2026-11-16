# 莓粉卫衣裙：按原版收量试修稿

Lisa 提供 `993c05918b88e427787836d7439a45aa.glb`，要求套到现有小人，先看适配再发版。源为莓粉小花卫衣、白内搭、奶油短裙、袜子和拼色运动鞋。**初稿被指出领口高、抬手腋下怪；切片修法失败。round-sleeves-v3 又被指出袖根尖、磨平原版褶皱，不能当作认可稿。authored-folds-v5又被指出太累赘；当前clean-silhouette-v6仍待Lisa看，未注册衣柜、未发布。**

- 最新文件：`clean-silhouette-v6/compressed/berry.glb`，3858280 字节／67427 三角面，SHA256 `da6895a3648177aead51b659519cbdeee1b830d6acd4e9fcc0dfad98f06209ea`。
- 可编辑源：同目录 `berry-ready.blend`；真实对比 `review.html`／`comparison.png`，最终 Chrome/WebKit 实图与报告在 `chrome/`、`webkit/`；身份见 `delivery.json`。
- 本机证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db4d-1d00-7601-b3b9-bc46958d51bf/hunyuan-993c-berry/`。该目录不会随 Git 同步；其他机器读不到须重新获取，不能当作已查看。
- 独立树 `/private/tmp/lisa-berry-993c`，分支 `codex/berry-outfit-993c`，基线 `66d6d036a`；未改生产身体、动作、发型或衣柜。

## 最新反馈与修订

Lisa指出v5太累赘，要求认真对比原版。同相机正侧对比确认：外肩鼓起、原落肩感减弱；袖口出现额外深色厚边，像多叠一层；腰侧比原版方。不能把更多圆体积当作自然，也不能把原褶皱磨平。

v6直接取回原袖口主体网格／UV／材质；沿袖口实测面内退.035切接，新袖身内缩并短重叠.0025藏在原袖口内侧。初版共面桥接三角面产生细裂纹，已废弃。上外肩局部降／内收，再由restore-shoulder.py把表面与布纹投回原外肩，保留下半袖根圆截面；腰侧最多内收.008，原前后鼓褶及裙鞋不动。**肩线与原版仍非逐点相同，轻巧感、落肩衔接和袖口需Lisa审美复看，不能称完整还原。**

## 复现与检查

Blender clean-silhouette-v6/refine.py（调用restore-shoulder.py，读v5与最初berry-ready.blend）→KEEP_FLOAT='Berry cloth' python3 compressed/pack-morphs.py。最终压缩稿64体型零翻面／零退化面；Chrome/WebKit各四体型走坐左右抬手、六区换色零页错。32组原骨骼对照零差异；本轮仅服装几何材质变化，身体与公共动作未改。模型分为10个运行时材质部件，仍6区配色。

前述切片、v3平滑袖、v4混合根权重、v5直接切接、v5首交点重投影均为失败尝试，不能复用交付。原版比例是基准；v5虽技术通过仍被否定。

未实机iPhone／全动作碰撞穷举；本轮未注册衣柜、未发布。获Lisa认可后再接prepared_outfits.json／dye_regions.py，验证衣柜存档并发版。
