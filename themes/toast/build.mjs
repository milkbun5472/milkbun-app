// 吐司：奶油底。头像＝一个荷包蛋（头像就是蛋黄），气泡＝一片吐司：鼓鼓的面包顶、一圈烤黄的边；
// 他的是白吐司，我的是烤过的金黄吐司、右边抹一块黄油。用法：node themes/toast/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#FAF5EC", crust: "#B87A3E", crustD: "#8E5A2A", bread: "#FFFCF5", toast: "#E9B66E", toast2: "#DFA45A", butter: "#FFE27A", ink: "#5A3E26", fog: "#B5A48E", yolk: "#FFC93C" };

// 吐司顶：两边比身子宽一点、中间鼓起来的两个圆包
const CAP = (fill) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30' preserveAspectRatio='none'><path d='M8 30 Q1 30 1.5 21 Q2 9 16 8 Q24 0 37 3 Q45 5 50 9 Q55 5 63 3 Q76 0 84 8 Q98 9 98.5 21 Q99 30 92 30Z' fill='${fill}'/><path d='M8.5 30 Q1.5 29.5 1.5 21 Q2 9 16 8 Q24 0 37 3 Q45 5 50 9 Q55 5 63 3 Q76 0 84 8 Q98 9 98.5 21 Q98.5 29.5 91.5 30' fill='none' stroke='${C.crust}' stroke-width='3' vector-effect='non-scaling-stroke' stroke-linejoin='round' stroke-linecap='round'/></svg>`;
// 荷包蛋：一圈不规则的蛋白，头像坐在中间当蛋黄
const EGG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 4 Q64 3 72 12 Q86 10 92 24 Q100 36 94 50 Q100 64 90 74 Q86 90 70 92 Q60 100 46 96 Q30 100 20 88 Q6 84 6 68 Q0 56 6 44 Q2 28 14 20 Q22 6 36 8 Q42 3 50 4Z' fill='#FFFFFF' stroke='#EFE6D6' stroke-width='1.5'/><path d='M22 30 Q26 24 32 23' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round'/></svg>`;
const BUTTER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 20'><path d='M11 18 C4 13 2 10 2 6.8 C2 4.2 4 2.5 6.3 2.5 C8.3 2.5 10 3.6 11 5.3 C12 3.6 13.7 2.5 15.7 2.5 C18 2.5 20 4.2 20 6.8 C20 10 18 13 11 18Z' fill='#D9473F' stroke='#B8352E' stroke-width='1' stroke-linejoin='round'/><path d='M5.5 7 Q6 5 8 4.8' fill='none' stroke='#fff' stroke-width='1.4' stroke-linecap='round' opacity='.8'/><path d='M11 18 Q11.5 19.5 10.8 20' stroke='#D9473F' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const CI = (inner, fill = "none", stroke = C.crust) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='${fill}' stroke='${stroke}' stroke-width='1.6'/>${inner}</svg>`;
// 按键：主页＝一只小烤面包机；更多＝三粒面包屑；加号；发送＝细箭头；最右「让他回复」＝焦糖色圆钮里一个对话框
const I_HOUSE = CI(`<rect x='11' y='16' width='18' height='12' rx='3' fill='none' stroke='${C.ink}' stroke-width='1.5'/><path d='M15 16 V12.5 Q15 11 16.5 11 H18.5 Q20 11 20 12.5 V16 M21 16 V12.5 Q21 11 22.5 11 H24.5 Q26 11 26 12.5 V16' fill='${C.toast}' stroke='${C.ink}' stroke-width='1.3'/><path d='M29 21 H31' stroke='${C.ink}' stroke-width='1.5' stroke-linecap='round'/>`, "#fff");
const I_MORE = CI(`<g fill='${C.crust}'><ellipse cx='13' cy='21' rx='2.4' ry='1.9'/><ellipse cx='20' cy='19' rx='2.2' ry='2.1'/><ellipse cx='27' cy='21' rx='2.4' ry='1.8'/></g>`, "#fff");
// 加号＝一片小吐司，中间一个加号；发送＝一把往右指的黄油刀
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M10 34 V18 Q5 17 5.5 12.5 Q6.5 7 13 7.5 Q16 4 20 6 Q24 4 27 7.5 Q33.5 7 34.5 12.5 Q35 17 30 18 V34Z' fill='${C.bread}' stroke='${C.crust}' stroke-width='2' stroke-linejoin='round'/><g fill='#E6D3B8'><circle cx='15' cy='20' r='1'/><circle cx='22' cy='17' r='.9'/><circle cx='25' cy='25' r='1'/><circle cx='17' cy='28' r='.9'/></g></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect x='4' y='17' width='12' height='6' rx='3' fill='${C.crust}'/><path d='M16 17.5 H30 Q36 17.5 36 20 Q36 22.5 30 22.5 H16Z' fill='#E9E4DA' stroke='#B9B0A2' stroke-width='1.2'/><path d='M18 19.2 H30' stroke='#fff' stroke-width='1' stroke-linecap='round'/><rect x='27' y='13' width='7' height='5' rx='2' fill='${C.butter}' stroke='#E8C24E' stroke-width='1'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 46 46'><circle cx='23' cy='23' r='21' fill='${C.crust}'/><path d='M14 16 H32 Q34 16 34 18 V26 Q34 28 32 28 H22 L17 32 V28 H14 Q12 28 12 26 V18 Q12 16 14 16Z' fill='none' stroke='#fff' stroke-width='2' stroke-linejoin='round'/></svg>`;
const DOT = c => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='3.2' fill='${c}'/></svg>`;

// ── 第二批用的图 ──
const JAR = (st) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 60'><rect x='9' y='4' width='32' height='9' rx='2' fill='${st === "open" ? "none" : "#E7C9A0"}' stroke='${C.crust}' stroke-width='1.6' ${st === "open" ? "stroke-dasharray='2 2'" : ""}/>${st === "open" ? `<rect x='26' y='-2' width='20' height='8' rx='2' transform='rotate(24 36 2)' fill='#E7C9A0' stroke='${C.crust}' stroke-width='1.4'/>` : ``}<path d='M8 13 H42 Q46 13 46 18 V52 Q46 57 41 57 H9 Q4 57 4 52 V18 Q4 13 8 13Z' fill='rgba(255,255,255,.7)' stroke='${C.crust}' stroke-width='1.8'/>${st === "empty" ? `` : `<path d='M6 ${st === "open" ? 34 : 24} Q25 ${st === "open" ? 30 : 20} 44 ${st === "open" ? 34 : 24} V52 Q44 55 41 55 H9 Q6 55 6 52Z' fill='#D9473F'/>`}<rect x='12' y='30' width='26' height='14' rx='2' fill='#FFFCF5' stroke='${C.crust}' stroke-width='1'/><circle cx='20' cy='37' r='2.2' fill='#D9473F'/><circle cx='26' cy='36' r='2.2' fill='#D9473F'/><path d='M23 34 Q24 31 26 31' stroke='#6F9060' stroke-width='1.2' fill='none'/>${st === "open" ? `<path d='M38 18 L46 2' stroke='#B8B8B8' stroke-width='3' stroke-linecap='round'/>` : ``}</svg>`;
const TOASTER = (pop) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 60'>${pop ? `` : `<path d='M18 22 V10 Q18 5 24 5 H30 Q34 5 34 10 V22Z' fill='${C.toast}' stroke='${C.crust}' stroke-width='1.6'/><path d='M36 22 V8 Q36 3 42 3 H48 Q52 3 52 8 V22Z' fill='${C.toast}' stroke='${C.crust}' stroke-width='1.6'/>`}<rect x='6' y='20' width='58' height='34' rx='10' fill='#F4E3CF' stroke='${C.crust}' stroke-width='2'/><path d='M18 20 H34 M36 20 H52' stroke='${C.crustD}' stroke-width='3' stroke-linecap='round'/><circle cx='54' cy='36' r='3' fill='${C.crust}'/><path d='M12 54 V58 M58 54 V58' stroke='${C.crust}' stroke-width='2.4' stroke-linecap='round'/>${pop ? `<g fill='none' stroke='${C.fog}' stroke-width='1.4' stroke-linecap='round'><path d='M24 14 Q22 10 25 6'/><path d='M44 14 Q42 10 45 6'/></g>` : ``}</svg>`;
const EGGPIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M15 2 Q22 1 25 6 Q30 9 28 16 Q30 23 24 26 Q18 30 11 27 Q3 27 3 19 Q0 12 5 8 Q8 2 15 2Z' fill='#fff' stroke='#E6DCCB'/><circle cx='15' cy='15' r='6' fill='${C.yolk}'/><circle cx='13' cy='13' r='1.6' fill='#fff' opacity='.8'/></svg>`;
const CUP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 10 H17 V16 Q17 20 13 20 H8 Q4 20 4 16Z' fill='#F4E3CF' stroke='${C.crust}' stroke-width='1.5'/><path d='M17 12 Q21 12 21 14.5 Q21 17 17 17' fill='none' stroke='${C.crust}' stroke-width='1.5'/><path d='M8 7 Q7 5 8.5 3 M12 7 Q11 5 12.5 3' fill='none' stroke='${C.fog}' stroke-width='1.3' stroke-linecap='round'/></svg>`;
const CRUMBS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 8'><g fill='${C.crust}'><ellipse cx='3' cy='5' rx='1.8' ry='1.4'/><ellipse cx='8' cy='3' rx='1.4' ry='1.3'/><ellipse cx='12' cy='5.5' rx='1.2' ry='1'/></g></svg>`;
const CARD = `background:${C.bread} !important;border:2.5px solid ${C.crust} !important;border-radius:14px !important;box-shadow:0 3px 0 #E6D3B8 !important;color:${C.ink} !important`;

