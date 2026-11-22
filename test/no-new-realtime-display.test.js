// 时间照虚拟时间走（她 2026-11-22「虚拟时间也搞个测试吧，以后加了时间感知相关的，就要确保跟上虚拟时间」）。
// 屏幕上、给模型看的钟点和日期，开了虚拟时间就该是那边的钟：拿到时间戳先过 vclockMap(ts, charId)（或 vclockMapBy），再 new Date。
// 这是一道棘轮：下面是现在每个文件里「直接拿真实时间戳出日子/钟点」的处数——有的是真该用现实时间的（存档文件名、调用记录、导出日期），
// 只许变少不许变多。新加一处直接 new Date(x.ts)／toLocaleTimeString 的就红：
//   该跟虚拟时间的 → 包一层 vclockMap；确实就是现实时间（日志、文件名）→ 调高这里的数，并在那一行写一句为什么。
const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"); const path = require("path");
const BASE = {"app.js":20,"ask-slip.js":1,"char-day-thoughts.js":2,"chat-stamp.js":2,"collage.js":1,"components.js":11,"date-game.js":1,"dreamjournal.js":1,"dwell.js":1,"engine.js":4,"fairy-garden.js":1,"gaze.js":1,"heart.js":1,"impression-core.js":1,"ledger.js":2,"live.js":1,"phone-ui.js":6,"phone-watch.js":1,"phone.js":2,"pomodoro.js":2,"screens-ui.js":20,"screens.js":6,"shike-core.js":2,"shike.js":1,"shua.js":2,"stamp-duel-ui.js":8,"stamp-run-ui.js":7,"stamps.js":3,"stories.js":2,"study.js":5,"tarot.js":1,"temporal-anchor.js":2,"theater.js":2,"trpg.js":1,"weekly.js":2};
const RE = /new Date\(\s*(?:[A-Za-z_$][\w$.]*\.)?(?:ts|_ts|lastTs|savedTs|createdTs|updatedTs|endTs|startTs)\s*\)|toLocale(?:Time|Date)String\(/g;
test("没有新的直接拿真实时间戳显示钟点/日期的地方", () => {
  const dir = path.join(__dirname, "..", "js"), over = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js"))) {
    const n = (fs.readFileSync(path.join(dir, f), "utf8").match(RE) || []).length;
    if (n > (BASE[f] || 0)) over.push(f + "：" + n + " 处（上限 " + (BASE[f] || 0) + "）");
  }
  assert.deepStrictEqual(over, [], "新加了 new Date(…ts)／toLocaleTimeString。开了虚拟时间要跟那边的钟：先过 vclockMap(ts, charId)；确实是现实时间才调高上限：\n" + over.join("\n"));
});
test("vclockMap 还在（这道闸指望它）", () => {
  assert.match(fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8"), /function vclockMap\(ts, id\)/);
});
