// 查手机的论坛和音乐接【真数据】（她 2026-08-29 点名）：
// 论坛读真论坛、带大号/小号/匿名三个账号；音乐读「一起听」里归到他名下的歌单，
// 每首带他自己的心境。这两个不再各自另生成一份，全刷少两次调用。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phoneSrc = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const appSrc = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const P = new Function(phoneSrc + "; return { PHONE_LIVE_KEYS, PHONE_APPS, PHONE_ANGLE, PHONE_DIGEST_PICK, phoneProbeSpec };")();

// live 不另编内容：论坛/音乐/日历接 App 真数据，匿名信箱接 x_anon，时间线只做聚合。
//   calendar 也接了真数据（App 里那份日历/日程/答应过的事）；
//   timeline 压根不生成任何东西，它只把别的 app 已经翻出来的碎片按时间串起来。
// 「不生成」这件事必须在代码里是真的：没有取材层、没有 probe spec、不进全刷。
test("接真数据的那几个从生成管线里整个撤掉了，不是留着说「这个别用」", () => {
  assert.deepEqual(P.PHONE_LIVE_KEYS, ["forum", "music", "calendar", "anon", "timeline"]);
  P.PHONE_LIVE_KEYS.forEach(k => {
    assert.equal(P.PHONE_ANGLE[k], undefined, k + " 还留着取材层");
    assert.equal(P.PHONE_DIGEST_PICK[k], undefined, k + " 还留在避重清单抽取表里");
    // 兜底 spec 的 instruction 是「推演内容」——说明这个 key 已经没有自己的推演任务了
    assert.equal(P.phoneProbeSpec(k, { name: "某人" }, [], "", []).schemaHint, "{}", k + " 还有自己的 probe spec");
  });
  // 但桌面入口还在，图标没丢
  const keys = P.PHONE_APPS.map(a => a.key);
  P.PHONE_LIVE_KEYS.forEach(k => assert.ok(keys.includes(k), k + " 的桌面图标丢了"));
});

