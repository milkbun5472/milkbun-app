// 双语角色开头漏出的一段中文草稿不进气泡；短短一句中文照旧留着
import { readFileSync } from "node:fs"; import assert from "node:assert/strict"; import vm from "node:vm";
const src = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.match(/function joinBilingualLines[\s\S]*?\n}\n/)[0], ctx);
const j = (l) => ctx.joinBilingualLines(l, false, { pairNext: true });
assert.deepEqual(j(["（…）我脸上画了个箭头", "又在肩膀那块画了个什么形状", "像是歪歪扭扭的……他愣了两秒才反应过来那是什么意思。……は?", "なにこれ顔に矢印描いて | 这是什么在脸上画一个箭头", "何のつもりだよ | 什么意思啊"]).length, 2);
assert.equal(j(["我在这儿", "いいね | 好啊", "どう | 怎么样"]).length, 3);
assert.equal(j(["今天去吃了火锅超级辣的我都流眼泪了哈哈哈", "いいね | 好啊", "中间这句中文也留着因为不在开头那一截里面", "どう | 怎么样"]).length, 4);
console.log("bilingual lead draft ok");
