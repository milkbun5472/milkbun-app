import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const cmp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("停手几秒自己回：数秒时亮正在输入，点输入框就收，停止键只在真生成时出", () => {
  assert.match(cmp, /const \[fakeTyping, setFakeTyping\] = useState\(false\)/);
  assert.match(cmp, /if \(busy\(\)\) \{ setFakeTyping\(false\); return; \} setFakeTyping\(true\);/);
  assert.match(cmp, /\(sending \|\| fakeTyping\) && h\("div", \{/);
  assert.match(cmp, /sending && onStopGen && h\(GenStopX/);
});
