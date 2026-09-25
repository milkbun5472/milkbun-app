// 一起看（她 2026-09-25：「做吧宝宝做一版试试，然后页面也弄好看点」）
const fs = require("fs"), assert = require("assert"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/../js/watch.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const html = fs.readFileSync(__dirname + "/../index.html", "utf8");

// 1. 字幕：srt / vtt / ass，台词清干净；GBK 字幕按 GB18030 再读一遍
const i = src.indexOf("function clock("), j = src.indexOf("function grabFrame(");
assert.ok(i > 0 && j > i, "抠不出字幕那几件");
const ctx = { TextDecoder, SUB_WINDOW: 90 }; vm.createContext(ctx);
vm.runInContext(src.slice(i, j) + ";this.parseSubs=parseSubs;this.recentLines=recentLines;this.cueAt=cueAt;this.decodeText=decodeText;this.clock=clock;", ctx);
const srt = ctx.parseSubs("1\r\n00:00:01,500 --> 00:00:03,000\r\n<i>你好</i>\r\n\r\n2\r\n00:01:02,000 --> 00:01:04,000\r\n第二句\r\n第二行\r\n");
assert.strictEqual(srt.length, 2);
assert.strictEqual(srt[0].t, "你好", "html 标签没剥");
assert.strictEqual(srt[1].s, 62);
assert.strictEqual(srt[1].t, "第二句 第二行");
const vtt = ctx.parseSubs("WEBVTT\n\n00:00.500 --> 00:02.000\n短时间戳\n");
assert.strictEqual(vtt.length, 1); assert.strictEqual(vtt[0].s, 0.5);
const ass = ctx.parseSubs("[Script Info]\nTitle: x\n\n[Events]\nDialogue: 0,0:00:05.10,0:00:07.00,Default,,0,0,0,,{\\an8}上一句\\N下一句\n");
assert.strictEqual(ass.length, 1); assert.strictEqual(ass[0].t, "上一句 下一句"); assert.strictEqual(ass[0].s, 5.1);
const gbk = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]); // 「你好」的 GBK
assert.strictEqual(ctx.decodeText(gbk), "你好", "GBK 字幕读成乱码了");
// 2. 只喂【到此刻为止】的台词：不往后看
const cues = [{ s: 10, e: 12, t: "早" }, { s: 50, e: 52, t: "中" }, { s: 200, e: 202, t: "晚" }];
const seen = ctx.recentLines(cues, 60).join("|");
assert.ok(/早/.test(seen) && /中/.test(seen) && !/晚/.test(seen), "喂了还没放到的台词");
assert.strictEqual(ctx.cueAt(cues, 51), "中"); assert.strictEqual(ctx.cueAt(cues, 55), "");
assert.strictEqual(ctx.clock(3725), "1:02:05");

// 3. 给TA的头走公共那一份；她刚说的那句不在「说过的」里再发一遍；天花板开满
assert.match(src, /const sys = companionHead\(p\.ctxFor, char\)/);
assert.match(src, /if \(\(mode === "reply" \|\| mode === "frame"\) && past\.length && past\[past\.length - 1\]\.role === "user"\) past\.pop\(\);/);
assert.ok((src.match(/maxTokens: 65535/g) || []).length >= 2);
assert.match(src, /imageDataUrls: frameUrl \? \[frameUrl\] : undefined/, "截的那一帧没发出去");
// 自己开口可以不开口（不强制）
assert.match(src, /没什么想说的就给空数组/);
// 4. 片子本体不进云：视频和字幕在 IndexedDB，localStorage 只有小卡
assert.match(src, /makeTextStore\("WatchTogetherDB", "films"\)/);
assert.match(src, /await _store\.put\(id, video\)/);
// 删之前说清楚：文件只在这台手机上（never-say-delete-first 那一类：删的是只有一份的东西）
assert.match(src, /电影文件只存在这台手机上，删了要重新导入/);

