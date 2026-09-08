const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), gaze = R("gaze.js"), components = R("components.js");
const appCode = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 固定时钟便于验证写入与复看的时间戳。
function loadGaze() {
  const store = {};
  const clock = { t: 1757000000000 };
  const ctx = {
    Date: new Proxy(Date, { get: (o, k) => (k === "now" ? () => clock.t : o[k]) },),
    React: { useState: () => [null, () => {}] },
    ReactDOM: { createPortal: () => null },
    document: { body: {} }, F_BODY: "", F_DISPLAY: "",
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(gaze, ctx);
  return { G: ctx.Gaze, store, clock };
}
// 把这张卡的所有写入时刻推回 n 天前（存档里就是这么存的：blocks[k].ts）
function ageCard(store, id, days) {
  const d = JSON.parse(store.x_gaze);
  Object.keys(d[id].blocks).forEach(k => { d[id].blocks[k].ts -= days * 86400000; });
  store.x_gaze = JSON.stringify(d);
}
// 把一张【十块写满、且已经过了门槛】的卡摆出来
function fullCard(G, id) {
  ["person", "soft", "like", "recent", "unread"].forEach((b, i) => G.apply(id, "me", b, "我" + b + i));
  ["what", "how", "marks", "elephant", "want"].forEach((b, i) => G.apply(id, "us", b, "我们" + b + i));
  return id;
}


test("省略不留漏答痕迹，也不伪造看过记录",()=>{
  const {G,store}=loadGaze();const id=fullCard(G,"quiet");G.markSeen(id,"me.person");
  const before=store.x_gaze;
  for(let i=0;i<100;i++){G.spec("阿棠",id);G.nudge("阿棠",id);assert.equal(G.applyParsed(id,null),false);}
  assert.equal(store.x_gaze,before);
  assert.equal(G.checkedAt(id,"me.person"),0);
  assert.equal(G.tick,undefined);
  assert.equal(G.reviewDue,undefined);
  assert.doesNotMatch(appCode,/maybeAutoReviewGaze|Gaze\\.tick/);
});
test("任意块的小补充可立即写入，只影响当前角色当前块并保存历史",()=>{
  const {G,store}=loadGaze();
  fullCard(G,"one");fullCard(G,"two");
  for(const key of Object.keys(G.KEYS)){
    const before=JSON.parse(store.x_gaze);
    const [side,block]=key.split(".");
    const text=before.one.blocks[key].text+"，新增一条有依据的认识";
    assert.equal(G.applyParsed("one",{side,block,text}),true);
    const after=JSON.parse(store.x_gaze);
    assert.equal(after.one.blocks[key].text,text);
    assert.deepEqual(after.two,before.two);
    for(const other of Object.keys(G.KEYS).filter(k=>k!==key))
      assert.deepEqual(after.one.blocks[other],before.one.blocks[other]);
    assert.equal(after.one.hist[0].old,before.one.blocks[key].text);
  }
});
test("旧存档漏答计数不会再催写或触发收费复看",()=>{
  const {G,store}=loadGaze();fullCard(G,"legacy");
  const data=JSON.parse(store.x_gaze);
  Object.assign(data.legacy,{mute:999,refuse:999,turns:999,skips:{"me.person":99}});
  store.x_gaze=JSON.stringify(data);
  assert.doesNotMatch(G.spec("阿棠","legacy"),/不许再跳过|点名|必须二选一/);
  assert.equal(G.reviewDue,undefined);
  assert.doesNotMatch(gaze,/lines.push.*被点名/);
});
test("复看那一份问的是「哪几块已经不对了」，不是「你对她怎么看」", () => {
  const { G, store } = loadGaze();
  const id = fullCard(G, "old2");
  ageCard(store, id, 20);
  const sp = G.reviewSpec("阿棠", id);
  // 现行十块要原样摆给他看，否则他只能凭空再编一份。
  // ⚠️v64.56 起【发给模型的名字换了一套】（KEYS 只留给界面，ASK 才是发出去的）——
  //   要点的是「十块一块不少地摆给他看」，不是「用界面上那套字」。
  const askOf = k => (G.ASK || G.KEYS)[k];
  Object.keys(G.KEYS).forEach(k => assert.ok(sp.indexOf(askOf(k)) >= 0, "复看没把这一块给他看：" + k));
  assert.match(sp, /哪几块已经跟你现在心里的不一样了/);
  assert.match(sp, /没变就是没变，不必为了交差改字/, "不给「没变」留出口，他就会为了交差乱改");
  assert.match(sp, /20 天前/, "得告诉他上次改是多久以前");
  // 跟建卡那一份一样，不许出现内容示范（prompt-no-content-samples）
  assert.ok(!/如「/.test(sp), "复看那份又写了「如……」的示范");
});

test("复看写进来的走同一个 apply：原样抄回来不算改，真改了才清零重来", () => {
  const { G } = loadGaze();
  G.apply("rv", "me", "person", "她比看上去能扛");
  G.markReview("rv");
  assert.equal(G.review("rv", { me: { person: "她比看上去能扛" }, us: {} }), 0, "一字不改也算写了一块");
  assert.equal(G.reviewState("rv").tries, 1, "一块没改却把次数清了，下次冻住还会再花一次");
  assert.equal(G.review("rv", { me: { person: "她比看上去能扛,只是不说" }, us: {} }), 1);
  assert.equal(G.reviewState("rv").tries, 0, "真改出来了，次数没清零");
});

// ── 接线 ────────────────────────────────────────────────────
test("专门复看仍由手动入口发起，先记尝试再调用",()=>{
  const fn=app.slice(app.indexOf("const reviewGazeFor"),app.indexOf("const [editMsg"));
  assert.ok(fn.indexOf("Gaze.markReview")<fn.indexOf("await gazeCall"));
  assert.match(fn,/Gaze.acceptReview/);
  assert.doesNotMatch(appCode,/reviewGazeFor\\(char\\)/);
});

test("她盯着一张冻住的卡时得有个按得动的东西", () => {
  assert.match(gaze, /onReview, reviewBusy/, "GazePage 没收这两个 prop");
  assert.match(gaze, /hasAny\(charId\) && onReview \? h\("button"/, "有内容的卡上没有复看按钮");
  assert.match(components, /onGazeReview, gazeReviewBusy/, "状态卡没把这条线传下去");
  assert.match(components, /onReview: onGazeReview, reviewBusy: gazeReviewBusy/);
  // v64.35：手动这颗传 manual=true，别再跟自动共用那三次预算
  assert.match(app, /onGazeReview: \(\) => \{ if \(!apiFor\(scc\.id\)\) return toast\("请先配置 API"\); reviewGazeFor\(scc, true\); \}/);
});

test("卡片只显示明确的复看结果，不再显示漏答连击",()=>{
  assert.doesNotMatch(gaze,/lines.push.*被点名/);
  assert.match(gaze,/rv.okAt/);
  assert.match(gaze,/rv.err/);
});
