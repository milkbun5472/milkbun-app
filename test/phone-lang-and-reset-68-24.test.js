// 她 2026-09-14：「查手机原来人设让他说英文然后生成了英文的东西，后面我把人设里面
// 英文去掉生成还是有惯性继续生成英文这种怎么解决啊，还是只能搞一个可以自由删除
// 查手机里面的东西让他重新生成了」。
//
// 惯性不是模型记性好，是我们自己发回去的：刷新【在旧那份上往下写】。
// 语言档约束新生成内容；已有四层数据保留，清空需确认并验证持久化。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require(path.join(root, "js/phone.js"));
const phoneSrc = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");
const appSrc = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const spec = (key, lang) => K.phoneProbeSpec(key, { name: "甲" }, [], "", [], null, null, false, "", lang).instruction;

test("三档都拼进提示词，而且拼在公共那一处（新加 app 漏不掉）", () => {
  // 拼在 _full 上，不是各 app 的 instruction 里
  assert.match(phoneSrc, /phoneAvoidBlock\(avoidLines\) \+ phoneLangBlock\(lang\)/);
  ["notes", "wechat", "album", "health"].forEach(k => {
    K.PHONE_LANG_MODES.forEach(m => assert.match(spec(k, m), /【手机里的字用哪种语言】/, k + "/" + m));
  });
});

test("一律中文：正文和心里那句都算，专有名词给出口", () => {
  const s = spec("notes", "zh");
  assert.match(s, /一律写中文/);
  assert.match(s, /TA心里那一句/);
  assert.match(s, /人名、店名、歌名、地名/);   // 给出口不给判决
});

test("默认那一档跟着人设走，没写才中文", () => {
  const s = spec("notes", undefined);
  assert.match(s, /TA自己说什么语言/);
  assert.match(s, /两处都没写的，写中文/);
  assert.equal(s, spec("notes", "persona"));
  assert.equal(s, spec("notes", "乱填的"));   // 认不出的一律回默认档
});

// 界线画在【这个字是内容，还是这一条的身份】上——两头都不能一刀切：
// 「旧的全改过来」会让名册攒成两份（phoneGrowList 按名字认人）；
// 「已有的一律沿用」又会让 🌱 那几栏一旦是外语就永远是外语。
test("三档都说清：这一轮写的字照这一档，旧内容的语言不算数", () => {
  K.PHONE_LANG_MODES.forEach(m => {
    const s = spec("notes", m);
    assert.match(s, /这一档只管【你这一轮写出来的字】/, m);
    assert.match(s, /不决定你这一轮写什么/, m);
  });
});

test("名册的名字和身份字段原样照抄——改了名字会攒成两份", () => {
  K.PHONE_LANG_MODES.forEach(m => {
    const s = spec("notes", m);
    assert.match(s, /账号和号码这类身份字段/, m);
    assert.match(s, /名册里每一条的名字/, m);
    assert.match(s, /会被当成新的攒进去，变成两份/, m);   // 说了理由，不是光下禁令
  });
  // 这条规矩的另一头真的在代码里：名册按名字认人（施工规则/phone-data-layers.md）
  const src = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");
  assert.match(src, /phoneGrowList/);
});

test("提示词里没有内容示范（施工规则/prompt-no-content-samples.md）", () => {
  // 只准出现判据和维度，不许出现能被逐字照抄的样例句
  K.PHONE_LANG_MODES.forEach(m => {
    assert.doesNotMatch(K.phoneLangBlock(m), /如「|比如「|例如/, m);
  });
});

test("清空只动这一个角色的这一个 app", () => {
  const store = { c1: { notes: { a: 1 }, wechat: { b: 2 } }, c2: { notes: { c: 3 } } };
  const n = K.phoneResetApp(store, "c1", "notes");
  assert.equal(n.c1.notes, undefined);
  assert.deepEqual(n.c1.wechat, { b: 2 });
  assert.deepEqual(n.c2.notes, { c: 3 });
  assert.equal(store.c1.notes.a, 1);          // 原来那份不许被就地改掉
});

test("没有的东西不当成改动（免得白写一次 localStorage）", () => {
  const store = { c1: { notes: {} } };
  assert.equal(K.phoneResetApp(store, "c1", "album"), store);
  assert.equal(K.phoneResetApp(store, "c9", "notes"), store);
  assert.equal(K.phoneResetApp(store, "", "notes"), store);
});

test("归档里属于这个 app 的那几条一起走——不然时间线上还翻得到，像没清干净", () => {
  const list = [{ app: "notes", id: "a" }, { app: "wechat", id: "b" }, { app: "notes", id: "c" }];
  assert.deepEqual(K.phoneArchDropApp(list, "notes").map(x => x.id), ["b"]);
  assert.equal(K.phoneArchDropApp(null, "notes").length, 0);
});

test("app.js 那一头：三张表都照着写入方的键名清（施工规则/stub-from-the-writer.md）", () => {
  assert.match(appSrc, /saveJSON\("x_phone", n\)/);
  assert.match(appSrc, /saveJSON\("x_phoneArch", n\)/);
  assert.match(appSrc, /const resetPhoneApp = async \(charId, key\) => \{/);
  // 健康的趋势是另存的一张表，清空时要一起走
  assert.match(appSrc, /if \(key === "health"\) setPhoneVitals/);
});

test("确认框里先叫她导出（.claude/rules/never-say-delete-first.md）", () => {
  const i = phoneSrc.indexOf('requestAppConfirm("清空「"');
  assert.ok(i > 0, "清空走公共确认框，不许用原生 confirm");
  const body = phoneSrc.slice(i, i + 900);
  assert.match(body, /导出全部数据/);
  assert.match(body, /存好了再清/);
});

test("语言那一档全局一份，存在 x_phoneLang", () => {
  assert.match(appSrc, /setPhoneLang\(loadJSON\("x_phoneLang", "persona"\)\)/);
  assert.match(appSrc, /saveJSON\("x_phoneLang", v\)/);
  // 两条生成路（单个 app / 整机）都要带上，别只改一处
  assert.equal((appSrc.match(/phoneBondBlock\(char\), phoneLangRef\.current\)/g) || []).length, 2);
});
