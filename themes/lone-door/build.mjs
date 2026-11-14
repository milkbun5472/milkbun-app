// 星野门扉：夜里的空地上立着一扇扇没有墙的门。每条气泡都是一扇开着的门，门里透出光，门底下接几级发光的台阶；
// 他的门里是暖白粉的光、门扇开在右边，我的门里是一道彩虹光、门扇开在左边。头像＝从一个发光的锁孔里看出去。
// 用法：node themes/lone-door/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { n1: "#141433", n2: "#1D2150", n3: "#173E4A", ground: "#1F5A52", frame: "#3A3170", frameD: "#241E4E", stone: "#5A5450", stoneL: "#8A827A", step: "#7FF0F0", ink: "#3A2E5A", fog: "#AFB4D8", warm: "#FFE6C8" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

const STARS = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='260'>${Array.from({ length: 40 }, (_, i) => `<circle cx='${(i * 61 + (i % 4) * 13) % 220}' cy='${(i * 43 + (i % 6) * 17) % 260}' r='${[0.6, 0.9, 1.2][i % 3]}' fill='#fff' opacity='${(0.3 + (i % 5) * 0.12).toFixed(2)}'/>`).join("")}<path transform='translate(160 60)' d='M0 -5 Q.4 -.4 3.5 0 Q.4 .4 0 5 Q-.4 .4 -3.5 0 Q-.4 -.4 0 -5Z' fill='#fff'/></svg>`;
// 门扇：一块斜着打开的紫色门板，带门把
const PANEL = (side) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 100' preserveAspectRatio='none'><path d='${side === "r" ? "M0 0 L20 8 L20 92 L0 100Z" : "M20 0 L0 8 L0 92 L20 100Z"}' fill='#4A3F86' stroke='#2A2358' stroke-width='1.5' vector-effect='non-scaling-stroke'/><path d='${side === "r" ? "M3 10 L17 15 L17 85 L3 90Z" : "M17 10 L3 15 L3 85 L17 90Z"}' fill='none' stroke='#6A5EA8' stroke-width='1' vector-effect='non-scaling-stroke'/></svg>`;
const KNOB = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><circle cx='4' cy='4' r='3' fill='#F2D28A' stroke='#B8913E' stroke-width='.8'/></svg>`;
// 门底下的发光台阶：三级，一级比一级往外
const STEPS = (side) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'>${[0, 1, 2].map(i => { const w = 30 + i * 6, x = side === "l" ? 30 - i * 14 : i * 14; return `<rect x='${x}' y='${4 + i * 9}' width='${w}' height='3.5' rx='1.5' fill='${C.step}' opacity='${(0.95 - i * 0.2).toFixed(2)}'/>`; }).join("")}</svg>`;
// 头像：一块石头锁孔门牌，上面圆孔里是头像，下面一道发光的锁孔光
const KEYLIGHT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 30'><defs><linearGradient id='k' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#FFF6E0'/><stop offset='1' stop-color='#FFD98A' stop-opacity='.2'/></linearGradient></defs><path d='M15 0 H25 L30 30 H10Z' fill='url(#k)'/></svg>`;
const SPARK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -8 12 16'><path d='M0 -7 Q.6 -.6 5 0 Q.6 .6 0 7 Q-.6 .6 -5 0 Q-.6 -.6 0 -7Z' fill='#fff'/></svg>`;
const RING = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><circle cx='6' cy='6' r='3.4' fill='none' stroke='${C.fog}' stroke-width='1.2'/></svg>`;
const CI = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect x='4' y='4' width='32' height='32' rx='9' fill='rgba(255,255,255,.06)' stroke='#C9C2F0' stroke-width='1.4'/>${inner}</svg>`;
// 按键：主页＝一扇小门；更多＝一个锁孔；加号＝一把钥匙；发送＝上台阶；最右「让他回复」＝一扇推开一半、透出光的门
const I_HOUSE = CI(`<rect x='13' y='11' width='14' height='19' rx='1' fill='none' stroke='#fff' stroke-width='1.5'/><circle cx='23.5' cy='21' r='1.2' fill='${C.step}'/>`);
const I_MORE = CI(`<circle cx='20' cy='17' r='4' fill='none' stroke='#fff' stroke-width='1.5'/><path d='M18 20 L16.5 28 H23.5 L22 20' fill='${C.step}' stroke='#fff' stroke-width='1.2' stroke-linejoin='round'/>`);
const I_PLUS = CI(`<circle cx='14' cy='20' r='4.5' fill='none' stroke='#fff' stroke-width='1.6'/><path d='M18.5 20 H29 M25 20 V24 M28 20 V23' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/>`);
const I_SEND = CI(`<path d='M10 28 H16 V23 H21 V18 H26 V13 H30' fill='none' stroke='${C.step}' stroke-width='1.8' stroke-linejoin='round' stroke-linecap='round'/><path d='M26 10 L30 13 L26 16' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/>`);
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><defs><linearGradient id='l' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#FFF6E0'/><stop offset='.5' stop-color='#FFD6EE'/><stop offset='1' stop-color='#C8E8FF'/></linearGradient></defs><rect x='9' y='6' width='26' height='36' rx='2' fill='url(#l)' stroke='${C.frame}' stroke-width='3'/><path d='M35 8 L43 12 V38 L35 42Z' fill='#4A3F86' stroke='#2A2358' stroke-width='1.5'/><circle cx='38' cy='25' r='1.5' fill='#F2D28A'/><path d='M15 18 H29 Q31 18 31 20 V26 Q31 28 29 28 H21 L17 31 V28 H15 Q13 28 13 26 V20 Q13 18 15 18Z' fill='none' stroke='${C.ink}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;

