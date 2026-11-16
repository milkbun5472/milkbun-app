# 竹纹交领袍（bamboo）

Lisa 于 2026-11-15 要求发布袖口染色修正版 cuff-v2。整套穿戴，沿公共衣柜、存档、DollRig 与按需加载；外袍、领缘与袖缘、裤子、腰带、靴子、鞋底六区独立染色，竹纹随外袍。

正式资产 `apps/fairy-garden/outfits/bamboo.glb`：2609236 字节，50392 三角面，SHA256 `8f0640f70e109cec8f6ad0bd45611de0a0b6860ec7b3fcfa050d4c07f80513f3`。六个体型 morph；cloth/trim/accent 另含衣服自身 seated 形变，复用既有动作驱动。身体、骨架与公共动作代码不为本套改变。

目录源 `prepared_outfits.json`，以 `dye_regions.py` 同步 doll.json 与 outfits.mjs。独立模型不经旧母包重导出；沿 split_outfits.py 的独立资产保护机制保留。

本机复现与证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/hunyuan-a873ea/`，原输入 `/Users/lisa/Downloads/a873ea6a68decb866d60e12308acf08b.glb`。当前源 `cuff-v2/bamboo-ready.blend`；从父级最终源经 cuff-v2/fix-cuffs.py 精确切分袖口边界，插值 UV、法线、骨权重及形变，并重新中和局部纹理；再经 cuff-v2/compressed/pack-morphs.py 压缩。袖缘形变必须保留浮点精度；全量 SHORT 曾造成极小翻面，已撤回。

压缩后重导入64体型端点零翻面，6处极小近零面积三角面；Chrome/WebKit 六区、92%/默认/极小/极大体型的走坐抬手检查通过且零页错。正式衣柜检查与发布证据放 cuff-v2/release/。领口接缝和坐姿侧面内层保留为造型复看项；未实体 iPhone 验证或穷举全身碰撞。

详细失败试验与共用注意事项见 `施工规则/model-outfit-review.md` 及本机 README；不要将已撤销的 seated-legs-preview.mjs 短上衣试验接入运行时。

## 举手／击掌修订：待看，未发布

Lisa 指出身侧切片、肩线异常和补面挡腰带，明确以旧款 cardigan/ranger/garden/jacket/suit/tee 为参考。最新本机 `legacy-sleeves-v4/` 复用 `round_sleeves.py` 和既有 `sleeveSide` / `bent-arms.mjs`；袖口保持原几何，袖筒重新连到肩部，身侧和原衣片共边闭合、细分顺圆，躯干及腰带上段仅 body 权重。旧补面与整上衣重网格方案已弃，不可接回。

最新试穿件 `legacy-sleeves-v4/compressed/bamboo.glb`：2801560 字节、53273 面，SHA256 `915619d8554d790fb9855cdf386eb702b27120832685ac4e316e5b5ed4e64a46`。正式 cuff-v2 没有替换。复现顺序 `rebuild.py`（每次从 cuff-v2 原源打开）→ `stabilize.py` → `compressed/pack-morphs.py`；当前 stabilizer 不需调整顶点。Draco 坐标精度 20 位，cloth 与原袖缘 FLOAT 形变不可取消，16 位坐标在重导入后曾使一处细面翻转。

最终重导入 64 体型零翻面、3 极小近零面积面；双内核四体型/六区染色/举手击掌与 Chrome 坐姿等回归实图已检查，`highfive.gif` 为实际 112 帧正面与斜侧动作。`preservation-report.json` 验证腰带/裤鞋坐标、UV、morph 不变，原领缘及袖缘坐标不变，裙摆距原表面最大 1.67e-8，骨架矩阵不变；腰带权重调整与布身法线重算单独保留。`compressed/` 才是本次最终验证对象，其余预览目录仅排查过程。未实体 iPhone 或穷举全碰撞；造型仍待 Lisa 确认。


## 最新收肩：shoulder-v5，待看未发布

Lisa随后指出legacy-sleeves-v4肩变宽，因此v4不再作为最新造型。shoulder-v5从v4源局部横向内收上肩最多10%，肩高不变，保留接好的身侧、腰带和袖口。narrow.py使用基准顶点选区驱动所有六形变，不能按变高后的坐标重新选区；否则调身高时会误收腰身。雅可比最小.722，所有部件高度零变化，非布身部件及布身z≤.55在全部形变中零差，UV和骨架不变。

最新 `shoulder-v5/compressed/bamboo.glb` 2801616字节/53273面，SHA `2fe013c1f1f6112634e8d93093b5bfe070e329999ef6ae30b869cfee89d7914a`。流程narrow.py（固定读取legacy-sleeves-v4源）→ compressed/pack-morphs.py；继承20位坐标与cloth/cuff FLOAT。64体型零翻面、3极小近零面积面，双内核四体型/六色/举手击掌、112帧连续动作和坐姿等回归已看。证据README、narrow-report、preservation-report、compressed/及highfive.gif；固定区验证脚本在同聊天outfit-85d617/raised-v4/check-preservation.py，包含两套校验。正式仍cuff-v2，未发布。
