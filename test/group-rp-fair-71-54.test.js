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

// ⚠️v71.68 她推翻了「整体掷 70%」那一版，而且理由是对的：
//   **她自己发的红包她领不了**（byMe → "own"），所以那 30% 没掷中就成了一个
//   谁也不领的死包——比被抢走还糟。她定的新规矩：
//   「所有红包三秒后角色开抢，如果数量不够人头的话就随机决定谁抢得到」。
//   照做，并把她算成一个人头（她那条规矩里本来就含着这个意思）。
test("一定有人抢，不再掷「抢不抢」那一下", () => {
  const seg = grab();
  // 只看抢红包这一段：别处（查手机那条）也有 Math.random() >= 的写法，跟这儿无关
  assert.ok(!/RP_NPC_CHANCE/.test(app), "那一下又回来了——她发的包会没人领");
  assert.ok(!/Math\.random\(\) >= /.test(seg), "抢红包这一段又掷了一次「抢不抢」");
  assert.ok(!/members\.filter\(\(\) => Math\.random\(\)/.test(app), "每人独立掷那一版更不能回来");
  assert.match(app, /const RP_GRAB_DELAY = 3000;/, "她定的是三秒");
  assert.equal((app.match(/autoGrabRedPacket\(groupId, rpId\), RP_GRAB_DELAY\)/g) || []).length, 2,
    "两条发红包的路要用同一个三秒");
});

// ⚠️v71.72 她拍板：「三秒后照抢不误吧宝宝」——我提的「抽中她就给她留一份」被否了。
//   她的机会就是那三秒，手快是她自己的事。代码里不许再有任何给她留份的暗档。
test("三秒后照抢不误：座位里没有她", () => {
  const seg = grab();
  assert.ok(/const seats = members\.slice\(\);/.test(seg), "座位里又混进了别的东西");
  assert.ok(!/\{ me: true \}|w\.me|rp\.byMe \?/.test(seg), "又偷偷给她留了一格");
  assert.ok(/for \(let i = seats\.length - 1; i > 0; i--\)/.test(seg), "没洗牌，座位顺序就是成员顺序");
  assert.ok(/const winners = seats\.slice\(0, left\);/.test(seg), "名额不够人头时没抽签");
});

test("她已经抢光了就别再动", () => {
  const seg = grab();
  assert.ok(/if \(left <= 0\) return;/.test(seg), "三秒里她抢光了，角色还会再抢一遍");
  assert.ok(/if \(!got\.length\) return;/.test(seg), "一份都没给出去还是写了一次存档");
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
