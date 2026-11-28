const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
// 群友 2026-11-28「功德要是不会重置就好了」：三种清零方式，默认照旧停手就清
assert(/const MUYU_MODES = \[\["idle", "停手就清零"\], \["day", "每天清零"\], \["keep", "一直攒着"\]\];/.test(s));
assert(/mode: lookOf\(key\)\.muyuReset/.test(s), "组件认编辑里挑的方式");
assert(/if \(mode === "idle"\) idleT\.current = setTimeout/.test(s), "只有停手模式才 5 秒清零");
assert(/"data-part": "muyureset"/.test(s) && /requestAppConfirm\("功德清零？"/.test(s), "一直攒着那档自己清零、先问一句");
assert(/!cur\.muyuReset/.test(s), "挑了方式不被当成空设置删掉");
console.log("ok muyu-reset-mode");
