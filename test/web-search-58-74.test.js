const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const eng = R("engine.js"), app = R("app.js"), comp = R("components.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
const call = grab(eng, "async function callAI(p, system, messages, opts) {", "function repairJSON(");
const nocomment = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 她 2026-08-31：「能不能做个 mcp 给角色上网」。
// MCP 是给宿主程序接工具的协议，手机上的网页没有那一层；而且上网这件事用不着它——
// Anthropic 自带一个【服务端】搜索工具，搜索在他们那边跑完，结果和回答在同一个
// 响应里回来，仍然是【一次调用】。不是「模型说要搜→app 去搜→再问一遍」的两次。
test("上网走服务端工具，一轮仍然只有一次调用", () => {
  assert.match(call, /if \(_wantWeb\(\)\) _tl\.push\(\{ type: "web_search_20250305", name: "web_search", max_uses: _webMax \}\)/, "没把搜索工具挂上去,或者不是按开关挂的");
  assert.match(call, /const _wantWeb = \(\) => !!\(opts && opts\.webSearch\) && !_noWeb;/, "开关不是从调用方传进来的");
  // 用基础版而不是带动态过滤的新版：新版只有 4.6 以后的模型收，她现在用的是 3.7
  assert.ok(call.indexOf("web_search_20260209") < 0, "用了只有新模型才收的变体,她那条 3.7 会报错");
  // 关键：客户端那个「再问一遍」的回合【只属于 MCP 工具】。内置搜索是服务端跑的，
  // 不产生回合——这个门一旦松掉，只开内置搜索的角色也会开始每轮两次调用。
  assert.match(call, /if \(_mcpTools && _mcpTools\.length && _runTool\) \{\n      for \(let _r = 0; _r < _maxRounds && d\.stop_reason === "tool_use"/, "anthropic 那边的工具回合没有只对 MCP 开");
  assert.match(call, /if \(_mcpTools && _mcpTools\.length && _runTool\) \{\n    for \(let _r = 0; _r < _maxRounds; _r\+\+\)/, "openai 那边的工具回合没有只对 MCP 开");
  assert.match(call, /const _webMax = \(opts && opts\.webMaxUses\) \|\| 3;/, "一轮搜几次没有天花板——搜索是另计费的");
});

test("这条线路不认就退回去，不白扣她一次", () => {
  const back = grab(call, "    // 上网回退", "    // 扩展缓存(1h)回退", 900);
  assert.match(back, /localStorage\.setItem\("x_noWeb"/, "没记下来,每轮都要白撞一次");
  assert.match(back, /_noWeb = true;\n      d = await postAnthropic\(wantTemp\(\)\);/, "没退回不带工具重发");
  // 判据必须咬住 tool/web_search：密钥错了报的是「invalid x-api-key」，
  // 太宽的判据会把它当成「这条线不认工具」，白扣一次还把上网永久关掉
  const re = /\/\(web\[_ \]\?search\|\\btools\?\\b\|tool_use\)\/i/;
  assert.match(back, re, "回退判据太宽/太窄");
  ["unsupported", "invalid", "not supported"].forEach(w =>
    assert.ok(back.indexOf('|' + w) < 0, "回退判据里混进了跟工具无关的词：" + w));
});

test("服务端工具跑久了会先还一个中场，要接回去续，而且封顶", () => {
  const pt = grab(call, '    for (let _pt = 0; _pt < 2 && d.stop_reason === "pause_turn"', "    // 工具回合（anthropic 方言）");
  assert.match(pt, /wireMessages\.push\(\{ role: "assistant", content: d\.content \}\)/, "中场没把已出的部分接回去,续出来的是另一段话");
  assert.match(pt, /const merged = \(d\.content \|\| \[\]\)\.concat\(cont\.content \|\| \[\]\)/, "续完没跟前半段拼起来,前半段丢了");
  assert.match(pt, /if \(!cont \|\| cont\.error\) break;/, "续失败了还往下走");
});

// ⚠️捞了不显示比不捞更坏（v55.95 那一课：声明了、然后从没被引用过）。
// 所以这一条要一路验到画面上：引擎捞 → 挂到那条气泡上 → 真的画出来。
test("他去查了什么，一路要看得见", () => {
  assert.match(call, /b\.type === "server_tool_use" && b\.name === "web_search"/, "没把搜了什么捞出来");
  assert.match(call, /if \(qs\.length && _meta\) _meta\.searched = qs;/, "捞出来了没往外递");
  assert.match(app, /searched: _callMeta\.searched\.slice\(0, 6\)/, "没挂到那条气泡上");
  assert.match(app, /_callMeta\.reasoning \|\| \(_callMeta\.searched && _callMeta\.searched\.length\) \|\| \(_callMeta\.toolCalls && _callMeta\.toolCalls\.length\)/, "只有深度思考那一路才挂——只查不想的那一轮就丢了");
  assert.match(comp, /"去查了 " \+ searched\.map\(q => "「" \+ q \+ "」"\)\.join\(" "\)/, "画面上没画出来");
  assert.match(comp, /if \(!m\.reasoning\) return webLine \? /, "没有思考链的那一轮就不画了");
  // 那一行是否出现，两个条件各自独立
  assert.equal((comp.match(/\(m\.reasoning \|\| \(m\.searched \|\| \[\]\)\.length \|\| \(m\.usedTools \|\| \[\]\)\.length\)/g) || []).length, 2,
    "决定要不要画那一行的地方没全改——一处漏了，某种消息就永远不显示");
});

// 四处一样喂：单聊那条链和群聊那条链是两个调用点，只写一处就是老病
test("单聊和群聊两条链都接上了", () => {
  assert.match(app, /const _wantWeb = !_engineerChat && !!_s\.webSearch;/, "单聊那条链没接");
  // ⚠️别冻「哪两个选项挨着」——昨天刚被这个坑过一次
  const soloCall = (app.match(/callAI\(_route, system, aiMessages, \{[^}]*\}/) || [""])[0];
  const soloRetry = (app.match(/callAI\(_route, system, retryMessages, \{[^}]*\}/) || [""])[0];
  assert.ok(soloCall.includes("webSearch: _wantWeb"), "单聊主调用没带上");
  assert.ok(soloRetry.includes("webSearch: _wantWeb"), "单聊的空正文重试没带上——重试那次就没有上网能力了");
  // 群聊一次调用写完所有人：在场任一成员开着就带上，同思考链的写法
  assert.match(app, /const _gWantWeb = members\.some\(c => \{[\s\S]{0,160}!!_cs\.webSearch;/, "群聊那条链没接");
  assert.match(app, /webSearch: _gWantWeb,/, "群聊调用没带上");
});

test("默认关，一个一个角色自己开", () => {
  assert.match(comp, /const \[webSearch, setWebSearch\] = useState\(!!settings\.webSearch\);/, "开关没存在角色设置里");
  assert.match(comp, /h\(Toggle, \{ on: webSearch, onChange: \(\) => setWebSearch\(v => !v\) \}\)/, "界面上没有这个开关");
  assert.match(comp, /"让 Ta 能上网"/, "开关没有名字");
  assert.match(comp, /仍然只花一次调用/, "没跟她讲清楚这个要花多少");
  assert.match(comp, /古代\/架空角色不建议开/, "没提醒扮演上的代价");
  // 工程师那条线不掺和：他不是被扮演的角色（four-surfaces 里写着的合法差异）
  assert.match(app, /!_engineerChat && !!_s\.webSearch/, "工程师那条线也被带上了");
});
