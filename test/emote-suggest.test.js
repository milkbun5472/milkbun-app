// 她 2026-11-01 群友：「输入关键词出表情包，就像微信QQ」
const assert = require("node:assert/strict");
const comp = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const ts = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "theme-studio.js"), "utf8");
const seg = comp.slice(comp.indexOf("function emoteHits("), comp.indexOf("function EmoteSuggest("));
const emoteHits = new Function(seg + "; return emoteHits;")();
const packs = [{ emotes: [{ id: 1, keyword: "我倒下惹", url: "a" }, { id: 2, keyword: "开心", url: "b" }, { id: 3, keyword: "超开心", url: "c" }] },
  { emotes: [{ id: 4, keyword: "开心", url: "b" }, { id: 5, keyword: "晚安", url: "d" }] }];
assert.deepEqual(emoteHits(packs, "开心").map(x => x.url), ["b", "c"], "一模一样的排最前，同一张图不重复");
assert.deepEqual(emoteHits(packs, "倒下").map(x => x.url), ["a"]);
assert.deepEqual(emoteHits(packs, "好困晚安").map(x => x.url), ["d"], "短句里含着名字也算");
assert.deepEqual(emoteHits(packs, "今天真的是累死了好想睡觉了晚安"), [packs[1].emotes[1]], "长句只看句尾");
assert.deepEqual(emoteHits(packs, "今天真的是累死了好想睡觉了晚安呀"), []);
assert.deepEqual(emoteHits(packs, "  "), []);
// 单聊、群聊都挂；面板和联想共用一个发送函数
assert.equal((comp.match(/emotePacks: emotePacks, onEmote: sendMyEmote,/g) || []).length, 2);
assert.equal((comp.match(/const sendMyEmote = em =>/g) || []).length, 2);
assert.equal((comp.match(/onPick: em => \{ sendMyEmote\(em\); set/g) || []).length, 2);
// 停手才比
assert.match(comp, /const hits = emoteHits\(emotePacks, draft\);[\s\S]{0,200}\}, 250\);/);
assert.match(ts, /\["emotesuggest", /);
console.log("ok");
