import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const comp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("幸运字符：收藏本里点满的也能挑来挂，再点一下换回正在点的", () => {
  assert.match(app, /if \(i && typeof i === "object" && "wear" in i\)/);
  assert.match(app, /wear: sb\.wear === w \? "" : w, hideBadge: false/);
  assert.match(comp, /if \(lucky && lucky\.wear && !lucky\.hideBadge && \(lucky\.book \|\| \[\]\)\.some/);
  assert.match(comp, /"data-wk": "gluckywear"/);
  assert.match(comp, /lk\.word \|\| book\.length \? h\("div", \{ "data-wk": "gluckybadgeset"/);
});
