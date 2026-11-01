// 她 2026-11-01 群友：「这个日历图标换不了吗」——缩成 1×1 图标的组件不在换图标名单里
const assert = require("node:assert/strict");
const comp = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const list = comp.slice(comp.indexOf("window.HomeAppList = function"), comp.indexOf("const onTS = e =>"));
assert.match(list, /REG\[k\]\.kind === "widget" && homeSizeOf\(k, widgetSizes\) === "icon"/);
assert.match(list, /HOME_WIDGET_NAMES\[REG\[k\]\.which\]/);
// 那一格画图标时 appKey 就是组件自己的 key，GlassIcon 照它找自定义图
assert.match(comp, /h\(GlassIcon, \{ G: wIcon\.G, label: HOME_WIDGET_NAMES\[it\.which\] \|\| "组件", appKey: key,/);
assert.match(comp, /const customSrc = appIconSrc\(appKey\);/);
console.log("ok");
