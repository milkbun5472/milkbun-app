// React 的 hook 顺序必须每次渲染都一样。组件里只要有一个「提前 return」，
// 排在它后面的 hook 就会时有时无——两次渲染数出来的 hook 数量不一样，React 直接
// 抛 #310 整页白屏。2026-08-29 查手机就是这么崩的：桌面翻页归位的那个 useEffect
// 写在通讯录 return 的下面，从列表点进某人手机的那一下 hook 变多了。
//
// 这种病渲染桩测不出来（桩不管 hook 顺序，每个状态还是分开渲染的），
// 只能靠静态扫。规矩：组件里的 hook 一律排在所有 return 上面，条件写进 hook 体内。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const JS_DIR = path.join(__dirname, "..", "js");

// 把注释和字符串抹成同长度的空白，免得里面的 return / useX 被当成代码
function blank(src) {
  let out = "", i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; for (; i < end; i++) out += src[i] === "\n" ? "\n" : " "; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; out += " "; i++;
      while (i < n) { if (src[i] === "\\") { out += "  "; i += 2; continue; } if (src[i] === q) { out += " "; i++; break; } out += src[i] === "\n" ? "\n" : " "; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

// 找出所有「大写开头的函数声明」——这个库里的组件都是 function Name({...}) {} 这个写法
function components(src) {
  const found = [];
  const re = /(^|\n)[ \t]*(?:const\s+([A-Z]\w*)\s*=\s*(?:function\s*)?\(|function\s+([A-Z]\w*)\s*\()/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[2] || m[3];
    // 先跳过参数表。这个库的组件几乎都是 function Name({ a, b }) {}，直接找第一个 {
    // 会抓到【解构参数】那个花括号，配对完就以为函数体到此为止——真正的组件体一行没扫，
    // 测了个寂寞（写这条测试时第一版就是这么漏掉查手机那个 bug 的）。
    let lp = src.indexOf("(", m.index + (m[1] ? m[1].length : 0));
    if (lp < 0) continue;
    let pd = 0, j = lp, close = -1;
    for (; j < src.length; j++) {
      if (src[j] === "(") pd++;
      else if (src[j] === ")") { pd--; if (pd === 0) { close = j; break; } }
    }
    if (close < 0) continue;
    const open = src.indexOf("{", close);
    if (open < 0) continue;
    // 从函数名后的第一个 { 开始配对，找到函数体的结束
    let depth = 0, i = open, end = -1;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    found.push({ name, start: open + 1, end, body: src.slice(open + 1, end) });
  }
  return found;
}

// 组件体里，深度 0（＝组件自己这一层，不含任何嵌套函数）的 return 和 hook 调用
function topLevelHits(body) {
  const returns = [], hooks = [];
  // 只认组件自己这一层（花括号深度 0）的 return 和 hook。嵌套函数体一进 { 深度就 +1，
  // 里面的 return 自然被排除；不带花括号的箭头函数写不出 return，不用管。
  // 别顺手加圆括号计数——hook 那条正则会把 ( 一起吃掉，配对立刻歪，返回值全是空的。
  let depth = 0;
  const re = /[{}]|\breturn\b|\buse[A-Z]\w*\s*\(/g;
  let m;
  while ((m = re.exec(body))) {
    const tk = m[0];
    if (tk === "{") depth++;
    else if (tk === "}") depth--;
    else if (depth === 0) {
      if (tk === "return") returns.push(m.index);
      else hooks.push({ at: m.index, name: tk.replace(/\s*\($/, "") });
    }
  }
  return { returns, hooks };
}

test("组件里的 hook 不许排在提前 return 后面（React #310 白屏）", () => {
  const bad = [];
  for (const f of fs.readdirSync(JS_DIR).filter(x => x.endsWith(".js"))) {
    const raw = fs.readFileSync(path.join(JS_DIR, f), "utf8");
    const src = blank(raw);
    for (const comp of components(src)) {
      const { returns, hooks } = topLevelHits(comp.body);
      if (!returns.length || !hooks.length) continue;
      const firstReturn = returns[0];
      for (const hk of hooks) {
        if (hk.at <= firstReturn) continue;
        const line = raw.slice(0, comp.start + hk.at).split("\n").length;
        bad.push(`${f}:${line} ${comp.name}() 里 ${hk.name} 排在提前 return 后面`);
      }
    }
  }
  assert.deepStrictEqual(bad, [], "hook 必须全部排在 return 之前：\n" + bad.join("\n"));
});