// ── 第二批用的图 ──
// 一把金钥匙挂着小牌；turned＝插在锁里转开、发光
const KEY = st => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 40'>${st === "turned" ? `<rect x='34' y='6' width='22' height='28' rx='3' fill='${C.frame}' stroke='#2A2358' stroke-width='1.4'/><circle cx='45' cy='17' r='3' fill='#FFF3D0'/><path d='M43.5 19 L42.5 26 H47.5 L46.5 19Z' fill='#FFF3D0'/><circle cx='45' cy='20' r='12' fill='#FFE7A8' opacity='.25'/>` : ``}<g transform='${st === "turned" ? "translate(-4 0)" : ""}'><circle cx='12' cy='20' r='7' fill='none' stroke='#F2D28A' stroke-width='3'/><path d='M19 20 H${st === "turned" ? 40 : 46} M${st === "turned" ? 34 : 40} 20 V26 M${st === "turned" ? 38 : 44} 20 V24' stroke='#F2D28A' stroke-width='3' stroke-linecap='round'/></g>${st === "back" ? `<path d='M6 6 L54 34' stroke='${C.fog}' stroke-width='2' opacity='.6'/>` : ``}</svg>`;
// 一扇小门；open＝门开着，光泼出来
const MINIDOOR = open => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 64'><rect x='8' y='6' width='30' height='50' rx='2' fill='${open ? "#FFF2D8" : "#2A2358"}' stroke='${C.frame}' stroke-width='4'/>${open ? `<path d='M38 8 L48 12 V52 L38 56Z' fill='#4A3F86' stroke='#2A2358' stroke-width='1.2'/><path d='M12 56 L4 64 H44 L38 56Z' fill='#FFE7A8' opacity='.5'/>` : `<rect x='12' y='10' width='22' height='42' fill='#4A3F86'/><circle cx='30' cy='32' r='2' fill='#F2D28A'/><path d='M23 6 V56' stroke='#E85A7A' stroke-width='3'/><path d='M23 20 Q16 14 18 22 Q21 24 23 20 Q25 24 28 22 Q30 14 23 20Z' fill='#E85A7A'/>`}</svg>`;
const KNOCKER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='7' r='3' fill='#F2D28A'/><circle cx='12' cy='14' r='6' fill='none' stroke='#F2D28A' stroke-width='2'/></svg>`;
const KEYHOLEPIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 34'><path d='M13 1 C6 1 2 6 2 12 C2 20 13 33 13 33 C13 33 24 20 24 12 C24 6 20 1 13 1Z' fill='${C.frame}' stroke='#C9C2F0' stroke-width='1.4'/><circle cx='13' cy='11' r='3.2' fill='#FFE7A8'/><path d='M11.5 13 L10.5 19 H15.5 L14.5 13Z' fill='#FFE7A8'/></svg>`;
const CARD = `background:linear-gradient(180deg,#2A2560,#1E1B48) !important;border:4px solid ${C.frame} !important;border-radius:3px !important;box-shadow:inset 0 0 0 1.5px #5A4FA0,0 0 16px 3px rgba(127,240,240,.18) !important;color:#fff !important`;

