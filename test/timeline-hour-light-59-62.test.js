const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ph = fs.readFileSync(path.join(root, "js", "phone.js"), "utf8");
const view = ph.slice(ph.indexOf("function TimelineView("), ph.indexOf("// 锁屏：拿起他手机的第一眼"));
const { loadPhone } = require("./helpers/phone-render.js");

// vm 里没有 phoneHourLight 的导出口，直接把这两个声明抠出来跑。
const decl = ph.slice(ph.indexOf("const PHONE_HOUR_LIGHT = ["), ph.indexOf("function phoneDayLabel("));
const phoneHourLight = new Function(decl + "\nreturn phoneHourLight;")();

// 她 2026-09-01：「这个背景和这俩 tab 太单调了，弄点跟时间有关的元素吧」。
test("底色跟着现在几点走，五个钟点各是各的", () => {
  const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return phoneHourLight(d.getTime()); };
  assert.equal(at(3).zh, "凌晨");
  assert.equal(at(7).zh, "清晨");
  assert.equal(at(13).zh, "白天");
  assert.equal(at(18).zh, "黄昏");
  assert.equal(at(22).zh, "夜里");
  // 边界：整点落在哪一档不能含糊
  assert.equal(at(5).key, "dawn");
  assert.equal(at(9).key, "day");
  assert.equal(at(17).key, "dusk");
  assert.equal(at(20).key, "dark");
  assert.equal(at(0).key, "night");
  assert.equal(at(23).key, "dark");
  // 五档的色不许有两档撞在一起，否则等于没分
  const tops = new Set([3, 7, 13, 18, 22].map(h => at(h).top));
  assert.equal(tops.size, 5, "有两档的天色是一样的");
});

test("那道光一整天从左挪到右，正午最高", () => {
  const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return phoneHourLight(d.getTime()); };
  assert.ok(at(6).gx < at(12).gx && at(12).gx < at(20).gx, "光的位置一整天没挪动");
  assert.ok(at(13).gy < at(6).gy && at(13).gy < at(22).gy, "正午那道光不是最高的");
  [0, 6, 13, 20, 23].forEach(h => {
    const L = at(h);
    assert.ok(L.gx >= 0 && L.gx <= 100 && L.gy >= 0 && L.gy <= 100, h + " 点时光跑到画面外面去了");
  });
});

test("底色一律用 rgba 压在主题底色上，不硬写某一种底", () => {
  const decls = ph.slice(ph.indexOf("const PHONE_HOUR_LIGHT = ["), ph.indexOf("const phoneHourLight ="));
  assert.ok(!/#[0-9a-fA-F]{3,6}/.test(decls), "写死了具体颜色，换成深色主题会打架");
  assert.match(view, /"radial-gradient\(58% 34% at " \+ light\.gx \+ "% " \+ light\.gy \+ "%," \+ light\.glow/,
    "那道光没有跟着钟点挪位置");
  assert.match(view, /linear-gradient\(180deg," \+ light\.top[\s\S]{0,140}\+ t\.bg/,
    "天色那一层没有压在 t.bg 上");
});

test("轴上那个「现在」要走针，页面上的今天也跟着它", () => {
  assert.match(view, /const \[clockNow, setClockNow\] = useState\(\(\) => Date\.now\(\)\);/, "没有会走的钟");
  assert.match(view, /setInterval\(\(\) => setClockNow\(Date\.now\(\)\), 30000\)/, "对表的间隔不是半分钟");
  assert.match(view, /return \(\) => clearInterval\(iv\);/, "退出这一页时没有把表停掉");
  assert.match(view, /const now = clockNow;/, "now 还是每次渲染现取的，过了午夜「今天」不会改口");
});

test("tab 那一行画成一条轴：左实右虚，中间钉着现在", () => {
  assert.match(view, /background: t\.line \} \}\),\s*h\("span", \{ style: \{ flexShrink: 0, width: 5, height: 5, borderRadius: 9, background: t\.ink/,
    "轴的左半不是实线、或者中间没有「现在」那个点");
  assert.match(view, /borderTop: "1px dashed " \+ t\.line \} \}\)\) : null,/, "轴的右半不是虚线");
  assert.match(view, /light\.zh \+ " " \+ phoneClock\(now\)/,
    "轴上没写现在是几点、什么时候——背景那道光变了没人知道为什么");
});

test("还没发生的那一条，竖轴也画成虚线", () => {
  assert.match(view, /width: r\.ahead \? 0 : 1, borderLeft: r\.ahead \? "1px dashed " \+ t\.line : "none"/,
    "接下来那一格里的竖轴还是实线——上面那条轴说的是一套，下面说的是另一套");
});

test("线走完最后一条还往下走一小截，收在一个空心点上", () => {
  assert.match(view, /background: "linear-gradient\(180deg," \+ t\.line \+ ",transparent\)"/, "收尾那截线没有淡出去");
  assert.match(view, /tab === "ahead" \? "再往后，他日历上还没排。" : "再往前，他手机上没留下什么了。"/,
    "线的尽头没交代那头是什么");
  // 一条都没有时不该画尾巴——空列表下面挂一截线，看着像加载坏了
  assert.match(view, /shown\.length \? h\("div", \{ className: "flex", style: \{ paddingLeft: 46 \} \}/,
    "空列表时也画了那条尾巴");
});

// 深色主题里 t.ink 是近白色：选中态压死 #fff 就是白底白字。
test("选中的那颗药丸不许写死 #fff", () => {
  ["tab === k", 'mode === "keep"', "(autoOn || {})[c.id]"].forEach(cond => {
    const i = ph.indexOf(cond + " ? t.ink : \"transparent\"");
    assert.ok(i > 0, "找不到 " + cond + " 那颗药丸");
    assert.ok(ph.slice(i, i + 220).indexOf('"#fff"') < 0, cond + " 那颗药丸在深色主题里是白底白字");
  });
});

// 真把两格各渲染一遍：正则断言拦不住「改签名那一步没匹配上」那种静默失败。
// useState 的第 2 个就是 tab（0 是 mode、1 是 sheet），下面这两句同时也在验它没串位。
test("两格各渲染一遍，各自只装自己那一半", () => {
  const props = {
    rows: [{ id: "a", app: "notes", appZh: "便签", tag: "", ts: Date.now() - 3600000, title: "走过的那条", text: "" },
           { id: "b", app: "calendar", appZh: "日历", tag: "事件", ts: Date.now() + 86400000, title: "要办的那件", text: "", ahead: true }],
    char: { name: "x" }, t: {}, onBack: () => {}, onOpenApp: () => {}, onPeek: () => {},
    newIds: {}, newCount: 0, onMarkRead: () => {}, kept: {}, onToggleKeep: () => {}
  };
  const draw = tb => { let tree; assert.doesNotThrow(() => { tree = loadPhone({ 2: tb }).TimelineView(props); }, tb + " 那一格炸了"); return JSON.stringify(tree); };
  const past = draw("past"), ahead = draw("ahead");
  assert.ok(past.includes("走过的那条") && !past.includes("要办的那件"), "走过的那格漏进了还没发生的事");
  assert.ok(ahead.includes("要办的那件") && !ahead.includes("走过的那条"), "接下来那格漏进了已经发生的事");
  assert.ok(past.includes("再往前，他手机上没留下什么了。"), "走过的那格没有收尾");
  assert.ok(ahead.includes("再往后，他日历上还没排。"), "接下来那格没有收尾");
});
