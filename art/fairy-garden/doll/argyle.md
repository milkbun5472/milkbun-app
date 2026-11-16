# 菱格背心套装（argyle，直顺袖形试穿稿）

Lisa于2026-11-15澄清85d617…GLB要做衣服。白色翻领衬衫、菱格针织背心、灯笼裤、袜子与皮鞋整套穿戴；六区配色为背心连菱格／衬衫／裤子／袜子／皮鞋／鞋底。菱格保留原有颜色层次，随背心整体染色。

当前为 **straight-v2 未发布试穿稿**，尚未注册正式衣柜。原输入 `/Users/lisa/Downloads/85d617a1023423b632b09f89f47d651f.glb`，33851432字节、50056三角面。最终压缩稿2254936字节、49914三角面，SHA256 `d6ef8aec6b04089a2ee7fc179124be33838f833c4df061653f549756c2acce81`。

本机制作根 `/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/outfit-85d617/straight-v2/`。README记录复现：fit → dye → stabilize → compressed/pack-morphs.py；源 argyle-ready.blend，运行稿 compressed/argyle.glb，palette.json为未来公共衣柜注册数据。身体与公共动作未改，保留现役骨架、六个体型形变。

首稿只旋转袖口再过渡到肩根，导致袖筒弯曲，被Lisa指出，已整段撤回。**不得重新运行父目录align-sleeves.py**；第二稿袖子保留原始套合坐标，压缩重载最大偏差0.00000705模型单位。背心权重固定到躯干，袖子独立跟臂，避免举手牵起背心下摆。

袖口阴影、裤脚暗边按部位与UV衣片归属，不能仅用深浅分类。白色纽扣门襟按实际窄条划分，V领内的背心仍属背心。衬衫形变SHORT量化曾出现1个极小面翻转，最终pack默认KEEP_FLOAT=Argyle trim，64体型端点零翻面、零近零面积面。

Chrome/WebKit四档体型（92%肩宽、默认、两端）走坐抬手正侧与六区换色检查，报告和实图在compressed/。这是试穿检查，未做正式衣柜存档回归或实体iPhone、全身碰撞穷举，造型仍待Lisa看。预览入口review.html、preview.png；袖形前后sleeve-comparison.png。后续发布按prepared_outfits/dye_regions公共目录与版本手册接入，保留最终GLB字节。
