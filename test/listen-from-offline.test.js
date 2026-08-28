const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-08-28：线下模式点音乐浮窗进不去听歌页，得先退回线上才行。
// 病因：线下浮层是 z-20，goListen 只 setScreen("listen")，屏切了但被浮层整个盖住。
const src = (() => {
  const i = app.indexOf("  const listenReturnOfflineRef = useRef(null);");
  assert.ok(i > 0, "goListen 那一段没了");
  const j = app.indexOf("\n  };", app.indexOf("const exitListen = () =>", i));
  assert.ok(j > i, "exitListen 没收尾");
  return app.slice(i, j + 5);
})();

// 把 goListen / exitListen 从真源码里抠出来跑。offlineChar / offlineGroup 在真组件里是每次
// 重渲染都会变的 state，这里换成 getter 取现值，否则闭包会一直读到初始值。
const mk = init => {
  const st = { screen: init.screen, offlineChar: init.offlineChar || null, offlineGroup: init.offlineGroup || null, wentHome: false };
  const body = src
    .replace(/\bofflineChar\b/g, "_off()")
    .replace(/\bofflineGroup\b/g, "_offG()");
  const fn = new Function("useRef", "setScreen", "goHome", "setOfflineChar", "setOfflineGroup", "_off", "_offG",
    'const listenReturnRef = { current: "home" };\n' + body + "\nreturn { goListen, exitListen };")(
      v => ({ current: v }),
      v => { st.screen = typeof v === "function" ? v(st.screen) : v; },
      () => { st.wentHome = true; st.screen = "home"; },
      v => { st.offlineChar = v; },
      v => { st.offlineGroup = v; },
      () => st.offlineChar,
      () => st.offlineGroup);
  return { st, ...fn };
};

test("线下单聊点浮窗：收起线下浮层并真的到听歌页", () => {
  const a = mk({ screen: "messages", offlineChar: { id: "c1" } });
  a.goListen();
  assert.equal(a.st.screen, "listen");
  assert.equal(a.st.offlineChar, null, "浮层没收，听歌页还是被盖着");
});

test("退出听歌：原样把线下单聊放回来，不是把她扔回列表", () => {
  const a = mk({ screen: "messages", offlineChar: { id: "c1", name: "阿屿" } });
  a.goListen();
  a.exitListen();
  assert.equal(a.st.screen, "messages");
  assert.ok(a.st.offlineChar && a.st.offlineChar.id === "c1", "线下没回来");
});

test("线下群聊同样能进能回", () => {
  const a = mk({ screen: "messages", offlineGroup: { id: "g1" } });
  a.goListen();
  assert.equal(a.st.screen, "listen");
  assert.equal(a.st.offlineGroup, null);
  a.exitListen();
  assert.ok(a.st.offlineGroup && a.st.offlineGroup.id === "g1");
});

test("退回来只放一次：再进再出不会把旧的线下层重新翻出来", () => {
  const a = mk({ screen: "messages", offlineChar: { id: "c1" } });
  a.goListen(); a.exitListen();
  a.st.offlineChar = null;          // 她自己关掉了线下
  a.goListen(); a.exitListen();
  assert.equal(a.st.offlineChar, null, "关掉的线下浮层又被翻回来了");
});

test("线上点浮窗照旧：没有线下层可收，退出回原屏", () => {
  const a = mk({ screen: "thread" });
  a.goListen();
  assert.equal(a.st.screen, "listen");
  a.exitListen();
  assert.equal(a.st.screen, "thread");
  assert.equal(a.st.offlineChar, null);
  assert.equal(a.st.offlineGroup, null);
});

test("从主屏进听歌再退出，仍然走 goHome", () => {
  const a = mk({ screen: "home" });
  a.goListen();
  a.exitListen();
  assert.equal(a.st.wentHome, true);
});