const bubble = { myBg: "#FFE0F0", myText: C.ink, myBorder: "none", charBg: C.warm, charText: C.ink, charBorder: "none", radius: 2, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const RAINBOW = "linear-gradient(110deg,#FFE3F1 0%,#FFF1C9 22%,#E2FFD8 42%,#D5F2FF 62%,#E6DBFF 82%,#FFE3F1 100%)";
const WARM = "radial-gradient(ellipse at 50% 50%,#FFFDF6,#FFE6D0 70%,#FFD3D8)";

const css = `
/* ───── 星野门扉 · 第一批 ───── */
[data-wk="chat"]{background:${svg(STARS)} 0 0/220px 260px,radial-gradient(ellipse at 50% 112%,${C.ground} 0 30%,transparent 55%),linear-gradient(180deg,${C.n1} 0%,${C.n2} 55%,${C.n3} 100%) !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：不做框，往下淡出，底下一道细光线 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,rgba(20,20,51,.9),rgba(20,20,51,0)) !important;border-bottom:none !important;box-shadow:none !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:10% !important;right:10% !important;bottom:0 !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(127,240,240,.8),transparent) !important;pointer-events:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.15em !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:#fff !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{flex:none !important;width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]),[data-wk="chathead"] + *:not([data-wk="body"]) *{color:#fff !important}

/* 头像：一块石头门牌，上面圆孔里是头像，底下透出一道锁孔的光——像从锁孔里往外看 */
button[data-wk="avatar"],span[data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:50% !important;box-shadow:0 0 0 2px #E8E0D4,0 0 14px 3px rgba(255,230,180,.55) !important;margin-bottom:12px !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important;border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-22% !important;right:-22% !important;top:-22% !important;bottom:-58% !important;border-radius:46% 46% 14px 14px / 40% 40% 14px 14px !important;background:radial-gradient(circle at 35% 25%,${C.stoneL},${C.stone} 70%) !important;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.15),0 4px 8px rgba(0,0,0,.45) !important;z-index:-1 !important;pointer-events:none !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;left:20% !important;right:20% !important;top:90% !important;height:46% !important;background:${svg(KEYLIGHT)} center top/100% 100% no-repeat !important;z-index:0 !important;pointer-events:none !important;filter:drop-shadow(0 0 4px rgba(255,220,150,.9)) !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before,[data-wk="chathead"] button[data-wk="avatar"]::after,[data-wk="chathead"] span[data-wk="avatar"]::after{content:none !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img[data-wk="avatar"]{margin-bottom:0 !important;box-shadow:0 0 0 2px #E8E0D4,0 0 10px 2px rgba(255,230,180,.5) !important}
[data-wk="msg"] [data-wk="row"]{gap:16px !important}

/* 气泡：一扇开着的门——深紫门框，门洞里透出光，门扇斜着开在一边，门底下几级发光台阶 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:2px !important;letter-spacing:.12em !important;font-weight:600 !important;padding:13px 22px !important;color:${C.ink} !important;border:5px solid ${C.frame} !important;box-shadow:inset 0 0 0 1.5px ${C.frameD},0 0 18px 4px rgba(255,214,190,.35) !important;margin-bottom:22px !important}
/* 他的：暖白粉的光，门扇在右，台阶往左下 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${WARM} !important;margin-right:20px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;right:-24px !important;top:-6px !important;bottom:-6px !important;width:18px !important;height:auto !important;left:auto !important;background:${svg(KNOB)} 4px 55%/6px 6px no-repeat,${svg(PANEL("r"))} center/100% 100% no-repeat !important;border:none !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;left:-30px !important;bottom:-28px !important;top:auto !important;right:auto !important;width:60px !important;height:24px !important;background:${svg(STEPS("l"))} center/contain no-repeat !important;border:none !important;transform:none !important;filter:drop-shadow(0 0 4px rgba(127,240,240,.8)) !important}
/* 我的：彩虹光，门扇在左，台阶往右下 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${RAINBOW} !important;margin-left:20px !important;box-shadow:inset 0 0 0 1.5px ${C.frameD},0 0 20px 5px rgba(220,200,255,.45) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;left:-24px !important;top:-6px !important;bottom:-6px !important;width:18px !important;height:auto !important;right:auto !important;background:${svg(KNOB)} 9px 55%/6px 6px no-repeat,${svg(PANEL("l"))} center/100% 100% no-repeat !important;border:none !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"" !important;position:absolute !important;right:-30px !important;bottom:-28px !important;top:auto !important;left:auto !important;width:60px !important;height:24px !important;background:${svg(STEPS("r"))} center/contain no-repeat !important;border:none !important;transform:none !important;filter:drop-shadow(0 0 4px rgba(127,240,240,.8)) !important}

/* 时间：一行淡色小字 */
[data-wk="time"] > span{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;letter-spacing:.3em !important;font-size:11.5px !important}
/* 已送达＝空心小圈；已读＝一颗亮起来的小星 */
[data-wk="meta"]{color:${C.fog} !important;font-size:11px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:8px !important;margin-top:-4px !important}
[data-wk="msg"][data-me="0"] [data-wk="meta"]{margin-left:42px !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{margin-right:42px !important}
[data-wk="meta"]::after{content:"" !important;width:11px !important;height:11px !important;flex:none !important;background:${svg(RING)} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{width:11px !important;height:15px !important;background:${svg(SPARK)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px rgba(127,240,240,.95)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${WARM} !important;border:5px solid ${C.frame} !important;border-radius:2px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.frame} !important}
[data-wk="name"]{color:${C.fog} !important}

/* 动描、我的动作：没有框，像门缝里漏出来的一道光——左边一道细光线，淡金斜体 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:block !important;background:linear-gradient(90deg,rgba(255,230,180,.12),transparent 70%) !important;border:none !important;border-left:2px solid #FFE0A8 !important;border-radius:0 !important;box-shadow:none !important;color:#FFE9C8 !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.08em !important;padding:4px 0 4px 14px !important}
[data-wk="myactink"]{border-left:none !important;border-right:2px solid ${C.step} !important;padding:4px 14px 4px 0 !important;text-align:right !important;background:linear-gradient(270deg,rgba(127,240,240,.1),transparent 70%) !important;color:#D8FBFB !important}
[data-wk="narrbar"]{background:rgba(20,20,51,.95) !important;border-top:1px solid rgba(127,240,240,.4) !important}
[data-wk="narrkind"]{border:1px solid rgba(201,194,240,.5) !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.step} !important;border-color:${C.step} !important;color:${C.n1} !important}
/* 系统提示 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 底栏：不做框，往上淡出，上沿一道细光线；输入框是一块淡紫玻璃；最右「让他回复」是一扇推开一半、透出光的门 */
[data-wk="composer"]{position:relative !important;background:linear-gradient(180deg,rgba(23,62,74,0),rgba(20,40,60,.9)) !important;border-top:none !important;box-shadow:none !important;align-items:center !important;gap:10px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:10% !important;right:10% !important;top:0 !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(127,240,240,.8),transparent) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:rgba(255,255,255,.08) !important;border:1px solid rgba(201,194,240,.5) !important;border-radius:8px !important;color:#fff !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:44px !important;min-width:44px !important;height:46px !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 10px rgba(255,220,200,.75)) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:rgba(20,20,51,.96) !important;border-top:1px solid rgba(127,240,240,.4) !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
/* ───── 星野门扉 · 第二批：卡片 ───── */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{${CARD}}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:#fff !important;border-color:rgba(201,194,240,.35) !important}

/* 转账＝一把挂着小牌的金钥匙：收下了钥匙插进锁里转开、锁亮起来；退回了钥匙上划一道 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;${CARD};padding-left:78px !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:60px !important;height:40px !important;margin-top:-24px !important;background:${svg(KEY("full"))} center/contain no-repeat !important;filter:drop-shadow(0 0 5px rgba(242,210,138,.7)) !important}
[data-wk="transfercard"] *{color:#fff !important;border-color:rgba(201,194,240,.35) !important}
[data-wk="transferlabel"]{color:${C.fog} !important;letter-spacing:.2em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#FFE9B8 !important;font-weight:700 !important;text-shadow:0 0 10px rgba(255,220,150,.6) !important}
[data-wk="transferrule"]{border:none !important;height:2px !important;background:repeating-linear-gradient(90deg,${C.step} 0 10px,transparent 10px 16px) !important;opacity:.7 !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(0,0,0,.2) !important}
[data-wk="transferbtn"]{border-radius:2px !important}
[data-wk="transferbtn"][data-part="take"]{background:linear-gradient(110deg,#FFE3F1,#FFF1C9 40%,#D5F2FF) !important;color:${C.ink} !important;border:none !important;font-weight:700 !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:#fff !important;border:1px solid rgba(201,194,240,.6) !important}
[data-wk="transferseal"]{background:transparent !important;border:1px solid rgba(201,194,240,.6) !important;color:#fff !important;border-radius:4px !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"]::before{background:${svg(KEY("turned"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"]::before{background:${svg(KEY("back"))} center/contain no-repeat !important;filter:none !important;opacity:.6 !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.75 !important}

/* 红包＝一扇系着红丝带的小门；领完了门开了，光泼出来 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:88px !important;padding:16px 16px 16px 76px !important;${CARD}}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:50px !important;height:64px !important;margin-top:-34px !important;background:${svg(MINIDOOR(false))} center/contain no-repeat !important}
[data-wk="rpcard"]::after{content:"一扇门" !important;position:absolute !important;right:12px !important;bottom:6px !important;font-size:10px !important;letter-spacing:.25em !important;color:${C.fog} !important}
[data-wk="rpcard"] *{color:#fff !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important;color:#FFE9C8 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(MINIDOOR(true))} center/contain no-repeat !important;filter:drop-shadow(0 0 8px rgba(255,220,150,.8)) !important}
[data-wk="rpcard"][data-status="done"]::after{content:"门开了" !important}
/* 拆红包＝一扇大门：关着时是一整扇深紫木门（四块门板、金门把、门缝漏光），「开」是门上的锁孔；
   拆开后门扇转到一边，门洞里是一片暖光，金额站在光里，门底下接三级发光台阶 */
[data-wk="rpenvelope"]{position:relative !important;overflow:visible !important;border-radius:6px 6px 2px 2px !important}
[data-wk="rpenvelope"][data-stage="closed"]{background:radial-gradient(circle at 82% 52%,#F2D28A 0 7px,#B8913E 7.5px 9px,transparent 9.5px),linear-gradient(#2A2358,#2A2358) 50% 8%/76% 2px no-repeat,linear-gradient(90deg,transparent 12%,rgba(255,255,255,.07) 12% 44%,transparent 44% 56%,rgba(255,255,255,.07) 56% 88%,transparent 88%) center 14%/100% 30% no-repeat,linear-gradient(90deg,transparent 12%,rgba(255,255,255,.07) 12% 44%,transparent 44% 56%,rgba(255,255,255,.07) 56% 88%,transparent 88%) center 86%/100% 30% no-repeat,linear-gradient(180deg,#4A3F86,#3A3170) !important;border:8px solid ${C.frameD} !important;box-shadow:0 0 0 2px #5A4FA0,0 0 22px 4px rgba(255,220,150,.55),0 0 60px 10px rgba(255,214,190,.25) !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rparc"]{display:none !important}
[data-wk="rpenvelope"][data-stage="closed"] *{color:#FFE9C8 !important}
[data-wk="rpopenbtn"]{background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><circle cx='30' cy='30' r='27' fill='#F2D28A' stroke='#8F6A26' stroke-width='3'/><circle cx='30' cy='24' r='7' fill='#1E1B48'/><path d='M26.5 28 L24 44 H36 L33.5 28Z' fill='#1E1B48'/><circle cx='30' cy='24' r='3' fill='#FFE7A8' opacity='.8'/></svg>`)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 0 10px rgba(255,220,150,.8)) !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpenvelope"][data-stage="open"]{background:radial-gradient(ellipse at 50% 60%,#FFFDF4,#FFE9C8 55%,#FFD3D8) !important;border:8px solid ${C.frame} !important;box-shadow:0 0 0 2px #5A4FA0,0 0 40px 10px rgba(255,220,170,.6) !important}
[data-wk="rpenvelope"][data-stage="open"]::after{content:"" !important;position:absolute !important;right:-46px !important;top:-10px !important;bottom:-10px !important;width:40px !important;background:radial-gradient(circle at 40% 52%,#F2D28A 0 4px,transparent 4.5px),${svg(PANEL("r"))} center/100% 100% no-repeat !important;pointer-events:none !important}
[data-wk="rpenvelope"][data-stage="open"]::before{content:"" !important;position:absolute !important;left:10% !important;right:10% !important;bottom:-46px !important;height:38px !important;background:linear-gradient(${C.step},${C.step}) center 4px/70% 4px no-repeat,linear-gradient(${C.step},${C.step}) center 17px/84% 4px no-repeat,linear-gradient(${C.step},${C.step}) center 30px/100% 4px no-repeat !important;filter:drop-shadow(0 0 6px rgba(127,240,240,.9)) !important;opacity:.9 !important;pointer-events:none !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"]{display:none !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:${C.ink} !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px #E8E0D4,0 0 12px rgba(255,230,180,.6) !important}
[data-wk="rpamount"]{color:${C.ink} !important;background:none !important;text-shadow:0 0 14px rgba(255,255,255,.9) !important}
[data-wk="rpclose"]{background:transparent !important;border:1.5px solid #fff !important;color:#fff !important}
[data-wk="rpenvelope"][data-stage="open"] ~ [data-wk="rpclose"],[data-wk="rpenvelope"][data-stage="open"] + * [data-wk="rpclose"]{margin-top:46px !important}

/* 照片＝从一扇门里看出去：门框框着照片，门扇开在旁边 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:${C.frame} !important;border:none !important;border-radius:3px !important;padding:8px 8px 24px !important;margin-right:22px !important;box-shadow:inset 0 0 0 2px #5A4FA0,0 0 16px rgba(255,214,190,.3) !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;right:-22px !important;top:-4px !important;bottom:-4px !important;width:18px !important;background:${svg(KNOB)} 4px 55%/6px 6px no-repeat,${svg(PANEL("r"))} center/100% 100% no-repeat !important}
[data-wk="photoface"]{background:${WARM} !important;border:none !important;border-radius:1px !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:${C.ink} !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.fog} !important}

/* 语音：前面一只金色门环 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:#fff !important}
[data-wk="voice"][data-me]{padding:0 14px 0 38px !important;position:relative !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:11px !important;top:50% !important;width:18px !important;height:18px !important;margin-top:-10px !important;background:${svg(KNOCKER)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:${RAINBOW} !important}
[data-wk="voice"][data-me="1"] *{color:${C.ink} !important}
[data-wk="voicewave"] span{background:${C.step} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:${C.frame} !important}

[data-wk="wxcardsky"]{background:${svg(STARS)} 0 0/220px 260px,linear-gradient(180deg,${C.n1},${C.n3}) !important}
[data-wk="wxcardsky"] *{color:#fff !important}
[data-wk="wxcardsky"] svg{stroke:${C.step} !important}
[data-wk="wxcardsay"]{background:rgba(0,0,0,.2) !important;color:#fff !important;border-top:1px solid rgba(201,194,240,.35) !important}
/* 位置：一枚锁孔图钉 */
[data-wk="geopin"]{background:${svg(KEYHOLEPIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:26px !important;height:34px !important;border-radius:0 !important;filter:drop-shadow(0 0 5px rgba(255,220,150,.7)) !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:#C9C2F0 !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px #E8E0D4 !important}

/* 拍一拍、通话结束：一行淡字，两头各一级小台阶 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:linear-gradient(${C.step},${C.step}) left center/10px 2px no-repeat,linear-gradient(${C.step},${C.step}) right center/10px 2px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 18px !important;color:${C.fog} !important;box-shadow:none !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.step} !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;max-width:86% !important;background:rgba(42,37,96,.75) !important;border:none !important;border-left:3px solid #FFE0A8 !important;border-radius:2px 10px 10px 2px !important;padding:8px 14px !important;color:#FFE9C8 !important}
[data-wk="noteink"]{color:${C.fog} !important}

/* 线下小结：一块门牌，标题是钉在门上的铜牌 */
[data-part="offlog"]{position:relative !important;padding-top:28px !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 6px !important;padding:3px 16px !important;background:linear-gradient(180deg,#F2D28A,#C9A04E) !important;color:${C.ink} !important;border-radius:2px !important;box-shadow:0 2px 0 #8F6A26 !important;letter-spacing:.15em !important;font-weight:700 !important}
[data-wk="offlogtitle"] *{color:${C.ink} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.step} !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(201,194,240,.35) !important;color:${C.fog} !important}

/* 加号面板：一格格小门洞，里面透光 */
[data-wk="chatpanel"] *{color:#fff !important}
[data-wk="chattoolicon"]{background:${WARM} !important;border:3px solid ${C.frame} !important;border-radius:3px !important;box-shadow:0 0 10px rgba(255,214,190,.3) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}

/* 引用 */
[data-wk="quotedraft"]{background:rgba(20,20,51,.95) !important;border:none !important;border-top:1px solid rgba(127,240,240,.4) !important}
[data-wk="quotedraft"] *{color:${C.fog} !important;border-color:${C.step} !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:#fff !important}
[data-wk="quote"]{background:rgba(255,255,255,.08) !important;color:${C.fog} !important;border:1px solid rgba(201,194,240,.4) !important;border-radius:4px !important;padding:3px 10px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}

/* 打电话那一屏：夜里，三颗键是三扇小门洞，中间挂断是一扇关着的红门 */
[data-wk="call"][data-video="0"]{background:${svg(STARS)} 0 0/220px 260px,radial-gradient(ellipse at 50% 112%,${C.ground} 0 30%,transparent 55%),linear-gradient(180deg,${C.n1},${C.n2} 55%,${C.n3}) !important}
[data-wk="call"][data-video="0"] [data-wk="calltitle"]{color:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callhead"] > div:not([data-wk]){color:${C.fog} !important}
[data-wk="call"][data-video="0"] > button:first-child{background:transparent !important;box-shadow:0 0 0 1.5px #C9C2F0 !important}
[data-wk="call"][data-video="0"] > button:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button > span:first-child{background:${WARM} !important;border-radius:4px 4px 2px 2px !important;box-shadow:0 0 0 4px ${C.frame},0 0 16px 3px rgba(255,214,190,.35) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:${C.ink} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:#C9475E !important;box-shadow:0 0 0 4px #7A2638 !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:${C.fog} !important}
[data-wk="callbubble"]{background:${WARM} !important;color:${C.ink} !important;border:4px solid ${C.frame} !important;border-radius:2px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${RAINBOW} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callbubble"][data-kind="typing"] [data-wk="typingdot"]{background:${C.frame} !important}
[data-wk="callact"]{color:#FFE9C8 !important;font-style:italic !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 4px #E8E0D4,0 0 0 18px ${C.stone},0 0 30px 18px rgba(255,220,150,.35) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "星野门扉", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "星野门扉-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
