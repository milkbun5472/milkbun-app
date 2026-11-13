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
const OFRAME = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M30 3 H70 L97 30 V70 L70 97 H30 L3 70 V30Z' fill='none' stroke='${C.gold}' stroke-width='3.2' stroke-linejoin='round'/><path d='M32 8 H68 L92 32 V68 L68 92 H32 L8 68 V32Z' fill='none' stroke='${C.goldD}' stroke-width='1.2'/>${[[16.5, 16.5], [83.5, 16.5], [83.5, 83.5], [16.5, 83.5]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='4' fill='${C.goldL}' stroke='${C.goldD}' stroke-width='1'/>`).join("")}</svg>`;
// 八角金印「阅」
const SEAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M12 1.5 H28 L38.5 12 V28 L28 38.5 H12 L1.5 28 V12Z' fill='${C.gold}' stroke='${C.goldL}' stroke-width='1.4'/><path d='M13.5 5 H26.5 L35 13.5 V26.5 L26.5 35 H13.5 L5 26.5 V13.5Z' fill='none' stroke='${C.ink}' stroke-width='1'/><text x='20' y='26.5' text-anchor='middle' font-size='17' font-weight='700' fill='${C.ink}' font-family='serif'>阅</text></svg>`;
const OBTN = (inner, fill = C.gold, stroke = C.goldL) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M12 2 H28 L38 12 V28 L28 38 H12 L2 28 V12Z' fill='${fill}' stroke='${stroke}' stroke-width='1.6'/>${inner}</svg>`;
const I_PLUS = OBTN(`<path d='M20 12 V28 M12 20 H28' stroke='${C.gold}' stroke-width='2.4' stroke-linecap='round'/>`, C.ink2, C.gold);
const I_SEND = OBTN(`<path d='M12 20 H27 M21 14 L27 20 L21 26' fill='none' stroke='${C.ink}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>`);
const I_HOUSE = OBTN(`<path d='M12 20 L20 13 L28 20 V28 H12Z' fill='none' stroke='${C.gold}' stroke-width='1.8' stroke-linejoin='round'/>`, C.ink2, C.gold);
const I_MORE = OBTN(`<g fill='${C.gold}'><path d='M12 20 l2 -2 l2 2 l-2 2z'/><path d='M18 20 l2 -2 l2 2 l-2 2z'/><path d='M24 20 l2 -2 l2 2 l-2 2z'/></g>`, C.ink2, C.gold);

