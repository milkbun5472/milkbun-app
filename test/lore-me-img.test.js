// 世界书「谁能拿到」能挑「我」（群友 2026-11-28）：绑给我的生图设定，画到她时才带
const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ui = R("screens-ui.js"), eng = R("engine.js");
assert(/const LORE_ME = \{ id: "me", name: "我"/.test(ui) && /const characters = \[LORE_ME\]\.concat\(chars0 \|\| \[\]\);/.test(ui));
assert(/\.map\(x => x === "__me" \? "me" : x\)/.test(eng) && /opts\.kind === "duo" && opts\.me/.test(eng));
const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" }, document: { addEventListener() {} } };
vm.createContext(ctx); try { vm.runInContext(eng, ctx); } catch (e) {}
const sel = vm.runInContext("selectLore", ctx);
const lore = [{ id: "a", payload: "我的画风", category: "生图", alwaysOn: true, charIds: ["me"], scope: { chat: true } }];
assert.equal(sel(lore, { scope: "img", charIds: ["c1", "me"], text: "" }).length, 1, "画到她时带");
assert.equal(sel(lore, { scope: "img", charIds: ["c1"], text: "" }).length, 0, "只画角色时不带");
console.log("ok lore-me-img");
