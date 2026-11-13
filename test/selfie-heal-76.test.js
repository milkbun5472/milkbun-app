const test = require("node:test"); const assert = require("node:assert");
const C = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
test("自拍气泡显示解不开时先缩小重存再显示一次", () => {
  const i = C.indexOf("function SelfieBubble"), seg = C.slice(i, i + 6000);
  assert.match(seg, /onError: healImg/); assert.match(seg, /createImageBitmap\(b\)/); assert.match(seg, /idbImgPut\(m\.imgKey, nb\)/);
  assert.ok(seg.indexOf("const healTried = useRef") < seg.indexOf("if (m.pending)"), "hook 要在早返回上面");
});
