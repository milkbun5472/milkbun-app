// 壳里「测试通知」发不出来（她 2026-09-23：允许了，但是发不出来）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const swift = R("tools/ios-shell/LisaPhone/LisaPhone/AppDelegate.swift");
const notify = R("js/notify.js");

test("App 在前台时也要显示：代理实现了 willPresent", () => {
  assert.match(swift, /willPresent notification: UNNotification,/);
  assert.match(swift, /completionHandler\(\[\.banner, \.list, \.sound\]\)/);
});

test("代理开机就挂上，不等网页第一次调桥", () => {
  const i = swift.indexOf("override func viewDidLoad()"), j = swift.indexOf("webView = WKWebView(", i);
  assert.ok(i > 0 && j > i, "抠不出 viewDidLoad");
  assert.match(swift.slice(i, j), /UNUserNotificationCenter\.current\(\)\.delegate = self/);
});

test("延时交给系统计时器，网页被冻住也能到", () => {
  assert.match(swift, /UNTimeIntervalNotificationTrigger\(timeInterval: delay, repeats: false\)/);
  const i = notify.indexOf("function test(delayMs)"), j = notify.indexOf("window.Notify =", i);
  assert.ok(i > 0 && j > i, "抠不出 test");
  assert.match(notify.slice(i, j), /if \(bridge\(\)\) \{\n\s*ask\(\{ action: "show", delay:/);
});
