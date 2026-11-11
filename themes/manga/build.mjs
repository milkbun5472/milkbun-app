// 漫画对白：白底网点、粗黑描边、实心错位阴影（不用虚线）。我的话＝黄色对白框带尖角＋左边速度线，他的话＝白色对白框，
// 尖角指向头像、头上一块黑底名牌、角上两颗闪光星。用法：node themes/manga/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { ink: "#1A1A1A", paper: "#FFFFFF", yellow: "#FBE27A", bg: "#FAFAF7", dot: "#E2E2DC", fog: "#8A8A85" };
const LINE = `2px solid ${C.ink}`;
const POP = `4px 4px 0 ${C.ink}`;

const DOTS = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><circle cx='3' cy='3' r='1.1' fill='${C.dot}'/><circle cx='9' cy='9' r='1.1' fill='${C.dot}'/></svg>`;
const SPEED = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 40'><path d='M28 8 L6 2 M28 20 H2 M28 32 L6 38' stroke='${C.ink}' stroke-width='2.4' stroke-linecap='round'/></svg>`;
const SPARK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 32'><path d='M14 6 Q15 17 26 18 Q15 19 14 30 Q13 19 2 18 Q13 17 14 6Z' fill='${C.ink}'/><path d='M32 1 Q32.6 6.4 38 7 Q32.6 7.6 32 13 Q31.4 7.6 26 7 Q31.4 6.4 32 1Z' fill='${C.ink}'/></svg>`;
const TAIL_R = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20'><path d='M0 2 L22 18 L0 14Z' fill='${f}' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round'/><path d='M-1 4 V12' stroke='${f}' stroke-width='3'/></svg>`;
const TAIL_L = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20'><path d='M24 6 L2 10 L24 16Z' fill='${f}' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round'/><path d='M25 8 V14' stroke='${f}' stroke-width='3'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><rect x='3' y='3' width='22' height='22' fill='${C.paper}' stroke='${C.ink}' stroke-width='2'/><path d='M14 8.5 V19.5 M8.5 14 H19.5' stroke='${C.ink}' stroke-width='2.4' stroke-linecap='square'/><path d='M25 6 H28 V28 H6 V25' fill='none' stroke='${C.ink}' stroke-width='2'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M14 24 V6 M7 13 L14 6 L21 13' fill='none' stroke='${C.ink}' stroke-width='2.8' stroke-linecap='square'/><path d='M22 22 L26 18 M24 26 L28 24' stroke='${C.ink}' stroke-width='2' stroke-linecap='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 34'><path d='M9 2 H58 L51 32 H2Z' fill='${C.ink}'/><path d='M20 9 C14 9 13 18 18 19 L16 24 L22 19 C29 20 32 17 32 14 C32 10 27 9 20 9Z' fill='${C.paper}'/><path d='M38 9 L36 20 M42 9 L40 20' stroke='${C.yellow}' stroke-width='2.6' stroke-linecap='round'/><circle cx='35.3' cy='24.5' r='1.5' fill='${C.yellow}'/><circle cx='39.3' cy='24.5' r='1.5' fill='${C.yellow}'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'><path d='M4 12 L13 4 L22 12 V22 H4Z' fill='${C.yellow}' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round'/><rect x='10.5' y='15' width='5' height='7' fill='${C.paper}' stroke='${C.ink}' stroke-width='1.6'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'><path d='M13 2 L15 9 L22 6 L18 12 L24 15 L17 16 L18 23 L13 18 L8 23 L9 16 L2 15 L8 12 L4 6 L11 9Z' fill='${C.paper}' stroke='${C.ink}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='9.5' cy='13' r='1.3' fill='${C.ink}'/><circle cx='13' cy='13' r='1.3' fill='${C.ink}'/><circle cx='16.5' cy='13' r='1.3' fill='${C.ink}'/></svg>`;

const bubble = { myBg: C.yellow, myText: C.ink, myBorder: LINE, charBg: C.paper, charText: C.ink, charBorder: LINE, radius: 20, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: true, gap: "normal", time: "show" };

