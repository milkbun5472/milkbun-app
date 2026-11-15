# 莓粉卫衣裙：待看试穿稿

Lisa 提供 `993c05918b88e427787836d7439a45aa.glb`，要求套到现有小人，先看适配再发版。源确认为莓粉小花卫衣、白内搭、奶油短裙、袜子和拼色运动鞋。2026-11-15 完成独立试穿资产；**未获造型验收、未注册正式衣柜、未发布。**

- 当前文件：`compressed/berry.glb`，2262024 字节／50306 三角面，SHA256 `3d73c80012ae0bf95ca5ea4fa5a8ea8387b68f614b829e441d0995074dd61c41`。
- 可编辑源 `berry-ready.blend`，六区配色 `palette.json`；全流程、失败尝试和复现顺序见资产 README.md。
- 本机证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db4d-1d00-7601-b3b9-bc46958d51bf/hunyuan-993c-berry/`，入口 `review.html`、`preview.png`、`delivery.json`。该目录不会随 Git 同步；其他机器读不到须重新获取，不能当作已查看。
- 独立树 `/private/tmp/lisa-berry-993c`，分支 `codex/berry-outfit-993c`，基线 `66d6d036a`；未改生产身体、动作、发型或衣柜。

适配内容：按现有手臂截面修袖口中心、方向和口径；展开鞋袜贴合原腿围；短裙减弱单腿牵拉并自带坐姿前摆弯落。六个体型 morph 与六区独立染色均保留。压缩后卫衣一处极小三角面敏感，保留 Berry cloth 浮点形变解决；其他大 morph 仍标准 SHORT，非数学无损。

最终重导 64 体型端点零翻面、四个极小近零面积面；Chrome/WebKit 四体型走坐左右抬手正侧和染色通过、零页错。32 组姿势／体型对照现役 garden，十根骨骼变换最大差 0。未实体 iPhone 验证或穷举全动作碰撞；坐姿前摆、袜口和整体造型待 Lisa 复看。

确认后沿 `prepared_outfits.json`／`dye_regions.py` 接入独立 berry 条目，复验正式衣柜选择、染色、切换、刷新、恢复默认与角色隔离，再按版本手册发版。勿用本预览阶段报告冒充衣柜集成或线上验收。
