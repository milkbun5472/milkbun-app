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
const BUTTER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 18'><rect x='1.5' y='2' width='17' height='14' rx='3.5' fill='${C.butter}' stroke='#E8C24E' stroke-width='1.2'/><path d='M5 6 Q8 5 10 5.5' stroke='#fff' stroke-width='1.6' stroke-linecap='round' opacity='.85'/></svg>`;
const CI = (inner, fill = "none", stroke = C.crust) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='${fill}' stroke='${stroke}' stroke-width='1.6'/>${inner}</svg>`;
// 按键：主页＝一只小烤面包机；更多＝三粒面包屑；加号；发送＝细箭头；最右「让他回复」＝焦糖色圆钮里一个对话框
const I_HOUSE = CI(`<rect x='11' y='16' width='18' height='12' rx='3' fill='none' stroke='${C.ink}' stroke-width='1.5'/><path d='M15 16 V12.5 Q15 11 16.5 11 H18.5 Q20 11 20 12.5 V16 M21 16 V12.5 Q21 11 22.5 11 H24.5 Q26 11 26 12.5 V16' fill='${C.toast}' stroke='${C.ink}' stroke-width='1.3'/><path d='M29 21 H31' stroke='${C.ink}' stroke-width='1.5' stroke-linecap='round'/>`, "#fff");
const I_MORE = CI(`<g fill='${C.crust}'><ellipse cx='13' cy='21' rx='2.4' ry='1.9'/><ellipse cx='20' cy='19' rx='2.2' ry='2.1'/><ellipse cx='27' cy='21' rx='2.4' ry='1.8'/></g>`, "#fff");
const I_PLUS = CI(`<path d='M20 13 V27 M13 20 H27' stroke='${C.ink}' stroke-width='1.8' stroke-linecap='round'/>`, "#fff", "#E6DCCB");
const I_SEND = CI(`<path d='M13 20 H27 M21.5 14.5 L27 20 L21.5 25.5' fill='none' stroke='${C.crust}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>`, "#fff", "#E6DCCB");
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 46 46'><circle cx='23' cy='23' r='21' fill='${C.crust}'/><path d='M14 16 H32 Q34 16 34 18 V26 Q34 28 32 28 H22 L17 32 V28 H14 Q12 28 12 26 V18 Q12 16 14 16Z' fill='none' stroke='#fff' stroke-width='2' stroke-linejoin='round'/></svg>`;
const DOT = c => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='3.2' fill='${c}'/></svg>`;

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
`;

const pack = { kind: "chat-look", v: 1, name: "吐司", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "吐司-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
