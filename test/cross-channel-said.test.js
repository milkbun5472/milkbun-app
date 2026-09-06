const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-08-27：顾朝顾暮在两个群里几乎同时说话，给了两套对不上的说法。
// 病因：一个人在几个频道里同时开口，谁也不知道自己在别处说了什么。
const src = (() => {
  const i = app.indexOf("const crossChannelSaid = (charId, exceptGroupId) => {");
  assert.ok(i > 0, "取数函数没了");
  return app.slice(i, app.indexOf("\n  };", i));
})();

const drive = ({ groups, chats, settings, charId, except }) => {
  const env = {
    groups,
    gsFor: gid => settings[gid] || { memoryInterop: true },
    groupChatsRef: { current: chats },
    contextAllowsMessage: () => true,
    Date: { now: () => 1000000 }
  };
  const fn = new Function(...Object.keys(env),
    "const CROSS_SAID_WINDOW_MS = 90 * 60000;\n" + src + "\n  };\nreturn crossChannelSaid;")(...Object.values(env));
  return fn(charId, except);
};

const base = {
  groups: [{ id: "g1", name: "三人群", memberIds: ["c1", "c2"] },
           { id: "g2", name: "朝暮", memberIds: ["c1", "c2"] }],
  chats: {
    g1: [{ role: "assistant", senderId: "c1", content: "六点半左右到家", ts: 999000 }],
    g2: [{ role: "assistant", senderId: "c1", content: "今晚不回去了", ts: 999500 }]
  },
  settings: { g1: { memoryInterop: true }, g2: { memoryInterop: true } },
  charId: "c1"
};

test("在这个群里说话时，看得到自己刚在别的群说过什么", () => {
  const got = drive({ ...base, except: "g2" });
  assert.match(got, /〔三人群〕六点半左右到家/);
  assert.doesNotMatch(got, /今晚不回去了/, "当前这个群自己的话不用再喂一遍");
});

test("只取 TA 自己说的，别人的话一个字都不带", () => {
  const chats = { g1: [
    { role: "assistant", senderId: "c2", content: "别人说的", ts: 999000 },
    { role: "user", content: "她说的", ts: 999100 },
    { role: "assistant", senderId: "c1", content: "我自己说的", ts: 999200 }
  ], g2: [] };
  const got = drive({ ...base, chats, except: "g2" });
  assert.match(got, /我自己说的/);
  ["别人说的", "她说的"].forEach(x => assert.ok(!got.includes(x), x + " 不该出现"));
});

// 封闭群只进不出（施工规则/four-surfaces-same-context.md）
test("封闭群里说过的话绝不外流", () => {
  const settings = { g1: { memoryInterop: false }, g2: { memoryInterop: true } };
  assert.equal(drive({ ...base, settings, except: "g2" }), "", "闭群的话漏出来了");
});

test("撤回的、OOC 的、系统的都不算", () => {
  const chats = { g1: [
    { role: "assistant", senderId: "c1", content: "撤回了", ts: 999000, recalled: true },
    { role: "assistant", senderId: "c1", content: "跳戏的", ts: 999050, kind: "ooc" },
    { role: "assistant", senderId: "c1", content: "系统的", ts: 999080, kind: "system" },
    { role: "assistant", senderId: "c1", content: "留下的", ts: 999100 }
  ], g2: [] };
  const got = drive({ ...base, chats, except: "g2" });
  assert.equal(got, "〔三人群〕留下的");
});

test("只看最近这一个半小时，陈年旧话不翻出来", () => {
  const chats = { g1: [{ role: "assistant", senderId: "c1", content: "三小时前说的", ts: 1000000 - 3 * 3600000 }], g2: [] };
  assert.equal(drive({ ...base, chats, except: "g2" }), "");
});

test("不在那个群里的人，拿不到那个群的话", () => {
  const groups = [{ id: "g1", name: "三人群", memberIds: ["c2"] }];
  assert.equal(drive({ ...base, groups, except: null }), "");
});

// —— 接线：群聊落在那位成员自己那一段里，单聊也要有
test("群里这一段落在成员自己那一段，别的成员看不到", () => {
  assert.match(app, /const said = crossChannelSaid\(c\.id, groupId\);/, "群聊没接");
  // 别冻整串拼接顺序——那一段以后还会长（v57.83 中间插了随身物 cySeg）。
  // 要守的是：xgSeg 拼在【这位成员自己那一段】的 return 里，不是合成一块共享注入。
  const seg = (app.match(/return "【" \+ c\.name \+ "】" \+ groupPersonaText\(c\.persona, gPersonaCap\)[^;]*;/) || [])[0] || "";
  assert.ok(seg, "找不到群里那位成员自己那一段");
  assert.match(seg, /\+ xgSeg\b/, "没拼进那位成员自己那一段");
  assert.match(app, /别的成员不一定知道，别替他们知道/, "隐私边界那句要写进去");
});

test("单聊也要有——以前它只知道「她在群里跟我互动过」，不知道我说了什么", () => {
  // ⚠️别冻整行：v60.15 起它由「这间房看不看得见别的场景」把着门（副本房不喂），取还是取
  assert.match(app, /_saidElsewhere = [\s\S]{0,60}crossChannelSaid\(charId, null\)/, "单聊没取");
  assert.match(app, /crossChannelHint \+ _saidElsewhereHint \+/, "取了却没拼进每轮任务串");
});
