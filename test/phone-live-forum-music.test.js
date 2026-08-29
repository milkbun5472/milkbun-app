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

test("论坛和音乐从生成管线里整个撤掉了，不是留着说「这个别用」", () => {
  assert.deepEqual(P.PHONE_LIVE_KEYS, ["forum", "music"]);
  P.PHONE_LIVE_KEYS.forEach(k => {
    assert.equal(P.PHONE_ANGLE[k], undefined, k + " 还留着取材层");
    assert.equal(P.PHONE_DIGEST_PICK[k], undefined, k + " 还留在避重清单抽取表里");
    // 兜底 spec 的 instruction 是「推演内容」——说明这个 key 已经没有自己的推演任务了
    assert.equal(P.phoneProbeSpec(k, { name: "某人" }, [], "", []).schemaHint, "{}", k + " 还有自己的 probe spec");
  });
  // 但桌面入口还在，图标没丢
  const keys = P.PHONE_APPS.map(a => a.key);
  assert.ok(keys.includes("forum") && keys.includes("music"));
});

test("全刷跳过接真数据的两个，少两次调用", () => {
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
  // 显示侧
  assert.match(phoneSrc, /const note = String\(s\.note \|\| ""\)\.trim\(\)/);
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
  const m = appSrc.match(/const genCharPlaylist = async char => \{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 genCharPlaylist");
  const s = m[0];
  assert.match(s, /const TARGET = 12, HARD_CAP = 16, MAX_ROUNDS = 3;/);
  assert.match(s, /for \(let round = 1; round <= MAX_ROUNDS && added\.length < TARGET; round\+\+\)/);
  // 旧的「按候选数重试」必须是删掉，不是留着加一句说它错了
  assert.doesNotMatch(s, /while \(wants\.length < 12/);
  // 搜过的不重复搜，免得多轮时把额度耗在同一批歌上
  assert.match(s, /if \(tried\.has\(k\)\) continue;/);
  // 没凑够要说实话，并分清是搜不到还是重复
  assert.match(s, /只凑到 " \+ added\.length \+ " 首/);
  assert.match(s, /网易云搜不到 " \+ miss/);
  assert.match(s, /重复 " \+ dup/);
});
