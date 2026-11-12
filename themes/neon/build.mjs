// 霓虹夜：深夜底，左下洋红、右上青绿两团光；气泡是一根弯着的霓虹灯管——描边发光、左下多绕出一截灯管。用法：node themes/neon/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#0E0B19", pink: "#FF5FAE", teal: "#43EEDD", gold: "#F6C764", ink: "#F4F0FF", fog: "#9C93B8", panel: "#17132A" };
const GP = `0 0 2px ${C.pink},0 0 8px ${C.pink},0 0 18px rgba(255,95,174,.55)`;
const GT = `0 0 2px ${C.teal},0 0 8px ${C.teal},0 0 18px rgba(67,238,221,.5)`;
const IG = (c) => `0 0 6px ${c},inset 0 0 6px ${c}`;
const T = (c, d) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${d}</svg>`;
const I_PLUS = T(C.teal, `<circle cx='15' cy='15' r='11'/><path d='M15 10 V20 M10 15 H20'/>`);
const I_HOUSE = T(C.pink, `<path d='M5 14 L15 5 L25 14'/><path d='M8 12 V25 H22 V12'/><path d='M13 25 V19 H17 V25'/>`);
const I_MORE = T(C.teal, `<path d='M4 15 H6 M14 15 H16 M24 15 H26'/>`);
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 52 34' fill='none' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='46' height='28' rx='14' stroke='${C.teal}' stroke-width='2'/><path d='M16 12 H34 Q36 12 36 14 V19 Q36 21 34 21 H23 L19 25 V21 H16 Q14 21 14 19 V14 Q14 12 16 12Z' stroke='${C.ink}' stroke-width='1.6'/></svg>`;

