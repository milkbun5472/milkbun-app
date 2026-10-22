// 她 2026-10-23「一起听回来还是不能继续自动播放」
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("回来时播放器自认在放、声音却停了，也算被打断；直接放被拒就等她点一下", () => {
  assert.ok(app.includes("if (!interruptedRef.current && !(playingRef.current && !userPauseRef.current)) return;"));
  assert.ok(app.includes('.catch(() => { if (!fromTap) arm(); });'));
  assert.ok(app.includes('document.addEventListener("pointerdown", onTap, true);'));
  assert.ok(app.includes("const onFocus = () => resume(false);"), "focus 传进来的 Event 不能被当成「点过了」");
});
