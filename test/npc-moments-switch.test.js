const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("配角发朋友圈：配角页有开关，开了的配角进发帖池，朋友圈里摆得出来；更多评论一轮条数跟名单长", () => {
  assert.match(comp, /"data-wk": "npcmoments"/);
  assert.match(comp, /onSetMoments\(cur\.id, !cur\.npcMoments\)/);
  assert.match(app, /onSetNpcMoments: \(id, v\) => pC\(p => p\.map\(c => c\.id === id && c\.npc \? \{ \.\.\.c, npcMoments: !!v \} : c\)\)/);
  assert.match(app, /liveChars\.concat\(\(characters \|\| \[\]\)\.filter\(c => c && c\.npc && c\.npcMoments\)\)\.filter\(c => autoRefreshOn\("moments", c\.id\)\)/);
  assert.match(comp, /\(npcs \|\| \[\]\)\.find\(x => x && x\.id === m\.characterId\)/);
  assert.match(app, /Math\.max\(3, Math\.min\(8, _momPool \+ 1\)\)/);
});

test("他身边开了发朋友圈的配角：发的那几条进他手机朋友圈，推演不再替这个配角编", () => {
  assert.match(app, /o\.npc && o\.npcMoments && String\(o\.ownerId \|\| ""\) === String\(char\.id\)\) ids\.add/);
  assert.match(app, /\.filter\(o => o && \(!o\.npc \|\| o\.npcMoments\)\)\.flatMap/);
});
