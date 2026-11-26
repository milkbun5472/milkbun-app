const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const i = s.indexOf("function PhoneLockScreen"), j = s.indexOf("\nfunction Spinner", i), seg = s.slice(i, j);
assert(i > 0 && j > i, "找得到锁屏");
assert(!/[hH]eight: "100dvh"/.test(seg), "锁屏高度跟外壳走，不写 100dvh（iOS 壳里底下会露一条）");
assert(/"data-wk": "phonelock", className: "h-full"/.test(seg), "锁屏铺满外壳");
console.log("ok phone-lock-fill");
