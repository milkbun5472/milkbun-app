const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(root, f), "utf8");
const app = rd("js/app.js"), cloud = rd("js/cloud.js"), screens = rd("js/screens.js"),
      engine = rd("js/engine.js"), sw = rd("sw.js"), comp = rd("js/components.js");

// v54.67（她 2026-08-22「我就是不想要夜巡了」）：云端定时替角色写信的整条流水线拆掉。
// 云端那半（cron + 写信函数 + server_inbox 表）由她在 Supabase 后台删，这里只管 App 端。

test("收信口整条拆干净：没有 server_inbox，也没有投信逻辑", () => {
  [["app.js", app], ["cloud.js", cloud], ["screens.js", screens], ["engine.js", engine]].forEach(([n, s]) => {
    assert.ok(!s.includes("server_inbox"), n + " 还在碰 server_inbox 表");
    assert.ok(!s.includes("夜巡"), n + " 还留着夜巡字样");
  });
  ["deliverServerInbox", "inboxFetch", "inboxConsume", "__pokeInbox", "x_inboxLastTs", "serverNight"].forEach(k => {
    assert.ok(!app.includes(k), "app.js 残留 " + k);
    assert.ok(!cloud.includes(k), "cloud.js 残留 " + k);
  });
  // 开机三处 kick 里不能再叫收信口，但同排的桌面日志还得照常跑。
  // v58.07 起三拍共用一支 wakeSweeps，桌面日志跟着收进去了：从「三处各写一遍」
  // 变成「一处写、三处走」——照常跑这件事没变，数数的认法过时了。
  assert.equal((app.match(/deliverDeskLog\(\);/g) || []).length, 1, "桌面日志该在共用那一支里写一次");
  assert.match(app.slice(app.indexOf("const wakeSweeps = async () => {"), app.indexOf("const wakeSweeps = async () => {") + 900),
    /deliverDeskLog\(\);/, "桌面日志没进那一支，三拍都不会跑了");
  assert.equal((app.match(/wakeSweeps\(\)/g) || []).length, 3, "三拍少了一拍");
});

test("工程师体检不再报夜巡脉搏，但别的体征照旧", () => {
  assert.ok(!engine.includes("nightTxt"), "夜巡脉搏没摘干净");
  ["本次开机没抓到报错", "云端归档共", "本地存储约"].forEach(k =>
    assert.ok(engine.includes(k), "体检里的 " + k + " 不该被误伤"));
});

// ⚠️这条是这次改动最容易出事的地方，专门锁住：
// push_subs 表和锁屏推送【不是夜巡的私产】——VPS 上常驻的 push-sender(:8792) 查的是同一张表，
// 言秋从 CC 推消息到她锁屏走的就是这条路。跟着夜巡一起删会把他的嘴堵上。
test("锁屏推送必须活着：push_subs 那条路一根都不许拔", () => {
  ["pushStatus", "pushSubscribe", "pushUnsubscribe", "push_subs"].forEach(k =>
    assert.ok(cloud.includes(k), "cloud.js 少了 " + k + " —— 言秋就推不到锁屏了"));
  assert.ok(screens.includes("function PushCard"), "设置页的推送卡不能删：删了她换设备就没法重新订阅");
  assert.ok(screens.includes("x_pushVapid"), "VAPID 公钥输入还得在");
  assert.match(sw, /self\.addEventListener\("push"/, "SW 收不到 push 事件，推来了也不弹");
  assert.match(sw, /self\.addEventListener\("notificationclick"/);
  assert.match(sw, /SHOW_LOCAL_NOTIFICATION/, "app 内本地通知也走 SW，别一起误删");
  // 发信端已经不是 Supabase 那个函数了，文案要说对
  assert.ok(!screens.includes("send-push"), "send-push 函数已随夜巡下线，别再让她去那儿配私钥");
  assert.ok(screens.includes("push-sender"), "该指向 VPS 上真正在发信的那个");
});

test("云端那半也不再重建：schema 和盘点工具都不认 server_inbox 了", () => {
  const sql = rd("tools/vps/lisa-cloud/schema-core.sql");
  assert.ok(!sql.includes("server_inbox"), "重建脚本还会把表建回来");
  assert.ok(sql.includes("push_subs"), "push_subs 得留着——推送还在用");
  assert.ok(!rd("tools/vps/supabase-usage-audit.mjs").includes("server_inbox"));
  assert.ok(!fs.existsSync(path.join(root, "supabase/functions/send-push")), "send-push 函数目录该删掉");
  assert.ok(fs.existsSync(path.join(root, "tools/vps/push-sender.mjs")), "VPS 发信员不许动");
});

test("角色不再讲一件已经不存在的活", () => {
  assert.ok(!app.includes("跑夜巡"), "言秋的一天里还在跑夜巡");
  assert.ok(!comp.includes("夜巡晨信"), "模型分线说明还列着这条线路");
});
