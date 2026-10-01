// 从帖子点进主页，退出来要回到那条帖（她 2026-10-01）
//
// 她原话：「从帖子点进主页再退出来直接回到贴吧主页，而不是在看的那条帖」。
// 病根就一行：goProfile 里 setOpen(null) —— 进主页时把正在看的那条帖【扔了】，
// 退出来自然无帖可回。
// ⚠️不能图省事不清 open：论坛的分派是 `if (open)` 打头，open 还在就永远渲染帖子、
//   主页根本进不去。所以正解是【进去时收起来、退出时放回去】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const scr = fs.readFileSync("js/screens.js", "utf8");

// enterSub / leaveSub 那一对，从源码里抠出来真跑，别在测试里另写一遍
const pair = (() => {
  const i = scr.indexOf("  const enterSub = go =>");
  const j = scr.indexOf("  const goProfile = id =>");
  assert.ok(i > 0 && j > i, "抠不出 enterSub / leaveSub");
  return scr.slice(i, j);
})();

function world() {
  const st = { open: null, fromPost: null, profile: null };
  const setOpen = v => { st.open = v; };
  const setFromPost = v => { st.fromPost = v; };
  // open / fromPost 在真实组件里都是渲染时读的闭包变量，这儿现取一次喂进去
  const api = new Function("state", "setOpen", "setFromPost",
    "const open = state.open, fromPost = state.fromPost;" + pair + "\nreturn {enterSub, leaveSub};");
  // open 在真实组件里是每次渲染重新读的，所以每次调用都现取一次
  return {
    st,
    enter: go => api(st, setOpen, setFromPost).enterSub(go),
    leave: go => api(st, setOpen, setFromPost).leaveSub(go),
  };
}

test("① 在看一条帖 → 点进主页 → 退出来，回到那条帖", () => {
  const w = world();
  w.st.open = { id: "fp_1", title: "那条帖" };
  w.enter(() => { w.st.profile = "c1"; });
  assert.equal(w.st.open, null, "进主页时必须清掉 open，否则主页根本渲染不出来");
  assert.equal(w.st.fromPost.id, "fp_1", "但那条帖要收着");
  w.leave(() => { w.st.profile = null; });
  assert.equal(w.st.open.id, "fp_1", "退出来要回到那条帖，不是回贴吧主页");
  assert.equal(w.st.fromPost, null, "回去之后就别再记着了");
});

test("② 本来就不是从帖子进去的（从列表直接点头像）：退出来照旧回主页", () => {
  const w = world();
  w.st.open = null;
  w.enter(() => { w.st.profile = "c1"; });
  assert.equal(w.st.fromPost, null);
  w.leave(() => { w.st.profile = null; });
  assert.equal(w.st.open, null, "没来处就别凭空变出一条帖");
});

test("③ 三种主页都走这一对，不许谁再自己写一份 setOpen(null)", () => {
  for (const fn of ["goProfile", "goAltProfile", "goNpcProfile"]) {
    const i = scr.indexOf("  const " + fn + " =");
    assert.ok(i > 0, "抠不出 " + fn);
    const line = scr.slice(i, scr.indexOf("\n", i));
    assert.match(line, /enterSub\(/, fn + " 没走 enterSub");
    assert.ok(!/setOpen\(null\)/.test(line), fn + " 还自己写着 setOpen(null)");
  }
  for (const [label, re] of [
    ["角色主页", /backFn = \(\) => leaveSub\(\(\) => setProfileId\(null\)\)/],
    ["小号主页", /backFn = \(\) => leaveSub\(\(\) => setAltProfile\(null\)\)/],
    ["网友主页", /backFn = \(\) => leaveSub\(\(\) => setNpcProfile\(null\)\)/],
  ]) assert.match(scr, re, label + "的返回键没走 leaveSub");
});

test("④ 换地方（跳私信 / 换底栏）要把记着的帖扔掉，别过一会儿凭空弹回来", () => {
  assert.equal((scr.match(/setNav\("pm"\); setPmId\(tid\);\s*setFromPost\(null\);/g) || []).length, 2,
    "从主页跳私信那两处要清掉 fromPost");
  assert.match(scr, /setNav\(nx\[0\]\); setFromPost\(null\);/, "底栏换一栏也要清掉");
});
