// 新票里没有「理念对上」：模型交上来也记成「这一轮说得好」（她 2026-09-23：「还是不行。。。还是全部理念对上」）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const dbt = fs.readFileSync(__dirname + "/../js/debate.js", "utf8");
const fn = name => { const i = dbt.indexOf("function " + name + "("); return dbt.slice(i, dbt.indexOf("\n  }\n", i) + 4); };
const ctx = {}; vm.createContext(ctx);
const i = dbt.indexOf("const VOTE_WHY = ");
vm.runInContext(dbt.slice(i, dbt.indexOf("\n", i)) + "\n" + fn("settleVotes") + "\nthis.settle = settleVotes;", ctx);
const out = ctx.settle([{ name: "江识", for: "顾暮", why: "value", reason: "有限才有重量" }], ["江识"], ["顾暮", "沈屿白"], {}, []);
assert.strictEqual(out[0].why, "round");
const vb = dbt.slice(dbt.indexOf("const voteBlock = benchBlock"), dbt.indexOf("const sys = AC()"));
assert(!/· value＝/.test(vb), "提示词里不再给「理念对上」这一项");
assert(/round|moved|friend|random/.test(dbt));
console.log("debate-no-value-vote ok");