const EGG2 = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M15 2 Q22 1 25 6 Q30 9 28 16 Q30 23 24 26 Q18 30 11 27 Q3 27 3 19 Q0 12 5 8 Q8 2 15 2Z' fill='#fff' stroke='#E6DCCB'/><circle cx='15.5' cy='15' r='6.5' fill='${C.yolk}'/><circle cx='13.5' cy='13' r='1.8' fill='#fff' opacity='.85'/></svg>`;
// 煎蛋的小铲子：带孔的铲面＋木柄
const SPATULA = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 48'><path d='M4 3 H20 Q21 3 21 4 V17 Q21 20 18 20 H6 Q3 20 3 17 V4 Q3 3 4 3Z' fill='#E9E4DA' stroke='#9C9285' stroke-width='1.3'/><g fill='#9C9285'><rect x='7' y='6' width='2' height='9' rx='1'/><rect x='11' y='6' width='2' height='9' rx='1'/><rect x='15' y='6' width='2' height='9' rx='1'/></g><path d='M10.5 20 H13.5 V27 H10.5Z' fill='#B9B0A2'/><rect x='9' y='27' width='6' height='19' rx='3' fill='${C.crust}' stroke='${C.crustD}' stroke-width='1'/><circle cx='12' cy='42' r='1.1' fill='${C.bg}'/></svg>`;
// 好感：一片吐司，好感越高烤得越黄——白吐司底，上面叠一片烤金黄的，透明度跟着好感走
const SLICE = (fill, crust) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><path d='M12 56 V25 Q4 24 4.5 16.5 Q6 7 16 8 Q21 2 30 4.5 Q39 2 44 8 Q54 7 55.5 16.5 Q56 24 48 25 V56Z' fill='${fill}' stroke='${crust}' stroke-width='3.5' stroke-linejoin='round'/></svg>`;
const SLICEFACE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><circle cx='23' cy='34' r='2' fill='${C.ink}'/><circle cx='37' cy='34' r='2' fill='${C.ink}'/><path d='M27 39 Q30 42 33 39' fill='none' stroke='${C.ink}' stroke-width='1.6' stroke-linecap='round'/><circle cx='19' cy='39' r='2.6' fill='#F2A3A0' opacity='.6'/><circle cx='41' cy='39' r='2.6' fill='#F2A3A0' opacity='.6'/></svg>`;
const bubble = { myBg: C.toast, myText: C.ink, myBorder: "none", charBg: C.bread, charText: C.ink, charBorder: "none", radius: 8, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 吐司 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(circle at 20% 30%,rgba(233,182,110,.08),transparent 40%),${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：奶油底，底下一条细线（不做框） */
[data-wk="chathead"]{background:${C.bg} !important;border-bottom:none !important;box-shadow:0 1px 0 #EFE4D2 !important;gap:6px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.08em !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:${C.ink} !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：一个荷包蛋，头像就是蛋黄（描一圈蛋黄色） */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.yolk} !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important;border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-34% !important;background:${svg(EGG)} center/contain no-repeat !important;z-index:-1 !important;pointer-events:none !important;filter:drop-shadow(0 2px 3px rgba(140,100,60,.15)) !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before{content:none !important}
[data-wk="msg"] [data-wk="row"]{gap:14px !important}

/* 气泡：一片吐司——一圈烤黄的面包边，顶上一个比身子略宽、中间鼓起的面包顶 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border:3px solid ${C.crust} !important;border-top:none !important;border-radius:0 0 12px 12px !important;padding:6px 18px 10px !important;margin-top:22px !important;color:${C.ink} !important;letter-spacing:.06em !important;box-shadow:0 3px 6px rgba(140,100,60,.12) !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;left:-8px !important;right:-8px !important;top:-22px !important;height:24px !important;background:${svg(CAP(C.bread))} center/100% 100% no-repeat !important;border:none !important;transform:none !important;bottom:auto !important;width:auto !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.bread} !important}
/* 我的：烤过的金黄吐司，右边抹一块黄油 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,${C.toast},${C.toast2}) !important;padding-right:38px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{background:${svg(CAP(C.toast))} center/100% 100% no-repeat !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;right:10px !important;top:50% !important;width:20px !important;height:18px !important;margin-top:-10px !important;background:${svg(BUTTER)} center/contain no-repeat !important;border:none !important;transform:rotate(-8deg) !important;left:auto !important;bottom:auto !important}

/* 时间：一行淡棕小字 */
[data-wk="time"] > span{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;letter-spacing:.15em !important;font-size:11.5px !important}
/* 已读＝后面一颗焦糖色小点；已送达＝浅灰小点 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::after{content:"" !important;width:8px !important;height:8px !important;flex:none !important;background:${svg(DOT("#D9CCB8"))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(DOT(C.crust))} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.bread} !important;border:3px solid ${C.crust} !important;border-radius:12px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.crust} !important}
[data-wk="name"]{color:${C.fog} !important}

/* 动描：没有框，棕色斜体，左边一道虚线（像撒的面包屑） */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{background:transparent !important;border:none !important;border-left:2px dotted ${C.crust} !important;border-radius:0 !important;box-shadow:none !important;color:#8E7258 !important;font-style:italic !important;font-size:13px !important;line-height:1.8 !important;padding:2px 0 2px 14px !important}
/* 系统提示：一行小字 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.08em !important}

/* 底栏：白底一条，输入框浅灰胶囊；加号、发送是细圈，最右「让他回复」是焦糖色圆钮 */
[data-wk="composer"]{background:#fff !important;border-top:none !important;box-shadow:0 -1px 0 #EFE4D2,0 -4px 12px rgba(140,100,60,.05) !important;align-items:center !important;gap:10px !important}
[data-wk="chatinput"]{background:#F5F1EA !important;border:none !important;border-radius:12px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#BFB3A2 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:44px !important;min-width:44px !important;height:44px !important;border-radius:50% !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:#fff !important;border-top:1px solid #EFE4D2 !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
/* ───── 吐司 · 第二批：卡片 ───── */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{${CARD}}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:rgba(184,122,62,.3) !important}

/* 转账＝一罐草莓果酱：金额写在罐子上；收下罐子打开插一把勺，退回罐子空了 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;${CARD};padding-left:64px !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:44px !important;height:54px !important;margin-top:-30px !important;background:${svg(JAR("full"))} center/contain no-repeat !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:rgba(184,122,62,.3) !important}
[data-wk="transferlabel"]{color:${C.fog} !important;letter-spacing:.2em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#C2453E !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:8px !important;background:${svg(CRUMBS)} center/14px 8px no-repeat,linear-gradient(90deg,transparent,#E6D3B8 20%,#E6D3B8 calc(50% - 10px),transparent calc(50% - 10px),transparent calc(50% + 10px),#E6D3B8 calc(50% + 10px),#E6D3B8 80%,transparent) center/100% 1.5px no-repeat !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:#F7EEDF !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.crust} !important;color:#fff !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:#fff !important;color:${C.crust} !important;border:1.5px solid ${C.crust} !important}
[data-wk="transferseal"]{background:transparent !important;border:1.5px solid ${C.crust} !important;color:${C.crust} !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"]::before{background:${svg(JAR("open"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"]::before{background:${svg(JAR("empty"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.8 !important}

/* 红包＝一台烤面包机，两片吐司探出头；领完了吐司被拿走、只剩两缕热气 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:84px !important;padding:16px 16px 16px 88px !important;${CARD}}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:68px !important;height:58px !important;margin-top:-30px !important;background:${svg(TOASTER(false))} center/contain no-repeat !important}
[data-wk="rpcard"]::after{content:"刚烤好" !important;position:absolute !important;right:12px !important;bottom:6px !important;font-size:10px !important;letter-spacing:.2em !important;color:${C.fog} !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important;color:${C.crustD} !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(TOASTER(true))} center/contain no-repeat !important}
[data-wk="rpcard"][data-status="done"]::after{content:"被拿走啦" !important}
[data-wk="rpenvelope"][data-stage="closed"],[data-wk="rpenvelope"][data-stage="open"]{background:linear-gradient(180deg,${C.toast},${C.toast2}) !important;border:4px solid ${C.crust} !important;border-radius:60px 60px 22px 22px / 40px 40px 22px 22px !important;box-shadow:0 10px 30px rgba(140,100,60,.35) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:${C.bread} !important;border-color:${C.crust} !important;box-shadow:none !important}
[data-wk="rpenvelope"] [data-wk="rparc"]::after{content:none !important}
[data-wk="rpenvelope"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:${svg(EGGPIN)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 3px 4px rgba(140,100,60,.3)) !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.yolk} !important}
[data-wk="rpamount"]{color:${C.crustD} !important;background:none !important}
[data-wk="rpclose"]{background:#fff !important;border:2px solid ${C.crust} !important;color:${C.crust} !important}

/* 照片＝嵌在一片吐司里：面包边当相框 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:${C.bread} !important;border:5px solid ${C.toast2} !important;border-top:none !important;border-radius:0 0 16px 16px !important;padding:8px 8px 22px !important;margin-top:24px !important;box-shadow:0 3px 6px rgba(140,100,60,.15) !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;left:-10px !important;right:-10px !important;top:-24px !important;height:26px !important;background:${svg(CAP(C.bread).replace(/stroke='[^']*' stroke-width='3'/, `stroke='${C.toast2}' stroke-width='5'`))} center/100% 100% no-repeat !important}
[data-wk="photoface"]{background:#F4E3CF !important;border:none !important;border-radius:6px !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:${C.ink} !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.fog} !important}

/* 语音：前面一杯冒热气的牛奶 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"][data-me]{padding:0 14px 0 38px !important;position:relative !important;border-radius:999px !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:11px !important;top:50% !important;width:20px !important;height:20px !important;margin-top:-11px !important;background:${svg(CUP)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:linear-gradient(180deg,${C.toast},${C.toast2}) !important}
[data-wk="voicewave"] span{background:${C.crust} !important}

[data-wk="wxcardsky"]{background:linear-gradient(170deg,#FFE7B8,#F6C98A) !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.crust} !important}
[data-wk="wxcardsay"]{background:${C.bread} !important;color:${C.ink} !important;border-top:1.5px dashed #E6D3B8 !important}
/* 位置：一颗荷包蛋当图钉 */
[data-wk="geopin"]{background:${svg(EGGPIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:28px !important;height:28px !important;border-radius:0 !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.crust} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 3px ${C.yolk} !important}

/* 拍一拍、通话结束：一行小字，两头撒面包屑 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${svg(CRUMBS)} left center/14px 8px no-repeat,${svg(CRUMBS)} right center/14px 8px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 22px !important;color:${C.fog} !important;box-shadow:none !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.crust} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}

/* 线下小结：一只牛皮纸面包袋，标题是袋口的贴纸 */
[data-part="offlog"]{background:repeating-linear-gradient(90deg,transparent 0 18px,rgba(140,100,60,.05) 18px 19px),#F1DDBF !important;border-color:${C.crustD} !important;padding-top:28px !important;position:relative !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:0 !important;height:10px !important;background:linear-gradient(135deg,transparent 50%,#F1DDBF 50%) 0 0/10px 10px repeat-x,#E3C79E !important;border-radius:12px 12px 0 0 !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 6px !important;padding:3px 14px !important;background:#fff !important;color:${C.crust} !important;border:1.5px solid ${C.crust} !important;border-radius:999px !important;letter-spacing:.12em !important}
[data-wk="offlogtitle"] *{color:${C.crust} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.crustD} !important}
[data-wk="offlogtranscript"]{border-top:1.5px dashed ${C.crust} !important;color:#8E7258 !important}

/* 加号面板：一颗颗白吐司圆钮 */
[data-wk="chattoolicon"]{background:${C.bread} !important;border:2px solid ${C.crust} !important;border-radius:50% !important;box-shadow:0 2px 0 #E6D3B8 !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.crust} !important;color:${C.crust} !important}
[data-wk="chattoollabel"]{color:${C.ink} !important}

/* 引用 */
[data-wk="quotedraft"]{background:#FFF8EC !important;border:none !important;border-top:1.5px solid #EFE4D2 !important}
[data-wk="quotedraft"] *{color:#8E7258 !important;border-color:${C.crust} !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.crust} !important}
[data-wk="quote"]{background:#FFF8EC !important;color:#8E7258 !important;border:1.5px solid #E6D3B8 !important;border-radius:10px !important;padding:3px 10px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}
/* 顶栏：我和他的头像并排，各坐在一颗荷包蛋里当蛋黄；名字和小字不显示 */
[data-wk="chathead"] [data-wk="headname"]{display:none !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"]){position:relative !important;overflow:visible !important;isolation:isolate !important;display:flex !important;align-items:center !important;gap:30px !important;padding-left:10px !important;flex:0 0 auto !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"])::before{content:"" !important;position:absolute !important;left:-1px !important;top:50% !important;width:58px !important;height:58px !important;margin-top:-29px !important;background:${svg(EGG)} center/contain no-repeat !important;z-index:-1 !important;pointer-events:none !important;filter:drop-shadow(0 2px 3px rgba(140,100,60,.15)) !important}
[data-wk="chathead"] img[data-wk="avatar"]{position:relative !important;z-index:1 !important;box-shadow:0 0 0 2.5px ${C.yolk} !important;border-radius:50% !important}
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;isolation:isolate !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:50% !important;top:50% !important;width:58px !important;height:58px !important;margin:-29px 0 0 -29px !important;background:${svg(EGG)} center/contain no-repeat !important;z-index:-1 !important;pointer-events:none !important;transform:rotate(140deg) !important;filter:drop-shadow(0 2px 3px rgba(140,100,60,.15)) !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img{border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.yolk} !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="chathead"] [data-wk="sameroom"]{margin-left:auto !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"])::after{content:"" !important;position:absolute !important;left:52px !important;top:50% !important;width:18px !important;height:36px !important;margin-top:-18px !important;background:${svg(SPATULA)} center/contain no-repeat !important;transform:rotate(18deg) !important;z-index:2 !important;pointer-events:none !important;filter:drop-shadow(0 2px 2px rgba(140,100,60,.25)) !important}

/* ───── 早安吐司 · 第三批：状态卡＝一整片大吐司（鼓起的面包顶＋烤黄的边）；好感是一片会被烤黄的吐司 ───── */
[data-wk="statecard"]{position:relative !important;overflow:visible !important;background:${C.bread} !important;border:4px solid ${C.crust} !important;border-top:none !important;border-radius:0 0 26px 26px !important;box-shadow:0 8px 20px rgba(140,100,60,.25) !important;margin-top:40px !important;padding-top:0 !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;left:-14px !important;right:-14px !important;top:-44px !important;height:48px !important;background:${svg(CAP(C.bread).replace("stroke-width='3'", "stroke-width='4'"))} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:0 !important}
[data-wk="statecard"] > *{position:relative !important;z-index:1 !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:2px dashed #EADBC3 !important;margin-top:-18px !important}
[data-wk="statehead"] *{color:${C.ink} !important}
[data-wk="statehead"] [data-wk="avatar"]::before{inset:-30% !important}
[data-wk="statehead"] button{border:2px solid ${C.crust} !important;background:#fff !important;border-radius:50% !important}
[data-wk="statemood"]{display:inline-block !important;background:${C.yolk} !important;color:${C.ink} !important;border:none !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:#F5EDDF !important;border:none !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.crust} !important;color:#fff !important}
/* 看得见的＝一张白盘子上的便签；心里想的＝金黄烤吐司色、斜体 */
[data-wk="stateseen"],[data-wk="statevoice"]{background:#fff !important;border:2px solid #EADBC3 !important;border-radius:16px !important;margin:12px 16px !important;color:${C.ink} !important;box-shadow:none !important}
[data-wk="statevoice"]{background:linear-gradient(180deg,#F6D39C,${C.toast}) !important;border-color:${C.crust} !important;font-style:italic !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.ink} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:#F5EDDF !important;border:none !important;border-radius:999px !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:#8E7258 !important}
[data-wk="statevoice"] + div > button{background:#fff !important;color:${C.crust} !important;border:2px solid ${C.crust} !important;border-radius:999px !important}
/* 好感：左边一片小吐司，好感越高烤得越黄（不是灌满，是整片变色），脸上一个笑；数字写在「好感度」底下 */
[data-wk="stateaff"]{background:transparent !important;border-top:2px dashed #EADBC3 !important;display:flex !important;align-items:center !important;gap:16px !important;padding:14px 20px 18px !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:relative !important;width:66px !important;height:66px !important;flex:none !important;background:${svg(SLICE("#FFFCF5", "#D9B98E"))} center/contain no-repeat !important}
[data-wk="stateheart"] > div{display:none !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;inset:0 !important;left:0 !important;bottom:0 !important;width:auto !important;height:auto !important;margin:0 !important;transform:none !important;background:${svg(SLICE("#D9963F", "#8E5A2A"))} center/contain no-repeat !important;opacity:var(--sc-heart-lvl) !important}
[data-wk="stateheartnum"]{display:block !important;position:absolute !important;inset:0 !important;background:${svg(SLICEFACE)} center/contain no-repeat !important;font-size:0 !important;color:transparent !important;-webkit-text-stroke:0 !important}
[data-wk="stateaffval"]{display:inline-block !important;margin:0 0 6px !important;padding:1px 12px !important;background:${C.yolk} !important;border-radius:999px !important;color:${C.ink} !important;font-weight:700 !important;font-size:14px !important}
[data-wk="stateaffval"]::after{content:" 分熟" !important;font-size:11px !important;font-weight:400 !important}
/* 翻旧的：一片片小吐司 */
[data-wk="statehistbtn"]{background:#fff !important;color:${C.crust} !important;border:2px solid ${C.crust} !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.fog} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1.5px solid ${C.crust} !important;border-radius:999px !important;color:${C.crust} !important;background:#fff !important}
[data-wk="statehistitem"]{position:relative !important;background:${C.bread} !important;border:2.5px solid ${C.crust} !important;border-top:none !important;border-radius:0 0 14px 14px !important;padding:8px 18px 14px !important;margin:22px 0 14px !important;box-shadow:0 3px 6px rgba(140,100,60,.12) !important;overflow:visible !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;left:-8px !important;right:-8px !important;top:-20px !important;height:22px !important;background:${svg(CAP(C.bread))} center/100% 100% no-repeat !important}
[data-wk="statehistitem"] *{color:${C.ink} !important}
[data-wk="statehistmood"]{background:${C.yolk} !important;border:none !important;color:${C.ink} !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:${C.fog} !important}
[data-wk="statehistmeta"]{background:#F5EDDF !important;border-radius:8px !important}
[data-wk="statehistend"]{color:${C.fog} !important}
/* Ta 眼里 */
[data-wk="gazepage"]{background:${C.bg} !important}
[data-wk="gazetitle"]{color:${C.ink} !important}
[data-wk="gazetab"]{background:#F5EDDF !important;color:${C.fog} !important;border:none !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.crust} !important;color:#fff !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{${CARD}}
[data-wk="gazetape"]{background:${svg(EGG2)} center/22px 22px no-repeat !important;box-shadow:none !important;border:none !important;transform:none !important;width:26px !important;height:26px !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#8E7258 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{${CARD}}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:#fff !important;border:2px dashed #E6D3B8 !important;border-radius:16px !important;color:${C.ink} !important}
[data-wk="gazeempty"] button{background:${C.crust} !important;color:#fff !important;border:none !important;border-radius:999px !important}
`;

const pack = { kind: "chat-look", v: 1, name: "早安吐司", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "早安吐司-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
