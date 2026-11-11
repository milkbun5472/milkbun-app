// 票签：烟紫底、豆沙粉。我的话＝一张票根（右边撕开一截写 No.＋时间感的小字），他的话＝尖头挂牌（小孔＋细线连到头像），
// 已读＝一枚圆红印章。用法：node themes/ticket/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#E8E3EA", paper: "#FBF6F2", pink: "#F6E4E6", rose: "#B5636F", roseD: "#8E4651", ink: "#5B4A55", line: "#9E8A95", fog: "#A79BA4" };

const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 6 V18 M6 12 H18' stroke='${C.ink}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M3 12 L24 4 L18 21 L13 14Z' fill='none' stroke='${C.ink}' stroke-width='1.5' stroke-linejoin='round'/><path d='M13 14 L24 4' stroke='${C.ink}' stroke-width='1.3'/></svg>`;
const HEART = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'><path d='M12 19 C5 14 2.5 11 2.5 7.5 C2.5 4.8 4.6 3 7 3 C9 3 11 4.3 12 6 C13 4.3 15 3 17 3 C19.4 3 21.5 4.8 21.5 7.5 C21.5 11 19 14 12 19Z' fill='none' stroke='#fff' stroke-width='1.8'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.ink}' stroke-width='1.5' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.5' fill='${C.ink}'/><circle cx='12' cy='12' r='1.5' fill='${C.ink}'/><circle cx='19' cy='12' r='1.5' fill='${C.ink}'/></svg>`;
// 圆形红印章
const STAMP = (t) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><circle cx='30' cy='30' r='26' fill='rgba(251,246,242,.85)' stroke='${C.rose}' stroke-width='2'/><circle cx='30' cy='30' r='21' fill='none' stroke='${C.rose}' stroke-width='1'/><text x='30' y='35' text-anchor='middle' font-size='14' fill='${C.rose}' font-family='sans-serif' transform='rotate(-14 30 30)'>${t}</text></svg>`;

const bubble = { myBg: C.pink, myText: C.ink, myBorder: "1.4px solid " + C.line, charBg: C.paper, charText: C.ink, charBorder: "1.4px solid " + C.line, radius: 8, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const LINE = `1.4px solid ${C.line}`;
const SH = "0 3px 0 rgba(91,74,85,.18)";

const css = `
/* ───── 票签 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(ellipse at 20% 10%,rgba(255,255,255,.5),transparent 60%),${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一条撕下来的票头——底边一排小半圆缺口 */
[data-wk="chathead"]{background:radial-gradient(circle at 8px 100%,${C.bg} 5px,transparent 5.5px) 0 0/16px 100% repeat-x,${C.paper} !important;border-bottom:none !important;box-shadow:none !important;padding-bottom:12px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headdim"]{color:${C.fog} !important;letter-spacing:.1em !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{border-radius:50% !important;box-shadow:0 0 0 1.4px ${C.line} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:28px !important;min-width:28px !important;height:28px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/21px no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/21px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}

/* 头像：圆的，细边 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 1.4px ${C.line} !important}

/* 我的话：一张票根。右边一道竖线隔出存根，上下两个半圆缺口 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;color:${C.ink} !important;box-shadow:${SH} !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:radial-gradient(circle at calc(100% - 30px) 0,${C.bg} 6px,transparent 6.5px),radial-gradient(circle at calc(100% - 30px) 100%,${C.bg} 6px,transparent 6.5px),linear-gradient(90deg,transparent calc(100% - 30.7px),${C.line} calc(100% - 30.7px),${C.line} calc(100% - 29.3px),transparent calc(100% - 29.3px)),${C.pink} !important;border:${LINE} !important;border-radius:8px !important;padding:11px 46px 11px 16px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"No." !important;position:absolute !important;right:6px !important;top:50% !important;left:auto !important;bottom:auto !important;width:18px !important;height:auto !important;margin-top:-7px !important;background:none !important;border:none !important;transform:none !important;font:600 9px/14px ui-monospace,Menlo,monospace !important;color:${C.rose} !important;text-align:center !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:none !important}
/* 他的话：一块尖头挂牌，左边尖角＋小孔，一根细线连到头像 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.paper} !important;border:${LINE} !important;border-left:none !important;border-radius:0 8px 8px 0 !important;margin-left:20px !important;padding:11px 16px 11px 14px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;left:-19px !important;top:-1.4px !important;bottom:-1.4px !important;width:20px !important;height:auto !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 40' preserveAspectRatio='none'><path d='M20 0.7 H14 L0.8 20 L14 39.3 H20' fill='${C.paper}' stroke='${C.line}' stroke-width='1.4' vector-effect='non-scaling-stroke' stroke-linejoin='round'/></svg>`)} center/100% 100% no-repeat !important;border:none !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;left:-8px !important;top:50% !important;bottom:auto !important;width:7px !important;height:7px !important;margin-top:-3.5px !important;border-radius:50% !important;background:${C.bg} !important;border:1.2px solid ${C.line} !important;transform:none !important}
[data-wk="msg"][data-me="0"][data-first="1"] [data-wk="row"]{position:relative !important}
[data-wk="msg"][data-me="0"][data-first="1"] [data-wk="row"]::before{content:"" !important;position:absolute !important;left:40px !important;top:22px !important;width:30px !important;height:14px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 14'><path d='M0 4 C10 2 14 14 30 9' fill='none' stroke='${C.rose}' stroke-width='1.2'/></svg>`)} center/contain no-repeat !important;pointer-events:none !important;z-index:0 !important}

/* 时间：豆沙色小字，等宽 */
[data-wk="time"] > span{background:transparent !important;border:none !important;color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.15em !important;font-size:10.5px !important}
/* 已读：一枚圆红印章；已送达只写一行小字 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.1em !important}
[data-wk="meta"][data-read="1"]{font-size:0 !important;width:36px !important;height:36px !important;background:${svg(STAMP("已读"))} center/contain no-repeat !important;margin-top:-14px !important;position:relative !important;z-index:2 !important;transform:rotate(-8deg) !important}
[data-wk="meta"][data-read="1"] *{opacity:0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.paper} !important;border:${LINE} !important;border-radius:8px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.rose} !important}
/* 动描：一行斜体小字，前面一道豆沙短线（跟气泡分开） */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important;opacity:.75 !important;font-style:italic !important;font-size:13px !important;padding-left:14px !important;border-left:2px solid ${C.rose} !important;border-radius:0 !important}
/* 系统提示：不带框的一行等宽小字 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.08em !important}

/* 底栏：一条票头，顶边一排半圆缺口；左发送右回复，回复是豆沙色票块「发送 ♡」那种 */
[data-wk="composer"]{background:radial-gradient(circle at 8px 0,${C.bg} 5px,transparent 5.5px) 0 0/16px 100% repeat-x,${C.paper} !important;border-top:none !important;align-items:center !important;gap:8px !important;padding-top:12px !important}
[data-wk="chatinput"]{background:#fff !important;border:${LINE} !important;border-radius:6px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="send"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/22px no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/26px no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{position:relative !important;width:62px !important;min-width:62px !important;height:34px !important;border:none !important;border-radius:4px !important;background:${C.rose} !important;box-shadow:0 3px 0 ${C.roseD} !important}
[data-wk="chatreply"]::before{content:"回复" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;color:#fff !important;font-size:13px !important;letter-spacing:.2em !important;padding-right:12px !important}
[data-wk="chatreply"]::after{content:"" !important;position:absolute !important;right:8px !important;top:50% !important;width:12px !important;height:11px !important;margin-top:-5.5px !important;background:${svg(HEART)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="meta"][data-read="1"]{margin-left:auto !important;margin-right:0 !important;align-self:flex-end !important}

`;

const pack = { kind: "chat-look", v: 1, name: "票签", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "票签-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
