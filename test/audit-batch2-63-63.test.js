// 2026-09-05 审计（报告 7527fce）剩下那一摞。
// ⚠️先说清两条【报告写了、但已经不成立】的：意见 #5（群通话隐私围栏）和 #6 里的
//   朋友圈/论坛/匿名箱三样，都被 v62.42（a612347）修掉了——那个提交比报告晚 23 分钟。
//   所以这里只钉 v62.42 漏掉的那一样（日历）和其余几条。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js"), screens = R("screens.js");
const vm = require("node:vm");
const bare = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const slice = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

// ── #7 导出／导入的图库对称 ───────────────────────────────────
// 「先导出一份」是所有数据规矩的地基（never-say-delete-first.md）。
// 地基本身能悄悄少图、导入本身能清光图库，那条规矩就是空的。
test("图库一张都没读出来、存档里却引用着 iv_ 门牌 → 拒绝导出", () => {
  const fn = bare(slice(app, "const doExport = async ()", "const doImport = file"));
  // idbVaultEntries 的 tx.onerror 是 res([])：读失败和「真没有图」返回值一模一样
  assert.match(engine, /async function idbVaultEntries\(\)[\s\S]{0,800}tx\.onerror = \(\) => res\(\[\]\)/,
    "静默那一段变了，这条交叉核对的前提要重新想一遍");
  assert.match(fn, /const ivRefs = new Set\(\);/);
  assert.match(fn, /match\(\/iv_\[A-Za-z0-9_-\]\+\/g\)/);
  assert.match(fn, /if \(ivRefs\.size > 0 && vaultCount === 0\) \{/);
  assert.match(fn, /toast\("没有导出：/, "光记日志没用，得当场拦住并说出来");
  assert.match(fn, /return;/);
  // 只是少几张（引用指向已删的图）不该拦，说一声就行
  assert.match(fn, /只剩门牌、图本身找不到了/);
});

test("album 目录要进备份——导入那一路会把它连图一起清掉", () => {
  const fn = bare(slice(app, "const doExport = async ()", "const doImport = file"));
  assert.match(fn, /idbAlbumEntries\(\)/, "照片说明从来没进过备份");
  assert.match(fn, /album: album/);
  assert.match(fn, /version: 4/, "格式变了得升版本号");
  // 清仓那一下确实会连 album 一起清——这才是必须备份它的理由
  assert.match(engine, /async function idbVaultClear\(\)[\s\S]{0,300}objectStore\("album"\)\.clear\(\)/);
  const imp = bare(slice(app, "const doImport = file", "// ---- routing ----"));
  assert.match(imp, /Array\.isArray\(parsed\.album\) && typeof idbAlbumPut === "function"/);
});

test("备份里 vault 是空对象时不许清仓——`{}` 是真值", () => {
  const imp = bare(slice(app, "const doImport = file", "// ---- routing ----"));
  assert.match(imp, /const vaultRows = parsed\.vault \? Object\.entries\(parsed\.vault\) : \[\];/);
  assert.match(imp, /if \(vaultRows\.length && typeof idbVaultPut === "function"/,
    "又变回 `if (parsed.vault)` 了——空对象照样能把本机图库清光");
  // 清仓必须在「真的有图要写」这个判断【里面】
  assert.ok(imp.indexOf("vaultRows.length &&") < imp.indexOf("await idbVaultClear()"));
});

test("网易云 Cookie 不许进导出文件——上云那一路早排掉了", () => {
  const cloud = R("cloud.js");
  assert.match(cloud, /k\.startsWith\("x_"\) && k !== "x_neteaseCookie"/, "上云那一路的口径没了");
  const fn = bare(slice(app, "const doExport = async ()", "const doImport = file"));
  assert.match(fn, /k\.startsWith\("x_"\) && k !== "x_neteaseCookie"/,
    "导出这一路又把账号 cookie 打进文件了——两处口径必须一样");
});

// ── #9 密钥「重装必丢」要写在脸上 ────────────────────────────
test("API 那一页写明密钥不随备份走", () => {
  const seg = slice(screens, 'h("button", { onClick: addNew', "list.map(p =>");
  assert.match(seg, /密钥只存这台设备，不随备份走/);
  assert.match(seg, /重新填一次/);
});

test("凭证金库打不开要说出来，不能被 catch(() => 0) 吞掉", () => {
  const boot = bare(slice(app, "if (window.CredentialVault) hyd.push", "// 退休九维"));
  assert.match(boot, /window\.__credentialVaultError = String/);
  assert.match(boot, /本机 API 凭证金库打不开/);
  // 症状是「所有模型调用都失败」，那会把她引到完全错的方向，所以必须点名说是密钥
  assert.match(boot, /重新填一次/);
});

test("「导出全部数据」旁边固定写着它不含什么", () => {
  const seg = slice(screens, 'if (part === "backup")', 'button("导入备份恢复"');
  assert.match(seg, /不含：API 密钥/);
  ["一起读的书正文", "语音音频", "本地歌", "网易云 Cookie"].forEach(x =>
    assert.ok(seg.indexOf(x) > 0, "漏了一样：" + x));
  // 以前唯一提到这件事的地方是【导入失败之后】那个 alert，那时候已经晚了
  assert.ok(seg.indexOf("导出全部数据（.json）") < seg.indexOf("不含：API 密钥"),
    "这一行要挨着导出按钮，按之前就看得见");
});

// ── #8 GROWTH_RULE：零引用的那条要么接上，要么删 ────────────────
test("GROWTH_RULE 真删掉了，不是在后面补一句「那个不用了」", () => {
  assert.ok(!/const GROWTH_RULE = /.test(engine), "那条零引用的常量还在");
  assert.equal(bare(engine).indexOf("GROWTH_RULE"), -1, "代码里还留着它的名字");
  assert.equal(bare(app).indexOf("GROWTH_RULE"), -1);
});

test("它独有的那一段没丢，并进了四处都接得上的那一条", () => {
  const anchor = slice(engine, "const PERSONA_REGISTER_ANCHOR = `", "`;\n");
  assert.match(anchor, /这一场里软下来了，就软到这一场结束/);
  assert.match(anchor, /不是软一句就弹回去/);
  assert.match(anchor, /洗澡、睡觉、吃饭、明天几点起/);
  assert.match(anchor, /要重新竖起硬壳，得有【真正的触发】/);
  // 这一条本来就是四处都在发的那个落点：群路走 groupBans、叙事路走 narrativeCore、
  // 单聊线上直接拼、单聊线下也直接拼
  assert.match(engine, /P\.push\(PERSONA_REGISTER_ANCHOR\);/);
  assert.match(engine, /if \(opts\.register !== false\) parts\.push\(PERSONA_REGISTER_ANCHOR\);/);
  assert.match(app, /REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/);
});

test("群里那条成长准则只写一份，三处群路共用", () => {
  assert.match(engine, /function groupGrowthLine\(names\) \{/);
  assert.equal((engine.match(/function groupGrowthLine/g) || []).length, 1);
  // ⚠️光钉「函数在、三处都调了」不够：把函数体改成永远 return "" 的话，
  //   三处都还在调、断言全绿、而那一层一个字都没发出去（变异测试当场逮到）。
  //   所以要真跑一次。
  const src = slice(engine, "function groupGrowthLine(names) {", "\n\nconst OFFLINE_NARRATIVE_RUNTIME");
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + "\nthis.f = groupGrowthLine;", ctx);
  assert.equal(ctx.f([]), "", "没人开成长也发一段，那是白占上下文");
  const out = ctx.f(["顾朝", "陆闻"]);
  assert.match(out, /顾朝、陆闻/, "点名的那几个人没写进去");
  assert.match(out, /硬核/); assert.match(out, /软层/);
  assert.match(out, /其余在场成员照旧严格贴合各自原卡/, "没说清这一条只管点名的那几个");
  // 原来群线上（app.js）和群线下（engine.js）各抄了一份长字符串
  assert.equal((bare(engine + app).match(/这些成员会成长·不冻在原卡里/g) || []).length, 1,
    "那段长文又被抄成了两份");
  assert.match(engine, /const groupGrowthRule = groupGrowthLine\(evolveNames\);/, "群线下");
  assert.match(app, /const gGrowthHint = groupGrowthLine\(gEvolveNames\);/, "群线上");
  // 群通话是第三处群路，原来这一层一个字都没有
  assert.match(app, /const gcGrowth = groupGrowthLine\(gcMembers\.filter\(c => PERSONA_EVOLVE_IDS\.includes\(c\.id\)\)\.map\(c => c\.name\)\);/);
  const sys = slice(app, "const sys = groupBans({ echo: true })", "const raw = await callAI(active, sys");
  assert.match(sys, /\+ gcGrowth/, "拼出来了却没接进 sys——那就是「声明了没人引用」");
});

// ── #6 v62.42 漏掉的第四样：日历 ──────────────────────────────
test("日历也得有过期和封顶——写满那天坏的是旁边的好感度和心情", () => {
  assert.match(app, /const CAL_KEEP_DAYS = 400;/);
  assert.match(app, /const CAL_MAX_EVENTS = 600;/);
  const fn = bare(slice(app, "const calPrune = bucket =>", "const calPruneAll"));
  // 判据按【日期】不按条数：日历答的是「哪天有什么」
  assert.match(fn, /const floor = Date\.now\(\) - CAL_KEEP_DAYS \* 86400000;/);
  assert.match(fn, /if \(!isNaN\(ms\) && ms < floor\) \{ delete bucket\[k\]; continue; \}/);
  // 认不出日期的格子一律留着——让遗漏往安全那边掉
  assert.match(bare(slice(app, "const calDateMs = dk =>", "const calPrune")), /\? new Date\(\+m\[1\], \+m\[2\] - 1, \+m\[3\]\)\.getTime\(\) : NaN/);
  // 整个裁剪里只许有两处 delete：①太老的那一格 ②超总量时最老的那几格。
  // 多出第三处就意味着有一条没写判据的删除路径——认不出日期的会跟着一起没。
  assert.equal((fn.match(/delete bucket\[k\]/g) || []).length, 2, "多了一条没写判据的删除路径");
  // 总量兜底从最老的日子开始扔
  assert.match(fn, /dated\.sort\(\(a, b\) => a\[1\] - b\[1\]\)/);
  // 挂在唯一会成批加条目的那个入口上
  const gen = bare(slice(app, "const genCalMonth = async", "// ---- probes ----"));
  assert.match(gen, /calPruneAll\(n\);/);
  assert.ok(gen.indexOf("calPruneAll(n);") < gen.indexOf('saveJSON("x_calendar", n)'),
    "先存了再裁，那这一次还是整份写进去了");
  // 三个视角都要裁（世界 / 我的 / 每个角色）
  const all = bare(slice(app, "const calPruneAll = n =>", "// srcId："));
  assert.match(all, /calPrune\(n\.world\); calPrune\(n\.mine\);/);
  assert.match(all, /Object\.keys\(n\.chars \|\| \{\}\)\.forEach/);
});
