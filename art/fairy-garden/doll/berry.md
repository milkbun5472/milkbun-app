# 莓粉卫衣裙：圆袖筒修订试穿稿

Lisa 提供 `993c05918b88e427787836d7439a45aa.glb`，要求套到现有小人，先看适配再发版。源为莓粉小花卫衣、白内搭、奶油短裙、袜子和拼色运动鞋。**初稿被指出领口高、抬手腋下怪；随后的切片修法不自然，已废弃。当前修订稿仍待 Lisa 造型验收，未注册衣柜、未发布。**

- 最新文件：`round-sleeves-v3/compressed/berry.glb`，2917488 字节／47545 三角面，SHA256 `62296e82e5b4b18c5a031678a3ddf1388ab8271dc65d4d68d82fd114e4efe2bd`。
- 可编辑源：同目录 `berry-ready.blend`；真实对比 `review.html`／`comparison.png`，最终 Chrome/WebKit 实图与报告在 `chrome/`、`webkit/`；身份见 `delivery.json`。
- 本机证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db4d-1d00-7601-b3b9-bc46958d51bf/hunyuan-993c-berry/`。该目录不会随 Git 同步；其他机器读不到须重新获取，不能当作已查看。
- 独立树 `/private/tmp/lisa-berry-993c`，分支 `codex/berry-outfit-993c`，基线 `66d6d036a`；未改生产身体、动作、发型或衣柜。

## 此轮病根与修法

源内袖与腰身物理相粘；只调权重会拉出长三角，平面封口、圆柱开洞、硬接袖根又形成可见补片。`collar-arm-v2` 全部模型试验均禁止发布。不能把有限顶点测试通过当作自然度通过。

按 Lisa 要求实际对照现役 ranger/cardigan 同相机抬手正侧面，阅读 `rebuild_cardigan_sleeves.py`、`round_sleeves.py`、`fit_cuffs.py`、`smooth_shoulders.py` 和 `clean_hoodie.py`。修订使用已有完整圆袖筒／袖口对齐／肩根过渡，衣身侧面连续重建、体素融合、局部平滑并烘焙中和布料；下摆顺接收口罗纹。领口平滑下降最多 .022。去除旧 UV 的粗糙度／法线贴图残留，并清理体素三角化微小退化面。

保留原小花、白内搭、短裙、鞋袜、六体型、六区配色和裙子的 seated。身体骨架与公共动作完全不变；运行时沿现有 bent-arms 给新圆袖筒分配前臂权重。

## 复现与验证

Blender 执行 `round-sleeves-v3/rebuild.py` → `finish.py` → `KEEP_FLOAT='Berry cloth' python3 compressed/pack-morphs.py`。重建读取父目录初稿 blend，不能从修订稿重复叠加。局部脚本依赖、旧失败证据见同目录 README。

最终压缩稿重导 64 体型组合零翻面、零近零面积面；Chrome/WebKit 四体型走坐左右抬手、六区换色通过，零页错；32 组与现役 garden 骨骼对比最大差 0。全 SHORT 曾产生衣身 1 个极小面翻面，保留衣身浮点并清理退化面后解决。

尚未实体 iPhone 或全动作碰撞穷举；领口、袖子松量、侧身与下摆自然度仍等 Lisa 看稿。确认后沿 `prepared_outfits.json`／`dye_regions.py` 接入并验证正式衣柜存档，再按版本手册发布。不可把试穿报告当作线上验收。
