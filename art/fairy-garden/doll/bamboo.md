# 竹纹交领袍（bamboo）

Lisa 于 2026-11-15 要求发布袖口染色修正版 cuff-v2。整套穿戴，沿公共衣柜、存档、DollRig 与按需加载；外袍、领缘与袖缘、裤子、腰带、靴子、鞋底六区独立染色，竹纹随外袍。

正式资产 `apps/fairy-garden/outfits/bamboo.glb`：2609236 字节，50392 三角面，SHA256 `8f0640f70e109cec8f6ad0bd45611de0a0b6860ec7b3fcfa050d4c07f80513f3`。六个体型 morph；cloth/trim/accent 另含衣服自身 seated 形变，复用既有动作驱动。身体、骨架与公共动作代码不为本套改变。

目录源 `prepared_outfits.json`，以 `dye_regions.py` 同步 doll.json 与 outfits.mjs。独立模型不经旧母包重导出；沿 split_outfits.py 的独立资产保护机制保留。

本机复现与证据根：`/Users/lisa/.codex/visualizations/2026/11/14/01a1db51-77f8-71f2-badb-f7fdb5d9bf46/hunyuan-a873ea/`，原输入 `/Users/lisa/Downloads/a873ea6a68decb866d60e12308acf08b.glb`。当前源 `cuff-v2/bamboo-ready.blend`；从父级最终源经 cuff-v2/fix-cuffs.py 精确切分袖口边界，插值 UV、法线、骨权重及形变，并重新中和局部纹理；再经 cuff-v2/compressed/pack-morphs.py 压缩。袖缘形变必须保留浮点精度；全量 SHORT 曾造成极小翻面，已撤回。

压缩后重导入64体型端点零翻面，6处极小近零面积三角面；Chrome/WebKit 六区、92%/默认/极小/极大体型的走坐抬手检查通过且零页错。正式衣柜检查与发布证据放 cuff-v2/release/。领口接缝和坐姿侧面内层保留为造型复看项；未实体 iPhone 验证或穷举全身碰撞。

详细失败试验与共用注意事项见 `施工规则/model-outfit-review.md` 及本机 README；不要将已撤销的 seated-legs-preview.mjs 短上衣试验接入运行时。
