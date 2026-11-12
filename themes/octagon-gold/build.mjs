// 八角 · 墨金：墨黑底、暗金线，所有框都切成八角。我的话＝一块金箔八角牌，他的话＝墨底金边八角牌、四角钉金铆钉，
// 已读＝一枚八角小金印刻「阅」。用法：node themes/octagon-gold/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { ink: "#12100D", ink2: "#1D1A15", ink3: "#2A251D", gold: "#C9A45C", goldL: "#EBD394", goldD: "#8A6A2E", cream: "#F2E6C8", dim: "#9C8B66" };
// 八角切角：k＝切角长度
const OCT = k => `polygon(${k} 0,calc(100% - ${k}) 0,100% ${k},100% calc(100% - ${k}),calc(100% - ${k}) 100%,${k} 100%,0 calc(100% - ${k}),0 ${k})`;

// 底纹：八角＋小方的窗格，极淡的金线
const LATTICE = `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><g fill='none' stroke='${C.gold}' stroke-width='.8' opacity='.09'><path d='M18 0 H42 L60 18 V42 L42 60 H18 L0 42 V18Z'/><path d='M0 0 L18 0 M0 0 V18 M60 0 H42 M60 0 V18 M0 60 H18 M0 60 V42 M60 60 H42 M60 60 V42'/></g><g fill='${C.gold}' opacity='.12'><rect x='28' y='28' width='4' height='4' transform='rotate(45 30 30)'/></g></svg>`;
// 回纹带
const FRET = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='12'><path d='M0 11 H10 V3 H4 V8 H7' fill='none' stroke='${C.gold}' stroke-width='1.2'/><path d='M12 11 H22 V3 H16 V8 H19' fill='none' stroke='${C.gold}' stroke-width='1.2'/><path d='M0 11.5 H24' stroke='${C.gold}' stroke-width='.8'/></svg>`;
const DIA = (f = C.gold, s = C.goldL) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M6 .8 L11.2 6 L6 11.2 L.8 6Z' fill='${f}' stroke='${s}' stroke-width='1'/></svg>`;
const DIAO = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M6 1.2 L10.8 6 L6 10.8 L1.2 6Z' fill='none' stroke='${C.gold}' stroke-width='1.3'/></svg>`;
// 小金铃
const BELL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 26'><path d='M8 0 V7' stroke='${C.gold}' stroke-width='1'/><path d='M3 18 Q3 9 8 8 Q13 9 13 18 L14.5 20 H1.5Z' fill='${C.gold}' stroke='${C.goldL}' stroke-width='.9' stroke-linejoin='round'/><circle cx='8' cy='22.5' r='2.2' fill='${C.goldL}'/><path d='M5.5 12 Q6 10.5 7.5 10' stroke='#fff' stroke-width='.9' fill='none' opacity='.6'/></svg>`;
// 八角头像框（四个斜角各嵌一颗金珠）
const OFRAME = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M30 3 H70 L97 30 V70 L70 97 H30 L3 70 V30Z' fill='none' stroke='${C.gold}' stroke-width='3.2' stroke-linejoin='round'/></svg>`;
// 八角金印「阅」
const SEAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M12 1.5 H28 L38.5 12 V28 L28 38.5 H12 L1.5 28 V12Z' fill='${C.gold}' stroke='${C.goldL}' stroke-width='1.4'/><path d='M13.5 5 H26.5 L35 13.5 V26.5 L26.5 35 H13.5 L5 26.5 V13.5Z' fill='none' stroke='${C.ink}' stroke-width='1'/><text x='20' y='26.5' text-anchor='middle' font-size='17' font-weight='700' fill='${C.ink}' font-family='serif'>阅</text></svg>`;
const OBTN = (inner, fill = C.gold, stroke = C.goldL) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M12 2 H28 L38 12 V28 L28 38 H12 L2 28 V12Z' fill='${fill}' stroke='${stroke}' stroke-width='1.6'/>${inner}</svg>`;
const OLINE = inner => OBTN(inner, C.ink2, C.gold);
// 加号＝一枚铜钱（外圆内方，方孔里一个小十字）
const I_PLUS = OLINE(`<circle cx='20' cy='20' r='9' fill='none' stroke='${C.gold}' stroke-width='1.6'/><rect x='16.5' y='16.5' width='7' height='7' fill='none' stroke='${C.gold}' stroke-width='1.4'/><path d='M20 18 V22 M18 20 H22' stroke='${C.goldL}' stroke-width='1.2'/>`);
// 发送＝金八角里一支毛笔，笔锋朝右
const I_SEND = OBTN(`<path d='M10 25 L22 17' stroke='${C.ink}' stroke-width='2.6' stroke-linecap='round'/><path d='M22 17 Q28 13 31 13 Q29 17 24 20Z' fill='${C.ink}'/><path d='M10 25 L8.5 26' stroke='${C.goldD}' stroke-width='3' stroke-linecap='round'/><path d='M12 29 H30' stroke='${C.ink}' stroke-width='1.2' opacity='.5'/>`);
// 回复＝一卷展开的卷轴，上面三行字
const I_REPLY = OLINE(`<rect x='12' y='13' width='16' height='14' fill='none' stroke='${C.gold}' stroke-width='1.4'/><path d='M10 12 H14 M10 28 H14 M26 12 H30 M26 28 H30' stroke='${C.gold}' stroke-width='2' stroke-linecap='round'/><path d='M15.5 17.5 H24.5 M15.5 20.5 H24.5 M15.5 23.5 H21' stroke='${C.goldL}' stroke-width='1.1'/>`);
// 主页＝一座小亭子（翘角屋檐）
const I_HOUSE = OLINE(`<path d='M10 18 Q14 17 20 11 Q26 17 30 18' fill='none' stroke='${C.gold}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/><path d='M13 18 H27' stroke='${C.gold}' stroke-width='1.4'/><path d='M15 18 V28 M25 18 V28 M12.5 28 H27.5' stroke='${C.gold}' stroke-width='1.4'/><circle cx='20' cy='10' r='1.2' fill='${C.goldL}'/>`);
// 更多＝一朵祥云
const I_MORE = OLINE(`<path d='M11 24 Q9 20 13 19 Q13 14 18 15 Q20 11 24 14 Q29 13 28 18 Q32 19 30 23 Q28 26 24 24 Q21 27 17 25 Q13 27 11 24Z' fill='none' stroke='${C.gold}' stroke-width='1.4' stroke-linejoin='round'/><path d='M16 21 Q18 19 20 21 Q22 23 24 21' fill='none' stroke='${C.goldL}' stroke-width='1.1'/>`);
// 方印：达（空心）、阅（实心）
const SQ = (t, fill) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='1.5' y='1.5' width='21' height='21' rx='1.5' fill='${fill ? C.gold : "none"}' stroke='${C.gold}' stroke-width='1.6'/><text x='12' y='17' text-anchor='middle' font-size='14' font-weight='700' fill='${fill ? C.ink : C.gold}' font-family='serif'>${t}</text></svg>`;

// ── 第二批用的图 ──
// 令牌顶上的挂绳＋流苏
const CORD = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 34'><path d='M20 0 V14' stroke='#A3322A' stroke-width='2.4'/><circle cx='20' cy='16' r='5' fill='none' stroke='${C.gold}' stroke-width='2'/><path d='M14 2 Q20 10 26 2' fill='none' stroke='#A3322A' stroke-width='2'/></svg>`;
// 漆盒：盖子＋盒身，open＝盖子掀开斜靠
const BOX = open => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 70'>${open ? `<g transform='rotate(-24 14 22)'><path d='M14 10 H66 L72 16 V24 H8 V16Z' fill='#7A1F1A' stroke='${C.gold}' stroke-width='1.6'/></g>` : `<path d='M14 14 H66 L72 20 V28 H8 V20Z' fill='#8E241E' stroke='${C.gold}' stroke-width='1.6'/><path d='M34 14 H46 V28 H34Z' fill='${C.gold}' opacity='.9'/>`}<path d='M8 28 H72 V56 L66 62 H14 L8 56Z' fill='#6A1A16' stroke='${C.gold}' stroke-width='1.6'/><path d='M14 34 H66 V54 H14Z' fill='none' stroke='${C.goldD}' stroke-width='1'/>${open ? `<circle cx='32' cy='30' r='3' fill='${C.goldL}' opacity='.5'/><circle cx='46' cy='29' r='2' fill='${C.goldL}' opacity='.4'/>` : `<path d='M40 36 L45 44 L40 52 L35 44Z' fill='${C.gold}'/>`}</svg>`;
// 花窗：八角窗框＋四角回纹
const WINF = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M14 2 H86 L98 14 V86 L86 98 H14 L2 86 V14Z' fill='none' stroke='${C.gold}' stroke-width='2.4' vector-effect='non-scaling-stroke'/><path d='M17 6 H83 L94 17 V83 L83 94 H17 L6 83 V17Z' fill='none' stroke='${C.goldD}' stroke-width='1' vector-effect='non-scaling-stroke'/></svg>`;
const WAVE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M15 4 L26 15 L15 26 L4 15Z' fill='none' stroke='${C.gold}' stroke-width='1.6'/><path d='M15 10 L20 15 L15 20 L10 15Z' fill='${C.gold}'/></svg>`;
const PIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 36'><path d='M9 2 H21 L28 9 V19 L15 34 L2 19 V9Z' fill='${C.gold}' stroke='${C.goldL}' stroke-width='1.4'/><path d='M15 9 L20 14 L15 19 L10 14Z' fill='${C.ink}'/></svg>`;

