# 莓粉卫衣裙：圆袖根与细袖口正式版

Lisa 提供 `993c05918b88e427787836d7439a45aa.glb`，要求套到现有小人，先看适配再发版。源为莓粉小花卫衣、白内搭、奶油短裙、袜子和拼色运动鞋。**初稿被指出领口高、抬手腋下怪；切片修法失败。round-sleeves-v3 又被指出袖根尖、磨平原版褶皱，不能当作认可稿。authored-folds-v5又被指出太累赘；v7又被指出肩部鼓包；Lisa已确认shoulder-slope-v8并授权发版，已发布v89.674并接入正式衣柜。**

- 正式运行文件：`apps/fairy-garden/outfits/berry.glb`，2638244字节／67427三角面，SHA256 `f190667a51f9c6d9c72a5f0fd23a6aea97ce9d0582bae31509c4cc94e7fbcd25`，与已确认round-root-v11/compressed/berry.glb逐字节相同。
- 正式源与复现：round-root-v11/berry-ready.blend；fit.py读v10源→KEEP_FLOAT='Berry cloth' compressed/pack-morphs.py。模型直接WebP95、形变初值0；不要用只接受旧v8 SHA的package_berry.py。沿现有prepared_outfits/dye_regions目录注册，ID与六区配色存档保持。
- 实图与验证：round-root-v11/review.html、comparison.png、delivery.json、chrome/webkit；发布证据在round-root-v11/release/。
- 本机证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db4d-1d00-7601-b3b9-bc46958d51bf/hunyuan-993c-berry/`。该目录不会随 Git 同步；其他机器读不到须重新获取，不能当作已查看。
- 独立树 `/private/tmp/lisa-berry-993c`，分支 `codex/berry-outfit-993c`，基线 `66d6d036a`；未改生产身体、动作或发型；本轮替换本套服装资产并更新攻略与内容缓存指纹。

最新发布回执：**v89.675**，提交`db5a40da22a93cd53f7c0c934200c38025082176`，build `fg-eb6abfb2878f1bb1`，Pages `43784404080` 成功。47项发布检查通过，211个线上发布文件SHA逐字节一致；线上正式衣柜选择、六区染色、换装/刷新保存、恢复默认、角色隔离、320/390宽度均通过。v9/v10未单独发布，v11包含细袖口与内侧清理；原身体及公共动作未改。

## 圆袖根v11：Lisa已确认并授权发布

Lisa指出v10抬手连接处仍太尖。round-root-v11以v10为源，上袖径向渐扩最多24%、封口沿轴向内延长最多.035，t≥.100固定；顶高增量渐减55%，避免鼓肩。首试32%扩径鼓肩、完全锁顶又导致上沿急折，已弃。最终2638244字节/67427面，SHA `f190667a51f9c6d9c72a5f0fd23a6aea97ce9d0582bae31509c4cc94e7fbcd25`。压缩重载64体型零翻面/零退化；Chrome/WebKit四体型走坐左右抬手/六色通过，32组原骨骼差异0。身体/非袖子/下袖固定区几何形变、所有骨权重/拓扑UV保持，原褶皱/细袖口与鞋袜保留。证据round-root-v11/README、review.html/comparison.png、delivery、compressed和chrome/webkit；fit.py读v10→KEEP_FLOAT='Berry cloth' compressed/pack-morphs复现。Lisa于2026-11-15确认本稿「发吧」。未实体iPhone或全碰撞穷举。

## 此前v10：抬手袖根仍被指出太尖（未发布）

Lisa再次指出抬手怪，要求参考旧几批衣服。v9只能解决袖口厚和暗斑，不能视为袖根通过。此次将ranger/cardigan/jacket与v9放到同一原版抬手动作、92%肩宽和相机对照。确认v8/v9的body混合绑定把袖根拽成弯钩；本套恢复整袖自身arm绑定，由既有bent-arms分肘，并用旧ranger实际袖根表面渐变拟合上袖，保留v9下袖和原褶皱。

最新sleeve-fit-v10/compressed/berry.glb：2633096字节/67427面，SHA256 `62122e8f79851d946113ade2b7f36997279a771ff4dec4e691e8b189c2cf52ed`。fit.py读取v9源及reference-ranger.blend，轴向t<.100内最近表面拟合85%，最多移动.01863；100%拟合造成两个极小面退化已弃。最终相对源零反向面、64体型零翻面/零退化，Chrome/WebKit四体型走坐左右抬手/六区通过，32组原骨骼零差异。身体/非袖子和下袖固定区几何形变、拓扑UV保持；袖子权重明确有变，原动作未动。

证据根sleeve-fit-v10/README、review.html、delivery.json、preservation-report、references/与chrome/webkit。复现fit→KEEP_FLOAT='Berry cloth' compressed/pack-morphs；v10直接WebP导出，不用只接受v8 SHA的package_berry.py。**本稿被指出连接仍尖，保留作过程对照；当前正式使用上文v11。** 未实体iPhone或全碰撞穷举。

## 此前v9：袖口与内侧修订（袖根被指出仍怪）

正式v89.674上线后，Lisa指出袖口太厚、抬手内侧脏。当时候选cuff-clean-v9，2646980字节/67427面，SHA256 `075b8ac172c4d85f34f67936b8ffd219a173fcaaf1ac8e6cb3dc2ee48e0480cc`；本稿未单独发布，其细袖口与内侧清理已包含在v11中。

纯材质诊断确认内侧马蹄形深印来自旧烘焙把源袖口/夹层阴影投进袖身。v9按实际袖轴选内向表面，UV局部掩码压低旧暗斑对比，外侧和原罗纹图保留，几何褶皱正常光影仍在。依左右实测袖口轴，保内区r≤.063，外层多余半径收38%；罗纹接界缩短最多.006，宽过渡衔接袖身，最小Jacobian.3103。首试45%/.008过急未通过下限，已弃。

refine.py读v8源→WEBP95/初始形变0/无遗留slotBase导出→KEEP_FLOAT='Berry cloth' compressed/pack-morphs.py。不要再用只接受v8 SHA的package_berry.py。最终64端点零翻面/零退化；双内核四体型走坐左右抬手及六色零页错，32组原骨骼零差异。身体、非袖子、上袖固定区几何/形变和全部骨权重/拓扑验证不变。证据根cuff-clean-v9/README、review.html/comparison.png、delivery、preservation与chrome/webkit。未实机iPhone/全动作碰撞穷举；候选未注册或发布。

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

未实机iPhone／全动作碰撞穷举。

发布回执：v89.674，main提交`9de1fe80f467da4890003e50ccfca1103d10d990`，build `fg-e63a34eaa480d1de`；Pages43781500189成功，47项定向发布检查通过，213个线上文件SHA一致。正式打包后的Chrome/WebKit四体型走坐抬手/六区与64端点重新通过；线上实际衣柜选择、六区换色、切换/刷新保存、默认恢复、角色隔离和320/390宽度均通过，零页错。发布证据见shoulder-slope-v8/release/。
