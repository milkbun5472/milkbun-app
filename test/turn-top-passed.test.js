// 她自己往下翻过了这一轮开头，后面的消息不把她拽回去（她 2026-11-04）
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
test("翻过就记 passed、不再滚回这一轮开头", () => {
  assert.match(s, /else if \(turnTopRef\.current !== "passed"\) \{/);
  assert.match(s, /if \(el\.scrollTop > top \+ 24\) turnTopRef\.current = "passed";\n\s*else if \(el\.scrollHeight - el\.clientHeight > top\) \{ el\.scrollTo\(\{ top, behavior: "smooth" \}\); return; \}/);
});
