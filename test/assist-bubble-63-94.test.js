// 「让秋秋在这个人的悬浮屏里可以直接改动」（她 2026-09-05）：
// 在谁的聊天窗上问秋秋「帮我改一下我的气泡颜色」「我想要梦幻风格的」，
// 它出一份改动稿，她点应用才真的换——秋秋的铁律一（永远不自己落库）照旧。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const asi = fs.readFileSync(__dirname + "/../js/assistant.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("白名单里多了这一样，写入口在 TARGETS 里", () => {
  assert.match(asi, /bubble: \{\n\s*zh: "聊天窗气泡"/, "没有这一项");
  assert.match(asi, /if \(!ctx\.onPatchBubble\) throw new Error/, "没接写入口就该当场说，别假装改了");
  // 洗值那一道跟 OOC 那条路共用，不许另写一套
  assert.match(asi, /sanitizeBubblePatch/, "没走那道闸——模型给的值最后要拼进一张 <style>");
  assert.ok(asi.indexOf("bubbleAiValueOk") < 0, "在这儿又抄了一份洗值的——改一处另一处永远落单");
  assert.match(asi, /if \(p\.target === "bubble"\) throw new Error\("气泡这一栏要整份给/, "JSON 走「改一小段」会切出非法 JSON");
});

test("它得知道她开着谁的窗口，不然只能反问", () => {
  assert.match(asi, /whoId: pg\.charId \|\| ""/, "页面上下文没带 id");
  assert.match(asi, /p\.whoId \? "（id＝" \+ p\.whoId/, "带了 id 却没告诉它这个 id 是干嘛的");
  // 悬浮屏和整页是同一个秋秋
  assert.equal((app.match(/onPatchBubble: \(charId, skin\) => applyOocSkin\(charId, skin\)/g) || []).length, 2,
    "两处没都接上——从另一处问同一句会被告知没接写入口");
  assert.match(app, /charId: \(offlineChar \|\| activeChar \|\| \{\}\)\.id \|\| ""/, "悬浮屏没把当前这个人的 id 递进去");
});

test("摆给她看的是人话，不是一整份 JSON", () => {
  assert.match(asi, /const bubbleText = b =>/, "改前改后并排摆的还是原始 JSON");
  assert.match(asi, /const BUB_ZH = \{/, "没有中文栏名");
  // 只摆真的有值的那几栏：整份摆出来，满屏都是没动过的空栏
  assert.match(asi, /filter\(k => b\[k\] !== "" && b\[k\] != null\)/, "空栏也摆上去了");
});

test("那一段不给内容示范，只给判据", () => {
  const i = asi.indexOf('"· bubble 这个人的聊天窗气泡');
  const rule = asi.slice(i, i + 1400);
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(rule.replace(/#hex/g, "")), "写死了一个色值——以后不管什么风格都往它上面靠");
  assert.ok(rule.indexOf("梦幻") < 0, "把某种风格写死成例子了");
  assert.match(rule, /字要看得清/, "少了那条压过审美的底线");
  assert.match(rule, /只填那一栏/, "她只说一处时会被整套盖掉");
  assert.match(rule, /不许自造新栏/, "没说死只能填这几栏");
});

test("改前改后要能并排比：两边都是人话", () => {
  assert.match(asi, /const previewText = patch =>/, "改后摆的还是那串 JSON，跟改前的人话没法比");
  assert.match(asi, /const shown = A\.previewText\(p\);/, "界面上没用它");
  // 摆的必须是【洗过之后】的那几栏——摆一份、落一份不一样，等于给她看了个假的
  assert.match(asi, /sanitizeBubblePatch\(o\) : null;\n\s*return c \? bubbleText\(c\)/, "摆的不是真会落进去的那一份");
});

test("撤销那张表为什么没有它，写下来了", () => {
  const i = asi.indexOf("const UNDOABLE =");
  assert.ok(asi.slice(Math.max(0, i - 400), i).indexOf("气泡不在这张表里") > 0,
    "少一样却没写理由——下一个人会当成漏了，顺手加进去，然后撤销写回一段人话");
});
