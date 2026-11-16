# 莓粉卫衣裙：顺肩与鞋袜对齐正式接入

Lisa 提供 `993c05918b88e427787836d7439a45aa.glb`，要求套到现有小人，先看适配再发版。源为莓粉小花卫衣、白内搭、奶油短裙、袜子和拼色运动鞋。**初稿被指出领口高、抬手腋下怪；切片修法失败。round-sleeves-v3 又被指出袖根尖、磨平原版褶皱，不能当作认可稿。authored-folds-v5又被指出太累赘；v7又被指出肩部鼓包；Lisa已确认shoulder-slope-v8并授权发版，现接入正式衣柜。**

- 正式运行文件：`apps/fairy-garden/outfits/berry.glb`，2659696字节／67427三角面，SHA256 `2e67639aa228aa602ce71e45b095c6440ccc0118e6e91fa8abc131d1acd49c4c`。原确认预览仍为shoulder-slope-v8/compressed/berry.glb。
- 正式打包：`package_berry.py`守卫预览SHA；三张PNG按原分辨率转WebP质量95，网格/蒙皮/形变二进制逐字不变。清预览初始形变值，移除遗留slotBase数组（本套使用colorSlot/dyeTexture）；正式首载预算无需放宽。prepared_outfits.json经dye_regions.py生成共用目录。
- 可编辑源：同目录 `berry-ready.blend`；真实对比 `review.html`／`comparison.png`，最终 Chrome/WebKit 实图与报告在 `chrome/`、`webkit/`；身份见 `delivery.json`。
- 本机证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db4d-1d00-7601-b3b9-bc46958d51bf/hunyuan-993c-berry/`。该目录不会随 Git 同步；其他机器读不到须重新获取，不能当作已查看。
- 独立树 `/private/tmp/lisa-berry-993c`，分支 `codex/berry-outfit-993c`，基线 `66d6d036a`；未改生产身体、动作、发型或衣柜。

## 最新肩部修正

v7被指出肩部仍鼓包。测得x=.13衣身顶.6918，袖顶.7038：衣身/领口降过.022，袖顶恢复后相对偏高。v8顺着衣身肩坡降低袖顶最多.024，前后局部收厚最多.00869；内肩渐入、外肩渐退，保留原袖口和下部鼓褶。法线按Jacobian逆转置，最小Jacobian.4819。

只降袖顶会让举手连接薄/脱开，首稿已弃；最终只在袖根上部渐变混入身体权重，公共动作未改。把该权重直接用于体型曾使16面端点翻折，已弃；体型沿原袖子整体映射，在新几何上重算。最终64体型零翻面/零退化；Chrome/WebKit四体型走坐抬手/六区染色零页错。原身体、所有非袖子部件和袖口固定区网格/形变/权重保留，v7鞋袜不回退。

复现shoulder-slope-v8/refine.py（读v7源）→KEEP_FLOAT='Berry cloth' compressed/pack-morphs.py。review.html/comparison.png为同机位原版/修前/修后；抬手袖根仍较收拢，整体自然度须Lisa看，不视为造型认可。32组原动作骨骼对照零差异；未实机iPhone/全碰撞穷举。

## 此前鞋袜修正

Lisa指出腿鞋没对准。v7按原左右腿 z=.155 截面分别平移鞋袜，左 x 内偏修正 -.02178，右 +.00368；同时修正少量前后偏移。鞋袜整体连通分区各自绑定原腿，清掉跨腿权重；放大袜口有顶点越过中线，不能按逐顶点 x 符号分左右，否则出现袜间蹼（该试验已弃）。按新位置重算足部六体型形变。本套遮挡线 .168→.148，让原腿伸进袜口，避免平切边露出。

原身体、非足部顶点与形变/权重逐项相同，原公共动作未改。最终压缩版64体型零翻面/零退化，Chrome/WebKit四体型走坐抬手/六区通过；32组原骨骼对照零差异。final-feet/含极端体型脚部实图；review.html为v6/v7正侧及走路对比。v6上衣审美仍待认可，不能因本次修鞋宣称完成上衣验收。

v7复现：Blender ankle-fit-v7/align-ankles.py（读v6源）→KEEP_FLOAT='Berry cloth' compressed/pack-morphs.py。check-preserved.py核对原身体及非足部数据。

## 上衣此前反馈与修订

Lisa指出v5太累赘，要求认真对比原版。同相机正侧对比确认：外肩鼓起、原落肩感减弱；袖口出现额外深色厚边，像多叠一层；腰侧比原版方。不能把更多圆体积当作自然，也不能把原褶皱磨平。

v6直接取回原袖口主体网格／UV／材质；沿袖口实测面内退.035切接，新袖身内缩并短重叠.0025藏在原袖口内侧。初版共面桥接三角面产生细裂纹，已废弃。上外肩局部降／内收，再由restore-shoulder.py把表面与布纹投回原外肩，保留下半袖根圆截面；腰侧最多内收.008，原前后鼓褶及裙鞋不动。**肩线与原版仍非逐点相同，轻巧感、落肩衔接和袖口需Lisa审美复看，不能称完整还原。**

## 复现与检查

Blender clean-silhouette-v6/refine.py（调用restore-shoulder.py，读v5与最初berry-ready.blend）→KEEP_FLOAT='Berry cloth' python3 compressed/pack-morphs.py。最终压缩稿64体型零翻面／零退化面；Chrome/WebKit各四体型走坐左右抬手、六区换色零页错。32组原骨骼对照零差异；本轮仅服装几何材质变化，身体与公共动作未改。模型分为10个运行时材质部件，仍6区配色。

前述切片、v3平滑袖、v4混合根权重、v5直接切接、v5首交点重投影均为失败尝试，不能复用交付。原版比例是基准；v5虽技术通过仍被否定。

未实机iPhone／全动作碰撞穷举。Lisa已授权发布；线上回执待部署核验后补在本文。
