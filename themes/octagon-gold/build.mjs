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
`;

const pack = { kind: "chat-look", v: 1, name: "八角墨金", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "八角墨金-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
