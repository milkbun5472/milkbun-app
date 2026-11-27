const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
assert(/ref: importRef, type: "file", multiple: true/.test(s), "file input allows multiple");
assert(/files\.length > 1 && onImportMany/.test(s), "batch path");
// 导好几条先停下来挑「给谁看·分类·去哪儿」，对全部一次生效（她 2026-11-27：开两个世界的设定互相串）
assert(/askMany\(all, "批量导入"\)/.test(s) && /if \(onImportMany\) \{ askMany\(list, file\.name\); return; \}/.test(s), "多条导入先停在设置页");
assert(/const saveMany = \(\) => \{[\s\S]{0,600}category: f\.category, scope: Object\.assign\(\{\}, f\.scope\), priority: f\.priority[\s\S]{0,200}onImportMany\(list, f\.folder \|\| "", \(f\.charIds \|\| \[\]\)\.slice\(\)\)/.test(s), "挑的设置对全部生效");
assert(/onImportMany: onImportMany \? \(list, bookName, ids\) => \{ onImportMany\(list, ids \|\| editing\.charIds/.test(s), "给谁看传到存档");
console.log("ok lore-batch-import");
