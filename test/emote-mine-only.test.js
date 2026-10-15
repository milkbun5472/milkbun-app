const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i >= 0, a); return app.slice(i, app.indexOf(b, i)); };

// 她 2026-10-15：「我要单独只给自己用的」——我能不能发只看 mine，角色那边才看 global / charIds
test("我的表情选择器只看「我自己也能发」，不看谁都能用和贴的名字", () => {
  const flat = cut("const emotesForCharMine = charId =>", "const emotesForGroupMine");
  assert.match(flat, /if \(pk\.mine !== false\) \(pk\.emotes/);
  assert.ok(flat.indexOf("pk.global") < 0, "又让 global 管我自己了");
  const packs = cut("const emotePacksForChar = charId =>", "const emotePacksForGroup");
  assert.match(packs, /\.filter\(pk => pk && pk\.mine !== false\)/);
  // 她 2026-10-16：「表情包专属的我想在他的界面只显示他的，不要其他角色的」——跟某个人聊天时，专属给【别人】的那几套不摆；
  //   全局的、没指定给谁的（只给自己用的那种）照旧都摆。「我自己也能发」关了的仍然一处都不摆。
  assert.match(packs, /pk\.global \|\| !\(pk\.charIds \|\| \[\]\)\.length \|\| \(pk\.charIds \|\| \[\]\)\.map\(String\)\.includes\(String\(charId\)\)/);
});
