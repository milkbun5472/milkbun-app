const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

// 她 2026-08-20：群里说「待会私聊给你看」，就该真的到私聊里来；反过来也成立。
test("群 → 私聊：dm 能力要说清「别放空炮」，并真的落进私聊", () => {
  assert.match(app, /const gDmHint = gDmMembers\.length \?/);
  const hint = app.slice(app.indexOf("const gDmHint"), app.indexOf("const gDmField"));
  assert.match(hint, /待会私聊说.*单独跟你讲.*回头发你/, "要点名这几句承诺");
  assert.match(hint, /别放空炮/);
  assert.match(hint, /群里其他人看不到/, "得说清它和 text 是两回事");
  assert.match(hint, /一轮最多一个人用，别频繁/);
  // 落地：形状必须和普通私聊消息一致，未读红点/预览/记忆才吃得到
  assert.match(app, /pChat\(spk\.id, p => \[\.\.\.p, \{ role: "assistant", content: gDmList\[di\], ts: Date\.now\(\), read: false, fromGroup: groupId, turnId: dmTurn \}\]\)/);
  // 被拉黑的人不该还能私聊过来
  assert.match(app, /if \(gDmList\.length && spk && !\(blocksRef\.current\[spk\.id\] && \(blocksRef\.current\[spk\.id\]\.iBlocked \|\| blocksRef\.current\[spk\.id\]\.theyBlocked\)\)\)/);
});

test("私聊 → 群：只挑最近有动静的共同群，没共同群就不开这能力", () => {
  const seg = app.slice(app.indexOf("const _myGroups"), app.indexOf("const capabilityHint"));
  assert.match(seg, /\(g\.memberIds \|\| \[\]\)\.includes\(char\.id\)/, "得是他真的在的群");
  assert.match(seg, /\.sort\(\(a, b\) => _gLast\(b\) - _gLast\(a\)\)\[0\] \|\| null/, "挑最近有动静的那个");
  assert.match(seg, /if \(toGroupTarget\) \{/, "没共同群就不开");
  // 公开发言，绝不能把私事带过去——这条是 knownBy 那套隐私工作的延续
  assert.match(seg, /只属于你和 " \+ uName \+ " 之间的私事、你俩的关系、TA 私下跟你说的话，一个字都不许写进去/);
});

test("toGroup 落地形状和群成员平时发言一致", () => {
  assert.match(app, /role: "assistant", senderId: char\.id, senderName: char\.name, content: gText/);
  assert.match(app, /parsed\.toGroup && String\(parsed\.toGroup\)\.toLowerCase\(\) !== "null" && toGroupTarget/,
    "没目标群时不许发");
});

test("决定沉默时不许绕道去群里发言", () => {
  const seg = app.slice(app.indexOf("if (parsed.silent === true"), app.indexOf("// 角色自行撤回一句"));
  assert.match(seg, /parsed\.toGroup = null;/, "和 momentComment 等能力一致，一并清掉");
});

test("两个字段都要写进各自的输出形状里", () => {
  assert.match(app, /const gDmField = gDmMembers\.length \? ",\\"dm\\":\[/, "输出形状要是数组");
  assert.match(app, /" \+ gDmField \+ thoughtField \+ impressionField \+ "/, "群输出形状要带上 dm");
  assert.match(app, /toGroup:string=把这句公开发到共同群里/, "单聊协议要带上 toGroup");
});

// v54.31：群里触发的私聊是一整段塞一个气泡，她要跟正常私聊一样拆成短气泡。
test("dm 是一条一个气泡，不是一整段", () => {
  assert.match(app, /它是【一个数组，一条一个气泡】，和 text 同一个规矩/);
  assert.match(app, /私聊里没人会把一整段话憋成一条发出去/);
  assert.match(app, /\*\*绝不要把整段塞进一条\*\*/);
  // 逐条推，节奏抄单聊那 420ms
  assert.match(app, /for \(let di = 0; di < gDmList\.length; di\+\+\)/);
  assert.match(app, /setTimeout\(r, di === 0 \? 500 : 420\)\); \/\/ 节奏同单聊/);
  // 同一轮的几条共用一个 turnId，撤回/统计才认得出是一次发言
  assert.match(app, /const dmTurn = "gdm_" \+ Date\.now\(\);/);
});

test("模型仍给字符串时也要拆开，不能退回一整段", () => {
  const split = raw => {
    let list = Array.isArray(raw) ? raw : [];
    if (!list.length && raw && String(raw).toLowerCase() !== "null") {
      list = String(raw).split(/\n+/).flatMap(x => x.length > 40 ? x.split(/(?<=[。！？…~～])/) : [x]);
    }
    return list.map(x => String(x == null ? "" : x).trim()).filter(Boolean).slice(0, 6);
  };
  assert.deepEqual(split(["喏", "刚拍的"]), ["喏", "刚拍的"], "数组原样过");
  assert.deepEqual(split("刚才没好意思说\n那个事我记着呢"), ["刚才没好意思说", "那个事我记着呢"], "换行要断开");
  const long = "刚才在群里我没好意思说其实那件事我一直记着呢。你要是不想提我们就不提了。我晚点再找你说吧。";
  assert.equal(split(long).length, 3, "长段按句末切开，不留一大坨");
  assert.deepEqual(split("喏。"), ["喏。"], "短句不许乱切");
  [null, "", "null"].forEach(x => assert.deepEqual(split(x), [], "空值不发"));
  assert.equal(split(Array.from({ length: 9 }, (_, i) => "第" + i)).length, 6, "封顶 6 条，别刷屏");
});
