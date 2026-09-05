// 2026-09-05 审计（报告 7527fce）里分给我的那一摞，全在「备份这条链上没人说实话」这一件事上。
// 9/3 事故的三道哑火，一道都没修完：
//   一道 自动上云失败静默吞掉，成功也不显示 → 连败九天没人知道
//   二道 过期设备闸一个会话只查一次、查失败当「不过期」 → 挂了九天的旧标签页照样盖新账
//   三道 开机推送跟灌文字库并排跑 → 只靠「盘慢网快」就能把云端换成一份没有聊天的残档
// 外加两条修复路径自己的坑：apply() 删光本机再逐键写、没有回滚；
// 「从云端恢复」和「退出登录（清空本机）」两个按钮前面都没有「先导出一份」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const cloud = R("cloud.js"), engine = R("engine.js"), app = R("app.js"),
      screens = R("screens.js"), components = R("components.js");
const bare = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const slice = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
const autoPush = bare(slice(cloud, "async autoPush()", "\n    },"));
const applyFn = bare(slice(cloud, "async apply(data)", "\n    async getUser()"));

// ── 闸一：文字库灌完了没有 ──────────────────────────────────────
// 这一条是唯一【不需要任何外部故障】的：IDB 读得慢、网络快，就够了。
// collect() 取的是内存镜像 __txtMirror，镜像是 hydrateTxtVault 灌的，
// 而开机 autoPull→autoPush 跟它并排跑、谁也不等谁。
test("文字库没灌完就不许上云——闸立在【灌的那一头】，不靠开机顺序", () => {
  // 闸的实现要能单独跑起来：把 engine.js 里那一段原样抠出来在沙箱里执行
  const src = slice(engine, "const _txtGate = {", "// 开机：IDB→内存镜像");
  const ctx = { setTimeout, clearTimeout, Promise };
  vm.createContext(ctx); vm.runInContext(src + "\nthis.G={_txtGateSettle,txtVaultState,txtVaultReady};", ctx);
  const G = ctx.G;
  assert.equal(G.txtVaultState().done, false, "一开始不该是「已就绪」");
  G._txtGateSettle(true, "");
  const st0 = G.txtVaultState();   // 跨 vm realm，deepEqual 会卡在原型上，逐项比
  assert.equal(st0.done, true); assert.equal(st0.ok, true); assert.equal(st0.err, "");
  return G.txtVaultReady(50).then(st => assert.equal(st.ok, true));
});

test("灌失败要把败因交出去，不能再只 return 0", () => {
  const hyd = slice(engine, "async function hydrateTxtVault()", "\n// 取得某个 JSON 键的原始字符串");
  assert.match(hyd, /_txtGateSettle\(true, ""\);/, "灌成功没开闸，上云那一路会一直等到超时");
  assert.match(hyd, /_txtGateSettle\(false, \(e && e\.message\) \|\| "文字库没灌起来"\)/,
    "灌失败还是只 return 0——失败和「本来就没东西」返回值一模一样");
});

test("等超时【也算没灌完】：宁可这一轮不备份，也不推残档", () => {
  const src = slice(engine, "const _txtGate = {", "// 开机：IDB→内存镜像");
  const ctx = { setTimeout, clearTimeout, Promise };
  vm.createContext(ctx); vm.runInContext(src + "\nthis.G={txtVaultReady};", ctx);
  return ctx.G.txtVaultReady(10).then(st => {
    assert.equal(st.ok, false, "等超时被当成「就绪」了，那这道闸等于没有");
    assert.match(st.err, /文字库/);
  });
});

test("autoPush 第一件事就是问这道闸，不 ok 就拦下并留痕", () => {
  assert.match(autoPush, /const txt = await txtVaultReady\(20000\);/);
  assert.match(autoPush, /if \(!txt\.ok\) \{ block\("txt_vault", \{ detail: txt\.err \|\| "" \}\); return; \}/);
  // 闸的位置要在【拿 user】之前：拿 user 是要发网络的，没灌完连问都不该问
  assert.ok(autoPush.indexOf("txtVaultReady") < autoPush.indexOf("await this.getUser()"),
    "闸排在取登录态后面了");
});

