# 菱格背心套装（argyle，袖手对齐第三稿）

**最新状态（2026-11-15）：** raised-v4 后被指出肩凹；shoulder-v5 曾试抬袖顶，但本轮静态改形路线已停止推进，两者均不可当成已验收稿。正式 aligned-v3 未替换。 Lisa要求保留原版站姿，只修举手／击掌变形；抬手问题目前仍未解决。执行约定与失败证据见 `施工规则/model-outfit-review.md` 最新纠正，下面旧检查仅作历史。

Lisa于2026-11-15澄清85d617…GLB要做衣服。白色翻领衬衫、菱格针织背心、灯笼裤、袜子与皮鞋整套穿戴；六区配色为背心连菱格／衬衫／裤子／袜子／皮鞋／鞋底。菱格保留原有颜色层次，随背心整体染色。

Lisa已确认 **aligned-v3** 并授权发版，现已通过prepared_outfits/dye_regions注册正式衣柜。原输入 `/Users/lisa/Downloads/85d617a1023423b632b09f89f47d651f.glb`，33851432字节、50056三角面。最终压缩稿2255552字节、49914三角面，SHA256 `06d4810006831dc67631cc212de6d3cee3ecd008a3a4067ad4a0b50b622e052e`。

本机制作根 `/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/outfit-85d617/aligned-v3/`。先复制straight-v2/argyle-ready.blend作为输入，运行align-whole-sleeves → stabilize → compressed/pack-morphs.py；输入SHA校验防止重复变形。源 argyle-ready.blend，运行稿 compressed/argyle.glb，palette.json为公共衣柜注册数据。身体与公共动作未改，保留现役骨架、六个体型形变。

首稿只转袖口并渐变回肩根，造成弯袖；straight-v2恢复原袖形，又被指出袖子没对齐手。第三稿左右分别按实际手臂截面，将袖筒中心线和袖口一起变换，下半袖筒保持直顺、肩根渐隐接回；中央领口固定。过短肩根过渡曾出现负Jacobian，当前拓宽后最小.416。**父目录align-sleeves.py是被否定的弯袖算法，不得用于发布**。背心仅躯干权重，避免举手牵起下摆。

袖口阴影、裤脚暗边按部位与UV衣片归属；白纽扣门襟取实际窄条，V领内背心仍属背心。pack默认KEEP_FLOAT=Argyle trim，避免衬衫量化产生微小翻面。最终GLB重载64体型端点零翻面、零近零面积面。

Chrome/WebKit四档体型（92%肩宽、默认、两端）走坐抬手正侧与六区换色检查通过，报告和实图在compressed/及其webkit/。正式衣柜选择、六区换色、换装/刷新保存、恢复默认、角色隔离及320/390宽度检查通过，见release/。未实体iPhone或全身碰撞穷举；已复看的抬手为向前抬手，并非举过头。review.html、preview.png为三视图；comparison.png为上一稿和本稿袖口对比。正式GLB沿公共目录按需加载，保留本稿压缩字节。

发布回执：v89.673，main提交 `4808cdf37e96431324b139abd5e2968582ba0b66`，build `fg-78971a9ce342e31d`；Pages 43780121777成功，41项定向测试通过，213个线上文件SHA与发布稿一致。线上正式衣柜选择、六区换色、换装/刷新保存、角色隔离、恢复默认与320/390宽度通过；证据在本机制作根release/。旧衣柜测试写死八套名单，已改为遍历当前合法套装验证真实写入/读档，仍保留非法输入过滤检查。


## 举手腋下与肩线修订：raised-v4，待看未发布

Lisa在正式aligned-v3后反馈举手腋下破、肩线凸起。原袖根含躯干混合权重，举手露出原外袖片缺口；裤腰也残留手臂权重。新稿沿原下袖的实际截面重接闭合圆袖根，使用既有sleeveSide/bent-arms，完整衬衫内层在背心下封住腋下，裤子手臂权重全部转到body。背心肩缘保留原件，靠圆袖根内藏、减少尖顶来顺接；降低背心肩缘会露白点，试验已撤回。

最终本机 `outfit-85d617/raised-v4/compressed/argyle.glb`：2387880字节/53672面，SHA `7871cc7c5437999f863357d5c1eab442c8c6fa4b11ef982a2c20d5a990d09228`。正式文件未替换。复现 repair.py（每次打开aligned-v3原源）→ compressed/pack-morphs.py；Draco坐标20位，Argyle trim及其复制袖子的morph均FLOAT。stabilize.py仅备用，最终源不需要运行它。

64体型零翻面、4极小近零面积面；Chrome/WebKit四体型六色与左右举手/击掌、112帧动作、坐姿/前伸/托腮已看。preservation-report确认背心菱格、裤袜鞋表面/UV/形变零差，下袖及袖口顶点与形变零差，骨架矩阵不变；蒙皮有调整。源外袖切口是开链，内壁另有闭环，不能误取内壁来重建外壳；填内壁截面会出现硬板阴影。按弧长整理根部、三角扇封口，腋下原缺口以轻弧面闭合。first/second/third及诊断图均过程稿，最终证据只看compressed/和highfive.gif。未实体iPhone或全碰撞穷举，造型待Lisa确认。
