const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const { toSimplified } = require("../js/t2s.js");

test("随消息来的繁体译文显示前换成简体", () => {
  assert.equal(toSimplified("摸魚摸得這麼理直氣壯"), "摸鱼摸得这么理直气壮");
  assert.equal(toSimplified("下了課再玩手機"), "下了课再玩手机");
  assert.equal(toSimplified("本来就是简体"), "本来就是简体");
  assert.match(R("components.js"), /if \(zhReady && typeof toSimplified === "function"\) zhReady = toSimplified\(zhReady\);/);
  assert.match(fs.readFileSync(__dirname + "/../index.html", "utf8"), /<script src="js\/t2s\.js\?v=[\d.]+"><\/script>/);
});

test("短句粤语见到一个专用字就算粤语；每轮提醒也说右边写简体", () => {
  const eng = R("engine.js");
  const a = eng.indexOf("function _transStrip("), b = eng.indexOf("// 长文（思考链）用的判定");
  const env = {};
  global.toSimplified = toSimplified;
  new Function("env", eng.slice(a, b) + "\nenv.f = translatableLang;")(env);
  assert.equal(env.f("仲有一節就忍下佢"), "粤语");
  assert.equal(env.f("摸魚摸得咁光明正大"), "粤语");
  assert.equal(env.f("他叫阿佢"), "", "通篇简体、只沾一个字的还是不算");
  const i = eng.indexOf("function bilingualTurnHint("), hint = eng.slice(i, eng.indexOf("\n}", i));
  assert.match(hint, /右边写简体普通话。/);
});