const bubble = { myBg: C.gold, myText: C.ink, myBorder: "none", charBg: C.ink2, charText: C.cream, charBorder: "none", radius: 0, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 八角 · 墨金 · 第一批 ───── */
[data-wk="chat"]{background:${svg(LATTICE)} 0 0/60px 60px,radial-gradient(ellipse at 50% 30%,#1F1B14,${C.ink} 70%) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：墨底，下沿一条回纹金带，带下吊五只小金铃 */
[data-wk="chathead"]{background:linear-gradient(180deg,#0C0B09,${C.ink2}) !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important;gap:6px !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:12px !important;background:${svg(FRET)} 0 0/24px 12px repeat-x !important;pointer-events:none !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% + 11px) !important;height:26px !important;background:${svg(BELL)} 10% 0/14px 22px no-repeat,${svg(BELL)} 30% 0/14px 22px no-repeat,${svg(BELL)} 50% 0/14px 22px no-repeat,${svg(BELL)} 70% 0/14px 22px no-repeat,${svg(BELL)} 90% 0/14px 22px no-repeat !important;pointer-events:none !important;transform-origin:50% 0 !important;animation:ogSway 3.2s ease-in-out infinite !important}
@keyframes ogSway{0%,100%{transform:translateX(0)}50%{transform:translateX(1.5px)}}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:30px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.goldL} !important;letter-spacing:.06em !important}
[data-wk="headdim"]{color:${C.dim} !important;white-space:nowrap !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.gold} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/28px no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/28px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：切成八角，外面一圈八角金框，四个斜角嵌金珠 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:0 !important;box-shadow:none !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:0 !important;clip-path:${OCT("29%")} !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-12% !important;background:${svg(OFRAME)} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important;border:none !important;border-radius:0 !important}

/* 顶栏头像也套八角金框 */
[data-wk="chathead"] button:has(> img[data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"])::before{content:"" !important;position:absolute !important;left:-5px !important;top:50% !important;width:46px !important;height:46px !important;margin:-23px 0 0 0 !important;background:${svg(OFRAME)} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}

/* 气泡：八角牌。外层画金边，::before 垫里面那块底（比外层缩进一圈） */
[data-wk="bubble"][data-kind="text"]{position:relative !important;isolation:isolate !important;border:none !important;border-radius:0 !important;clip-path:${OCT("11px")} !important;box-shadow:none !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;inset:1.6px !important;clip-path:${OCT("10.3px")} !important;z-index:-1 !important;border:none !important;transform:none !important;width:auto !important;height:auto !important;top:1.6px !important;left:1.6px !important;right:1.6px !important;bottom:1.6px !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
/* 我的话：金箔牌，墨字，一道斜着的亮光 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.goldD} !important;color:${C.ink} !important;font-weight:600 !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{background:linear-gradient(115deg,transparent 0 30%,rgba(255,248,220,.45) 38%,transparent 46%),linear-gradient(180deg,${C.goldL},${C.gold} 60%,#B48E45) !important}
/* 他的话：墨底金边，四角各钉一颗金铆钉 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.gold} !important;color:${C.cream} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{background:radial-gradient(circle at 10px 10px,${C.goldL} 1.8px,transparent 2.3px),radial-gradient(circle at calc(100% - 10px) 10px,${C.goldL} 1.8px,transparent 2.3px),radial-gradient(circle at 10px calc(100% - 10px),${C.goldL} 1.8px,transparent 2.3px),radial-gradient(circle at calc(100% - 10px) calc(100% - 10px),${C.goldL} 1.8px,transparent 2.3px),linear-gradient(180deg,${C.ink3},${C.ink2}) !important}

/* 时间：两道细金线夹两颗空心菱形 */
[data-wk="time"]{display:flex !important;justify-content:center !important}
[data-wk="time"] > span{display:inline-flex !important;align-items:center !important;justify-content:center !important;gap:8px !important;background:transparent !important;border:none !important;color:${C.gold} !important;font-family:serif !important;letter-spacing:.15em !important;font-size:12px !important;box-shadow:none !important;padding:2px 0 !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;display:inline-block !important;width:64px !important;height:10px !important;background:${svg(DIAO)} right center/10px 10px no-repeat,linear-gradient(${C.goldD},${C.goldD}) left center/calc(100% - 14px) 1px no-repeat !important}
[data-wk="time"] > span::after{transform:scaleX(-1) !important}
/* 已读：一枚八角小金印刻「阅」；已送达只留一行小字 */
[data-wk="meta"]{color:${C.dim} !important;font-size:10.5px !important;font-family:serif !important;letter-spacing:.08em !important}
[data-wk="meta"][data-read="1"]::before{content:"" !important;display:inline-block !important;width:15px !important;height:15px !important;margin-right:5px !important;vertical-align:-3px !important;background:${svg(SEAL)} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.ink2} !important;border:1.4px solid ${C.gold} !important;border-radius:0 !important;clip-path:${OCT("9px")} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{width:8px !important;height:8px !important;border-radius:0 !important;background:${svg(DIA())} center/contain no-repeat !important}
[data-wk="name"]{color:${C.gold} !important}

/* 动描：不进框——上下两道从中间往两头淡出的金线，上线正中嵌一颗金菱形，字是淡金色楷意斜体 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:linear-gradient(90deg,transparent,${C.goldD} 30%,${C.goldD} 70%,transparent) center top/100% 1px no-repeat,linear-gradient(90deg,transparent,${C.goldD} 30%,${C.goldD} 70%,transparent) center bottom/100% 1px no-repeat,radial-gradient(ellipse at 50% 50%,rgba(201,164,92,.10),transparent 70%) !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#D9C694 !important;font-style:italic !important;font-family:serif !important;font-size:13px !important;line-height:1.8 !important;letter-spacing:.04em !important;padding:14px 22px !important;text-align:center !important}
[data-wk="narrink"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-5px !important;width:10px !important;height:10px !important;margin-left:-5px !important;background:${svg(DIA())} center/contain no-repeat !important}
[data-wk="narrink"]::after{content:"" !important;position:absolute !important;left:50% !important;bottom:-5px !important;width:10px !important;height:10px !important;margin-left:-5px !important;background:${svg(DIA(C.ink, C.gold))} center/contain no-repeat !important}
/* 系统提示：不带框的一行小字，前面一颗空心金菱 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.dim} !important;font-size:11.5px !important;font-style:normal !important;font-family:serif !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:9px !important;height:9px !important;margin-right:6px !important;vertical-align:0 !important;background:${svg(DIAO)} center/contain no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.dim} !important}

/* 底栏：墨底，上沿一条回纹金带；输入框是墨底金边的长八角 */
[data-wk="composer"]{background:linear-gradient(180deg,${C.ink2},#0C0B09) !important;border-top:none !important;position:relative !important;overflow:visible !important;align-items:center !important;gap:8px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:100% !important;height:12px !important;background:${svg(FRET)} 0 0/24px 12px repeat-x !important;transform:scaleY(-1) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:linear-gradient(${C.goldD},${C.goldD}) left bottom/100% 1.2px no-repeat,${C.ink3} !important;border:none !important;border-radius:0 !important;clip-path:${OCT("8px")} !important;color:${C.cream} !important}
[data-wk="chatinput"]::placeholder{color:${C.dim} !important}
[data-wk="chatplus"],[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{position:relative !important;width:64px !important;min-width:64px !important;height:34px !important;border:none !important;border-radius:0 !important;clip-path:${OCT("9px")} !important;background:${C.gold} !important;box-shadow:none !important}
[data-wk="chatreply"]::before{content:"回复" !important;position:absolute !important;inset:1.6px !important;clip-path:${OCT("8.3px")} !important;display:flex !important;align-items:center !important;justify-content:center !important;background:linear-gradient(180deg,${C.ink3},${C.ink2}) !important;color:${C.goldL} !important;font-size:13px !important;font-family:serif !important;letter-spacing:.2em !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:${C.ink2} !important;border-top:1.4px solid ${C.goldD} !important}

/* 打电话那一屏（语音）：整屏底色跟这套走；三个按键换成这套的扣子，中间挂断单独一色 */
[data-wk="call"][data-video="0"]{background:radial-gradient(circle at 50% 22%,rgba(201,164,92,.18),transparent 55%),linear-gradient(180deg,#1D1A15,#12100D) !important}
[data-wk="call"][data-video="0"] [data-wk="calltitle"]{color:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callhead"] > div:not([data-wk]){color:rgba(255,255,255,.65) !important}
[data-wk="call"][data-video="0"] > button:first-child{background:rgba(255,255,255,.12) !important}
[data-wk="call"][data-video="0"] > button:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button > span:first-child{background:#1D1A15 !important;border-radius:14px !important;box-shadow:0 0 0 1.4px #C9A45C,0 0 0 4px #12100D,0 0 0 5px #8A6A2E !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:#EBD394 !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:#8A6A2E !important;box-shadow:0 0 0 1.4px #EBD394,0 0 14px rgba(201,164,92,.5) !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:rgba(255,255,255,.65) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "八角墨金", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "八角墨金-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