test("全刷跳过接真数据的那几个，少几次调用", () => {
  const m = appSrc.match(/const keys = PHONE_APPS\.filter\(.*/);
  assert.ok(m, "找不到全刷的 keys");
  assert.match(m[0], /PHONE_LIVE_KEYS\.indexOf\(a\.key\) < 0/);
});

test("接真数据的 app 不自动生成、也不给重刷按钮", () => {
  assert.match(phoneSrc, /const isLive = PHONE_LIVE_KEYS\.indexOf\(appKey\) >= 0/);
  // v57.54 起视频不再是带子版块的特例，这里只剩接真数据的判断
  assert.match(phoneSrc, /if \(isLive \|\| charData\[appKey\]\) return;/);
  assert.match(phoneSrc, /const refreshKey = isLive \? null : appKey;/);
});

test("三个账号都打包过去了，匿名号也在", () => {
  const m = appSrc.match(/const phoneForumFor = char => \{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 phoneForumFor");
  const s = m[0];
  ["character", "character_alt", "character_anon"].forEach(t => assert.ok(s.includes('by("' + t + '")'), t + " 没接上"));
  ["大号", "小号", "匿名"].forEach(l => assert.ok(s.includes('"' + l + '"'), l + " 没接上"));
  // 他在别人楼下说的话单独一栏，帖子和评论都给
  assert.match(s, /saidUnder\("character"\)/);
  assert.match(s, /saidUnder\("character_anon"\)/);
  // 嵌套楼中楼也要收
  assert.match(s, /f\.replies \|\| \[\]\)\.forEach\(r =>/);
});

test("查手机的歌单和「一起听」是同一张，不是另存一份", () => {
  assert.match(appSrc, /playlistFor: cid => \(listen\.playlists \|\| \[\]\)\.find\(x => x\.charId === cid\)/);
  assert.match(appSrc, /onGenPlaylist: genCharPlaylist/);
  // 群聊那句「TA 最近在听」原来读 phones[].music，现在也改读真歌单，两边不会对不上
  assert.doesNotMatch(appSrc, /ph\.music && ph\.music\.songs/);
  assert.match(appSrc, /const _pl = \(listenRef\.current\.playlists \|\| \[\]\)\.find\(x => x\.charId === c\.id\)/);
});

test("歌单里每首歌带心境，并且在查手机看得到", () => {
  // 生成侧：note 字段解析 + 存进歌曲对象
  assert.match(appSrc, /note: String\(\(w && \(w\.note \|\| w\.thought \|\| w\.why \|\| w\.mood\)\)/);
  assert.match(appSrc, /note: w\.note \|\| ""/);
  assert.match(appSrc, /\\"note\\":\\"第一人称一句/);
  // 显示侧：别冻这一行的长相（v59.66 歌单重做成曲目单，那个变量改名了），
  // 真渲一遍看 note 有没有印在页面上
  const { loadPhone } = require("./helpers/phone-render.js");
  const tree = JSON.stringify(loadPhone().MusicView({
    pl: { name: "深夜那张", songs: [{ id: "a", title: "某首", artist: "某人", note: "他为什么循环这一首" }] },
    char: { name: "某人" }, t: {}, onGen: () => {}, busy: false, onPlay: () => {}, onPeek: () => {}
  }));
  assert.ok(tree.includes("他为什么循环这一首"), "查手机的歌单里看不到心境");
  assert.ok(tree.includes("某首") && tree.includes("某人"), "歌名或歌手没印出来");
});

test("歌单备注不许套同一个句式（她 2026-08-29：「有点不自然」）", () => {
  // 病根在我这条提示词：上一版问的是「你什么时候会循环这一首」，
  // 模型就老实答「……的时候」，十九条一个句式。
  assert.doesNotMatch(appSrc, /你什么时候会循环这一首/);
  assert.match(appSrc, /绝对不许每条都用「……的时候」「……时」收尾/);
  assert.match(appSrc, /有的只有三五个字/);
  assert.match(appSrc, /长短要差得很开/);
  // 也不许写成恋爱周报
  assert.match(appSrc, /这不是恋爱歌单/);
  assert.match(appSrc, /提到用户的最多三四首/);
  // 仍然禁乐评腔
  assert.match(appSrc, /不要评价旋律、编曲、歌词写得多好/);
});

test("歌单按【真进歌单几首】重试，不是按模型给了几个候选", () => {
  // v60.40 起这条漏斗抽成了 collectRealSongs，角色歌单和情侣唱片共用一份——
  // 所以这里验的是那一份，外加两个调用方都真的走它（写两遍必然有一处忘了跟上）。
  const m = appSrc.match(/const collectRealSongs = async \(\{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 collectRealSongs");
  const s = m[0];
  assert.match(s, /for \(let round = 1; round <= \(rounds \|\| 3\) && added\.length < target; round\+\+\)/);
  // 旧的「按候选数重试」必须是删掉，不是留着加一句说它错了
  assert.doesNotMatch(appSrc, /while \(wants\.length < 12/);
  // 搜过的不重复搜，免得多轮时把额度耗在同一批歌上
  assert.match(s, /if \(tried\.has\(k\)\) continue;/);
  // 两个调用方都得走同一条漏斗
  const pl = appSrc.match(/const genCharPlaylist = async char => \{[\s\S]*?\n  \};/);
  const disc = appSrc.match(/const genCoupleDisc = async char => \{[\s\S]*?\n  \};/);
  assert.ok(pl && disc, "找不到 genCharPlaylist / genCoupleDisc");
  assert.match(pl[0], /await collectRealSongs\(/);
  assert.match(disc[0], /await collectRealSongs\(/);
  // 没凑够要说实话，并分清是搜不到还是重复——两处都要说
  for (const src of [pl[0], disc[0]]) {
    assert.match(src, /只凑到 " \+ added\.length \+ " 首/);
    assert.match(src, /网易云搜不到 " \+ miss/);
    assert.match(src, /重复 " \+ dup/);
  }
});

// 进情侣空间就换成这张唱片直接放（她 2026-09-02 改的），走的时候只带走自己
test("情侣唱片进空间一律落针，离开只收自己的针", () => {
  const m = appSrc.match(/const discEnter = cid => \{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 discEnter");
  // 旧的「播放器里有东西在响就不落针」必须是删掉的（那一版让唱片永远轮不到）。
  // ⚠️冻的是【有没有这道闸】，不是「!el.paused 这几个字出现过没有」：
  //   v60.63 起 discEnter 也读 !el.paused，但那是记「她原来那首是不是真在放」
  //   （好在离开时原样还回去），跟要不要落针没关系。逐字冻字符串会误伤到它。
  // v64.62：礼数抽成了共用的 roomMusicEnter（情侣唱片 / 查手机两处用），
  // 于是那两道闸分在两处：「这对没有唱片」留在 discEnter，「已经在转」变成
  // 共用那份里的 isMine()。要冻的还是同一件事——**不许有第三道**。
  const guards = m[0].match(/if \(.*?\) return;/g) || [];
  assert.deepEqual(guards, ["if (!discSongsOf(cid).length) return;"],
    "discEnter 只许有这一道闸：这对没有唱片——别再加「播放器忙就不落针」");
  const shared = appSrc.match(/const roomMusicEnter = \(isMine, play\) => \{[\s\S]*?\n  \};/);
  assert.ok(shared, "找不到共用那份 roomMusicEnter");
  assert.deepEqual(shared[0].match(/if \(.*?\) return;/g) || [], ["if (isMine()) return;"],
    "共用那份里多了一道闸——「播放器忙就不落针」那一版会让唱片永远轮不到");
  // 而且是【接着上次那首】，不是永远从第一首（她 2026-09-02：后面的永远轮不到）
  assert.match(m[0], /discPlay\(cid, discNextId\(cid\)\)/);
  const nx = appSrc.match(/const discNextId = cid => \{[\s\S]*?\n  \};/);
  assert.ok(nx, "找不到 discNextId");
  assert.match(nx[0], /\(k \+ 1\) % ss\.length/);
  // 针位不能只在离开时记（App 被杀/直接切走都不会走 discLeave）：挂在换歌上。
  // v64.62 起同一个 effect 还顺手记查手机那张歌单的针位，所以唱片这一支
  // 从「不是 sgd_ 就直接 return」变成「不是 sgd_ 就往下走另一支」。
  assert.match(appSrc, /if \(String\(sid\)\.indexOf\("sgd_"\) === 0\) \{/);
  assert.match(appSrc, /lastId: sid/);
  // 「离开只收自己的针」——冻的是这件事，不是那一行长什么样。
  // v60.63 起 discLeave 还要把她进来之前那首还回去（她报：出来自己的悬浮播放器也没了），
  // 所以它不再是一行；但「唱片没落针就一个音符都别动她的」这条没变。
  // v64.62：这一半也搬进共用那份了（discLeave 现在就是一行转发）。
  assert.match(appSrc, /const discLeave = \(\) => roomMusicLeave\(discSpinning\);/,
    "discLeave 没走共用那份");
  const rl = appSrc.match(/const roomMusicLeave = async isMine => \{[\s\S]*?\n  \};/);
  assert.ok(rl, "找不到共用那份 roomMusicLeave");
  assert.match(rl[0], /if \(!isMine\(\)\) \{ roomMusicRef\.current = null; return; \}/,
    "这一层没落针就该原样退出，别去动她自己在放的歌");
});


// ── 归档必须发生在覆盖之前，而且绝不许拖累这次刷新 ──
// 浏览器里够不到 savePhoneApp（它是组件内的闭包），这一层只能静态验。
test("刷新时先归档旧那份，再整份覆盖", () => {
  const m = appSrc.match(/const savePhoneApp = \(charId, key, d\) => \{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 savePhoneApp");
  const fn = m[0];
  const iArch = fn.indexOf("archivePhoneApp(");
  const iWrite = fn.indexOf("setPhones(");
  assert.ok(iArch >= 0, "刷新没归档旧内容——那条时间线永远长不起来");
  assert.ok(iArch < iWrite, "归档必须排在覆盖前面，不然读到的已经是新数据了");
  // 必须走 ref 读最新的：全刷是一个 app 接一个写的，闭包里的 phones 到第二个就旧了
  assert.match(fn, /phonesRef\.current/, "归档读的是闭包里的旧 phones");

  const a = appSrc.match(/const archivePhoneApp = \(charId, key, oldData\) => \{[\s\S]*?\n  \};/);
  assert.ok(a, "找不到 archivePhoneApp");
  // 归档是锦上添花：写坏了（localStorage 满会抛 QuotaExceeded）也不能连累手机内容
  assert.match(a[0], /try \{/, "归档没包 try——存满时会把整次刷新一起弄挂");
  assert.match(a[0], /phoneArchCapAll/, "没做全局封顶");
});
