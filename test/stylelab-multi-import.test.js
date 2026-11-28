// 文风台一次导好几篇（她 2026-11-28：zip 里 12 个文档只拆出来一个）：全放进同一条预设，每篇一块能单独开关
const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const lab = fs.readFileSync(path.join(__dirname, "..", "js", "style-lab.js"), "utf8");
assert(/if \(files\.length > 1\) \{/.test(lab) && /SP\.fromPromptList\(\{ prompts: blocks \}, "导入的 " \+ blocks\.length \+ " 篇"\)/.test(lab), "好几份走拆块那一路");
assert(/ref: fileRef, type: "file", multiple: true/.test(lab), "能多选");
const store = {}, ctx = { console, window: {}, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, loadJSON: (k, d) => d, saveJSON() {} };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "style-presets.js"), "utf8"), ctx);
const SP = ctx.window.StylePresets;
const tv = SP.fromPromptList({ prompts: Array.from({ length: 12 }, (_, i) => ({ name: "版块" + (i + 1), content: "第" + (i + 1) + "块的正文" })) }, "导入的 12 篇");
assert.equal(tv.modules.length, 12); assert.equal(tv.presets.length, 1); assert.equal(tv.presets[0].mods.length, 12);
console.log("ok stylelab-multi-import");
