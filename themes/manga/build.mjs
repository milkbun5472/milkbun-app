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
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><rect x='3' y='3' width='22' height='22' fill='${C.paper}' stroke='${C.ink}' stroke-width='2'/><path d='M14 8.5 V19.5 M8.5 14 H19.5' stroke='${C.ink}' stroke-width='2.4' stroke-linecap='square'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M14 24 V6 M7 13 L14 6 L21 13' fill='none' stroke='${C.ink}' stroke-width='2.8' stroke-linecap='square'/><path d='M22 22 L26 18 M24 26 L28 24' stroke='${C.ink}' stroke-width='2' stroke-linecap='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 34'><path d='M9 2 H58 L51 32 H2Z' fill='${C.ink}'/><path d='M20 9 C14 9 13 18 18 19 L16 24 L22 19 C29 20 32 17 32 14 C32 10 27 9 20 9Z' fill='${C.paper}'/><path d='M38 9 L36 20 M42 9 L40 20' stroke='${C.yellow}' stroke-width='2.6' stroke-linecap='round'/><circle cx='35.3' cy='24.5' r='1.5' fill='${C.yellow}'/><circle cx='39.3' cy='24.5' r='1.5' fill='${C.yellow}'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'><path d='M4 12 L13 4 L22 12 V22 H4Z' fill='${C.yellow}' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round'/><rect x='10.5' y='15' width='5' height='7' fill='${C.paper}' stroke='${C.ink}' stroke-width='1.6'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'><path d='M13 2 L15 9 L22 6 L18 12 L24 15 L17 16 L18 23 L13 18 L8 23 L9 16 L2 15 L8 12 L4 6 L11 9Z' fill='${C.paper}' stroke='${C.ink}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='9.5' cy='13' r='1.3' fill='${C.ink}'/><circle cx='13' cy='13' r='1.3' fill='${C.ink}'/><circle cx='16.5' cy='13' r='1.3' fill='${C.ink}'/></svg>`;

