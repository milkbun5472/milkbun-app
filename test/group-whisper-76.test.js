// 群聊悄悄话（2026-10-30）：whisper 字段落成灰字一行；历史里标明只有谁听见；跨场景只进说的和被说的人
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("提示里有悄悄话这一栏，并接进群聊 system", () => {
  assert.match(app, /const gWhisperHint = members\.length >= 2/);
  assert.match(app, /gLuckyHint \+ gWhisperHint \+ gKickInviteHint/);
});
test("落成带 whisper 的旁白行，记下对谁", () => {
  assert.match(app, /role: "narration", kind: "narration", who: "char", whisper: true,/);
  assert.match(app, /toId: _wc \? _wc\.id : "me"/);
});
test("群历史标明只有谁听见；跨场景只给说的和被说的人", () => {
  assert.match(app, /m\.whisper \? "【悄悄话·只有 "/);
  assert.match(app, /if \(m\.whisper && m\.senderId !== charId && m\.toId !== charId\) return;/);
});
test("显示成「某某 悄悄对某某说：」", () => {
  assert.match(comp, /if \(m\.whisper\) return nm \+ " 悄悄对"/);
});