// ── 闸二：查不到 ≠ 访客 ────────────────────────────────────────
test("getUser 吞掉网络错时，autoPush 不许把它当访客模式", () => {
  // getUser 自己照旧返回 null（三十来处调用点都靠它），区分放在 autoPush 里：
  // 本机还揣着持久 session，就说明是【查失败】，那是备份坏了，不是没登录。
  assert.match(autoPush, /const local = await this\.getSessionUser\(\)\.catch\(\(\) => null\);/);
  assert.match(autoPush, /if \(local\) block\("auth_lookup", \{\}\);/);
  assert.match(cloud, /async getSessionUser\(\)/, "那个只读本机 session 的方法没了");
});

// ── 闸三：半份 / 中断的存档绝不上云 ──────────────────────────────
test("apply 出过事的机器，一律禁推", () => {
  assert.match(autoPush, /this\.pushBlocked\.reason === "apply_partial" \|\| this\.pushBlocked\.reason === "apply_threw"/);
  assert.match(autoPush, /if \(localStorage\.getItem\("x_cloudApplyFailed_v1"\)\) \{ block\("apply_partial", \{\}\); return; \}/,
    "重载之后内存里的旗没了，得认那个落盘的键");
});

// ── 闸四：过期设备闸（详细口径在 stale-device-guard-61-63）─────────
test("过期闸每次 upsert 前重查，且不许 fail-open", () => {
  assert.ok(!/let staleVerdict/.test(cloud), "会话级缓存还在");
  assert.match(autoPush, /try \{ verdict = await this\.staleness\(user\.id\); \}/);
  assert.match(autoPush, /catch \(e\) \{ block\("stale_unknown"/);
  // 重查必须排在 upsert 之前（这才是「挡得住挂了九天的标签页」的那一下）
  assert.ok(autoPush.indexOf("this.staleness(user.id)") < autoPush.indexOf('from("saves").upsert'));
});

// ── 在途超时 ────────────────────────────────────────────────
test("在途 upsert 有硬超时，不然这个标签页会从此再也不备份", () => {
  // pushInFlight 永不 resolve 时，后续每次 autoPush 都在开头 return pushInFlight
  assert.match(autoPush, /await withTimeout\(\n?\s*client\.from\("saves"\)\.upsert/);
  assert.match(cloud, /const PUSH_TIMEOUT_MS = 45000;/);
  assert.match(cloud, /const withTimeout = \(p, ms\) => Promise\.race\(\[/);
  assert.match(cloud, /rej\(new Error\("push_timeout"\)\)/);
  assert.match(autoPush, /=== "push_timeout" \? "timeout"/, "超时没被认出来，界面上会说成「云端拒绝」");
});

// ── 失败要留痕（9/3 第一道哑火）────────────────────────────────
test("每一种没备份成都留一笔，catch 不许再是空的", () => {
  assert.ok(!/catch \(e\) \{\n\s*\/\/ 离线或网络错误：静默/.test(cloud), "那个空 catch 还在");
  assert.match(autoPush, /block\(String\(\(e && e\.message\) \|\| e\) === "push_timeout"/);
  assert.match(cloud, /const PUSH_ERR = "cloud_push_err_v1";/);
  // 成功那一路要把痕迹擦掉，否则界面永远红着
  assert.match(autoPush, /localStorage\.setItem\(MARK, ts\);/);
  assert.match(autoPush, /removeItem\(PUSH_ERR\)/);
  // 理由 → 人话只写一份，toast 和界面共用
  assert.match(cloud, /const PUSH_WHY = \{/);
  assert.equal((cloud.match(/PUSH_WHY\[b\.reason\]/g) || []).length, 1, "人话表被抄成了两份");
});

// 「别天天弹窗」跟过期闸当初按【跨度】判是同一个道理：掉个网是常事。
test("弹窗只留给【我们主动拦下的】那几种，掉网超时交给常驻横幅", () => {
  assert.match(cloud, /const LOUD_BLOCK = \{ txt_vault: 1, stale: 1, apply_partial: 1, apply_threw: 1 \};/);
  const blk = bare(slice(cloud, "const block = (reason, extra) =>", "pushInFlight = (async"));
  assert.match(blk, /const loud = LOUD_BLOCK\[reason\] \|\| this\.pushState\(\)\.overdue;/,
    "掉网也弹，或者一天没成功了还闷着——两头都不对");
  assert.match(blk, /if \(loud && staleAnnounced !== reason\)/);
  // 不弹也要留痕：这一整轮修的就是「静默」
  assert.match(blk, /localStorage\.setItem\(PUSH_ERR, JSON\.stringify\(b\)\)/);
  assert.ok(blk.indexOf("localStorage.setItem(PUSH_ERR") < blk.indexOf("const loud ="),
    "留痕跑到「要不要弹」后面去了——不弹的那一路就什么都没记");
});

// ── 备份可见性：读的那头和写的那头曾经不是同一个键 ────────────────
test("那句「上次备份」原来读的是一个【没有任何人写过】的键", () => {
  // ⚠️剥掉注释行再搜：解释这个病的注释里就写着那个坏键名
  assert.equal(bare(screens).indexOf("cloud_synced_at"), -1,
    "又在界面里手写键名了——写的那头叫 cloud_pushed_at，两边一错就永远显示不出来");
  assert.match(cloud, /const MARK = "cloud_pushed_at";/);
  assert.match(cloud, /lastPushedAt\(\) \{/);
  assert.match(cloud, /pushState\(\) \{/);
  // 界面一律问 Cloud 要，不自己拼键
  assert.match(screens, /window\.Cloud\.pushState\(\)/);
  assert.match(components, /window\.Cloud\.pushState\(\)/);
});

test("pushState 说得出三件事：上次什么时候、算不算过期、这次为什么没成", () => {
  const store = {};
  const ctx = {
    console, setTimeout, clearTimeout, Promise, Date, JSON, Object, Math, Error, String, Number, Map,
    document: { addEventListener() {} },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx); vm.runInContext(cloud, ctx);
  const C = ctx.window.Cloud;
  assert.equal(C.pushState().never, true, "从没备份过要说得出来");
  assert.equal(C.pushState().overdue, true, "从没备份过当然算过期");
  store["cloud_pushed_at"] = new Date().toISOString();
  assert.equal(C.pushState().never, false);
  assert.equal(C.pushState().overdue, false, "刚备份完还说过期");
  store["cloud_pushed_at"] = new Date(Date.now() - 3 * 86400000).toISOString();
  assert.equal(C.pushState().overdue, true, "三天没备份了还说没事");
  // 失败理由要跨重载活下来（内存里那面旗刷新就没了）
  store["cloud_push_err_v1"] = JSON.stringify({ reason: "txt_vault", at: Date.now() });
  assert.equal(C.pushState().blocked.reason, "txt_vault");
  assert.match(C.pushState().why, /还没.*读完/, "拦截理由没翻成人话");
});

test("真出事了要挂在她每天开得最多的那一页上，而且划不走", () => {
  const seg = slice(components, "// ── 备份坏了要看得见", "h(\"div\", { className: \"flex-1 min-h-0\"");
  assert.match(seg, /st\.never \|\| st\.overdue \|\| st\.blocked/, "没出事也挂着就成了摆设");
  assert.match(seg, /if \(!st \|\| !\(/, "云同步没开着也挂，那是吓唬人");
  assert.match(seg, /className: "shrink-0"/, "横幅会跟着列表滚走");
  assert.match(seg, /导出全部数据/, "只报警不说怎么办");
  assert.match(app, /onOpenSettings: \(\) => setScreen\("config"\)/, "横幅点不动");
});

test("云同步那一页不许再只写一句没有证据的「已开启自动同步」", () => {
  const seg = slice(screens, "const st = (window.Cloud && window.Cloud.pushState)", "const inner = user");
  assert.match(seg, /上次成功备份：/);
  assert.match(seg, /st\.never \|\| st\.overdue \|\| st\.blocked/);
  const panel = slice(screens, 'h("div", { key: "pushstate"', 'key: "push"');
  assert.match(panel, /这一次没备份：" \+ st\.why/);
});

// ── apply()：修复路径不许比事故更危险 ────────────────────────────
test("删本机之前先留底，任何抛错都整份还原", () => {
  assert.match(applyFn, /const rollback = new Map\(\);/);
  // ⚠️两处都得先【确认存在】再比先后：indexOf 找不到是 -1，而 -1 小于任何下标，
  //   光比大小的话「压根没留底」会一声不吭地通过（变异测试当场逮到）。
  const iSave = applyFn.indexOf("rollback.set(k, localStorage.getItem(k))");
  const iWipe = applyFn.indexOf("forEach((k) => localStorage.removeItem(k))");
  assert.ok(iSave > 0, "删之前根本没留底");
  assert.ok(iWipe > 0, "那句整份删没了？");
  assert.ok(iSave < iWipe, "先删了才留底，那留的是个空的");
  assert.match(applyFn, /rollback\.forEach\(\(v, k\) => \{ if \(v != null\) \{ try \{ localStorage\.setItem\(k, v\); \}/);
  assert.match(applyFn, /this\.pushBlocked = \{ reason: "apply_threw"/);
  assert.match(applyFn, /localStorage\.setItem\("x_cloudApplyFailed_v1", JSON\.stringify\(\{ at: new Date\(\)\.toISOString\(\), threw:/,
    "抛错那一路没落盘，重载之后禁推旗就没了");
  assert.match(applyFn, /throw e;/, "吞掉的话调用方会以为恢复成功");
});

test("回滚要在 suspend 还开着、frozen 还没落的时候做", () => {
  // 顺序不能换：suspend 关了会触发 markDirty 反向 push；frozen 落了写回会被自己挡掉
  const cat = applyFn.indexOf("} catch (e) {");
  const fin = applyFn.indexOf("suspend = false;", cat);
  assert.ok(cat > 0 && fin > cat, "回滚跑到 finally 后面去了");
  assert.match(cloud, /只走【成功】那条路/, "frozen 为什么在外面，得写在代码里");
  // frozen 仍然必须在 try 之外的成功路径上（catch 里 throw 走不到这儿）
  const tail = slice(cloud, "// 写回完成后冻结本地 x_ 写入", "\n    },");
  assert.match(tail, /frozen = true;/);
});

// ── never-say-delete-first：立在按钮上，不只立在对人说话上 ─────────
test("两个会让数据消失的按钮，前面都摆着「先导出一份」", () => {
  const seg = slice(screens, "// ── 会让数据消失的按钮", "const inner = user");
  assert.match(seg, /const exportGate = which =>/);
  assert.equal((screens.match(/exportGate\("pull"\)/g) || []).length, 1, "「从云端恢复」前面没有");
  assert.equal((screens.match(/exportGate\("out"\)/g) || []).length, 1, "「退出登录（清空本机）」前面没有");
  assert.equal((screens.match(/const exportGate = which =>/g) || []).length, 1, "闸抄成了两份");
  // 是闸不是提示：没导出、也没亲口说有备份，那个按钮按不动
  assert.match(screens, /disabled: busy === "pull" \|\| saved !== "pull"/);
  assert.match(screens, /disabled: busy === "out" \|\| saved !== "out"/);
  // 「云端有备份」不能代替它——云是一行 upsert、没有历史
  assert.match(screens, /云端只有一行、没有历史/);
  assert.match(seg, /「云端有备份」不能代替它/);
  // 导出得真的调导出，不是嘴上说说
  assert.match(seg, /try \{ await onExport\(\); setSaved\(which\); \} catch \(e\)/,
    "那个按钮没真的调导出，只是把闸自己放开了");
  assert.match(screens, /function CloudSync\(\{ toast, onExport \}\)/);
  assert.match(screens, /h\(CloudSync, \{ toast: toast, onExport: onExport \}\)/);
});

test("退出登录原来连一次确认都没有", () => {
  // 它做的事是「清空本机」，比「从云端恢复」更狠，却是单击直发
  assert.ok(!/key: "out", onClick: doSignOut/.test(screens), "又变回单击直接退了");
  assert.match(screens, /onClick: \(\) => \{ setConfirmOut\(true\); setSaved\(""\); \}/);
});
