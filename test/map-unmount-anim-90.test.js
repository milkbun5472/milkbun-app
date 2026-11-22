// 地图页关掉时先停动画再拆，防止「_leaflet_pos」报错
const assert = require("assert"); const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/map.js", "utf8");
const i = s.indexOf("clearTimeout(tSize)");
assert(i > 0, "收起时清掉 invalidateSize 计时器");
const seg = s.slice(i, i + 600);
assert(seg.indexOf("map.stop()") >= 0 && seg.indexOf("map.stop()") < seg.indexOf("map.remove()"), "先 stop 再 remove");
assert(/_onZoomTransitionEnd = function \(\) \{\}/.test(seg), "缩放收尾回调置空");
console.log("ok map-unmount-anim-90");
