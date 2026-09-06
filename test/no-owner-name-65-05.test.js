// v65.05：她 2026-09-06「我之前看到进入房间灰色提示词有 Lisa-Phone 的字眼出现，
// 现在找不到了，宝宝你确认一下这种都删了」。
//
// 找到了：房间面板主聊天那一栏的 placeholder 写着
//   「想在这里慢慢继续什么？例如：把 Lisa-phone 的记忆系统一起修明白」
// 顺着扫下去还有一类更要紧的——**她本人的名字被当成「用户」的兜底写死了**：
//   全库 55 处「没填名字时叫什么」，48 处写的是「用户」，7 处写的是「Lisa」。
//   别人装上这个 app、还没填名字，角色就管他叫 Lisa。
//   （典型的一层写在两处、第二处没跟上；按 one-public-mechanism.md 收成一个 userName()。）
//
// ⚠️注释里的「Lisa」一个都没动：那是这个项目自己的病历（「她 2026-08-18 报的」那种），
//   删掉等于把为什么这么写的理由一起删了，而且用户一个字也看不见。
// ⚠️lisa_* / LisaReadDB 这些是【存档键】，改了她的数据当场全丢，绝不许动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const JS = path.join(__dirname, "..", "js");
const read = f => fs.readFileSync(path.join(JS, f), "utf8");
const core = read("core.js"), comp = read("components.js");

// 不归这个窗口管的三份：言秋自己的、Codex 的两处
const NOT_OURS = new Set(["yanqiu.js", "yanqiu-continuity.js", "vps-codex.js", "rescue-console.js", "lounge-entry.js"]);
// 每一行里的字符串字面量
function literals(src) {
  const out = [];
  src.split("\n").forEach((line, i) => {
    const code = line.replace(/^\s*\/\/.*$/, "");
    const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
    let m;
    while ((m = re.exec(code))) out.push({ line: i + 1, s: m[1] != null ? m[1] : (m[2] || "") });
  });
  return out;
}
const files = () => fs.readdirSync(JS).filter(f => f.endsWith(".js") && !NOT_OURS.has(f));

