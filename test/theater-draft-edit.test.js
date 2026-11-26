const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/theater.js", "utf8");
assert(/"data-wk": "thrdraftedit", value: draft\[f\]/.test(s), "draft fields editable");
assert(/setDraft\(d => d \? Object\.assign\(\{\}, d, \{ \[f\]: v \}\)/.test(s), "edits write back to draft");
console.log("ok theater-draft-edit");
assert(/"data-wk": "thrdrafttitle", value: draft\.title/.test(s), "title editable");
