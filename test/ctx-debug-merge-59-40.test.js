const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 她 2026-09-01：「这个长期记忆是 7/8 之前的，而且一直没变过」。
// 它没停——那底下所有带日期的都是它，新浓缩出来的接在后面。
// 是这一页把【一段】按行首的【】切成了几十条，看着像几十个各自独立的东西。
test("长期记忆里那些带日期的小段，并回它自己那一段", () => {
  const i = scr.indexOf("const secs = (() => {");
  const seg = scr.slice(i, scr.indexOf("return out;\n  })();", i) + 20);
  assert.match(seg, /if \(out\.length && \/\^【\\d\+月\\d\+日\/\.test\(sec\.title\)\)/, "带日期的小段还在冒充顶层段");
  assert.match(seg, /prev\.body = prev\.body \+ "\\n" \+ sec\.body/, "并回去了但正文没接上");
  assert.match(seg, /prev\.inner = \(prev\.inner \|\| 0\) \+ 1/, "没记住它吃进去几段");
  // 标题上要看得出它是一大段，不然又变成「886 字，很小嘛」
  assert.match(scr, /s\.inner \? h\("span"[\s\S]{0,180}"含 " \+ s\.inner \+ " 段"/, "标题上看不出它含着几段");
});

// 真跑一遍：切完之后长期记忆必须是【一段】，而且体量算的是全部
test("真跑一遍：切完是一段，占比按合起来的算", () => {
  const split = text => {
    const raw = text.split(/\n(?=【)/).map((p, i) => {
      const m = p.match(/^【[^】]*】/);
      return { title: m ? m[0] : (i === 0 ? "【开头】" : "【段落 " + (i + 1) + "】"), body: p };
    });
    const out = [];
    raw.forEach(sec => {
      if (out.length && /^【\d+月\d+日/.test(sec.title)) {
        const prev = out[out.length - 1];
        prev.body = prev.body + "\n" + sec.body;
        prev.inner = (prev.inner || 0) + 1;
        return;
      }
      out.push(sec);
    });
    return out;
  };
  const txt = ["【世界书】" + "书".repeat(300),
    "【长期记忆摘要（过往对话浓缩）】" + "旧".repeat(200),
    "【7月8日】" + "甲".repeat(200),
    "【7月9日–7月12日】" + "乙".repeat(200),
    "【今天的日期时间】九月一日"].join("\n");
  const secs = split(txt);
  assert.equal(secs.length, 3, "还是被切成了五段");
  assert.equal(secs[1].title, "【长期记忆摘要（过往对话浓缩）】");
  assert.equal(secs[1].inner, 2, "没把两段日期块吃进去");
  assert.ok(secs[1].body.indexOf("甲") > 0 && secs[1].body.indexOf("乙") > 0, "正文没并进来");
  assert.ok(secs[1].body.length > secs[0].body.length, "合起来之后体量还没世界书大，占比就还是骗人的");
  assert.equal(secs[2].title, "【今天的日期时间】", "把后面真正的段也吃掉了");
});