const BURST = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40' preserveAspectRatio='none'><path d='M6 8 L14 2 L22 7 L32 1 L42 6 L52 1 L62 6 L72 1 L82 6 L94 3 L96 14 L99 22 L94 30 L96 38 L84 35 L74 39 L64 34 L54 39 L44 34 L34 39 L24 34 L14 38 L4 34 L6 24 L1 17Z' fill='${C.yellow}' stroke='${C.ink}' stroke-width='1.6' vector-effect='non-scaling-stroke' stroke-linejoin='round'/></svg>`;
const HATCH = "repeating-linear-gradient(135deg,rgba(26,26,26,.16) 0 1.2px,transparent 1.2px 5px)";
// 融进气泡的尾巴：填色往回多盖一截压住气泡边框，描边只画外面两条边
const TAILR = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-5 0 29 22'><path d='M-5 2 L1 2 L22 19 L1 13 L-5 13Z' fill='${f}'/><path d='M1 2 L22 19 L1 13' fill='none' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/></svg>`;
const TAILL = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 22'><path d='M29 5 L23 5 L2 10 L23 16 L29 16Z' fill='${f}'/><path d='M23 5 L2 10 L23 16' fill='none' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/></svg>`;
// 红包里那颗大爆炸：黄底黑边，中间「¥!」
const BOOM = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><path d='M30 2 L35 17 L50 8 L44 24 L58 28 L44 35 L52 50 L36 43 L30 58 L24 43 L8 50 L16 35 L2 28 L16 24 L10 8 L25 17Z' fill='${C.yellow}' stroke='${C.ink}' stroke-width='2.4' stroke-linejoin='round'/><text x='30' y='36' text-anchor='middle' font-size='17' font-weight='900' fill='${C.ink}' font-family='sans-serif'>¥!</text></svg>`;
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


/* ── 跟别的黑白粗边款分开：头像改方格子、错位黑影只留给对白框、顶栏做成分镜格、黄色当标志色 ── */
/* 头像：方形漫画格，细黑线框，不要粗圈和错位影 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{border-radius:2px !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{box-shadow:0 0 0 1.4px ${C.ink},0 0 0 4px ${C.paper},0 0 0 5.2px ${C.ink} !important}
/* 时间、已读：去掉错位影；时间是网点小格，已读是黄色小爆炸框 */
[data-wk="time"] > span{box-shadow:none !important;border:1.4px solid ${C.ink} !important;background:${HATCH},${C.paper} !important}
[data-wk="meta"]{border:none !important;background:${svg(BURST)} center/100% 100% no-repeat !important;padding:3px 12px !important;font-weight:800 !important}
[data-wk="chatinput"]{box-shadow:none !important;border-radius:4px !important}
/* 顶栏：一条分镜格——左上角斜贴「EP.」，名字下面一道黄色马克笔，底边是网点 */
[data-wk="chathead"]{background:${C.paper} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:-8px !important;height:8px !important;background:${HATCH},${C.paper} !important;border-top:2px solid ${C.ink} !important;border-bottom:1px solid ${C.ink} !important;pointer-events:none !important;z-index:5 !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]{background:linear-gradient(transparent 55%,${C.yellow} 55%,${C.yellow} 92%,transparent 92%) !important;padding:0 4px !important;position:relative !important;overflow:visible !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]::before{content:"EP." !important;position:absolute !important;left:-6px !important;top:-14px !important;background:${C.ink} !important;color:${C.yellow} !important;font:800 9px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.1em !important;padding:2px 5px !important;transform:rotate(-8deg) !important}
[data-wk="body"]{padding-top:10px !important}
/* 底栏：顶边也是一条网点 */
[data-wk="composer"]{border-top:none !important;position:relative !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:-8px !important;height:8px !important;background:${HATCH},${C.paper} !important;border-top:1px solid ${C.ink} !important;border-bottom:2px solid ${C.ink} !important;pointer-events:none !important}
/* 加号不再带错位格 */

[data-wk="chathead"] [data-wk="headname"]{overflow:visible !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]::before{top:-12px !important;left:-2px !important;z-index:3 !important}

[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::after{right:-16px !important;bottom:8px !important;width:22px !important;height:17px !important;background:${svg(TAILR(C.yellow))} center/contain no-repeat !important;filter:drop-shadow(4px 4px 0 ${C.ink}) !important;z-index:1 !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after{left:-23px !important;top:10px !important;width:29px !important;height:22px !important;background:${svg(TAILL(C.paper))} center/contain no-repeat !important;z-index:1 !important}


/* ───── 漫画对白 · 第二批：卡片（形状不动；对白框同款粗黑边＋错位影；小巧思：卡角一块黑底黄字的分镜标签） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.paper} !important;border:${LINE} !important;border-radius:4px !important;box-shadow:${POP} !important;color:${C.ink} !important;position:relative !important;overflow:visible !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:${C.ink} !important}
[data-wk="transfercard"]::before,[data-wk="namecard"]::before,[data-part="offlog"]::before{position:absolute !important;left:-6px !important;top:-12px !important;background:${C.ink} !important;color:${C.yellow} !important;font:800 10px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.12em !important;padding:4px 8px !important;transform:rotate(-4deg) !important;z-index:2 !important}
[data-wk="transfercard"]::before{content:"¥ 转账" !important}
[data-wk="namecard"]::before{content:"CAST · 名片" !important}
[data-part="offlog"]::before{content:"番外 · 线下" !important}
[data-wk="transfercard"],[data-wk="namecard"],[data-part="offlog"]{margin-top:14px !important}
/* 转账：金额下面一道黄色马克笔；收下盖黄色爆炸「GET!」，退回盖斜线网点 */
[data-wk="transferamount"]{background:linear-gradient(transparent 60%,${C.yellow} 60%,${C.yellow} 92%,transparent 92%) !important;font-weight:900 !important}
[data-wk="transferrule"]{border:none !important;height:2px !important;background:${C.ink} !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${HATCH},${C.paper} !important;border-top:${LINE} !important}
[data-wk="transferbtn"]{border-radius:2px !important;border:${LINE} !important;box-shadow:2px 2px 0 ${C.ink} !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.yellow} !important;color:${C.ink} !important}
[data-wk="transferbtn"][data-part="back"]{background:${C.paper} !important;color:${C.ink} !important}
[data-wk="transferseal"]{border:${LINE} !important;border-radius:2px !important;background:${C.paper} !important;color:${C.ink} !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:66px !important;height:40px !important;border:none !important;background:${svg(BURST)} center/100% 100% no-repeat !important;transform:rotate(-10deg) !important;font-size:0 !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]::after{content:"GET!" !important;font:900 13px/40px ui-monospace,Menlo,monospace !important;color:${C.ink} !important;display:block !important;text-align:center !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *{display:none !important}
[data-wk="transfercard"][data-status="returned"]{background:${HATCH},${C.paper} !important;opacity:.75 !important}
/* 红包：留红，加粗黑边错位影 */
[data-wk="rpcard"]{border:${LINE} !important;border-radius:4px !important;box-shadow:${POP} !important}
[data-wk="rpenvelope"]{border:3px solid ${C.ink} !important;border-radius:6px !important;box-shadow:6px 6px 0 ${C.ink} !important}
/* 照片：漫画格子，下面一行等宽小字 */
[data-wk="photocard"]{padding:6px 6px 10px !important}
[data-wk="photoface"]{border-radius:0 !important;border:${LINE} !important;background:${HATCH},#F1F0EA !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}
/* 语音：小对白框，我黄他白 */
[data-wk="voice"][data-me]{background:${C.paper} !important;border:${LINE} !important;border-radius:18px !important;box-shadow:3px 3px 0 ${C.ink} !important}
[data-wk="voice"][data-me="1"]{background:${C.yellow} !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voicewave"] span{background:${C.ink} !important;border-radius:0 !important}
[data-wk="wxcardsky"]{background:${HATCH},#F1F0EA !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.ink} !important}
[data-wk="wxcardsay"]{background:${C.paper} !important;color:${C.ink} !important;border-top:${LINE} !important}
[data-wk="geopin"]{background:${C.yellow} !important;border:${LINE} !important;box-shadow:2px 2px 0 ${C.ink} !important}
[data-wk="geopinstem"]{background:${C.ink} !important}
[data-wk="namecard"] img{border-radius:2px !important;box-shadow:0 0 0 1.4px ${C.ink} !important}
/* 拍一拍、通话结束：小爆炸框 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${svg(BURST)} center/100% 100% no-repeat !important;border:none !important;border-radius:0 !important;color:${C.ink} !important;font-weight:800 !important;padding:5px 18px !important;font-size:12px !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.ink} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
/* 线下小结 */
[data-wk="offlogtitle"]{font-weight:900 !important;letter-spacing:.1em !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.ink} !important;text-decoration:underline !important;text-decoration-color:${C.yellow} !important;text-decoration-thickness:4px !important;text-underline-offset:-1px !important}
[data-wk="offlogtranscript"]{border-top:${LINE} !important}
/* 加号面板：一格格漫画格子，黄白交替 */
[data-wk="chatpanel"]{background:${svg(DOTS)} 0 0/12px 12px,${C.bg} !important;border-top:${LINE} !important}
[data-wk="chattoolicon"]{background:${C.paper} !important;border:${LINE} !important;border-radius:4px !important;box-shadow:3px 3px 0 ${C.ink} !important}
[data-wk="chattool"]:nth-child(odd) [data-wk="chattoolicon"]{background:${C.yellow} !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.ink} !important;font-weight:700 !important}
/* 引用三处 */
[data-wk="quotedraft"]{background:${C.paper} !important;border-top:none !important}
[data-wk="quote"]{background:${HATCH},${C.paper} !important;color:${C.ink} !important;border:1.6px solid ${C.ink} !important;border-left:5px solid ${C.ink} !important;border-radius:0 !important;opacity:1 !important}
[data-wk="quote"][data-me="1"]{background:${C.yellow} !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.ink} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:3px solid ${C.ink} !important;padding-left:8px !important;opacity:.7 !important}
/* 线下：加号、照片键也换成漫画格子按键 */
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:32px !important;height:32px !important;background:${svg(I_PLUS)} center/28px no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><rect x='3' y='5' width='24' height='19' fill='${C.yellow}' stroke='${C.ink}' stroke-width='2'/><circle cx='10' cy='11' r='2' fill='${C.ink}'/><path d='M4 22 L12 15 L17 19 L21 16 L26 21' fill='none' stroke='${C.ink}' stroke-width='2' stroke-linejoin='round'/></svg>`)} center/28px no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}


