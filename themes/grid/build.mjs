// 方格手稿：方角、细灰线框、英文等宽小标签，像排好版的稿纸。用法：node themes/grid/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { ink: "#1E1E1E", paper: "#F1F0EC", panel: "#F6F5F2", line: "#C9C7C1", fog: "#8A8984" };
const SERIF = "'Times New Roman','Songti SC',serif";

const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 5 V19 M5 12 H19' stroke='${C.ink}' stroke-width='1.4' stroke-linecap='square'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M3 3 H25 V17 H12 L6 22 V17 H3Z' fill='none' stroke='${C.ink}' stroke-width='1.3' stroke-linejoin='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 20 V5 M6 11 L12 5 L18 11' fill='none' stroke='#fff' stroke-width='1.4'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.ink}' stroke-width='1.3' stroke-linejoin='round'/></svg>`;
const I_MENU = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 7 H20 M4 12 H20 M4 17 H16' stroke='${C.ink}' stroke-width='1.3'/></svg>`;

const bubble = { myBg: C.ink, myText: "#fff", myBorder: "none", charBg: C.panel, charText: C.ink, charBorder: "1px solid " + C.line, radius: 2, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "none", name: true, gap: "normal", time: "show" };
const PANEL = `background:${C.panel} !important;border:1px solid ${C.line} !important;border-radius:2px !important;box-shadow:0 3px 10px rgba(0,0,0,.08) !important`;

const css = `
/* ───── 方格手稿 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(ellipse at 20% 30%,rgba(255,255,255,.6),transparent 60%),linear-gradient(180deg,#D9D8D4,#E4E2DE) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一块方角面板，返回键后一道竖线分隔 */
[data-wk="chathead"]{background:transparent !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;padding-left:24px !important;padding-right:24px !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;top:calc(var(--app-safe-top, 0px) + 4px) !important;bottom:4px !important;${PANEL};pointer-events:none !important;z-index:-1 !important}
[data-wk="chatback"]{position:relative !important;padding-right:12px !important}
[data-wk="chatback"]::after{content:"" !important;position:absolute !important;right:0 !important;top:15% !important;bottom:15% !important;width:1px !important;background:${C.line} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important;stroke-width:1.4 !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important;font-family:${SERIF} !important;font-weight:500 !important}
[data-wk="headdim"]{color:${C.fog} !important;letter-spacing:.1em !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"] *,[data-wk="chathead"] img{border-radius:1px !important;box-shadow:0 0 0 1px ${C.line} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/22px no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_MENU)} center/22px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 名字：气泡上方一块浅色小签条，宽字距大写感 */
[data-wk="name"]{display:inline-block !important;background:${C.panel} !important;color:${C.ink} !important;font-family:${SERIF} !important;font-size:10px !important;letter-spacing:.3em !important;padding:2px 10px !important;margin:0 0 6px !important;border-radius:0 !important}
[data-wk="name"][data-me="1"]{align-self:flex-end !important}

/* 气泡：方角。我的纯黑，他的浅灰细框 */
[data-wk="bubble"][data-kind="text"]{border-radius:2px !important;padding:12px 18px !important;font-size:15px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.ink} !important;color:#fff !important;border:1px solid ${C.ink} !important;box-shadow:0 3px 10px rgba(0,0,0,.15) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.panel} !important;color:${C.ink} !important;border:1px solid ${C.line} !important;box-shadow:0 3px 10px rgba(0,0,0,.08) !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}

/* 时间：浅色长条，左右两道细线 */
[data-wk="time"] > span{display:inline-block !important;background:${C.panel} !important;color:${C.ink} !important;border:none !important;border-radius:0 !important;padding:4px 18px !important;font-family:${SERIF} !important;letter-spacing:.3em !important;font-size:11px !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;display:inline-block !important;width:40px !important;height:1px !important;background:${C.ink} !important;vertical-align:middle !important;margin:0 8px !important}
/* 已读：一道短横线＋小字 */
[data-wk="meta"]{display:inline-flex !important;align-items:center !important;background:${C.panel} !important;color:${C.fog} !important;border-radius:0 !important;padding:1px 8px !important;font-size:10px !important;letter-spacing:.2em !important}
[data-wk="meta"]::before{content:"" !important;width:12px !important;height:1px !important;background:${C.fog} !important;margin-right:6px !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.panel} !important;border:1px solid ${C.line} !important;border-radius:2px !important}
[data-wk="typingdot"]{background:${C.ink} !important;border-radius:0 !important;width:4px !important;height:4px !important}
[data-wk="narrink"]{background:${C.panel} !important;border-radius:0 !important;color:${C.ink} !important;padding:3px 10px !important}
[data-wk="sysnotetext"]{color:${C.fog} !important;letter-spacing:.1em !important}

/* 底栏：方角面板包住加号｜输入｜对话气泡；外面一块黑色方形发送键 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important;align-items:center !important;padding-left:22px !important;padding-right:14px !important;gap:8px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:10px !important;right:68px !important;top:8px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) + 0px) !important;${PANEL};pointer-events:none !important;z-index:-1 !important}
[data-wk="chatinput"]{background:transparent !important;border:none !important;border-left:1px solid ${C.line} !important;border-radius:0 !important;box-shadow:none !important;color:${C.ink} !important;padding-left:14px !important;letter-spacing:.1em !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/20px no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/24px no-repeat !important;margin-right:16px !important}
[data-wk="send"]{order:99 !important;width:46px !important;min-width:46px !important;height:46px !important;border:1px solid ${C.ink} !important;border-radius:2px !important;background:${C.ink} ${svg(I_SEND)} center/22px no-repeat !important;box-shadow:0 3px 10px rgba(0,0,0,.2) !important;opacity:1 !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="msg"][data-first="0"] [data-wk="name"]{display:none !important}
[data-wk="msg"][data-first="0"]{margin-top:-4px !important}
[data-wk="composer"]::before{top:6px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) + 6px) !important}
[data-wk="send"]{height:44px !important;width:44px !important;min-width:44px !important}

`;

const pack = { kind: "chat-look", v: 1, name: "方格手稿", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "方格手稿-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