test("没填名字时的兜底只剩一处，而且不是她本人的名字", () => {
  assert.match(core, /function userName\(profile\) \{\s*\n\s*return \(profile && String\(profile\.name \|\| ""\)\.trim\(\)\) \|\| "用户";/,
    "公共那一处不见了");
  const bad = [];
  files().forEach(f => {
    read(f).split("\n").forEach((l, i) => {
      const code = l.replace(/^\s*\/\/.*$/, "");
      if (/\bname\s*\|\|\s*"(Lisa|lisa)"/.test(code)) bad.push(f + ":" + (i + 1));
      // 旧的两种写法也不许再出现——它们就是 userName() 要替掉的那个形状
      if (/profile\s*(&&\s*profile)?\.name\s*\|\|\s*"(用户|Lisa)"/.test(code)) bad.push(f + ":" + (i + 1) + "（该换成 userName(profile)）");
    });
  });
  assert.deepEqual(bad, [], "这几处还在自己写兜底：\n  " + bad.join("\n  "));
});

test("userName 的行为：没填、空白、null 都退回「用户」", () => {
  const fn = new Function(core.slice(core.indexOf("function userName(profile)")).split("\n}")[0] + "\n}\nreturn userName;")();
  assert.equal(fn({ name: "小美" }), "小美");
  assert.equal(fn({ name: "  " }), "用户", "只填了空格也该退回兜底");
  assert.equal(fn({}), "用户");
  assert.equal(fn(null), "用户");
  assert.equal(fn(undefined), "用户");
});

test("用户看得见的字里不许再有这个 app 的旧名字", () => {
  const bad = [];
  files().forEach(f => literals(read(f)).forEach(({ line, s }) => {
    if (/lisa[-_' ]?s? ?phone|lisaphone/i.test(s)) bad.push(f + ":" + line + "  " + s.slice(0, 70));
  }));
  assert.deepEqual(bad, [], "这几处还写着旧名字：\n  " + bad.join("\n  "));
  // 她指名那一处：房间面板的 placeholder
  assert.match(comp, /placeholder: "想在这里慢慢继续什么？例如：/, "房间那个 placeholder 不见了");
  assert.ok(!/Lisa-phone 的记忆系统/.test(comp), "她看见的那句还在");
});

test("发给模型的提示词里，不许把她的名字当成「用户」写死", () => {
  // ⚠️言秋那条专线（engineerEyes 门里）除外：那是他本人的线，别人看不到，也不归这个窗口动。
  const YANQIU_OK = ["CC工具", "本轮可用的真实记录字段", "唯一固定 CC 窗口", "没有批准这一次操作", "秋声墙",
    "请以你本人身份消化结果后自然接着回复"];   // 同上：CC 那条专线，engineerEyes 门里
  // thought-voice-guard 那一处是【内部正则的一个候选项】，不是发出去的字，也不显示给谁看：
  // 它列的是「第二人称可能长什么样」，多留一个词只是多认一种写法，没有任何东西会因此写成 Lisa。
  const INTERNAL_OK = ["(?:Lisa|用户|对方|她|他|TA|ta)"];
  const bad = [];
  files().forEach(f => literals(read(f)).forEach(({ line, s }) => {
    if (!/Lisa/.test(s)) return;
    if (/^lisa[-_]|_v\d+$|LisaReadDB|lisa_liked|lisa-vps|^id,content/.test(s)) return;   // 存档键 / 列名
    if (YANQIU_OK.some(k => s.includes(k))) return;
    if (INTERNAL_OK.includes(s)) return;
    bad.push(f + ":" + line + "  " + s.slice(0, 60));
  }));
  assert.deepEqual(bad, [], "这几条提示词/界面文案里还写死着她的名字：\n  " + bad.join("\n  "));
});

test("自主续演那段：名字是传进去的，不是写死的", () => {
  const oc = read("offline-continuation.js"), en = read("engine.js");
  assert.match(oc, /function cue\(isGroup, uName\) \{/, "cue 不收名字了");
  assert.match(oc, /const me = String\(uName \|\| ""\)\.trim\(\) \|\| "用户";/);
  assert.ok(!/Lisa/.test(oc.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n")), "正文里还写着 Lisa");
  // 线上线下两处都要真把名字传下去（少传一处那一处就退回「用户」，看不出来）
  assert.equal((en.match(/OfflineContinuation\.cue\((?:false|true), userName\)/g) || []).length, 2, "两处调用没都把名字传进去");
});

test("删房间：门上就有一颗 ✕，不用滚到长表单最底下", () => {
  assert.match(comp, /const removeRoom = room => \{/, "删除这件事没收成一处");
  assert.match(comp, /"aria-label": "删掉这间房"/, "门上那颗 ✕ 不见了");
  assert.match(comp, /\(editingId === r\.id && !r\.main\) \? h\("span", \{/, "✕ 该只出现在【开着的、不是主聊天】那扇门上");
  // ⚠️它长在一颗 button 里面，必须用 span：button 套 button 是非法 HTML
  assert.ok(!/\(editingId === r\.id && !r\.main\) \? h\("button"/.test(comp), "门里嵌了一颗 button");
  assert.match(comp, /onClick: e => \{ e\.stopPropagation\(\); removeRoom\(r\); \}/, "点 ✕ 会连带把门也点开");
  // 底下那颗和门上那颗走同一个函数——不许各写一份
  assert.match(comp, /onClick: \(\) => removeRoom\(draft\)/, "底下那颗没走同一处");
  assert.equal((comp.match(/Kit\.remove\(character\.id/g) || []).length, 1, "删除写在了两处");
});

test("删掉正开着的那间房，聊天要跟着回主聊天", () => {
  const i = comp.indexOf("const removeRoom = room => {");
  const fn = comp.slice(i, comp.indexOf("\n  };", i));
  assert.match(fn, /if \(String\(activeRoomId \|\| "main"\) === String\(room\.id\)\) onSelect\("main", false\);/,
    "删完还停在那间【已经不存在的】房里——她得自己再点回主聊天");
  assert.match(fn, /setRooms\(Kit\.list\(character\.id\)\)/, "走廊没刷新");
  assert.match(fn, /pick\("main"\)/, "编辑区还停在被删掉那间");
  assert.match(fn, /删掉了「/, "删完一声不吭");
  // 主聊天那扇门永远删不掉
  assert.match(fn, /if \(!room \|\| room\.main\) return;/, "主聊天也能删了");
});