const css = `
/* ───── 漫画对白 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DOTS)} 0 0/12px 12px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：白底一道粗黑线，名字像漫画标题框 */
[data-wk="chathead"]{background:${C.paper} !important;border-bottom:${LINE} !important;box-shadow:0 3px 0 ${C.ink} !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important;font-weight:800 !important}
[data-wk="headdim"]{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important;stroke-width:2.6 !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{border-radius:50% !important;box-shadow:0 0 0 2px ${C.ink},2px 2px 0 2px ${C.ink} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:32px !important;min-width:32px !important;height:32px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/26px no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/28px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆，粗黑边＋错位影 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 2px ${C.ink},3px 3px 0 2px ${C.ink} !important}

/* 名字：他头上一块黑底白字名牌；我不写名字 */
[data-wk="name"][data-me="1"]{display:none !important}
[data-wk="name"][data-me="0"]{display:inline-block !important;background:${C.ink} !important;color:#fff !important;font-size:11px !important;letter-spacing:.15em !important;padding:2px 12px !important;margin:0 0 -2px 16px !important;border-radius:0 !important;position:relative !important;z-index:2 !important}
[data-wk="msg"][data-first="0"] [data-wk="name"]{display:none !important}

/* 对白框：粗黑描边＋实心错位黑影 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border:${LINE} !important;border-radius:22px !important;box-shadow:${POP} !important;color:${C.ink} !important;font-weight:600 !important;padding:12px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.yellow} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.paper} !important}
/* 尖角：我的从右下戳出去，他的从左边指向头像（只在一串第一条） */
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;right:-18px !important;left:auto !important;bottom:2px !important;top:auto !important;width:22px !important;height:18px !important;background:${svg(TAIL_R(C.yellow))} left center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;left:-20px !important;right:auto !important;top:12px !important;bottom:auto !important;width:22px !important;height:18px !important;background:${svg(TAIL_L(C.paper))} right center/contain no-repeat !important;border:none !important;transform:none !important}
/* 速度线：我那串第一条左边三道；他那串第一条右上两颗闪光星 */
[data-wk="bubble"][data-kind="text"]::before{content:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"" !important;position:absolute !important;left:-34px !important;right:auto !important;top:50% !important;width:26px !important;height:34px !important;margin-top:-17px !important;background:${svg(SPEED)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;right:-34px !important;left:auto !important;top:-18px !important;width:36px !important;height:30px !important;background:${svg(SPARK)} center/contain no-repeat !important;border:none !important;transform:none !important}

/* 时间、已读：白底黑框小方签 */
[data-wk="time"] > span{display:inline-block !important;background:${C.paper} !important;border:${LINE} !important;border-radius:0 !important;color:${C.ink} !important;font-weight:700 !important;padding:1px 10px !important;font-size:11px !important;box-shadow:2px 2px 0 ${C.ink} !important}
[data-wk="meta"]{display:inline-block !important;background:${C.paper} !important;border:1.6px solid ${C.ink} !important;color:${C.ink} !important;padding:0 6px !important;font-size:10.5px !important;margin-top:8px !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.ink} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.paper} !important;border:${LINE} !important;border-radius:22px !important;box-shadow:${POP} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.ink} !important}
/* 动描：旁白框——方角、浅灰、斜体，像漫画格子里的说明框 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{display:inline-block !important;background:#F1F0EA !important;border:1.6px solid ${C.ink} !important;border-radius:0 !important;box-shadow:none !important;color:${C.ink} !important;font-style:italic !important;font-size:13px !important;padding:4px 12px !important}
/* 系统提示：不带框的一行小字，前后一颗小星 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11.5px !important;font-style:normal !important}
[data-wk="sysnotetext"]::before{content:"✦ " !important;color:${C.ink} !important}

/* 底栏：白底一道粗黑线；左发送右回复（回复是一块斜着的黑色漫画框） */
[data-wk="composer"]{background:${C.paper} !important;border-top:${LINE} !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:${C.paper} !important;border:${LINE} !important;border-radius:18px !important;box-shadow:3px 3px 0 ${C.ink} !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="send"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/28px no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/28px no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:58px !important;min-width:58px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(3px 3px 0 ${C.yellow}) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="msg"][data-me="1"] [data-wk="name"]{display:none !important}

`;

const pack = { kind: "chat-look", v: 1, name: "漫画对白", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "漫画对白-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
