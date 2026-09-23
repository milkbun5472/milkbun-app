// ① 上一轮就投这个人、这一轮还投TA，不算「被说动」；② 新一回合出来停在这一回合开头，不沉底
// （她 2026-09-23：「原本就是同一边的立场就不应该第二回合显示是被说动吧。还有每一回合出来的都会跳到最下面」）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const dbt = fs.readFileSync(__dirname + "/../js/debate.js", "utf8");
const fn = name => { const i = dbt.indexOf("function " + name + "("); assert(i > 0, name); return dbt.slice(i, dbt.indexOf("\n  }\n", i) + 4); };
const ctx = {}; vm.createContext(ctx);
const i = dbt.indexOf("const VOTE_WHY = ");
vm.runInContext(dbt.slice(i, dbt.indexOf("\n", i)) + "\n" + fn("settleVotes") + "\nthis.settle = settleVotes;", ctx);
const raw = [{ name: "陆衍", for: "顾暮", why: "moved", reason: "那句戳到我了" }];
let v = ctx.settle(raw, ["陆衍"], ["顾暮", "沈屿白"], { "陆衍": ["顾暮"] }, []);
assert.strictEqual(v[0].why, "round", "一直投这个人的不是被说动，记成「这一轮说得好」（v73.314）");
assert.strictEqual(v[0].reason, "那句戳到我了", "理由照留");
v = ctx.settle(raw, ["陆衍"], ["顾暮", "沈屿白"], { "陆衍": ["沈屿白"] }, []);
assert.strictEqual(v[0].why, "moved", "真换了边才是被说动");
assert(/reason 里点出是哪句话的意思，哪怕说这句的人跟TA不是一边/.test(dbt), "被说动要点出哪句（v73.312 起票跟着这一轮走）");
// 滚动
assert(/"data-round": ri2/.test(dbt));
assert(/querySelector\('\[data-round="' \+ \(n - 1\) \+ '"\]'\)/.test(dbt));
assert(!/useEffect\(\(\) => \{ const el = feedRef\.current; if \(el\) el\.scrollTop = el\.scrollHeight; \}/.test(dbt), "不再一律沉底");
console.log("debate-moved-and-scroll ok");
