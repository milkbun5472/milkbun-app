// 票签：薰衣草紫＋樱花粉，玫红印章。我的话＝一张票根（右边撕开一截写 No.＋时间感的小字），他的话＝尖头挂牌（小孔＋细线连到头像），
// 已读＝一枚圆红印章。用法：node themes/ticket/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#ECE4F7", paper: "#FBF8FF", pink: "#FFC7E0", rose: "#8B6CC9", roseD: "#6A4FA6", ink: "#4B3B66", line: "#9A86C4", fog: "#A79CC0", red: "#F0478E" };

const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 6 V18 M6 12 H18' stroke='${C.ink}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M3 12 L24 4 L18 21 L13 14Z' fill='none' stroke='${C.ink}' stroke-width='1.5' stroke-linejoin='round'/><path d='M13 14 L24 4' stroke='${C.ink}' stroke-width='1.3'/></svg>`;
const HEART = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'><path d='M12 19 C5 14 2.5 11 2.5 7.5 C2.5 4.8 4.6 3 7 3 C9 3 11 4.3 12 6 C13 4.3 15 3 17 3 C19.4 3 21.5 4.8 21.5 7.5 C21.5 11 19 14 12 19Z' fill='none' stroke='#fff' stroke-width='1.8'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.ink}' stroke-width='1.5' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.5' fill='${C.ink}'/><circle cx='12' cy='12' r='1.5' fill='${C.ink}'/><circle cx='19' cy='12' r='1.5' fill='${C.ink}'/></svg>`;
// 圆形红印章
const STAMP = (t) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><circle cx='30' cy='30' r='26' fill='rgba(251,246,242,.85)' stroke='${C.red}' stroke-width='2'/><circle cx='30' cy='30' r='21' fill='none' stroke='${C.red}' stroke-width='1'/><text x='30' y='35' text-anchor='middle' font-size='14' fill='${C.red}' font-family='sans-serif' transform='rotate(-14 30 30)'>${t}</text></svg>`;

const I_REPLYW = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M5 3 H23 Q26 3 26 6 V15 Q26 18 23 18 H12 L6 22 L7 18 H5 Q2 18 2 15 V6 Q2 3 5 3Z' fill='none' stroke='#fff' stroke-width='1.8' stroke-linejoin='round'/><path d='M14 14.5 C10.5 12 9 10.6 9 9 C9 7.7 10 6.8 11.2 6.8 C12.3 6.8 13.4 7.5 14 8.4 C14.6 7.5 15.7 6.8 16.8 6.8 C18 6.8 19 7.7 19 9 C19 10.6 17.5 12 14 14.5Z' fill='#fff'/></svg>`;

