const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
assert(/ref: importRef, type: "file", multiple: true/.test(s), "file input allows multiple");
assert(/files\.length > 1 && onImportMany/.test(s), "batch path");
assert(/onImportMany\(all, "批量导入"\)/.test(s), "batch goes to one folder");
console.log("ok lore-batch-import");