/* 红包：一格漫画——红色网点底、粗黑边错位影、左边一颗黄色大爆炸「¥!」，右下速度线；领完变灰网点 */
[data-wk="rpcard"]{background:radial-gradient(circle,rgba(0,0,0,.18) 1.2px,transparent 1.5px) 0 0/7px 7px,#E8463D !important;border:2.4px solid ${C.ink} !important;border-radius:2px !important;box-shadow:5px 5px 0 ${C.ink} !important;padding-left:74px !important;position:relative !important;overflow:visible !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:6px !important;top:50% !important;width:62px !important;height:62px !important;margin-top:-31px !important;background:${svg(BOOM)} center/contain no-repeat !important;transform:rotate(-8deg) !important;z-index:2 !important}
[data-wk="rpcard"]::after{content:"" !important;position:absolute !important;right:-28px !important;bottom:4px !important;width:24px !important;height:30px !important;background:${svg(SPEED)} center/contain no-repeat !important;transform:scaleX(-1) !important}
[data-wk="rpcard"] *{color:#fff !important;font-weight:800 !important;text-shadow:1.5px 1.5px 0 ${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding-left:4px !important}
[data-wk="rpcard"][data-status="done"]{background:${HATCH},#BDBDB8 !important;filter:none !important}
[data-wk="rpcard"][data-status="done"]::before{filter:grayscale(1) !important;opacity:.7 !important}
/* 拆开那页：一大格漫画分镜 */
[data-wk="rpenvelope"]{background:radial-gradient(circle,rgba(0,0,0,.18) 1.4px,transparent 1.7px) 0 0/9px 9px,#E8463D !important;border:3px solid ${C.ink} !important;border-radius:4px !important;box-shadow:7px 7px 0 ${C.ink} !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:${C.paper} !important;border-color:${C.ink} !important}
[data-wk="rpenvelope"] *{color:#fff !important;text-shadow:1.5px 1.5px 0 ${C.ink} !important}
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(DOTS)} 0 0/12px 12px,${C.paper} !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:${C.ink} !important;text-shadow:none !important}
[data-wk="rpopenbtn"]{background:${svg(BOOM)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;width:88px !important;height:88px !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important;text-shadow:none !important}
[data-wk="rpamount"]{background:linear-gradient(transparent 60%,${C.yellow} 60%,${C.yellow} 92%,transparent 92%) !important;color:${C.ink} !important}


/* ───── 漫画对白 · 第三批：状态卡（形状不动；一页漫画分镜：每块是一格，左上角黑底黄字格号） ───── */
[data-wk="statecard"]{background:${svg(DOTS)} 0 0/12px 12px,${C.paper} !important;border:3px solid ${C.ink} !important;border-radius:4px !important;box-shadow:7px 7px 0 ${C.ink} !important;--sc-heart-ink:${C.yellow} !important}
[data-wk="statehead"]{background:${C.paper} !important;border-bottom:${LINE} !important}
[data-wk="statehead"] *{color:${C.ink} !important}
[data-wk="statehead"] [data-wk="avatar"],[data-wk="statehead"] [data-wk="avatar"] *{border-radius:2px !important}
[data-wk="statehead"] button{border:${LINE} !important;border-radius:2px !important;background:${C.paper} !important;box-shadow:2px 2px 0 ${C.ink} !important}
[data-wk="statemood"]{display:inline-block !important;background:${svg(BURST)} center/100% 100% no-repeat !important;color:${C.ink} !important;font-weight:800 !important;padding:2px 12px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important;padding:3px !important;margin:12px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:0 !important;font-weight:700 !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.ink} !important;color:${C.yellow} !important}
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important;margin:16px 16px 12px !important;padding-top:26px !important;color:${C.ink} !important;box-shadow:4px 4px 0 ${C.ink} !important}
[data-wk="stateseen"]::before,[data-wk="statevoice"]::before{position:absolute !important;left:-2px !important;top:-2px !important;background:${C.ink} !important;color:${C.yellow} !important;font:800 10px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.12em !important;padding:4px 8px !important}
[data-wk="stateseen"]::before{content:"#1 看得见" !important}
[data-wk="statevoice"]::before{content:"#2 OS" !important}
[data-wk="statevoice"]{border-radius:24px !important;background:${C.yellow} !important}
[data-wk="statevoice"]::before{left:22px !important;top:-2px !important;z-index:2 !important;overflow:visible !important;line-height:1 !important;height:auto !important;width:auto !important;display:block !important}
[data-wk="statevoice"]{overflow:visible !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.ink} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:${HATCH},${C.paper} !important;border:1.6px solid ${C.ink} !important;border-radius:0 !important}
[data-wk="statewear"] > span{background:${C.paper} !important;border:1px solid ${C.ink} !important;border-radius:0 !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.ink} !important;text-decoration:underline !important}
[data-wk="statevoice"] + div > button{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:2px !important;box-shadow:2px 2px 0 ${C.ink} !important}
/* 好感：一根漫画能量条——黑框、斜线底、黄色灌满，旋钮是一颗小爆炸 */
[data-wk="stateaff"]{background:${C.paper} !important;border-top:${LINE} !important;position:relative !important;display:block !important;padding:16px 20px 60px !important;overflow:hidden !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:absolute !important;width:18px !important;left:calc(50% - 9px) !important;height:min(240px, 72vw) !important;bottom:calc(30px - min(240px, 72vw) / 2) !important;transform:rotate(90deg) !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 240' preserveAspectRatio='none'><rect width='18' height='240'/></svg>`)} !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:${C.ink} !important;opacity:1 !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:2px !important}
[data-wk="stateheartbase"]{background:${HATCH},${C.paper} !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{background:${C.yellow} !important;opacity:1 !important;border-top:2px solid ${C.ink} !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateheartknob"]{display:block !important;width:30px !important;height:30px !important;margin:0 0 -15px -15px !important;background:${svg(BOOM)} center/contain no-repeat !important;transform:rotate(-90deg) !important;z-index:2 !important;border:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:20px !important;top:10px !important;font:900 30px/1 ui-monospace,Menlo,monospace !important;color:${C.ink} !important;background:linear-gradient(transparent 55%,${C.yellow} 55%) !important}

/* 翻旧的：往期分镜，每格编号 EP.01 */
[data-wk="statehistbtn"]{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:2px !important;box-shadow:2px 2px 0 ${C.ink} !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.ink} !important;font-weight:800 !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:${LINE} !important;border-radius:2px !important;background:${C.paper} !important}
[data-wk="statehistlist"]{counter-reset:ep !important}
[data-wk="statehistitem"]{counter-increment:ep !important;position:relative !important;background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important;padding:28px 18px 14px !important;margin:16px 0 12px !important;box-shadow:4px 4px 0 ${C.ink} !important}
[data-wk="statehistitem"]::before{content:"EP.0" counter(ep) !important;position:absolute !important;left:-2px !important;top:-2px !important;background:${C.ink} !important;color:${C.yellow} !important;font:800 10px/1 ui-monospace,Menlo,monospace !important;letter-spacing:.12em !important;padding:4px 8px !important}
[data-wk="statehistmood"]{background:${C.yellow} !important;color:${C.ink} !important;border:1.4px solid ${C.ink} !important;border-radius:0 !important}
[data-wk="statehisttime"]{color:${C.fog} !important;font-family:ui-monospace,Menlo,monospace !important}
[data-wk="statehisttext"],[data-wk="statehistact"],[data-wk="statehistwear"]{color:${C.ink} !important}
[data-wk="statehistmeta"]{background:${HATCH},${C.paper} !important;border-radius:0 !important}
[data-wk="statehistend"]{color:${C.fog} !important;font-weight:800 !important;letter-spacing:.3em !important}
[data-wk="statehistend"]::before{content:"— TO BE CONTINUED — " !important;display:block !important;color:${C.ink} !important}

/* Ta 眼里：贴条换成一颗小爆炸 */
[data-wk="gazepage"]{background:${svg(DOTS)} 0 0/12px 12px,${C.bg} !important}
[data-wk="gazetitle"]{color:${C.ink} !important;background:linear-gradient(transparent 55%,${C.yellow} 55%) !important}
[data-wk="gazetab"]{background:${C.paper} !important;color:${C.fog} !important;border:${LINE} !important;border-radius:2px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.ink} !important;color:${C.yellow} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important;box-shadow:4px 4px 0 ${C.ink} !important}
[data-wk="gazetape"]{background:${svg(BURST)} center/100% 100% no-repeat !important;height:16px !important;box-shadow:none !important;border:none !important}
[data-wk="gazecardname"]{color:${C.ink} !important;font-weight:800 !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.fog} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.paper} !important;border:3px solid ${C.ink} !important;border-radius:4px !important;box-shadow:6px 6px 0 ${C.ink} !important}
[data-wk="gazeempty"]{background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important}
[data-wk="gazeempty"] button{background:${C.yellow} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:2px !important;box-shadow:2px 2px 0 ${C.ink} !important}