const bubble = { myBg: C.gold, myText: C.ink, myBorder: "none", charBg: C.ink2, charText: C.cream, charBorder: "none", radius: 0, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 八角 · 墨金 · 第一批 ───── */
[data-wk="chat"]{background:${svg(LATTICE)} 0 0/60px 60px,radial-gradient(ellipse at 50% 30%,#1F1B14,${C.ink} 70%) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：墨底，下沿一条细回纹金带 */
[data-wk="chathead"]{background:linear-gradient(180deg,#0C0B09,${C.ink2}) !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important;gap:6px !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:8px !important;background:${svg(FRET)} 0 0/16px 8px repeat-x !important;pointer-events:none !important;opacity:.85 !important}
[data-wk="chathead"]::before{content:none !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:8px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.goldL} !important;letter-spacing:.06em !important}
[data-wk="headdim"]{color:${C.dim} !important;white-space:nowrap !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.gold} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/32px no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/32px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：切成八角，外面一圈八角金框，四个斜角嵌金珠 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:0 !important;box-shadow:none !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:0 !important;clip-path:${OCT("29%")} !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-6% !important;background:${svg(OFRAME)} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important;border:none !important;border-radius:0 !important}

/* 顶栏头像也套八角金框 */
[data-wk="chathead"] button:has(> img[data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"])::before{content:"" !important;position:absolute !important;left:-3px !important;top:50% !important;width:42px !important;height:42px !important;margin:-21px 0 0 0 !important;background:${svg(OFRAME)} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}

/* 气泡：八角牌。外层画金边，::before 垫里面那块底（比外层缩进一圈） */
[data-wk="bubble"][data-kind="text"]{position:relative !important;isolation:isolate !important;border:none !important;border-radius:0 !important;clip-path:${OCT("8px")} !important;box-shadow:none !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;inset:1.6px !important;clip-path:${OCT("7.4px")} !important;z-index:-1 !important;border:none !important;transform:none !important;width:auto !important;height:auto !important;top:1.6px !important;left:1.6px !important;right:1.6px !important;bottom:1.6px !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
/* 我的话：金牌，墨字 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.goldD} !important;color:${C.ink} !important;font-weight:500 !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{background:linear-gradient(180deg,#E3C47E,${C.gold} 55%,#B8944D) !important}
/* 他的话：墨底金边 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.gold} !important;color:${C.cream} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{background:linear-gradient(180deg,#262119,${C.ink2}) !important}

/* 时间：两道细金线夹两颗空心菱形 */
[data-wk="time"]{display:flex !important;justify-content:center !important}
[data-wk="time"] > span{display:inline-flex !important;align-items:center !important;justify-content:center !important;gap:8px !important;background:transparent !important;border:none !important;color:${C.gold} !important;font-family:serif !important;letter-spacing:.15em !important;font-size:12px !important;box-shadow:none !important;padding:2px 0 !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;display:inline-block !important;width:64px !important;height:10px !important;background:${svg(DIAO)} right center/10px 10px no-repeat,linear-gradient(${C.goldD},${C.goldD}) left center/calc(100% - 14px) 1px no-repeat !important}
[data-wk="time"] > span::after{transform:scaleX(-1) !important}
/* 已读：一枚八角小金印刻「阅」；已送达只留一行小字 */
[data-wk="meta"]{color:${C.dim} !important;font-size:10.5px !important;font-family:serif !important;letter-spacing:.08em !important}
[data-wk="meta"]{display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"][data-read="1"]::before{content:"" !important;display:inline-block !important;width:15px !important;height:15px !important;flex:none !important;background:${svg(SQ("阅", true))} center/contain no-repeat !important;order:-1 !important}
[data-wk="meta"][data-read="0"]::after{content:"" !important;display:inline-block !important;width:15px !important;height:15px !important;flex:none !important;background:${svg(SQ("达", false))} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.ink2} !important;border:1.4px solid ${C.gold} !important;border-radius:0 !important;clip-path:${OCT("9px")} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{width:8px !important;height:8px !important;border-radius:0 !important;background:${svg(DIA())} center/contain no-repeat !important}
[data-wk="name"]{color:${C.gold} !important}

/* 动描：不进框——上下两道往两头淡出的金线，正中断开嵌菱形（上实下空），字是正体、字距松 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:linear-gradient(90deg,transparent,${C.goldD} 25%,${C.goldD} calc(50% - 12px),transparent calc(50% - 12px),transparent calc(50% + 12px),${C.goldD} calc(50% + 12px),${C.goldD} 75%,transparent) center top/100% 1px no-repeat,linear-gradient(90deg,transparent,${C.goldD} 25%,${C.goldD} calc(50% - 12px),transparent calc(50% - 12px),transparent calc(50% + 12px),${C.goldD} calc(50% + 12px),${C.goldD} 75%,transparent) center bottom/100% 1px no-repeat !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#CDBE9C !important;font-style:normal !important;font-family:serif !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.12em !important;padding:16px 22px !important;text-align:center !important}
[data-wk="narrink"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-5px !important;width:10px !important;height:10px !important;margin-left:-5px !important;background:${svg(DIA())} center/contain no-repeat !important}
[data-wk="narrink"]::after{content:"" !important;position:absolute !important;left:50% !important;bottom:-5px !important;width:10px !important;height:10px !important;margin-left:-5px !important;background:${svg(DIAO)} center/contain no-repeat !important}
/* 系统提示：不带框的一行小字，前面一颗空心金菱 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.dim} !important;font-size:11.5px !important;font-style:normal !important;font-family:serif !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:9px !important;height:9px !important;margin-right:6px !important;vertical-align:0 !important;background:${svg(DIAO)} center/contain no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.dim} !important}

/* 底栏：墨底，上沿一条回纹金带；输入框是墨底金边的长八角 */
[data-wk="composer"]{background:${C.ink2} !important;border-top:none !important;position:relative !important;overflow:visible !important;align-items:center !important;gap:8px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:-5px !important;height:10px !important;background:${svg(DIAO)} center/10px 10px no-repeat,linear-gradient(90deg,${C.goldD} calc(50% - 9px),transparent calc(50% - 9px),transparent calc(50% + 9px),${C.goldD} calc(50% + 9px)) center/100% 1px no-repeat !important;pointer-events:none !important}
[data-wk="chatinput"]{background:#1A1712 !important;border:1.4px solid ${C.goldD} !important;border-radius:9px !important;color:${C.cream} !important}
[data-wk="chatinput"]::placeholder{color:${C.dim} !important}
[data-wk="chatplus"],[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:36px !important;min-width:36px !important;height:36px !important;border:none !important;border-radius:0 !important;box-shadow:none !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:${C.ink2} !important;border-top:1.4px solid ${C.goldD} !important}
/* ───── 八角 · 墨金 · 第二批：卡片 ───── */
/* 卡片统一：墨底、金边、切八角（外层金、里层墨，跟气泡同一个办法） */
[data-wk="photocard"],[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:linear-gradient(180deg,#262119,${C.ink2}) !important;border:1.4px solid ${C.gold} !important;border-radius:6px !important;box-shadow:0 0 0 3px ${C.ink},0 0 0 4px ${C.goldD} !important;color:${C.cream} !important}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.cream} !important;border-color:rgba(201,164,92,.35) !important}

/* 转账＝一块八角金令牌：顶上挂红绳金环，正中刻金额；收下＝牌面亮起、盖金印「收」；退回＝牌面发灰 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;isolation:isolate !important;margin-top:34px !important;background:${C.gold} !important;border:none !important;border-radius:0 !important;clip-path:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;inset:0 !important;z-index:-1 !important;background:linear-gradient(${C.goldD},${C.goldD}) !important;clip-path:${OCT("16px")} !important}
[data-wk="transfercard"] > *{position:relative !important}
[data-wk="transfercard"]{background:transparent !important}
[data-wk="transfercard"]::after{content:"" !important;position:absolute !important;left:50% !important;top:-34px !important;width:40px !important;height:34px !important;margin-left:-20px !important;background:${svg(CORD)} center bottom/contain no-repeat !important;z-index:2 !important}
[data-wk="transfercard"] > :first-child{clip-path:${OCT("15px")} !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:rgba(18,16,13,.25) !important}
[data-wk="transfercard"]{--og-face:linear-gradient(180deg,#E3C47E,${C.gold} 55%,#B8944D)}
[data-wk="transfercard"] > *{background:transparent !important}
[data-wk="transfercard"]::before{inset:0 !important;background:radial-gradient(circle at 50% 0,rgba(255,248,220,.35),transparent 55%),linear-gradient(180deg,#E8CB86,${C.gold} 50%,#B08B45) !important}
[data-wk="transfercard"]{background-clip:padding-box !important}
[data-wk="transferlabel"]{color:#5A4520 !important;letter-spacing:.2em !important;font-family:serif !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.ink} !important;font-family:serif !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:8px !important;background:${svg(DIA(C.ink, C.ink))} center/8px 8px no-repeat,linear-gradient(90deg,transparent,rgba(18,16,13,.5) 20%,rgba(18,16,13,.5) calc(50% - 8px),transparent calc(50% - 8px),transparent calc(50% + 8px),rgba(18,16,13,.5) calc(50% + 8px),rgba(18,16,13,.5) 80%,transparent) center/100% 1px no-repeat !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(18,16,13,.12) !important}
[data-wk="transferbtn"]{border-radius:0 !important;clip-path:${OCT("6px")} !important;font-family:serif !important;letter-spacing:.15em !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.ink} !important;color:${C.goldL} !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:rgba(18,16,13,.15) !important;color:${C.ink} !important;border:none !important}
[data-wk="transferseal"]{background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M12 2 H28 L38 12 V28 L28 38 H12 L2 28 V12Z' fill='none' stroke='${C.ink}' stroke-width='1.4'/></svg>`)} center/contain no-repeat !important;border:none !important;color:${C.ink} !important;border-radius:0 !important;box-shadow:none !important;font-family:serif !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:44px !important;height:44px !important;flex-shrink:0 !important;border:none !important;clip-path:none !important;background:${svg(SQ("收", true).replace(C.gold, "#A3322A").replace(C.gold, "#A3322A"))} center/contain no-repeat !important;transform:rotate(-8deg) !important}
[data-wk="transfercard"][data-status="returned"]{filter:grayscale(.85) brightness(.75) !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:44px !important;height:44px !important;flex-shrink:0 !important;border:none !important;clip-path:none !important;background:${svg(SQ("退", false))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{display:none !important}

/* 红包＝一只朱漆八角盒：盖上压金菱；领完了盖子掀开斜靠 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:86px !important;padding:16px 16px 16px 96px !important;background:linear-gradient(180deg,#262119,${C.ink2}) !important;border:1.4px solid ${C.gold} !important;border-radius:6px !important;box-shadow:0 0 0 3px ${C.ink},0 0 0 4px ${C.goldD} !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:78px !important;height:68px !important;margin-top:-34px !important;background:${svg(BOX(false))} center/contain no-repeat !important}
[data-wk="rpcard"]::after{content:"漆 盒" !important;position:absolute !important;right:12px !important;bottom:6px !important;font-size:10px !important;letter-spacing:.2em !important;color:${C.dim} !important;font-family:serif !important}
[data-wk="rpcard"] *{color:${C.cream} !important;font-family:serif !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important;color:${C.goldL} !important}
[data-wk="rpcard"][data-status="done"]{opacity:.8 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(BOX(true))} center/contain no-repeat !important}
[data-wk="rpcard"][data-status="done"]::after{content:"已 启" !important}
[data-wk="rpenvelope"][data-stage="closed"],[data-wk="rpenvelope"][data-stage="open"]{background:${svg(LATTICE)} 0 0/60px 60px,linear-gradient(180deg,#7A1F1A,#4A120F) !important;border:2px solid ${C.gold} !important;border-radius:0 !important;clip-path:${OCT("26px")} !important;box-shadow:none !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:${C.ink2} !important;border-color:${C.gold} !important;box-shadow:none !important}
[data-wk="rpenvelope"] [data-wk="rparc"]::after{content:none !important}
[data-wk="rpenvelope"] *{color:${C.goldL} !important;font-family:serif !important}
[data-wk="rpopenbtn"]{background:${svg(OBTN(`<text x='20' y='26' text-anchor='middle' font-size='15' font-weight='700' fill='${C.ink}' font-family='serif'>啟</text>`))} center/contain no-repeat !important;border:none !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpavatar"]{border-radius:0 !important;clip-path:${OCT("29%")} !important;box-shadow:none !important;outline:2px solid ${C.gold} !important}
[data-wk="rpamount"]{color:${C.goldL} !important;background:none !important;font-family:serif !important}
[data-wk="rpclose"]{background:${C.ink2} !important;border:1.4px solid ${C.gold} !important;color:${C.gold} !important;border-radius:0 !important;clip-path:${OCT("30%")} !important}

/* 照片＝一扇八角花窗，照片嵌在窗里 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;padding:12px 12px 26px !important;border:none !important;box-shadow:none !important;background:${C.ink2} !important;border-radius:0 !important;clip-path:${OCT("14%")} !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;inset:0 !important;background:${svg(WINF)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:2 !important}
[data-wk="photoface"]{background:${svg(LATTICE)} 0 0/40px 40px,linear-gradient(170deg,#2A251D,#14110D) !important;border:none !important;border-radius:0 !important;clip-path:${OCT("12px")} !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:${C.cream} !important;font-family:serif !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.dim} !important;font-family:serif !important}

/* 语音：墨底金边，前面一颗实心菱形，波纹是一根根金线 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.cream} !important}
[data-wk="voice"][data-me]{padding:0 12px 0 34px !important;position:relative !important;border-radius:0 !important;clip-path:${OCT("8px")} !important;box-shadow:none !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:12px !important;height:12px !important;margin-top:-6px !important;background:${svg(DIA())} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:linear-gradient(180deg,#E3C47E,${C.gold} 55%,#B8944D) !important;border:none !important}
[data-wk="voice"][data-me="1"] *{color:${C.ink} !important}
[data-wk="voice"][data-me="1"]::before{background:${svg(DIA(C.ink, C.ink))} center/contain no-repeat !important}
[data-wk="voicewave"] span{background:${C.gold} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:${C.ink} !important}

/* 天气：墨底窗格，图标金线；下面一行写他说的 */
[data-wk="wxcardsky"]{background:${svg(LATTICE)} 0 0/40px 40px,linear-gradient(170deg,#2A251D,#14110D) !important}
[data-wk="wxcardsky"] *{color:${C.cream} !important;font-family:serif !important}
[data-wk="wxcardsky"] svg{stroke:${C.gold} !important}
[data-wk="wxcardsay"]{background:${C.ink} !important;color:${C.goldL} !important;border-top:1px solid ${C.goldD} !important;font-family:serif !important}
/* 位置：一枚八角金钉 */
[data-wk="geopin"]{background:${svg(PIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:24px !important;height:30px !important;border-radius:0 !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.gold} !important}
/* 名片 */
[data-wk="namecard"] img{border-radius:0 !important;clip-path:${OCT("29%")} !important;box-shadow:none !important}

/* 拍一拍、通话结束：一行小字，两头各一颗空心菱 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${svg(DIAO)} left center/9px 9px no-repeat,${svg(DIAO)} right center/9px 9px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 18px !important;color:${C.dim} !important;box-shadow:none !important;font-family:serif !important;letter-spacing:.08em !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.gold} !important}
[data-wk="note"][data-part="callsum"]{color:${C.dim} !important}

/* 线下小结：一卷题签——标题是竖着的金签条贴在左上，正文是墨底金边 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:28px !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;right:12px !important;top:12px !important;width:24px !important;height:24px !important;background:${svg(WAVE)} center/contain no-repeat !important;opacity:.8 !important}
[data-wk="offlogtitle"]{display:inline-block !important;position:absolute !important;top:-13px !important;left:16px !important;margin:0 !important;padding:4px 16px !important;background:linear-gradient(180deg,#E3C47E,${C.gold}) !important;color:${C.ink} !important;border-radius:0 !important;clip-path:${OCT("6px")} !important;letter-spacing:.2em !important;font-family:serif !important}
[data-wk="offlogtitle"] *{color:${C.ink} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.gold} !important}
[data-wk="offlogtranscript"]{border-top:1px solid ${C.goldD} !important;color:${C.dim} !important}

/* 加号面板：一格格墨底八角金边 */
[data-wk="chatpanel"] *{color:${C.cream} !important}
[data-wk="chattoolicon"]{background:${svg(OBTN("", C.ink, C.gold))} center/contain no-repeat !important;border:none !important;border-radius:0 !important;box-shadow:none !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.gold} !important;color:${C.gold} !important}
[data-wk="chattoollabel"]{color:${C.dim} !important;font-family:serif !important}

/* 引用三处：待发送那条＝墨底金线条；气泡上方＝一行淡金小字带菱形；气泡里＝左边一道金线 */
[data-wk="quotedraft"]{background:${C.ink} !important;border:1px solid ${C.goldD} !important;border-radius:6px !important;position:relative !important;padding-left:28px !important}
[data-wk="quotedraft"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:9px !important;height:9px !important;margin-top:-4.5px !important;background:${svg(DIAO)} center/contain no-repeat !important}
[data-wk="quotedraft"] *{background:transparent !important;color:${C.dim} !important;border:none !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.gold} !important}
[data-wk="quote"]{background:rgba(201,164,92,.08) !important;color:${C.dim} !important;border:none !important;border-left:2px solid ${C.goldD} !important;border-radius:0 !important;padding:3px 10px !important;opacity:1 !important;font-family:serif !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.75 !important}
`;

const pack = { kind: "chat-look", v: 1, name: "八角墨金", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "八角墨金-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
