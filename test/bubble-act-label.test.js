// 模型自己挂了【线下场景】牌子的描写：挪进动作行、并成一行，不再切成白气泡（群里报 2026-09-28）
const assert = require("assert");
const g = require("../js/bubble-act-guard.js");
let r = g.split(["【线下场景】：我规规矩矩地跪坐在床沿边低着脑袋", "双手老老实实搭在自己膝盖上", "头头……不气了好不好"], { secondPerson: true });
assert.deepStrictEqual(r.acts, ["我规规矩矩地跪坐在床沿边低着脑袋，双手老老实实搭在自己膝盖上"]);
assert.deepStrictEqual(r.words, ["头头……不气了好不好"]);
r = g.split(["[场景] 靠在门边", "你回来啦？"], { secondPerson: false });
assert.deepStrictEqual(r.acts, ["靠在门边"], "牌子不看称谓设置");
assert.deepStrictEqual(r.words, ["你回来啦？"]);
r = g.split(["【线下场景】", "手指绕着衣角", "今天好冷"]);
assert.deepStrictEqual(r.acts, ["手指绕着衣角"]); assert.deepStrictEqual(r.words, ["今天好冷"]);
r = g.split(["早", "吃了吗"]); assert.deepStrictEqual(r.acts, []);
console.log("bubble-act-label ok");
