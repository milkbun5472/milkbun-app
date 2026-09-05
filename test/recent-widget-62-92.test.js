const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const P = f => path.resolve(__dirname, "..", f);
const src = fs.readFileSync(P("js/recent-widget.js"), "utf8");
const comp = fs.readFileSync(P("js/components.js"), "utf8");
const app = fs.readFileSync(P("js/app.js"), "utf8");

function load() {
  const sandbox = {
    React: { createElement: function () { return { el: [].slice.call(arguments) }; } },
    useTheme: () => ({ bg: "#ece8e1", bg2: "#f6f3ec", ink: "#3a3430", sub: "#6b635b", fog: "#9b948a", line: "#ddd8cd", accent: "#b04a3f" }),
    F_DISPLAY: "d", F_BODY: "b",
    skinAlpha: (c, a) => (typeof c === "string" && c[0] === "#" && c.length === 7 ? c + a : c),
    IArrow: () => null,
    window: {}
  };
  sandbox.window.React = sandbox.React;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.RecentWidget;
}

test("这一沓答的是「有什么在等你」：只夹没看的，最新的压在最上面", () => {
  const R = load();
  const now = 1757000000000;
  const rows = R.recentRows({
    characters: [{ id: "c1", name: "甲" }, { id: "c2", name: "乙", remark: "王爷" }, { id: "c3", name: "丙" }],
    groups: [{ id: "g1", name: "茶水间" }],
    chats: {
      c1: [{ ts: now - 1000, content: "刚说的" }],
      c2: [{ ts: now - 90000, content: "早些说的" }],
      c4: [{ ts: now, content: "查无此人" }]
    },
    groupChats: { g1: [{ ts: now - 50000, content: "群里那句" }], g2: [{ ts: now, content: "看过的群" }] },
    // c2/g2 说过话但看完了；c3 有未读却一句没说过
    unreadMap: { c1: 3, g1: 12, c3: 9 }
  });
  // rows 是在 vm 里造的，跨 realm 的数组过不了 deepStrictEqual，所以比字符串
  assert.equal(rows.map(r => r.id).join(","), "c1,g1",
    "v63.68 起只夹【还没看的】（她 2026-09-05：「我要只有未读的」）：看完的 c2/g2 不该在，一句没说过的 c3 也不该在");
  assert.equal(rows[0].unread, 3);
  assert.equal(rows[1].type, "group");
});

test("有备注就用备注，跟聊天列表同一个叫法", () => {
  const R = load();
  const now = 1757000000000;
  const rows = R.recentRows({
    characters: [{ id: "c2", name: "乙", remark: "王爷" }],
    groups: [], chats: { c2: [{ ts: now, content: "在" }] }, groupChats: {}, unreadMap: { c2: 1 }
  });
  assert.equal(rows[0].name, "王爷");
});