/* ───── 线下 ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(DOTS)} 0 0/12px 12px,${C.bg} !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:${C.ink} !important;font-weight:800 !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:${C.ink} !important;color:${C.yellow} !important;border:none !important;border-radius:0 !important;font-size:12px !important;padding:3px 12px !important;transform:skewX(-8deg) !important}
[data-wk="offcomposer"]{background:${C.paper} !important;border-top:${LINE} !important}
[data-wk="offcomposer"] textarea{background:${C.paper} !important;border:${LINE} !important;border-radius:4px !important;color:${C.ink} !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/28px no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{width:58px !important;min-width:58px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(3px 3px 0 ${C.yellow}) !important;font-size:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcard"]{position:relative !important;background:${C.paper} !important;border:${LINE} !important;border-left-width:2px !important;border-radius:2px !important;box-shadow:5px 5px 0 ${C.ink} !important}
[data-wk="offcard"][data-me="1"]{background:${C.yellow} !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:2px !important;box-shadow:0 0 0 1.6px ${C.ink} !important}
[data-wk="offname"]{background:${C.ink} !important;color:#fff !important;padding:0 8px !important;font-weight:700 !important}
[data-wk="offtext"]{color:${C.ink} !important}
[data-wk="offsay"]{background:${C.paper} !important;border:1.6px solid ${C.ink} !important;border-radius:14px !important;padding:1px 8px !important;color:${C.ink} !important;font-weight:800 !important;box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important}
[data-wk="offthought"]{background:${HATCH},${C.paper} !important;border:1.6px solid ${C.ink} !important;border-radius:20px !important;color:${C.ink} !important;font-style:italic !important}
[data-wk="offcardacts"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="offreplyopt"]{background:${C.paper} !important;border:${LINE} !important;border-radius:2px !important;color:${C.ink} !important;box-shadow:2px 2px 0 ${C.ink} !important}

/* ───── 通话 ───── */
[data-wk="callbubble"]{background:${C.paper} !important;color:${C.ink} !important;border:${LINE} !important;border-radius:20px !important;box-shadow:3px 3px 0 ${C.ink} !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.yellow} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callavatar"]{border-radius:4px !important;box-shadow:0 0 0 3px ${C.ink},0 0 0 8px ${C.paper},0 0 0 10px ${C.ink},10px 10px 0 10px ${C.yellow} !important}


