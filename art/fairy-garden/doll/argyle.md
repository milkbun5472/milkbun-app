# 菱格背心套装（argyle，袖手对齐第三稿）

Lisa于2026-11-15澄清85d617…GLB要做衣服。白色翻领衬衫、菱格针织背心、灯笼裤、袜子与皮鞋整套穿戴；六区配色为背心连菱格／衬衫／裤子／袜子／皮鞋／鞋底。菱格保留原有颜色层次，随背心整体染色。

Lisa已确认 **aligned-v3** 并授权发版，现已通过prepared_outfits/dye_regions注册正式衣柜。原输入 `/Users/lisa/Downloads/85d617a1023423b632b09f89f47d651f.glb`，33851432字节、50056三角面。最终压缩稿2255552字节、49914三角面，SHA256 `06d4810006831dc67631cc212de6d3cee3ecd008a3a4067ad4a0b50b622e052e`。

本机制作根 `/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/outfit-85d617/aligned-v3/`。先复制straight-v2/argyle-ready.blend作为输入，运行align-whole-sleeves → stabilize → compressed/pack-morphs.py；输入SHA校验防止重复变形。源 argyle-ready.blend，运行稿 compressed/argyle.glb，palette.json为公共衣柜注册数据。身体与公共动作未改，保留现役骨架、六个体型形变。

首稿只转袖口并渐变回肩根，造成弯袖；straight-v2恢复原袖形，又被指出袖子没对齐手。第三稿左右分别按实际手臂截面，将袖筒中心线和袖口一起变换，下半袖筒保持直顺、肩根渐隐接回；中央领口固定。过短肩根过渡曾出现负Jacobian，当前拓宽后最小.416。**父目录align-sleeves.py是被否定的弯袖算法，不得用于发布**。背心仅躯干权重，避免举手牵起下摆。

袖口阴影、裤脚暗边按部位与UV衣片归属；白纽扣门襟取实际窄条，V领内背心仍属背心。pack默认KEEP_FLOAT=Argyle trim，避免衬衫量化产生微小翻面。最终GLB重载64体型端点零翻面、零近零面积面。

Chrome/WebKit四档体型（92%肩宽、默认、两端）走坐抬手正侧与六区换色检查通过，报告和实图在compressed/及其webkit/。正式衣柜选择、六区换色、换装/刷新保存、恢复默认、角色隔离及320/390宽度检查通过，见release/。未实体iPhone或全身碰撞穷举；已复看的抬手为向前抬手，并非举过头。review.html、preview.png为三视图；comparison.png为上一稿和本稿袖口对比。正式GLB沿公共目录按需加载，保留本稿压缩字节。
