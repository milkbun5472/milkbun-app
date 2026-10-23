// 群里 2026-10-23「系统通知刷新失败我想 ❌ 掉会给我跳到很前面」：条数变少（删了东西）原地不动；换聊天照常钉到底
const assert = require("node:assert/strict");
const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "components.js"), "utf8");
const body = src.slice(src.indexOf("function useShrank(key)"), src.indexOf("function pinToBottom(el, ms)"));
// 跟 React 一样：同一个组件每次重画按顺序拿回同一批 ref
const store = []; let slot = 0; const useRef = v => { const i = slot++; if (!store[i]) store[i] = { current: v }; return store[i]; };
const useShrank = new Function("useRef", body + " return useShrank;")(useRef);
const render = key => { slot = 0; return useShrank(key); };
assert.equal(render("a")(10), false);
assert.equal(render("a")(11), false, "多了一条不算删");
assert.equal(render("a")(10), true, "删了一条要认出来");
assert.equal(render("b")(3), false, "换到条数少的聊天不该当成删了东西");
assert.equal(render("b")(4), false);
assert.equal((src.match(/if \(shrank\(messages\.length\)\)/g) || []).length, 2, "单聊、群聊都要有");
console.log("ok");