/* 好感不做进度条：一颗大漫画心，从下往上灌黄色，旁边一个「DOKI!」音效字和速度线 */
[data-wk="stateaff"]{padding:16px 120px 18px 20px !important;min-height:110px !important}
[data-wk="stateheart"]{position:absolute !important;left:auto !important;right:22px !important;top:50% !important;bottom:auto !important;width:84px !important;height:76px !important;margin-top:-38px !important;transform:rotate(-6deg) !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 84 76'><path d='M42 74 C14 54 2 40 2 23 C2 10 12 2 24 2 C32 2 38 6 42 13 C46 6 52 2 60 2 C72 2 82 10 82 23 C82 40 70 54 42 74Z'/></svg>`)} !important;filter:drop-shadow(4px 4px 0 ${C.ink}) !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:3px !important}
[data-wk="stateheartbase"]{background:${HATCH},${C.paper} !important}
[data-wk="stateheartfill"] > div{background:${C.yellow} !important;border-top:2.5px solid ${C.ink} !important}
[data-wk="stateheartknob"]{display:none !important}
[data-wk="stateheartnum"]{display:block !important;transform:none !important;font:900 20px/1 ui-monospace,Menlo,monospace !important;color:${C.ink} !important;-webkit-text-stroke:0 !important}
[data-wk="stateaffval"]{display:none !important}
[data-wk="stateaff"]::after{content:"DOKI!" !important;position:absolute !important;right:96px !important;top:12px !important;font:900 13px/1 ui-monospace,Menlo,monospace !important;color:${C.ink} !important;background:${C.yellow} !important;padding:3px 6px !important;border:1.6px solid ${C.ink} !important;transform:rotate(-12deg) !important}
[data-wk="stateaff"]::before{content:"" !important;position:absolute !important;right:104px !important;bottom:14px !important;width:22px !important;height:28px !important;background:${svg(SPEED)} center/contain no-repeat !important}

[data-wk="stateheartnum"]{position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;padding:0 0 6px !important;z-index:3 !important;transform:rotate(6deg) !important;-webkit-text-stroke:4px ${C.paper} !important;paint-order:stroke !important}
[data-wk="stateaff"]::after{right:112px !important;top:18px !important}
[data-wk="stateaff"]::before{right:118px !important}

`;

const pack = { kind: "chat-look", v: 1, name: "漫画对白", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "漫画对白-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
