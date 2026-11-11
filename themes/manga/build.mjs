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

`;

const pack = { kind: "chat-look", v: 1, name: "漫画对白", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "漫画对白-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
