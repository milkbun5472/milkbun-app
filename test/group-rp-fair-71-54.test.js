// 她 2026-09-19：「现在群里发红包只有一个的话模型是不是必定让另一个领到这样我根本
//   没机会。。。」＋「群聊能发专属红包也弄一下」
//
// 前一句是真的，而且比看上去狠：原来是【每个成员独立掷 70%】——
//   两个 NPC 就是 1-0.3²=91%，三个是 97%；再加上 1.2 秒就开抢，她一次都碰不到。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comp = P("js/components.js");

const grab = () => {
  const i = app.indexOf("  const autoGrabRedPacket = (groupId, rpId) => {");
  const j = app.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出 autoGrabRedPacket");
  return app.slice(i, j);
};

// ⚠️这一条是整个修复：抢不抢是【这一个红包】的一次判定，不是每人一次
test("整体只掷一次，不随群里人数膨胀", () => {
  const seg = grab();
  assert.ok(/if \(Math\.random\(\) >= RP_NPC_CHANCE\) return;/.test(seg), "又变回每人一掷了");
  assert.ok(!/members\.filter\(\(\) => Math\.random\(\)/.test(app), "旧那句每人独立掷还在");
  assert.match(app, /const RP_NPC_CHANCE = 0\.7;/);
  // 掷中之后挑谁抢是随机的，但那一步不许再掺概率
  assert.ok(/pool\.slice\(0, Math\.min\(room, pool\.length\)\)/.test(seg), "挑人那一步又掺进了概率");
});

test("先给她一段先手窗口，名额越紧越长", () => {
  assert.match(app, /const RP_HEADSTART_TIGHT = 12000;/);
  assert.match(app, /const RP_HEADSTART_LOOSE = 3000;/);
  assert.match(app, /const rpHeadstart = \(rp, npcN\) => \(rp && rp\.count > npcN\) \? RP_HEADSTART_LOOSE : RP_HEADSTART_TIGHT;/);
  // 两条发红包的路都要用它，旧那个写死的 1200/1400 不许留
  assert.equal((app.match(/rpHeadstart\(\{ count: splits\.length \}/g) || []).length, 2, "有一条路还在用写死的延时");
  assert.ok(!/autoGrabRedPacket\(groupId, rpId\), 1200\)|autoGrabRedPacket\(groupId, rpId\), 1400\)/.test(app), "写死的 1.2/1.4 秒还在");
});

test("多份的时候永远留一份给她", () => {
  const seg = grab();
  assert.ok(/const room = rp\.count > 1 \? Math\.max\(1, left - 1\) : left;/.test(seg),
    "多份红包被 NPC 抢光了——她点进去只剩「已被领完」");
});

// ── 专属红包 ─────────────────────────────────────────────────────────────
test("专属红包压根不走随机抢那条路", () => {
  const seg = grab();
  assert.ok(/if \(rp\.toId\) return;/.test(seg), "专属红包也会被别人抢走");
  assert.ok(seg.indexOf("if (rp.toId) return;") < seg.indexOf("Math.random()"), "判定排在掷骰后面就晚了");
});

test("专属就是一份，不拆", () => {
  // 给一个人还分好几份，那不是专属，是普通红包写了个名字
  assert.equal((app.match(/splitRedPacket\(a, to \? 1 : count\)/g) || []).length, 2, "两条发红包的路里有一条会把专属红包拆开");
});

test("她领不了的那一张要当场说清楚，不是点了没反应", () => {
  assert.match(app, /if \(rp\.toId && rp\.toId !== "me"\) return "notyours";/, "她能领走点名给别人的红包");
  assert.ok(comp.includes('r === "notyours"'), "点下去一声不吭，像坏了");
  assert.ok(comp.includes("这是专属红包，只有 "), "没说清是谁的");
  // 卡面上就该看得出来，别等点开才知道
  // v71.66 重画时它从祝福语里拎出来，单做了一枚标签（原来挤在前面把那一行吃掉一半）
  assert.ok(comp.includes('"只给 " + only'), "卡面上没写只给谁");
  assert.ok(comp.includes("不是给你的"), "卡面底注没交代");   // v71.66 重画后「只给谁」上移成标签，底注就只留这一句
});

test("他也能发专属给她：名字解析不出来就退回普通红包，绝不猜", () => {
  const i = app.indexOf("    const to = (() => {"), j = app.indexOf("    })();", i);
  assert.ok(i > 0 && j > i, "抠不出名字解析那一段");
  const seg = app.slice(i, j);
  assert.ok(/return c \? \{ id: c\.id, name: c\.remark \|\| c\.name \} : null;/.test(seg), "认不出还硬给一个 id");
  assert.ok(/nm === \(profile\.name \|\| "我"\)/.test(seg), "他点名给她的时候认不出来");
  assert.ok(/x\.id !== char\.id/.test(seg), "他能发专属红包给自己");
  // 能力字典里得写清这一栏
  assert.ok(app.includes("专属红包，别人领不了，金额不拆"), "模型不知道有这一栏");
});

test("专属红包在上下文里也要说清是给谁的", () => {
  assert.ok(app.includes('发了个专属红包，点名只给 '), "群里别的角色看不出这红包是点名的");
});
