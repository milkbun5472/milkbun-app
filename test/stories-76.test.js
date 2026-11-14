const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
test("版面：模型给的 0~1 位置换成拼壁纸画布的坐标，越界的夹住", () => {
  global.window = { Collage: { BGS: { cream: {}, night: {} } } };
  global.loadJSON = () => []; global.saveJSON = () => true;
  new Function(R("stories.js"))();
  const L = window.Stories.layoutFrom({ bg: "night", font: "serif", texts: [{ t: "下雨了", x: 0.5, y: 2, size: 999, color: "#fff" }], stickers: [{ ch: "☔", x: 0.1, y: 0.1, size: 100 }] }, true);
  assert.equal(L.tpl, "blank"); assert.equal(L.bg, "night");
  assert.equal(L.free[0].type, "photo"); assert.equal(L.free[1].text, "下雨了");
  assert.ok(L.free[1].y <= 2340 * 0.95 && L.free[1].size <= 180);
  assert.equal(L.deco[0].ch, "☔");
  assert.equal(window.Stories.layoutFrom({ bg: "nope" }, false).bg, "cream");
});
test("接线：聊天回复里的 story、开关跟着朋友圈、TA 看得到她的动态、聊天列表头像框、朋友圈主页过往", () => {
  const A = R("app.js"), C = R("components.js"), E = R("engine.js"), I = fs.readFileSync(__dirname + "/../index.html", "utf8");
  assert.match(A, /const storyOnFor = id => \{ const s = settingsFor\(id\) \|\| \{\}; return s\.autoStory != null \? !!s\.autoStory : !!s\.autoMoment; \};/);
  assert.match(A, /story:string=顺手发一条限时动态/); assert.match(A, /if \(_st\) storyMake\(char, _st\);/);
  assert.match(A, /storyLine: \(\(\) => \{/); assert.match(E, /if \(!ctx\.notRoleplay && ctx\.storyLine\) parts\.push\(ctx\.storyLine\);/);
  assert.match(A, /onStoryReply: \(st, tx, kind\) => \{/);
  assert.match(C, /storyRing\(c\.id, h\(Avatar/); assert.match(C, /startTpl: "blank"/); assert.match(C, /h\(window\.Stories\.StoryArchive/);
  assert.match(C, /settings\.autoStory != null \? !!settings\.autoStory : !!settings\.autoMoment/);
  assert.match(I, /<script src="js\/stories\.js\?v=/);
});
test("每 24 小时最多挂几条：满了就不给 story 这一格", () => {
  const A = R("app.js"), C = R("components.js");
  assert.match(A, /const storyRoomFor = id => storyOnFor\(id\) && !\(window\.Stories && window\.Stories\.activeOf\(id\)\.filter\(s => !s\.manual\)\.length >= storyMaxFor\(id\)\);/);
  assert.equal((A.match(/storyRoomFor\(charId\)\) openCaps\.push\("story"\)/g) || []).length, 2);
  assert.match(C, /"data-wk": "storymax"/); assert.match(A, /storyMax: Math\.max\(1, Math\.min\(10, Number\(s\.storyMax\) \|\| 3\)\)/);
});
test("她叫出来的那条不占名额", () => {
  const A = R("app.js"), C = R("components.js");
  assert.match(A, /activeOf\(id\)\.filter\(s => !s\.manual\)\.length >= storyMaxFor\(id\)/);
  assert.match(A, /onStoryNow: id => \{[^\n]*storyMake\(c, "", true\)/);
  assert.match(C, /\["让 TA 发", "[^"]*", \(\) => setStAsk\(true\), "storynow"\]/); assert.match(C, /onStoryNow\(c\.id\)/);
});
test("朋友圈里头像带框、点头像看动态、点名字进主页", () => {
  const C = R("components.js");
  assert.match(C, /onClick: \(\) => \{ const act = mfAct\(c\.id\); if \(act\.length\) setMfStory\(act\); else onOpenProfile\(c\.id\); \}/);
  assert.match(C, /role: "button", onClick: \(\) => onOpenProfile\(c\.id\)/);
  assert.match(C, /MomentsFeed, \{ onStoryReply,/);
});
test("第二版：贴纸、只给谁看、精选", () => {
  const S = window.Stories;
  assert.equal(S.normSticker({ type: "poll", q: "吃啥", opts: ["火锅"] }), null);
  assert.deepStrictEqual(S.normSticker({ type: "poll", q: "吃啥", opts: ["火锅", "烤肉"] }).opts, ["火锅", "烤肉"]);
  assert.ok(S.normSticker({ type: "countdown", q: "见面", days: 3 }).at > Date.now());
  assert.equal(S.visibleTo({ by: "me", audience: ["a"] }, "b"), false); assert.equal(S.visibleTo({ by: "me", audience: ["a"] }, "a"), true);
  assert.equal(S.visibleTo({ by: "c1" }, "b"), true);
  const A = R("app.js"), C = R("components.js");
  assert.match(A, /storyVote:string=投她限时动态上那个投票/); assert.match(A, /window\.Stories\.vote\(_p\.id, charId, _k\)/);
  assert.match(A, /SK\.activeFor\("me", char\.id\)/); assert.match(A, /sticker: d && d\.sticker,/);
  assert.match(C, /"data-wk": "storypost"/); assert.match(C, /h\(window\.Stories\.StoryHighlights/);
});
test("跟 TA 有关系的人也会看、会投、会回——排卡那一次顺便写，不另花调用", () => {
  const S = window.Stories, A = R("app.js");
  assert.equal(typeof S.applyCrowd, "function");
  assert.match(A, /const related = \(characters \|\| \[\]\)\.filter\(c => c && c\.id !== char\.id && \(\(rels \|\| \{\}\)\[char\.id \+ "->" \+ c\.id\]/);
  assert.match(A, /window\.Stories\.applyCrowd\(_row\.id, d\.crowd\.map/);
  assert.match(A, /\\"crowd\\":\[/);
});
test("去重、自动翻页、头像、补图", () => {
  const S = window.Stories, A = R("app.js"), J = R("stories.js");
  assert.equal(S.similar("更衣室走廊温度正常", "更衣室走廊温度正常！"), true);
  assert.equal(S.similar("下雨了", "今天吃火锅"), false);
  assert.match(A, /if \(idea && window\.Stories\.dupOf\(char\.id, idea\)\) return;/);
  assert.match(J, /const paused = held \|\| typing \|\| !!draft \|\| !!ans/); assert.match(J, /const DUR = 6000/);
  assert.match(J, /window\.__storyAvatar/); assert.match(A, /window\.__storyGenPhoto = async st =>/);
  assert.match(A, /raw: d \|\| null, photoDesc: d && d\.photo, photoKind: d && d\.photoKind,/);
  assert.ok(J.indexOf("const DUR = 6000") < J.indexOf("if (!s) return null;"), "hook 在提前 return 前面");
});
test("谁的动态都能删、图会画什么默认收着", () => {
  const J = R("stories.js");
  assert.match(J, /"data-wk": "storydel", onClick: \(\) => \{ const doIt/); assert.ok(!/mine && onDelete \? h\("button", \{ "data-wk": "storydel"/.test(J));
  assert.match(J, /const \[photoOpen, setPhotoOpen\] = React\.useState\(false\)/);
});
test("TA 自己挑谁能看：仅她、密友、所有人", () => {
  const S = window.Stories, A = R("app.js");
  assert.equal(S.visibleTo({ by: "c1", audience: ["me"] }, "c2"), false); assert.equal(S.visibleTo({ by: "c1", audience: ["me"] }, "me"), true);
  assert.equal(S.audLabel({ by: "c1", audience: ["me"] }), "仅你可见"); assert.equal(S.audLabel({ by: "c1", audience: ["me", "c2"] }), "密友可见");
  assert.match(A, /const _aud = _who === "me" \? \["me"\] : _who === "close" && _close\.length \? \["me"\]\.concat\(_close\) : null;/);
});
test("第三版：表情回应、存图、秒删、深夜、信息贴纸、转发、同框、群里", () => {
  const J = R("stories.js"), A = R("app.js"), C = R("components.js");
  assert.match(J, /\["❤️", "😂", "😮", "😢", "🔥", "👏"\]/); assert.match(J, /markSaved\(s\.id, viewer\)/);
  assert.match(J, /function sweep\(\)/); assert.match(J, /"data-wk": "storyghost"/);
  const L = window.Stories.layoutFrom({ bg: "night", texts: [{ t: "睡不着", color: "#111111" }], chips: [{ type: "location", text: "江边", x: .3, y: .1 }] }, false);
  assert.equal(L.free.find(f => f.text === "睡不着").color, "#f3eee8"); assert.ok(L.free.some(f => f.text === "📍 江边" && f.tstyle === "strip"));
  assert.match(A, /deleteAt: _regret \? Date\.now\(\) \+ _regret \* 60000 : 0/); assert.match(A, /if \(d && _night\) d\.bg = "night";/);
  assert.match(A, /storyRepost:string=/); assert.match(A, /const storyRepost = async \(char, comment\) =>/);
  assert.match(A, /看过了，什么也没说/); assert.match(A, /把这张存下来了/);
  assert.match(C, /"data-wk": "storyco"/); assert.match(A, /const gStoryHint = /);
});
test("动态上的歌真的能听", () => {
  const J = R("stories.js"), A = R("app.js"), C = R("components.js");
  assert.match(J, /"data-wk": "storymusic", onClick: \(\) => window\.__storyPlay\(cur\.music\)/);
  assert.match(A, /window\.__storyPlay = \(m, auto\) => \{[^\n]*playSong\(/); assert.match(A, /music: _music,/);
  assert.match(C, /"data-wk": "storywithsong"/);
});
test("没一起听也能挂歌：TA 点名一首，去云村搜到才挂；搜歌跟唱片共用一份", () => {
  const A = R("app.js");
  assert.match(A, /const searchSong = async query =>/); assert.match(A, /const song = Object\.assign\(songFromSearch\(sr\), \{ by: "me"/);
  assert.match(A, /if \(!_song && d && d\.song\) \{ const sg = await searchSong\(/);
});

test("歌自动放、做成顶上的横幅；补的图贴在原卡上", () => {
  const J = R("stories.js"), A = R("app.js");
  assert.match(J, /window\.__storyPlay\(m, true\);\s*\n\s*return \(\) => \{ if \(window\.__storyStop\) window\.__storyStop\(\); \};/);
  assert.match(J, /async function overlayPhoto\(cardBlob, photoBlob, raw\)/); assert.match(J, /await overlayPhoto\(card, photoBlob, s0\.raw\)/);
  assert.match(A, /window\.__storyStop = \(\) =>/);
  assert.ok(J.indexOf("window.__storyPlay(m, true)") < J.indexOf("if (!s) return null;"), "hook 在提前 return 前面");
});