// 5. 接进 app：主屏图标、「一起做」文件夹、路由、记忆
assert.match(cmp, /watch: \{ kind: "app", zh: "一起看", G: IFilm \}/);
assert.match(cmp, /keys: \["study", "read", "watch", "pomodoro"\]/);
assert.match(app, /screen === "watch"\) body = h\(WatchTogether, \{/);
assert.match(app, /entry: \{ source: "watch", tags: \["一起看"\] \}/);
assert.match(html, /<script src="js\/watch\.js\?v=[\d.]+"><\/script>/);
// 6. 触控位 40px、底栏吃 0.4 安全区
assert.match(src, /minHeight: 40/);
assert.match(src, /paddingBottom: COMPOSER_PAD_BOTTOM/);
// 7. 没单独导字幕时，先试视频里自带的字幕轨（她 2026-09-25「字幕必须单独导吗」→「试试」）
assert.match(src, /const adoptInband = \(\) => \{/);
assert.match(src, /t\.kind === "subtitles" \|\| t\.kind === "captions"/);
assert.match(src, /if \(t\.mode === "disabled"\) t\.mode = "hidden";/, "轨不开成 hidden，台词根本不会加载");
assert.match(src, /t\.oncuechange = pull;/, "内封台词是边放边到的，得边放边收");
assert.match(src, /adoptInband\(\); if \(v\.textTracks\) v\.textTracks\.onaddtrack = adoptInband;/);
// 单独导了字幕的片子不去碰自带轨（别两份台词掺在一起）
assert.match(src, /\(film && film\.cueCount && !film\.inband\)\) return;/);
// 8. 自己开口多久一次：她自己拉（1~20 分钟），存起来；开着才出来
assert.match(src, /const AUTO_MIN = 1, AUTO_MAX = 20, AUTO_DEFAULT = 5;/);
assert.match(src, /v\.currentTime - lastAuto\.current >= every \* 60/);
assert.match(src, /saveJSON\("x_watch_auto_every", n\)/);
assert.match(src, /auto && h\("div"/);
// 9. 手边那几样收进「＋」，平时不占地方；没字幕的片子不出台词条（她 2026-09-25）
assert.match(src, /const \[toolsOpen, setToolsOpen\] = useState\(false\);/);
assert.match(src, /toolsOpen && h\("div"/);
assert.match(src, /"aria-expanded": String\(toolsOpen\)/);
assert.match(src, /cues\.length \? h\("div"/);
assert.ok(!/这部没有字幕，TA 靠你说和截图/.test(src), "没字幕的提示又回来了");
// 10. 改名：票上一支笔、放映页点标题，两处走同一个 renameFilm；图标用 app 自己的 SVG
assert.match(src, /function renameFilm\(f, done\) \{/);
assert.match(src, /onRename: \(\) => renameFilm\(f, /);
assert.match(src, /onTitleTap: \(\) => renameFilm\(film, refresh\)/);
assert.match(src, /h\(IPencil, /);
// 11. 长片子：聊多了折成摘要，喂回去；只删折进去的那几条（她 2026-09-25「都做了吧」）
assert.match(src, /const FOLD_AT = 40, FOLD_TAKE = 24;/);
assert.match(src, /async function foldWatchTalk\(/);
assert.match(src, /window\.ChatRooms\.digestMerge\(film\.talkDigest \|\| "", seg\)/, "合并器又自己写了一份");
assert.match(src, /film\.talkDigest \? "【你们前面看的时候聊过的（你自己记下的）】/);
assert.match(src, /filter\(r => !gone\[r\.ts \+ "\|" \+ r\.role \+ "\|" \+ \(r\.content \|\| ""\)\]\)/);
// 12. 字幕挪时间轴：画面上那句和喂给 TA 的那段按同一个偏移
assert.match(src, /recentLines\(cues, at - \(Number\(film\.subOffset\) \|\| 0\)\)/);
assert.match(src, /const line = cueAt\(cues, now - off\);/);
// 13. 放不了的格式有话说
assert.match(src, /onError: \(\) => setPlayErr\(true\)/);
assert.match(src, /这台手机放不了这个格式/);
// 14. 影院模式：铺满、TA 的话浮在画面上、层本身不挡原生控件
assert.match(src, /function CinemaLayer\(p\)/);
assert.match(src, /pointerEvents: "none"/);
assert.match(src, /el\.requestFullscreen\(\)/);
assert.match(src, /"aria-label": "退出影院模式"/);
// 15. 看完回单聊落一条交接：话术只一处（watchLogText），单聊回话、recentChat、卡片三处都用它
assert.match(src, /function watchLogText\(m, uName, cName\)/);
assert.match(src, /window\.watchLogText = watchLogText;/);
assert.match(src, /if \(f && partner && props\.onHandoff && \(rows\.length \|\| to - from >= 60\)\)/, "没看也没说也落了一条");
assert.match(app, /onHandoff: \(charId, entry\) => pChat\(charId, p => \{/);
assert.match(app, /last\.kind === "watchlog" && last\.filmId === entry\.filmId && Date\.now\(\) - \(last\.ts \|\| 0\) < 30 \* 60000/, "进进出出会刷一串");
assert.ok((app.match(/watchLogText\(m, uName, char\.name\)/g) || []).length >= 2, "单聊回话和 recentChat 两路没都接上");
assert.match(cmp, /if \(m\.kind === "watchlog"\) return h\(SysNote, \{ key: i, label: "一起看",/);
// 行为：话术里有片名、起止、原话；没说话也成立
const k = src.indexOf("function watchLogText("), k2 = src.indexOf("window.watchLogText", k);
const c2 = { clock: ctx.clock }; vm.createContext(c2);
vm.runInContext(src.slice(k, k2) + ";this.f=watchLogText;", c2);
const t1 = c2.f({ title: "海边", from: 12, to: 2730, done: false, lines: [{ who: "user", text: "好熟" }, { who: "assistant", text: "嗯" }] }, "Lisa", "沈屿白");
assert.ok(/《海边》/.test(t1) && /0:12 看到 45:30（还没看完）/.test(t1) && /Lisa：好熟/.test(t1) && /沈屿白：嗯/.test(t1));
assert.ok(!/原话/.test(c2.f({ title: "x", from: 0, to: 100, lines: [] }, "L", "S")), "没说话还挂了个空的原话块");
// 16. 「记住」只记上次记住之后新的（她 2026-09-25）
assert.match(src, /const fresh = \(film\.talk \|\| \[\]\)\.filter\(function \(m\) \{ return \(m\.ts \|\| 0\) > since; \}\)/);
assert.match(src, /const digestGrew = !!film\.talkDigest && film\.talkDigest !== \(film\.rememberedDigest \|\| ""\);/);
assert.match(src, /patchFilm\(id, \(\) => \(\{ rememberedAt: Date\.now\(\), rememberedDigest: cur\.talkDigest \|\| "" \}\)\);/);
assert.match(src, /上次记住之后你们还没新聊什么/);
// 17. 影院模式在苹果上黑屏／退出白屏（她 2026-09-25）：视频不靠 flex 撑高；退出收键盘、页面滚回原位；不自动弹键盘
assert.ok(!/position: "fixed", inset: 0, zIndex: 99990, background: "#000", display: "flex"/.test(src), "又拿 flex 撑影院里的视频了");
assert.match(src, /display: playErr \? "none" : "block", position: "absolute", top: 0, left: 0, width: "100%", height: "100%"/);
assert.match(src, /document\.activeElement\.blur\(\)/);
assert.match(src, /reset\(\); setTimeout\(reset, 120\); setTimeout\(reset, 400\);/);
assert.ok(!/h\("input", \{ autoFocus: true, value: p\.txt/.test(src), "影院里又自动弹键盘了");
console.log("ok watch-together");