// 空着的时候要说对话：一条都没说过 vs 说过但都看完了，是两件事。
// 全说成「夹子上还空着」的话，她每天看完消息都会以为这个组件坏了。
test("两种空态说的不是同一件事", () => {
  const w = src.slice(src.indexOf("function RecentWidget("), src.indexOf("function UnreadBack("));
  assert.match(w, /everSpoke\(props\) \? "都看完了。" : "夹子上还空着/);
  const es = src.slice(src.indexOf("function everSpoke(p)"), src.indexOf("function clampBar("));
  assert.match(es, /Object\.keys\(chats\)\.some/);
  assert.match(es, /Object\.keys\(gchats\)\.some/, "群聊那一半漏了：只跟群说过话的人会看到「还空着」");
});

// 撤掉东西要删干净：夹上全是没看的之后，「看过的那一档」的浅样式不许留在原地
test("「看过的那一档」的样式删干净了，没留在原地", () => {
  const w = src.slice(src.indexOf("const slip = function"), src.indexOf("    return h(\"div\", {\n      className: \"w-full h-full flex flex-col\""));
  assert.doesNotMatch(w, /un \? /, "还留着「看过的怎么摆」那些分支");
  // v63.70 起那道红跟着主题的强调色走（她换主题时它也跟着换）
  assert.match(w, /borderLeft: "3px solid " \+ accent/);
  // 时刻和条数都要：只剩条数的话，「这是刚来的还是昨天的」就看不出来了
  assert.match(w, /whenLabel\(r\.ts, props\.now\)/, "时刻没了");
  assert.match(w, /un > 99 \? "99\+" : un/, "条数没了");
});

test("字条真的能翻：高度钉死 + 自己那一层滚，不靠内容把主屏格子撑大", () => {
  const seg = src.slice(src.indexOf("function RecentWidget("), src.indexOf("function UnreadBack("));
  assert.match(seg, /overflowY: "auto"/, "不能滚的话「真的可以翻」就没实现");
  assert.match(seg, /className: "flex-1 min-h-0"/, "滚动层必须是 flex-1 min-h-0，否则它会把外壳顶开");
  assert.doesNotMatch(comp, /HOME_FREE_HEIGHT = \{[^}]*w_recent/, "字条夹的高度必须钉死，不然它按内容长个没完");
});

test("点一张字条真的落到那个人的聊天框里", () => {
  const seg = src.slice(src.indexOf("function RecentWidget("), src.indexOf("function UnreadBack("));
  assert.match(seg, /props\.onOpenChat\(r\.id, r\.type\)/);
  assert.match(comp, /it\.which === "recent"\) inner = \(window\.RecentWidget/, "组件没挂上主屏");
  assert.match(comp, /w_recent: \{ kind: "widget", which: "recent" \}/, "没进 REG 的 key 会被 valid\\(\\) 滤掉，摆不上去");
  const at = comp.indexOf('it.which === "recent"');
  const dispatch = comp.slice(at, comp.indexOf("\n", at));
  for (const k of ["characters:", "groups:", "chats:", "groupChats:", "unreadMap:", "onOpenChat:"]) {
    assert.ok(dispatch.indexOf(" " + k) >= 0, "字条夹少喂了 " + k);
  }
  // Home 自己得先收到这几样，否则派发那行拿到的全是 undefined
  const homeArgs = comp.slice(comp.indexOf("function Home({"), comp.indexOf("function Home({") + 400);
  for (const k of ["groups", "chats", "groupChats", "unreadMap", "onOpenChat"]) {
    assert.match(homeArgs, new RegExp("\\n  " + k + ","), "Home 没接 " + k);
  }
  assert.match(app, /onOpenChat: \(id, type\) =>/);
  assert.match(app, /setActiveGroup\(g\); clearUnread\(id\); setScreen\("gthread"\)/);
  assert.match(app, /setActiveChar\(c\); clearUnread\(id\); setScreen\("thread"\)/);
});

test("返回键那个圈数的是【别处】，当前这一间不算在里头", () => {
  assert.match(comp, /window\.RecentWidget\.UnreadBack, \{ count: unreadOther \|\| 0, onBack: onBack \}/);
  assert.match(app, /unreadOther: Object\.entries\(unreadMap\)[\s\S]{0,80}kv\[0\] === activeChar\.id \? 0 :/,
    "不排掉当前角色的话，人在 A 的屋里还会看到 A 自己那几条");
});

test("圈是「一眼看得出还剩几条」，不是一颗点不着的小点", () => {
  const seg = src.slice(src.indexOf("function UnreadBack("));
  assert.match(seg, /if \(!n\) return/, "一条没有时该退回原来那支箭，别摆一个 0");
  assert.match(seg, /n > 99 \? "99\+"/);
  assert.match(seg, /padding: "9px 5px 9px 3px"/, "圈只有 22px 高，靠 padding 补到 40 的手感");
  assert.match(seg, /border: "1\.5px solid "/, "圈得是个圈——只填个色就退回基础款了");
});

test("夹子整只是程序画的：没有 emoji、没有符号当图标", () => {
  // 注释里写个箭头没关系（她看不见），要挡的是【渲进界面】的那些
  const code = src.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const bad = [...code].filter(ch => {
    const c = ch.codePointAt(0);
    return (c >= 0x1f000 && c <= 0x1ffff) || (c >= 0x2190 && c <= 0x2bff) || (c >= 0xfe0f && c <= 0xfe0f);
  });
  assert.equal(bad.join(""), "", "她机器上这些会渲成豆腐块");
});