const bubble = { myBg: "transparent", myText: C.ink, myBorder: `2px solid ${C.pink}`, charBg: "transparent", charText: C.ink, charBorder: `2px solid ${C.teal}`, radius: 18, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 霓虹夜 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(circle at 0% 100%,rgba(196,40,130,.45),transparent 55%),radial-gradient(circle at 100% 0%,rgba(30,150,150,.35),transparent 50%),${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：半透明夜色，底边一根洋红灯管 */
[data-wk="chathead"]{background:rgba(14,11,25,.82) !important;border-bottom:1.5px solid ${C.pink} !important;box-shadow:0 1px 10px rgba(255,95,174,.5) !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] [data-wk="headink"]{text-shadow:0 0 6px rgba(255,255,255,.5) !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important;margin-left:auto !important;filter:drop-shadow(0 0 4px ${C.pink}) !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-left:6px !important;filter:drop-shadow(0 0 4px ${C.teal}) !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
/* 顶栏双头像：两个灯圈挨着，一青一粉，中间一颗小爱心灯 */
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-10px !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img{border-radius:50% !important;box-shadow:0 0 0 2px ${C.pink},${GP} !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-8px !important;bottom:-4px !important;width:14px !important;height:14px !important;z-index:3 !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 17 C3 12 2 9 2 7 C2 4 4 2.5 6.5 2.5 C8 2.5 9.3 3.4 10 4.6 C10.7 3.4 12 2.5 13.5 2.5 C16 2.5 18 4 18 7 C18 9 17 12 10 17Z' fill='${C.bg}' stroke='${C.gold}' stroke-width='2'/></svg>`)} center/contain no-repeat !important;filter:drop-shadow(0 0 3px ${C.gold}) !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}

/* 头像：圆的灯圈——他的青、我的粉 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="chathead"] img{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="chathead"] [data-wk="avatar"]{box-shadow:0 0 0 2px ${C.teal},${GT} !important}
[data-wk="msg"][data-me="1"] button[data-wk="avatar"],[data-wk="msg"][data-me="1"] span[data-wk="avatar"],[data-wk="cardrow"][data-me="1"] button[data-wk="avatar"]{box-shadow:0 0 0 2px ${C.pink},${GP} !important}

/* 气泡：一根霓虹灯管——圆角描边、里外都亮；左下多绕出一截灯管（我的左下拐一个弯，他的左边多一道竖管） */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;background:rgba(14,11,25,.55) !important;border-radius:18px !important;color:${C.ink} !important;padding:11px 20px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{border:2px solid ${C.pink} !important;box-shadow:${IG(C.pink)},0 0 18px rgba(255,95,174,.45) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{border:2px solid ${C.teal} !important;box-shadow:${IG(C.teal)},0 0 18px rgba(67,238,221,.4) !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;pointer-events:none !important;background:transparent !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{left:-9px !important;top:28% !important;bottom:-7px !important;right:auto !important;width:38% !important;height:auto !important;border:2px solid ${C.pink} !important;border-top:none !important;border-right:none !important;border-radius:0 0 0 16px !important;box-shadow:-2px 2px 8px -2px ${C.pink} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{left:-9px !important;top:30% !important;bottom:12% !important;right:auto !important;width:12px !important;height:auto !important;border:2px solid ${C.teal} !important;border-right:none !important;border-radius:10px 0 0 10px !important;box-shadow:-3px 0 8px -2px ${C.teal} !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:none !important}

/* 时间：一行暖金灯字，不带底 */
[data-wk="time"] > span{background:transparent !important;border:none !important;color:${C.gold} !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.18em !important;font-size:12px !important;text-shadow:0 0 6px rgba(246,199,100,.8) !important}
/* 已读：小字，前面（我的在后面）一颗亮点 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:6px !important;height:6px !important;border-radius:50% !important;background:${C.teal} !important;box-shadow:0 0 6px ${C.teal} !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]::before{background:${C.pink} !important;box-shadow:0 0 6px ${C.pink} !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:rgba(14,11,25,.55) !important;border:2px solid ${C.teal} !important;border-radius:18px !important;box-shadow:${IG(C.teal)} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.teal} !important;box-shadow:0 0 4px ${C.teal} !important}

/* 动描：不是灯管——像橱窗里一行暗下来的字幕：上下各一道渐隐的金线，淡紫斜体 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{display:block !important;background:linear-gradient(90deg,transparent,rgba(246,199,100,.7),transparent) top/100% 1px no-repeat,linear-gradient(90deg,transparent,rgba(246,199,100,.7),transparent) bottom/100% 1px no-repeat,rgba(246,199,100,.05) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#CFC3EE !important;opacity:1 !important;font-style:italic !important;font-size:13px !important;line-height:1.8 !important;padding:8px 18px !important;text-align:center !important}
/* 系统提示：一行等宽小字，两边一颗灭着的小灯 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;font-size:11px !important;font-style:normal !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]::before{content:"◦ " !important;color:${C.teal} !important}
[data-wk="sysnotetext"]::after{content:" ◦" !important;color:${C.teal} !important}

/* 底栏：夜色，顶边一根青色灯管；左加号、发送（洋红灯牌「發送」），右回复（青色灯框） */
[data-wk="composer"]{background:rgba(14,11,25,.88) !important;border-top:1.5px solid ${C.teal} !important;box-shadow:0 -1px 10px rgba(67,238,221,.35) !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:${C.panel} !important;border:1.5px solid rgba(244,240,255,.25) !important;border-radius:18px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_PLUS)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.teal}) !important}
[data-wk="send"]{width:58px !important;min-width:58px !important;height:34px !important;border:2px solid ${C.pink} !important;border-radius:17px !important;background:transparent !important;box-shadow:${IG(C.pink)} !important;opacity:1 !important;position:relative !important}
[data-wk="send"]::after{content:"發送" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;color:${C.ink} !important;font-weight:700 !important;font-size:13px !important;letter-spacing:.3em !important;padding-left:.3em !important;text-shadow:0 0 6px ${C.pink} !important}
[data-wk="chatreply"]{width:52px !important;min-width:52px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.teal}) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "霓虹夜", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "霓虹夜-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
