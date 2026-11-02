const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const engine = read("engine.js");
const cloud = read("cloud.js");
const app = read("app.js");

// 病根：切后台回来，系统把 IndexedDB 连接掐断而 onclose 不发——握着的 _walDB 从此每笔事务都报错，
// 手机根本没满。一处处写重试必然漏，所以读写一律走 walWith。
test("保险箱每个读写都走 walWith，出错丢连接重开再试一次", () => {
  const w = engine.match(/function walWith\(run\) \{([\s\S]*?)\n\}/);
  assert.ok(w, "walWith 要留着");
  assert.match(w[1], /walDrop\(\)/, "出错必须把死连接丢掉");
  assert.match(w[1], /walOpen\(\)\.then\(run\)[\s\S]*walOpen\(\)\.then\(run\)/, "丢掉之后要重开再跑一次");
  assert.match(engine, /function walDrop\(\) \{[\s\S]*?_walDB = null;[\s\S]*?\n/, "walDrop 要把缓存的连接清掉");
  for (const fn of ["walPutVerified", "walGetRaw", "walKeys", "walDel", "walDelIf"]) {
    const body = engine.match(new RegExp("function " + fn + "\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}"));
    assert.ok(body, fn + " 要留着");
    assert.match(body[1], /walWith\(/, fn + " 必须走 walWith，不许自己 walOpen");
    assert.doesNotMatch(body[1], /walOpen\(\)/, fn + " 不许绕过 walWith 直接拿连接");
  }
});

// 开机 idbTxtAll 失败一次，界面上就是一台空手机——这一下尤其要重试。
test("文字仓的读写也要开不成就重开再试一次", () => {
  assert.match(engine, /function idbTxtRun\(run\) \{[\s\S]*idbTxtOpen\(\)\.then\(run\)[\s\S]*idbTxtOpen\(\)\.then\(run\)/);
  for (const fn of ["idbTxtPut", "idbTxtGet", "idbTxtDel", "idbTxtAll"]) {
    const body = engine.match(new RegExp("function " + fn + "\\([^)]*\\) \\{([\\s\\S]*)"));
    assert.ok(body, fn + " 要留着");
    assert.match(body[1].slice(0, 400), /idbTxtRun\(/, fn + " 必须走 idbTxtRun");
  }
});

// 大仓库被系统清掉、localStorage 那几个小键还留着：bootHadLocal 判 true，
// 这台已经空了的手机被当成老设备，既不恢复也不吭声。
test("大仓库空了就不许再冒充老设备，但没灌起来时绝不拉云覆盖", () => {
  const pull = cloud.match(/async autoPull\(\) \{([\s\S]*?)\n    \},/);
  assert.ok(pull, "autoPull 要留着");
  assert.match(pull[1], /if \(bootHadLocal && !vaultEmpty\)/, "老设备那一支要加上「大仓库还有东西」");
  const v = pull[1].match(/vaultEmpty = (!![^;]*);/);
  assert.ok(v, "vaultEmpty 要算出来");
  assert.match(v[1], /st\.ok/, "仓库没灌起来时不许判空——那是读不出来，不是真没了");
  assert.match(v[1], /localMeaningful\(\)/, "判据是大仓库里有没有角色");
  assert.match(pull[1], /txtVaultReady\(/, "要等灌完再判，不许抢在前面");
});

// 一飘走就看不见了，接着建角色/导入/云恢复才是真把活的那份盖掉的时刻。
test("仓库没打开要赖着不走的横幅，不许只弹几秒的 toast", () => {
  assert.match(app, /function showVaultDownBanner\(/);
  const b = app.match(/function showVaultDownBanner\(err\) \{([\s\S]*?)\n  \}/);
  assert.match(b[1], /别建角色/);
  assert.match(b[1], /别点从云端恢复/);
  assert.match(b[1], /document\.body\.appendChild/, "挂在 body 上，界面半残时也看得见");
  const call = app.match(/st\.done && !st\.ok\) ([^\n]*)/);
  assert.ok(call, "那一处判断要留着");
  assert.match(call[1], /showVaultDownBanner/);
  assert.doesNotMatch(call[1], /toast/, "不许再退回 toast");
});
