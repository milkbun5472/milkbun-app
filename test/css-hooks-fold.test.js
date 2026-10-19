// 她 2026-10-19：设置、聊天设置写 CSS 那里，挂点列表太长刷不到下面的保存——叠起来
const assert = require("node:assert/strict");
const ui = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
const seg = ui.slice(ui.indexOf("function CssHookPicker"), ui.indexOf("g.CssHookPicker = CssHookPicker"));
assert.match(seg, /const \[openRows, setOpenRows\] = useState\(\{\}\);/, "默认要收着");
assert.match(seg, /!isOpen \? null : h\("div", \{ className: "flex flex-wrap"/);
assert.match(seg, /"data-wk": "csshookgroup"/);
assert.match(seg, /minHeight: 40, padding: "0 10px"/, "展开键要够大");
const ts = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "theme-studio.js"), "utf8");
assert.match(ts, /\["csshookgroup", /, "新挂点要登记");
console.log("ok");
