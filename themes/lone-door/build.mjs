// 门后有光：夜里的空地上立着一扇扇没有墙的门。每条气泡都是一扇开着的门，门里透出光，门底下接几级发光的台阶；
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

const bubble = { myBg: "#FFE0F0", myText: C.ink, myBorder: "none", charBg: C.warm, charText: C.ink, charBorder: "none", radius: 2, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const RAINBOW = "linear-gradient(110deg,#FFE3F1 0%,#FFF1C9 22%,#E2FFD8 42%,#D5F2FF 62%,#E6DBFF 82%,#FFE3F1 100%)";
const WARM = "radial-gradient(ellipse at 50% 50%,#FFFDF6,#FFE6D0 70%,#FFD3D8)";

const css = `
/* ───── 门后有光 · 第一批 ───── */
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
`;

const pack = { kind: "chat-look", v: 1, name: "门后有光", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "门后有光-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
