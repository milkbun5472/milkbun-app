// 外置记忆库（群里 2026-10-18 许愿：「接外置记忆库，有时候想让他去其他前端帮忙做一些东西，想让记忆都互通」）
//   挑一台已经接好的 MCP 当外置记忆库：
//   · 每轮回复前，App 自己拿她这句话去它那儿搜一下，搜到的跟本地记忆库一起带给 TA（不花模型调用）；
//   · 这边记进记忆库的新条目，顺手往它那儿也写一份。
//   别的前端接同一台，记忆就汇到一处。工具认不出来时让她在设置里自己挑哪件是搜、哪件是记。
//   ⚠️只在这儿读写配置（x_extMem，走 loadJSON/saveJSON → IDB），连接、出错全交给 mcp.js 那一套。
(function () {
  const KEY = "x_extMem";
  const S = x => String(x == null ? "" : x).trim();
  const cfg = () => { try { return (typeof loadJSON === "function" ? loadJSON(KEY, null) : null) || {}; } catch (e) { return {}; } };
  const setCfg = v => { try { typeof saveJSON === "function" && saveJSON(KEY, v || {}); } catch (e) {} };
  const SEARCH_RE = /search|query|recall|retrieve|find|lookup|get_?memor|read_?memor|搜|查/i;
  const ADD_RE = /add|save|store|write|create|remember|insert|put|upsert|记/i;
  const MEM_RE = /memor|mem0|记忆|note|knowledge/i;
  // 一件工具里哪个格子放文字：先认常见名字，再退到唯一一个必填的字符串
  function textArg(tool, kind) {
    const sc = (tool && tool.input_schema) || {}, props = sc.properties || {};
    const keys = Object.keys(props);
    const pref = kind === "search" ? /^(query|q|text|search|keyword|keywords|prompt|input)$/i : /^(content|text|memory|memories|message|messages|note|input|data)$/i;
    const hit = keys.find(k => pref.test(k)) || keys.find(k => (props[k] || {}).type === "string" && (sc.required || []).indexOf(k) >= 0) || keys.find(k => (props[k] || {}).type === "string");
    return hit || "";
  }
  // 自动认：这台服务器的工具里，名字像「搜记忆」「记一条」的那两件
  function guess(tools, sid) {
    const mine = (tools || []).filter(t => t && String(t.name || "").indexOf(sid + "__") === 0);
    const pick = re => mine.filter(t => re.test(t.raw || t.name)).sort((a, b) => (MEM_RE.test(b.raw || b.name) ? 1 : 0) - (MEM_RE.test(a.raw || a.name) ? 1 : 0))[0];
    const s = pick(SEARCH_RE), a = pick(ADD_RE);
    return { search: s && textArg(s, "search") ? s.name : "", add: a && a !== s && textArg(a, "add") ? a.name : "" };
  }
  async function toolsOf(sid) {
    const M = window.MCP;
    if (!M || !sid) return [];
    try { return (await M.listTools(false)).filter(t => String(t.name || "").indexOf(sid + "__") === 0); } catch (e) { return []; }
  }
  const usable = c => !!(c && c.on && c.sid && window.MCP && window.MCP.enabled().some(s => (s.id || "mcp") === c.sid));
  // 每个角色上一轮搜到的（ctxFor 同步读这一份）
  const cache = {};
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  async function prefetch(char, query) {
    const c = cfg(), id = char && char.id;
    if (!id) return;
    if (!usable(c) || !c.search || !S(query)) { delete cache[id]; return; }
    try {
      const tools = await toolsOf(c.sid), tool = tools.find(t => t.name === c.search);
      const arg = tool && textArg(tool, "search");
      if (!arg) { delete cache[id]; return; }
      const q = (c.tagName === false ? "" : S(char.name) + " ") + S(query).slice(0, 300);
      const r = await withTimeout(window.MCP.callTool(c.search, { [arg]: q }), 6000);
      const txt = r && !r.isError ? S(r.text) : "";
      if (txt && !/^（这次没返回内容）$/.test(txt)) cache[id] = { ts: Date.now(), text: txt.slice(0, 2400) };
      else delete cache[id];
    } catch (e) { delete cache[id]; }
  }
  const textFor = charId => { const x = cache[charId]; return x && Date.now() - x.ts < 10 * 60000 ? x.text : ""; };
  // 写一份过去：带上是谁的记忆，别的前端读到才分得清
  async function push(entry, names) {
    const c = cfg();
    if (!usable(c) || !c.add || c.writeBack === false || !entry || !S(entry.text)) return;
    try {
      const tools = await toolsOf(c.sid), tool = tools.find(t => t.name === c.add);
      const arg = tool && textArg(tool, "add");
      if (!arg) return;
      const who = (names || []).filter(Boolean).join("、");
      await window.MCP.callTool(c.add, { [arg]: (who ? "【" + who + "】" : "") + S(entry.text) });
    } catch (e) {}
  }
  if (typeof window !== "undefined") window.ExtMem = { cfg, setCfg, guess, toolsOf, textArg, prefetch, textFor, push, KEY };
  if (typeof module === "object" && module.exports) module.exports = { guess, textArg };
})();
