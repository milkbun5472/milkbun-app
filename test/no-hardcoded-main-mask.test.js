// 不许再新写死主面具（她 2026-11-20 立）。
// 跟某个角色说话的地方要用 profileFor(charId)（单聊）或 herNameIn(gid) / groupProfileFor(gid)（群聊），
// 不是 profile / userName(profile)。
// 这是一道棘轮：下面是现存的数量（含真该用主面具的地方，如主面具列表、论坛 ID、生日表）。
// 只许变少不许变多。改掉一处就把这里的数字跟着调小；真要新加一处主面具，先想清楚它是不是全局的。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const BASE = { "app.js": 240, "assistant.js": 2, "astro-core.js": 1, "astro.js": 1, "capsule.js": 1, "companion.js": 1, "components.js": 27, "core.js": 2, "debate.js": 3, "dream.js": 1, "dreamjournal.js": 2, "engine.js": 23, "fairy-garden.js": 18, "fanfic-core.js": 2, "fanfic.js": 2, "games.js": 11, "impression-core.js": 1, "impression.js": 1, "ledger.js": 1, "listen-talk.js": 2, "live.js": 2, "map.js": 1, "memo.js": 1, "phone-ui.js": 8, "pomodoro.js": 1, "read.js": 7, "screens-ui.js": 4, "shike.js": 1, "shua.js": 1, "study.js": 11, "style-lab.js": 2, "tarot.js": 1, "theater.js": 1, "trpg.js": 1, "watch.js": 3, "weekly.js": 1,  };
const RE = /userName\(profile\)|profile\.name/g;
test("没有新写死主面具的地方", () => {
  const dir = path.join(__dirname, "..", "js");
  const over = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js"))) {
    const n = (fs.readFileSync(path.join(dir, f), "utf8").match(RE) || []).length;
    if (n > (BASE[f] || 0)) over.push(f + "：" + n + " 处（上限 " + (BASE[f] || 0) + "）");
  }
  assert.deepStrictEqual(over, [], "新加了 userName(profile) / profile.name。跟角色说话用 profileFor(charId)，群里用 herNameIn(gid)；确实是全局主面具才调高上限：\n" + over.join("\n"));
});