// 顶栏、底栏小按键：一张张紫边小票，中间放图案（加号／房子／三个点），左右两个半圆缺口
const TIX = (inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 30'><path d='M3 2 H37 Q38 2 38 3 V11 A4 4 0 0 0 38 19 V27 Q38 28 37 28 H3 Q2 28 2 27 V19 A4 4 0 0 0 2 11 V3 Q2 2 3 2Z' fill='${C.pink}' stroke='${C.rose}' stroke-width='1.4' stroke-linejoin='round'/>${inner}</svg>`;
const T_PLUS = TIX(`<path d='M20 9 V21 M14 15 H26' stroke='${C.roseD}' stroke-width='2' stroke-linecap='round'/>`);
const T_HOUSE = TIX(`<path d='M13 15 L20 9 L27 15 V22 H13Z' fill='none' stroke='${C.roseD}' stroke-width='1.7' stroke-linejoin='round'/><path d='M18.5 22 V18 H21.5 V22' fill='none' stroke='${C.roseD}' stroke-width='1.5'/>`);
const T_MORE = TIX(`<circle cx='14' cy='15' r='1.9' fill='${C.roseD}'/><circle cx='20' cy='15' r='1.9' fill='${C.roseD}'/><circle cx='26' cy='15' r='1.9' fill='${C.roseD}'/>`);
const T_PHOTO = TIX(`<rect x='12.5' y='9.5' width='15' height='11' rx='1.5' fill='none' stroke='${C.roseD}' stroke-width='1.6'/><circle cx='17' cy='13.5' r='1.5' fill='${C.roseD}'/><path d='M13 20 L18 16 L21 18.5 L24 16 L27 19' fill='none' stroke='${C.roseD}' stroke-width='1.4' stroke-linejoin='round'/>`);

// 顶栏两颗换成挂牌：尖头朝左、带小孔、一截细绳，跟他的气泡同一个形状
const TAG = (inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 30'><path d='M2 8 Q6 2 10 6' fill='none' stroke='${C.rose}' stroke-width='1.2' stroke-linecap='round'/><path d='M14 3 H40 Q42 3 42 5 V25 Q42 27 40 27 H14 L5 15Z' fill='${C.paper}' stroke='${C.rose}' stroke-width='1.4' stroke-linejoin='round'/><circle cx='12' cy='15' r='2.2' fill='${C.bg}' stroke='${C.rose}' stroke-width='1.1'/>${inner}</svg>`;
const G_HOUSE = TAG(`<path d='M21 15.5 L28 9.5 L35 15.5 V22 H21Z' fill='${C.pink}' stroke='${C.roseD}' stroke-width='1.5' stroke-linejoin='round'/><path d='M26.5 22 V18 H29.5 V22' fill='none' stroke='${C.roseD}' stroke-width='1.3'/>`);
const G_MORE = TAG(`<path d='M28 21 C23.5 18 21.5 16 21.5 13.6 C21.5 11.8 22.9 10.6 24.5 10.6 C26 10.6 27.3 11.5 28 12.6 C28.7 11.5 30 10.6 31.5 10.6 C33.1 10.6 34.5 11.8 34.5 13.6 C34.5 16 32.5 18 28 21Z' fill='${C.pink}' stroke='${C.roseD}' stroke-width='1.4'/>`);
// 头像框：邮票齿孔一圈＋紫色细环
const PERF = (() => { let d = ""; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; d += `<circle cx='${(50 + Math.cos(a) * 47).toFixed(2)}' cy='${(50 + Math.sin(a) * 47).toFixed(2)}' r='3.2' fill='${C.bg}'/>`; } return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='${C.paper}'/>${d}<circle cx='50' cy='50' r='40' fill='none' stroke='${C.rose}' stroke-width='2'/></svg>`; })();
const G_SEND = TAG(`<path d='M28 21.5 V9 M23.5 13.5 L28 9 L32.5 13.5' fill='none' stroke='${C.roseD}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/>`);
const bubble = { myBg: C.pink, myText: C.ink, myBorder: "1.4px solid " + C.line, charBg: C.paper, charText: C.ink, charBorder: "1.4px solid " + C.line, radius: 8, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const LINE = `1.4px solid ${C.line}`;
const SH = "0 3px 0 rgba(106,79,166,.18)";

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

/* 回复键：不写字，紫色小票块，中间一个白色带心的对话框；左右两侧各一个半圆缺口 */
[data-wk="chatreply"]{width:46px !important;min-width:46px !important;height:34px !important;background:radial-gradient(circle at 0 50%,${C.paper} 4.5px,transparent 5px),radial-gradient(circle at 100% 50%,${C.paper} 4.5px,transparent 5px),${svg(I_REPLYW)} center/22px no-repeat,${C.rose} !important}
[data-wk="chatreply"]::before,[data-wk="chatreply"]::after{content:none !important}

/* ───── 票签 · 第二批：卡片 ───── */
/* 卡片统一：浅紫白底、紫细边、底下一道淡影 */
[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.paper} !important;border:${LINE} !important;border-radius:8px !important;box-shadow:${SH} !important;color:${C.ink} !important}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:rgba(154,134,196,.4) !important}
/* 转账＝一张车票：左边粉色主票、右边一截紫色存根，中间一排半圆缺口隔开；收下盖玫粉圆章，退回盖一枚斜的「作废」 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;background:radial-gradient(circle at calc(100% - 64px) 0,${C.bg} 7px,transparent 7.5px),radial-gradient(circle at calc(100% - 64px) 100%,${C.bg} 7px,transparent 7.5px),linear-gradient(90deg,transparent calc(100% - 64.7px),${C.line} calc(100% - 64.7px),${C.line} calc(100% - 63.3px),transparent calc(100% - 63.3px)),linear-gradient(90deg,${C.pink} calc(100% - 64px),#FFE4F0 calc(100% - 64px)) !important;border:${LINE} !important;border-radius:8px !important;box-shadow:${SH} !important;padding-top:26px !important}
[data-wk="transfercard"]::before{content:"ADMIT ONE · 转账" !important;position:absolute !important;left:16px !important;top:9px !important;font:600 9px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.2em !important;color:${C.roseD} !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:rgba(106,79,166,.25) !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.roseD} !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:rgba(106,79,166,.35) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:transparent !important}
[data-wk="transferbtn"]{border-radius:4px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.rose} !important;color:#fff !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important}
[data-wk="transferseal"]{border:1.4px solid ${C.rose} !important;background:transparent !important;color:${C.roseD} !important;box-shadow:none !important}
[data-wk="transferseal"] *{color:${C.roseD} !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:54px !important;height:54px !important;border:none !important;background:${svg(STAMP("已收"))} center/contain no-repeat !important;transform:rotate(-12deg) !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:54px !important;height:54px !important;border:none !important;background:${svg(STAMP("作废"))} center/contain no-repeat !important;transform:rotate(10deg) !important;filter:grayscale(1) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.7 !important}
/* 红包＝一张入场券：紫色主票＋粉色存根，存根上一颗心 */
[data-wk="rpcard"]{background:radial-gradient(circle at 60px 0,${C.bg} 7px,transparent 7.5px),radial-gradient(circle at 60px 100%,${C.bg} 7px,transparent 7.5px),linear-gradient(90deg,transparent 59.3px,rgba(255,255,255,.7) 59.3px,rgba(255,255,255,.7) 60.7px,transparent 60.7px),linear-gradient(90deg,#A48ADA 60px,${C.rose} 60px) !important;border:${LINE} !important;border-radius:8px !important;box-shadow:${SH} !important;padding-left:72px !important}
[data-wk="rpcard"] > div:not([data-wk]){padding-left:12px !important}
[data-wk="rpcard"] *{color:#fff !important}
[data-wk="rpflap"]{display:none !important}
[data-wk="rpcorner"]{display:none !important}
[data-wk="rpseal"]{border:none !important;left:18px !important;top:50% !important;margin-top:-12px !important;width:24px !important;height:22px !important;background:${svg(HEART)} center/contain no-repeat !important}
[data-wk="rpseal"] *{display:none !important}
[data-wk="rpcard"][data-status="done"]{filter:saturate(.4) !important;opacity:.8 !important}
[data-wk="rpenvelope"]{background:${C.rose} !important;border:${LINE} !important;border-radius:18px !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:${C.roseD} !important}
[data-wk="rpenvelope"] *{color:#fff !important}
[data-wk="rpenvelope"][data-stage="open"]{background:${C.paper} !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:${C.pink} ${svg(HEART.replace(/#fff/g, C.roseD))} center/50% no-repeat !important;border:${LINE} !important;box-shadow:none !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpamount"]{color:${C.roseD} !important}
/* 照片：像一张贴在票夹里的照片，四角一点紫色胶带 */
[data-wk="photocard"]{padding:8px 8px 10px !important}
[data-wk="photoface"]{border-radius:4px !important;background:${C.bg} !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}
/* 语音：一张小票，我粉他白 */
[data-wk="voice"][data-me]{background:${C.paper} !important;border:${LINE} !important;border-radius:8px !important;box-shadow:${SH} !important}
[data-wk="voice"][data-me="1"]{background:${C.pink} !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voicewave"] span{background:${C.rose} !important}
[data-wk="wxcardsky"]{background:${C.bg} !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.rose} !important}
[data-wk="wxcardsay"]{background:${C.paper} !important;color:${C.ink} !important;border-top:${LINE} !important}
[data-wk="geopin"]{background:${C.red} !important;box-shadow:0 0 0 3px #fff !important}
[data-wk="geopinstem"]{background:${C.rose} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 1.4px ${C.line} !important}
/* 拍一拍、通话结束：小票胶囊 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:radial-gradient(circle at 0 50%,${C.bg} 4px,transparent 4.5px),radial-gradient(circle at 100% 50%,${C.bg} 4px,transparent 4.5px),${C.pink} !important;border:none !important;border-radius:3px !important;color:${C.ink} !important;padding:2px 16px !important;font-size:12px !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.ink} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
/* 线下小结：一张票根，标题像票面上的印字 */
[data-part="offlog"]{background:radial-gradient(circle at 0 50%,${C.bg} 8px,transparent 8.5px),radial-gradient(circle at 100% 50%,${C.bg} 8px,transparent 8.5px),${C.paper} !important;padding:16px 22px !important}
[data-wk="offlogtitle"]{color:${C.roseD} !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.3em !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.rose} !important}
[data-wk="offlogtranscript"]{border-top:${LINE} !important}
/* 加号面板：一排排小票 */
[data-wk="chatpanel"]{background:${C.paper} !important;border-top:${LINE} !important}
[data-wk="chattoolicon"]{background:radial-gradient(circle at 0 50%,${C.paper} 4px,transparent 4.5px),radial-gradient(circle at 100% 50%,${C.paper} 4px,transparent 4.5px),${C.pink} !important;border:none !important;border-radius:6px !important;box-shadow:${SH} !important}
[data-wk="chattool"]:nth-child(even) [data-wk="chattoolicon"]{background:radial-gradient(circle at 0 50%,${C.paper} 4px,transparent 4.5px),radial-gradient(circle at 100% 50%,${C.paper} 4px,transparent 4.5px),${C.bg} !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.ink} !important}
/* 引用三处：一张小纸签，左边一个打孔 */
[data-wk="quotedraft"]{background:${C.paper} !important;border-top:${LINE} !important}
[data-wk="quote"]{background:radial-gradient(circle at 10px 50%,${C.bg} 3px,transparent 3.5px),${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:4px !important;padding-left:22px !important;opacity:1 !important}
[data-wk="quote"][data-me="1"]{background:radial-gradient(circle at 10px 50%,${C.bg} 3px,transparent 3.5px),${C.pink} !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.rose} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid ${C.rose} !important;padding-left:8px !important;opacity:.75 !important}


/* 加号、房子、三个点都换成小票按键（线上线下一样） */
[data-wk="sameroom"],[data-wk="chatmore"]{width:36px !important;min-width:36px !important;height:28px !important}
[data-wk="sameroom"]{background:${svg(T_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(T_MORE)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatplus"]{width:36px !important;min-width:36px !important;height:28px !important;background:${svg(T_PLUS)} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:36px !important;height:28px !important;background:${svg(T_PLUS)} center/contain no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:36px !important;min-width:36px !important;height:28px !important;border:none !important;box-shadow:none !important;font-size:0 !important;color:transparent !important;background:${svg(T_PHOTO)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
/* 转账存根里的印章：没收时也要看得清——白底紫字的小圆章 */
[data-wk="transfercard"][data-status="pending"] [data-wk="transferseal"]{background:${C.paper} !important;border:1.4px solid ${C.roseD} !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="pending"] [data-wk="transferseal"] *{color:${C.roseD} !important}

[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/26px no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{width:46px !important;min-width:46px !important;height:34px !important;border:none !important;border-radius:4px !important;background:radial-gradient(circle at 0 50%,${C.paper} 4.5px,transparent 5px),radial-gradient(circle at 100% 50%,${C.paper} 4.5px,transparent 5px),${svg(I_REPLYW)} center/22px no-repeat,${C.rose} !important;box-shadow:0 3px 0 ${C.roseD} !important;font-size:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}


/* 房子、三个点：换成挂牌 */
[data-wk="sameroom"],[data-wk="chatmore"]{width:40px !important;min-width:40px !important;height:28px !important}
[data-wk="sameroom"]{background:${svg(G_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(G_MORE)} center/contain no-repeat !important}
/* 头像框：一枚邮票——齿孔圆边＋紫色细环，头像压在上面 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:none !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-22% !important;background:${svg(PERF)} center/contain no-repeat !important;z-index:0 !important;pointer-events:none !important;filter:drop-shadow(0 2px 2px rgba(106,79,166,.25)) !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{box-shadow:none !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;left:-6px !important;top:calc(50% - 26px) !important;width:52px !important;height:52px !important;background:${svg(PERF)} center/contain no-repeat !important;z-index:0 !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]) > [data-wk="avatar"]{position:relative !important;z-index:1 !important}


/* 发送：不用纸飞机，换成跟顶栏同款的挂牌，里面一个箭头（线上线下一样） */
[data-wk="send"]{width:40px !important;min-width:40px !important;height:28px !important;background:${svg(G_SEND)} center/contain no-repeat !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){width:40px !important;min-width:40px !important;height:28px !important;background:${svg(G_SEND)} center/contain no-repeat !important}
/* 引用待发那条：一张小票——左边紫色存根写 RE.，竖线隔开，上下两个半圆缺口 */
[data-wk="quotedraft"]{background:${C.paper} !important;border-top:none !important}
[data-wk="quote"][data-draft="1"]{position:relative !important;background:radial-gradient(circle at 44px 0,${C.paper} 5px,transparent 5.5px),radial-gradient(circle at 44px 100%,${C.paper} 5px,transparent 5.5px),linear-gradient(90deg,${C.rose} 44px,${C.pink} 44px) !important;border:${LINE} !important;border-radius:6px !important;padding-left:54px !important;box-shadow:${SH} !important}
[data-wk="quote"][data-draft="1"]::before{content:"RE." !important;position:absolute !important;left:0 !important;top:0 !important;bottom:0 !important;width:44px !important;display:flex !important;align-items:center !important;justify-content:center !important;font:700 10px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.1em !important;color:#fff !important}
[data-wk="quote"][data-draft="1"] [data-wk="quoteicon"]{display:none !important}
[data-wk="quote"][data-draft="1"] *{color:${C.ink} !important}
[data-wk="quoteclear"]{color:${C.roseD} !important}
/* 气泡上方那条引用：一张小挂牌，跟他的气泡同形状 */
[data-wk="quote"]:not([data-draft]){background:radial-gradient(circle at 12px 50%,${C.bg} 3px,transparent 3.5px),${C.paper} !important;border:${LINE} !important;border-radius:4px 8px 8px 4px !important;clip-path:polygon(8px 0,100% 0,100% 100%,8px 100%,0 50%) !important;padding-left:22px !important}
[data-wk="quote"]:not([data-draft])[data-me="1"]{background:radial-gradient(circle at 12px 50%,${C.bg} 3px,transparent 3.5px),${C.pink} !important}


/* 我的票根：描边换嫩粉，存根竖线也跟着粉 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{border-color:#F59BC4 !important;background:radial-gradient(circle at calc(100% - 30px) 0,${C.bg} 6px,transparent 6.5px),radial-gradient(circle at calc(100% - 30px) 100%,${C.bg} 6px,transparent 6.5px),linear-gradient(90deg,transparent calc(100% - 30.7px),#F59BC4 calc(100% - 30.7px),#F59BC4 calc(100% - 29.3px),transparent calc(100% - 29.3px)),${C.pink} !important;box-shadow:0 3px 0 rgba(245,155,196,.35) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{color:#E0558A !important}
/* 一串最后一条是表情包、卡片时：已读印章盖在它底下（cardmeta 默认藏着） */
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:0 !important;height:36px !important;padding:0 !important;margin:-12px 0 0 !important;background:${svg(STAMP("已读"))} 70px center/36px 36px no-repeat !important;position:relative !important;z-index:2 !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{background:none !important;font-size:10.5px !important;height:auto !important;margin:2px 0 0 !important;text-align:right !important;padding:0 64px 0 0 !important;color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important;letter-spacing:.1em !important}


/* ───── 票签 · 第三批：状态卡＝一本票夹（形状不动；小巧思：每块像一张票，好感是一排打孔） ───── */
[data-wk="statecard"]{background:${C.bg} !important;border:${LINE} !important;border-radius:14px !important;box-shadow:0 14px 34px rgba(106,79,166,.25) !important;--sc-heart-ink:${C.rose} !important}
[data-wk="statehead"]{background:radial-gradient(circle at 8px 100%,${C.bg} 5px,transparent 5.5px) 0 0/16px 100% repeat-x,${C.paper} !important;border-bottom:none !important;padding-bottom:14px !important}
[data-wk="statehead"] *{color:${C.ink} !important}
[data-wk="statehead"] button{border:${LINE} !important;background:${C.paper} !important}
[data-wk="statemood"]{display:inline-block !important;background:${C.pink} !important;border:1.4px solid #F59BC4 !important;color:${C.ink} !important;border-radius:3px !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.paper} !important;border:${LINE} !important;border-radius:6px !important;padding:3px !important;margin:12px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:4px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.rose} !important;color:#fff !important}
/* 看得见的＝一张白票；心里想的＝一张粉票根，右边存根写 No. */
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;border:${LINE} !important;border-radius:8px !important;margin:12px 16px !important;color:${C.ink} !important;box-shadow:${SH} !important}
[data-wk="stateseen"]{background:radial-gradient(circle at 0 50%,${C.bg} 7px,transparent 7.5px),radial-gradient(circle at 100% 50%,${C.bg} 7px,transparent 7.5px),${C.paper} !important}
[data-wk="statevoice"]{background:radial-gradient(circle at calc(100% - 34px) 0,${C.bg} 6px,transparent 6.5px),radial-gradient(circle at calc(100% - 34px) 100%,${C.bg} 6px,transparent 6.5px),linear-gradient(90deg,transparent calc(100% - 34.7px),#F59BC4 calc(100% - 34.7px),#F59BC4 calc(100% - 33.3px),transparent calc(100% - 33.3px)),${C.pink} !important;border-color:#F59BC4 !important;padding-right:44px !important}
[data-wk="statevoice"]::after{content:"No." !important;position:absolute !important;right:8px !important;top:50% !important;margin-top:-7px !important;font:600 9px/14px ui-monospace,Menlo,monospace !important;color:#E0558A !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.ink} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:#fff !important;border:${LINE} !important;border-radius:4px !important}
[data-wk="statewear"] > span{background:${C.bg} !important;border-radius:3px !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.rose} !important}
[data-wk="statevoice"] + div > button{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:6px !important}
/* 好感：一张打孔卡，一排圆孔，打穿的填紫 */
[data-wk="stateaff"]{background:${C.paper} !important;border-top:${LINE} !important;position:relative !important;display:block !important;padding:16px 20px 60px !important;overflow:hidden !important;border-radius:0 0 12px 12px !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:absolute !important;width:24px !important;left:calc(50% - 12px) !important;height:min(240px, 72vw) !important;bottom:calc(28px - min(240px, 72vw) / 2) !important;transform:rotate(90deg) !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 240'>${[...Array(10)].map((_,i)=>`<circle cx='12' cy='${12+i*24}' r='9'/>`).join("")}</svg>`)} !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:transparent !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:0 !important}
[data-wk="stateheartbase"]{background:${C.bg} !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{background:${C.rose} !important;opacity:1 !important;border-top:none !important}
[data-wk="stateheart"]{filter:drop-shadow(1px 0 0 ${C.line}) drop-shadow(-1px 0 0 ${C.line}) drop-shadow(0 1px 0 ${C.line}) drop-shadow(0 -1px 0 ${C.line}) !important}
[data-wk="stateheartnum"],[data-wk="stateheartknob"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:20px !important;top:12px !important;font:700 26px/1 ui-monospace,Menlo,monospace !important;color:${C.roseD} !important}

/* 翻旧的：一叠票根，每张左上角编号 */
[data-wk="statehistbtn"]{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:6px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.ink} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:${LINE} !important;border-radius:6px !important;color:${C.rose} !important;background:${C.paper} !important}
[data-wk="statehistlist"]{counter-reset:tk !important}
[data-wk="statehistitem"]{counter-increment:tk !important;position:relative !important;background:radial-gradient(circle at 0 50%,${C.bg} 7px,transparent 7.5px),radial-gradient(circle at 100% 50%,${C.bg} 7px,transparent 7.5px),${C.paper} !important;border:${LINE} !important;border-radius:8px !important;padding:30px 20px 14px !important;margin-bottom:12px !important;box-shadow:${SH} !important}
[data-wk="statehistitem"]::before{content:"No.00" counter(tk) !important;position:absolute !important;left:18px !important;top:10px !important;font:600 9px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.15em !important;color:${C.rose} !important}
[data-wk="statehistmood"]{background:${C.pink} !important;border:1.2px solid #F59BC4 !important;color:${C.ink} !important;border-radius:3px !important}
[data-wk="statehisttime"]{color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="statehisttext"],[data-wk="statehistact"],[data-wk="statehistwear"]{color:${C.ink} !important}
[data-wk="statehistmeta"]{background:${C.bg} !important;border-radius:4px !important}
[data-wk="statehistend"]{color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important}

/* Ta 眼里：贴条换成一枚小红印章 */
[data-wk="gazepage"]{background:${C.bg} !important}
[data-wk="gazetitle"]{color:${C.roseD} !important}
[data-wk="gazetab"]{background:${C.paper} !important;color:${C.fog} !important;border:${LINE} !important;border-radius:4px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.rose} !important;color:#fff !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{background:radial-gradient(circle at 0 50%,${C.bg} 6px,transparent 6.5px),radial-gradient(circle at 100% 50%,${C.bg} 6px,transparent 6.5px),${C.paper} !important;border:${LINE} !important;border-radius:8px !important;box-shadow:${SH} !important}
[data-wk="gazetape"]{background:${svg(STAMP("♡"))} center/26px 26px no-repeat !important;width:26px !important;height:26px !important;margin-left:-13px !important;top:-13px !important;box-shadow:none !important;border:none !important;transform:rotate(-10deg) !important}
[data-wk="gazecardname"]{color:${C.roseD} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.fog} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.paper} !important;border:${LINE} !important;border-radius:12px !important}
[data-wk="gazeempty"]{background:${C.paper} !important;border:${LINE} !important;border-radius:8px !important}
[data-wk="gazeempty"] button{background:${C.rose} !important;color:#fff !important;border:none !important;border-radius:6px !important}

/* ───── 线下 ───── */
[data-wk="offline"]:not([style*="url("]){background:${C.bg} !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:${C.ink} !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:${C.rose} !important;color:#fff !important;border:none !important;border-radius:4px !important;font-size:12px !important;padding:3px 12px !important;box-shadow:0 2px 0 ${C.roseD} !important}
[data-wk="offcomposer"]{background:radial-gradient(circle at 8px 0,${C.bg} 5px,transparent 5.5px) 0 0/16px 100% repeat-x,${C.paper} !important;border-top:none !important;padding-top:12px !important}
[data-wk="offcomposer"] textarea{background:#fff !important;border:${LINE} !important;border-radius:6px !important;color:${C.ink} !important}
[data-wk="offcard"]{position:relative !important;background:radial-gradient(circle at 0 40px,${C.bg} 7px,transparent 7.5px),radial-gradient(circle at 100% 40px,${C.bg} 7px,transparent 7.5px),${C.paper} !important;border:${LINE} !important;border-left-width:1.4px !important;border-radius:10px !important;box-shadow:${SH} !important}
[data-wk="offcard"][data-me="1"]{background:radial-gradient(circle at 0 40px,${C.bg} 7px,transparent 7.5px),radial-gradient(circle at 100% 40px,${C.bg} 7px,transparent 7.5px),${C.pink} !important;border-color:#F59BC4 !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important}
[data-wk="offname"]{color:${C.roseD} !important;font-weight:700 !important}
[data-wk="offtext"]{color:${C.ink} !important}
[data-wk="offsay"]{background:linear-gradient(transparent 60%,rgba(245,155,196,.45) 60%) !important;color:${C.ink} !important;font-weight:700 !important;box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important}
[data-wk="offthought"]{background:${C.bg} !important;border:none !important;border-left:2px solid ${C.rose} !important;border-radius:0 6px 6px 0 !important;color:${C.ink} !important}
[data-wk="offcardacts"] svg{stroke:${C.rose} !important;color:${C.rose} !important}
[data-wk="offreplyopt"]{background:${C.paper} !important;border:${LINE} !important;border-radius:4px !important;color:${C.ink} !important}

/* ───── 通话 ───── */
[data-wk="callbubble"]{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:8px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.pink} !important;border-color:#F59BC4 !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 6px ${C.paper},0 0 0 7.4px ${C.rose},0 14px 30px rgba(106,79,166,.3) !important}

/* 挂牌尖头对齐：尖头图的上下边正好压在气泡上下边框上（线宽 2.8 一半裁掉＝1.4，跟边框一样粗）；影子改用 drop-shadow 让尖头也一起有影 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{box-shadow:none !important;filter:drop-shadow(0 3px 0 rgba(106,79,166,.18)) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{left:-20px !important;width:21px !important;top:0 !important;bottom:0 !important;margin-top:-1.4px !important;height:calc(100% + 2.8px) !important;overflow:hidden !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 21 40' preserveAspectRatio='none'><path d='M21 0 H14 L0.9 20 L14 40 H21Z' fill='${C.paper}'/><path d='M21 0 H14 M14 40 H21' stroke='${C.line}' stroke-width='2.8' vector-effect='non-scaling-stroke'/><path d='M14 0.5 L1.2 20 L14 39.5' fill='none' stroke='${C.line}' stroke-width='1.4' vector-effect='non-scaling-stroke' stroke-linejoin='round' stroke-linecap='round'/></svg>`)} left top/100% 100% no-repeat !important}

`;

const pack = { kind: "chat-look", v: 1, name: "票签", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "票签-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
