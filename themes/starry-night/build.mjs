// 星空聊天美化：生成 chat-look 包。用法：node themes/starry-night/build.mjs
// 配色：夜蓝 #070A22 → #1B1A52 → #4A2A78 → 晚霞 #F09A78；金 #FFD98A；字 #F4F1FF / 灰紫 #B4B0E0；我的气泡 #6F5BFF→#C56BE0
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;utf8," + encodeURIComponent(s).replace(/'/g, "%27").replace(/"/g, "%22") + "\")";
const C = { night: "#070A22", deep: "#1B1A52", violet: "#4A2A78", dusk: "#A2477F", glow: "#F09A78", gold: "#FFD98A", ink: "#F4F1FF", dim: "#B4B0E0", glass: "rgba(11,15,43,.45)" };

// 四角星
const SPARK = (f = C.gold, s = 9) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-10 -10 20 20'><path d='M0 -${s} Q${s * .12} -${s * .12} ${s} 0 Q${s * .12} ${s * .12} 0 ${s} Q-${s * .12} ${s * .12} -${s} 0 Q-${s * .12} -${s * .12} 0 -${s}Z' fill='${f}'/></svg>`;
// 月相小图标：k 0..7（0 新月、4 满月）
const phasePath = (k, r) => {
  if (k === 0) return "";
  if (k === 4) return `<circle r='${r}' fill='${C.gold}'/>`;
  const waxing = k < 4, rx = Math.abs(r * Math.cos(2 * Math.PI * k / 8)).toFixed(2), crescent = k === 1 || k === 7;
  const outer = waxing ? 1 : 0, term = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  return `<path d='M0 -${r} A${r} ${r} 0 0 ${outer} 0 ${r} A${rx} ${r} 0 0 ${term} 0 -${r}Z' fill='${C.gold}'/>`;
};
const MOONDOT = (k, r = 6) => `<g><circle r='${r}' fill='#0B0F2B' fill-opacity='.6' stroke='${C.gold}' stroke-width='.9'/>${phasePath(k, r)}</g>`;
// 顶栏底下那一排：新月→满月→残月九颗，今天那颗放大发光
const STRIP = today => {
  const xs = [-88, -66, -44, -22, 0, 22, 44, 66, 88];
  const seq = [0, 1, 2, 3, 4, 5, 6, 7, 0];
  const dots = xs.map((x, i) => {
    const on = seq[i] === today && (today !== 0 || i === 0);
    return `<g transform='translate(${240 + x} 9)'>${MOONDOT(seq[i], 6)}${on ? `<path d='M-3 11 L3 11 L0 15.5Z' fill='${C.gold}'/>` : ""}</g>`;
  }).join("");
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 24' preserveAspectRatio='xMidYMid meet'><defs><linearGradient id='a' x1='0' x2='1'><stop offset='0' stop-color='${C.gold}' stop-opacity='0'/><stop offset='1' stop-color='${C.gold}'/></linearGradient><linearGradient id='b' x1='1' x2='0'><stop offset='0' stop-color='${C.gold}' stop-opacity='0'/><stop offset='1' stop-color='${C.gold}'/></linearGradient></defs><rect x='0' y='8.4' width='140' height='1.2' fill='url(#a)'/><rect x='340' y='8.4' width='140' height='1.2' fill='url(#b)'/>${dots}</svg>`;
};
// 满天星（平铺）
const STARS = (() => { let r = 7, out = ""; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const cols = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#F5B8FF", "#A8F0FF", "#FFE9B0"];
  for (let i = 0; i < 70; i++) out += `<circle cx='${(rnd() * 240).toFixed(1)}' cy='${(rnd() * 240).toFixed(1)}' r='${(.5 + rnd() * 1.1).toFixed(2)}' fill='${cols[Math.floor(rnd() * cols.length)]}' opacity='${(.35 + rnd() * .6).toFixed(2)}'/>`;
  for (const [x, y, s, f] of [[30, 60, 7, "#FFFFFF"], [190, 150, 5, "#A8F0FF"], [120, 210, 6, "#F5B8FF"]]) out += `<g transform='translate(${x} ${y})'>${SPARK(f, s).replace(/<\/?svg[^>]*>/g, "")}</g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>${out}</svg>`; })();
// 右下角那轮大月亮＋刻度光环＋山和树的剪影、坐着的小兔
const TREE = `<path d='M0 -44 L11 -22 H5 L15 -4 H7 L19 16 H-19 L-7 -4 H-15 L-5 -22 H-11 Z'/><rect x='-2.5' y='16' width='5' height='8'/>`;
const SCENE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 560 480 390' preserveAspectRatio='xMidYMax slice'><defs><radialGradient id='m' cx='.38' cy='.35' r='.75'><stop offset='0' stop-color='#FFFBEA'/><stop offset='.6' stop-color='#FFE3A3'/><stop offset='1' stop-color='#E9B25A'/></radialGradient><radialGradient id='g'><stop offset='.3' stop-color='#FFE3A3' stop-opacity='.45'/><stop offset='1' stop-color='#FFE3A3' stop-opacity='0'/></radialGradient></defs><circle cx='366' cy='690' r='170' fill='url(#g)'/><circle cx='366' cy='690' r='108' fill='none' stroke='${C.gold}' stroke-width='1' stroke-dasharray='120 560' stroke-dashoffset='-40' stroke-linecap='round' opacity='.75'/><circle cx='366' cy='690' r='96' fill='none' stroke='${C.gold}' stroke-width='.8' stroke-dasharray='70 540' stroke-dashoffset='-330' stroke-linecap='round' opacity='.6'/><circle cx='366' cy='690' r='76' fill='url(#m)'/><g fill='#C98F3F' opacity='.22'><circle cx='342' cy='668' r='15'/><circle cx='392' cy='698' r='20'/><circle cx='354' cy='724' r='10'/><circle cx='396' cy='654' r='7'/></g><path d='M0 800 Q90 740 190 786 T400 770 T480 790 V950 H0 Z' fill='#2A1B5E'/><g fill='#2A1B5E'><g transform='translate(232 778) scale(.7)'>${TREE}</g><g transform='translate(452 776) scale(.8)'>${TREE}</g></g><path d='M0 838 Q70 778 160 812 T330 830 T480 812 V950 H0 Z' fill='#150F3A'/><g fill='#150F3A'><g transform='translate(30 810)'>${TREE}</g><g transform='translate(60 806) scale(.7)'>${TREE}</g><g transform='translate(300 826) scale(.9)'>${TREE}</g><g transform='translate(122 780) scale(1.15)'><ellipse cx='0' cy='6' rx='10' ry='13'/><circle cx='4' cy='-13' r='9'/><ellipse cx='13' cy='-11' rx='6' ry='4'/><ellipse cx='-3' cy='-12' rx='4' ry='8.5' transform='rotate(18 -3 -12)'/><path d='M-9 14 q-12 2 -12 -9' fill='none' stroke='#150F3A' stroke-width='4' stroke-linecap='round'/><rect x='2' y='8' width='5' height='12' rx='2.5'/></g></g></svg>`;
// 头像外圈：金色刻度光环＋右上一颗小金点
const RING = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-40 -40 80 80'><defs><radialGradient id='h'><stop offset='.55' stop-color='${C.gold}' stop-opacity='.35'/><stop offset='1' stop-color='${C.gold}' stop-opacity='0'/></radialGradient></defs><circle r='38' fill='url(#h)'/><circle r='32' fill='none' stroke='${C.gold}' stroke-width='5' stroke-dasharray='1.2 7.2' opacity='.9'/><circle r='27.5' fill='none' stroke='${C.gold}' stroke-width='.8' opacity='.7'/><circle r='24' fill='none' stroke='${C.gold}' stroke-width='2'/><circle cx='22.6' cy='-22.6' r='4.5' fill='${C.gold}'/></svg>`;
// 按键
const MOONFRAME = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='mg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#FFF1C4'/><stop offset='.5' stop-color='#F3C566'/><stop offset='1' stop-color='#D9A040'/></linearGradient><radialGradient id='gl'><stop offset='.74' stop-color='#FFD98A' stop-opacity='0'/><stop offset='.78' stop-color='#FFD98A' stop-opacity='.5'/><stop offset='1' stop-color='#FFD98A' stop-opacity='0'/></radialGradient></defs><circle cx='100' cy='100' r='80' fill='url(#gl)'/><path d='M184.8 85.8 A86 86 0 1 1 130.7 19.7 A74 74 0 1 0 184.8 85.8 Z' fill='url(#mg)' stroke='#D9A040' stroke-width='.8'/><circle cx='100' cy='100' r='62.5' fill='none' stroke='url(#mg)' stroke-width='2.5'/><path d='M130.7 19.7 v9' stroke='#F3C566' stroke-width='1'/><polygon points='130.7,28.2 132.9,32.8 137.9,33.4 134.2,36.8 135.1,41.7 130.7,39.3 126.3,41.7 127.3,36.8 123.6,33.4 128.6,32.8' fill='url(#mg)' stroke='#D9A040' stroke-width='.6' stroke-linejoin='round'/><path d='M112 176 a10 10 0 0 1 4 -19 a13 13 0 0 1 24 -3 a10 10 0 0 1 6 19 a7 7 0 0 1 -6 3 z' fill='#FFF7E0' stroke='#F3C566' stroke-width='1'/><path transform='translate(178 60)' d='M0 -9 Q.9 -.9 9 0 Q.9 .9 0 9 Q-.9 .9 -9 0 Q-.9 -.9 0 -9 Z' fill='#FFFFFF'/><path transform='translate(166 36)' d='M0 -5 Q.5 -.5 5 0 Q.5 .5 0 5 Q-.5 .5 -5 0 Q-.5 -.5 0 -5 Z' fill='#FFD98A'/><path transform='translate(184 128)' d='M0 -5 Q.5 -.5 5 0 Q.5 .5 0 5 Q-.5 .5 -5 0 Q-.5 -.5 0 -5 Z' fill='#FFD98A'/><path transform='translate(40 60)' d='M0 -4 Q.4 -.4 4 0 Q.4 .4 0 4 Q-.4 .4 -4 0 Q-.4 -.4 0 -4 Z' fill='#FFF7E0' opacity='.9'/><path transform='translate(58 150)' d='M0 -3.5 Q.35 -.35 3.5 0 Q.35 .35 0 3.5 Q-.35 .35 -3.5 0 Q-.35 -.35 0 -3.5 Z' fill='#FFF7E0' opacity='.9'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='15' fill='none' stroke='${C.gold}' stroke-width='2'/><path d='M13.5 20 h13 M20 13.5 v13' stroke='${C.gold}' stroke-width='2' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><defs><radialGradient id='m' cx='.38' cy='.35' r='.75'><stop offset='0' stop-color='#FFFBEA'/><stop offset='.6' stop-color='#FFE3A3'/><stop offset='1' stop-color='#E9B25A'/></radialGradient><radialGradient id='h'><stop offset='.55' stop-color='${C.gold}' stop-opacity='.4'/><stop offset='1' stop-color='${C.gold}' stop-opacity='0'/></radialGradient></defs><circle cx='28' cy='28' r='27' fill='url(#h)'/><circle cx='28' cy='28' r='19' fill='url(#m)'/><g transform='rotate(-35 28 28)'><rect x='16' y='26.8' width='14' height='2.4' rx='1.2' fill='#0B0F2B' opacity='.7'/></g><g transform='translate(33 24)'>${SPARK("#0B0F2B", 6.5).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='#fff' fill-opacity='.1' stroke='${C.gold}' stroke-width='1.2'/><path d='M12 12 h16 a5 5 0 0 1 5 5 v5 a5 5 0 0 1 -5 5 h-9 l-6 5 l1 -5 a5 5 0 0 1 -7 -5 v-5 a5 5 0 0 1 5 -5 z' fill='none' stroke='${C.ink}' stroke-width='1.8' stroke-linejoin='round'/><circle cx='14.5' cy='19.5' r='1.4' fill='${C.ink}'/><circle cx='20' cy='19.5' r='1.4' fill='${C.ink}'/><circle cx='25.5' cy='19.5' r='1.4' fill='${C.ink}'/></svg>`;
const I_PLANET = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-22 -22 44 44'><circle r='11' fill='${C.gold}' fill-opacity='.35' stroke='${C.gold}' stroke-width='2'/><ellipse rx='19' ry='6' fill='none' stroke='${C.gold}' stroke-width='1.6' transform='rotate(-20)'/></svg>`;
const I_SPARKS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 20'><g transform='translate(8 10)'>${SPARK(C.gold, 5).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(22 10)'>${SPARK(C.gold, 7).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(36 10)'>${SPARK(C.gold, 5).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;

const bubble = { myBg: "#6F5BFF", myText: C.ink, myBorder: "1px solid rgba(255,255,255,.45)", charBg: C.glass, charText: C.ink, charBorder: "1.2px solid rgba(255,217,138,.75)", radius: 22, shadow: "none", myAlpha: 100, charAlpha: 100 };
const strip = [0, 1, 2, 3, 4, 5, 6, 7].map(k => `html[data-lisa-moon="${k}"] [data-wk="chathead"]::after{background-image:${svg(STRIP(k))} !important}`).join("\n");

const css = `
/* ───── 星空 · 第一批：夜空、月亮、顶栏月相、气泡、头像光环、底栏 ───── */
[data-wk="chat"]{background:${svg(STARS)} 0 0/240px 240px,radial-gradient(ellipse at 15% 35%,rgba(63,208,201,.09),transparent 55%),radial-gradient(ellipse at 90% 55%,rgba(230,107,208,.09),transparent 55%),linear-gradient(180deg,#05061A 0%,#0A0B26 40%,#1A1440 65%,#3A2468 85%,#8A4278 95%,#D98670 100%) !important;position:relative !important}
/* 大月亮和山：钉在底下，不跟着消息滚，消息从它上面滑过 */
[data-wk="chat"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:0 !important;height:56% !important;background:${svg(SCENE)} center bottom/cover no-repeat !important;pointer-events:none !important;z-index:0 !important;opacity:.95 !important}
[data-wk="body"]{background:transparent !important;position:relative !important;z-index:1 !important}
/* 顶栏：深夜色半透明，底下一排月相，今天那颗亮 */
[data-wk="chathead"]{background:rgba(7,10,34,.72) !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% - 12px) !important;height:24px !important;background:center/auto 24px no-repeat !important;pointer-events:none !important}
${strip}
[data-wk="headink"]{color:${C.ink} !important}
[data-wk="headdim"]{color:${C.dim} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="chatmore"],[data-wk="sameroom"]{border:none !important;box-shadow:none !important;background:${svg(I_SPARKS)} center/40px auto no-repeat !important;width:44px !important}
[data-wk="sameroom"]{background-image:${svg(I_PLANET)} !important;background-size:36px 36px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="body"]{padding-top:22px !important}

/* 头像：金色刻度光环 */
[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important}
[data-wk="avatar"] *{border-radius:50% !important}
img[data-wk="avatar"],[data-wk="avatar"] img{clip-path:circle(50%) !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-38% !important;background:${svg(RING)} center/contain no-repeat !important;pointer-events:none !important;z-index:2 !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:62px !important;height:62px !important;left:-13px !important;top:calc(50% - 31px) !important;background:${svg(RING)} center/contain no-repeat !important;pointer-events:none !important;z-index:2 !important}

/* 气泡：你的紫色渐变带星点，他的磨砂玻璃金边；角上闪一颗四角星 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;color:${C.ink} !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${svg(STARS)} 0 0/120px 120px,linear-gradient(135deg,#6F5BFF,#C56BE0) !important;border-radius:22px 4px 22px 22px !important;box-shadow:0 0 0 3px rgba(181,140,255,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.05)),rgba(11,15,43,.45) !important;backdrop-filter:blur(4px) !important;-webkit-backdrop-filter:blur(4px) !important;border-radius:4px 22px 22px 22px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;top:-10px !important;width:22px !important;height:22px !important;border:none !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><g transform='translate(10 13)'>${SPARK(C.gold, 9).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(20 4)'>${SPARK("#fff", 4).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} center/contain no-repeat !important;transform:none !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{left:-10px !important;right:auto !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{right:-12px !important;left:auto !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
/* 已读：前面一颗月亮，送达是半月、已读是满月 */
[data-wk="meta"]{color:${C.dim} !important}
[data-wk="meta"]::before{content:"" !important;display:inline-block !important;width:11px !important;height:11px !important;margin-right:4px !important;vertical-align:-1px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-7 -7 14 14'>${MOONDOT(4, 5.5)}</svg>`)} center/contain no-repeat !important}
[data-wk="meta"][data-me="1"]::before{background-image:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-7 -7 14 14'>${MOONDOT(2, 5.5)}</svg>`)} !important}
/* 时间：两道渐隐金线夹着，两头各一颗星 */
[data-wk="time"] > span{color:${C.gold} !important;letter-spacing:.15em !important;padding:0 26px !important;background:${svg(SPARK())} left center/10px 10px no-repeat,${svg(SPARK())} right center/10px 10px no-repeat !important;position:relative !important}
[data-wk="time"]{background:linear-gradient(90deg,transparent 10%,rgba(255,217,138,.6) 35%,transparent 35%,transparent 65%,rgba(255,217,138,.6) 65%,transparent 90%) center/100% 1px no-repeat !important}

/* 底栏：金边玻璃胶囊，发送是一颗小月亮 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important}
[data-wk="composer"] > div:has([data-wk="chatinput"]),[data-wk="chatinput"]{background:transparent !important}
[data-wk="chatinput"]{color:${C.ink} !important;border:none !important;border-radius:0 !important;background:transparent !important;box-shadow:none !important}
/* 整个底栏画成一颗金边玻璃胶囊，加号、输入框、发送、回复都包在里面 */
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:8px !important;right:8px !important;top:6px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + 6px) !important;border-radius:999px !important;border:1.3px solid rgba(255,217,138,.8) !important;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.04)),rgba(7,10,34,.62) !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important;pointer-events:none !important;z-index:0 !important}
[data-wk="composer"] > *{position:relative !important;z-index:1 !important}
[data-wk="composer"] > div{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="chatinput"]::placeholder{color:${C.dim} !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/78% no-repeat !important;margin-right:6px !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}

/* 底栏四颗键一样大、上下居中 */
[data-wk="composer"]{align-items:center !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{width:38px !important;height:38px !important;min-width:38px !important;align-self:center !important;margin-top:0 !important;margin-bottom:0 !important;transform:none !important;background-size:contain !important}
[data-wk="send"]{background-size:120% !important}
/* 月亮调暗，压在字后面不抢眼 */
[data-wk="chat"]::before{opacity:.72 !important;filter:brightness(.9) !important}
/* 流星：每隔几秒从右上划过一颗 */
@keyframes snMeteor{0%{transform:translate(0,0) rotate(-32deg);opacity:0}3%{opacity:1}14%{transform:translate(-420px,260px) rotate(-32deg);opacity:0}100%{transform:translate(-420px,260px) rotate(-32deg);opacity:0}}
@keyframes snMeteor2{0%,40%{transform:translate(0,0) rotate(-28deg);opacity:0}43%{opacity:.9}54%{transform:translate(-380px,220px) rotate(-28deg);opacity:0}100%{opacity:0}}
[data-wk="chat"]::after{content:"" !important;position:absolute !important;top:120px !important;right:-140px !important;width:130px !important;height:3px !important;border-radius:3px !important;background:linear-gradient(90deg,#fff,rgba(255,217,138,.7) 30%,transparent) !important;box-shadow:0 0 8px 1px rgba(255,255,255,.6) !important;pointer-events:none !important;z-index:0 !important;animation:snMeteor 4s ease-in infinite !important}
[data-wk="body"]::before{content:"" !important;position:fixed !important;top:300px !important;right:-100px !important;width:90px !important;height:2px !important;border-radius:2px !important;background:linear-gradient(90deg,#fff,rgba(168,240,255,.6) 30%,transparent) !important;pointer-events:none !important;animation:snMeteor2 5.5s ease-in infinite !important}
@media (prefers-reduced-motion:reduce){[data-wk="chat"]::after,[data-wk="body"]::before{animation:none !important;opacity:0 !important}}
/* 系统提示：一行星座连线小字，不要白框 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important;text-align:center !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{color:${C.dim} !important;font-style:normal !important;font-size:12px !important;letter-spacing:.06em !important}
[data-wk="sysnotetext"]::before{content:"✦ " !important;color:${C.gold} !important}
[data-wk="sysnoteclose"]{color:${C.dim} !important;opacity:.6 !important}
[data-wk="narrink"]{color:${C.dim} !important}
[data-wk="name"]{color:${C.dim} !important}

/* 第三颗流星 */
@keyframes snMeteor3{0%,60%{transform:translate(0,0) rotate(-36deg);opacity:0}62%{opacity:1}74%{transform:translate(-460px,300px) rotate(-36deg);opacity:0}100%{opacity:0}}
[data-wk="body"]::after{content:"" !important;position:fixed !important;top:180px !important;left:105% !important;width:110px !important;height:2.5px !important;border-radius:2px !important;background:linear-gradient(90deg,#fff,rgba(245,184,255,.6) 30%,transparent) !important;box-shadow:0 0 6px rgba(255,255,255,.5) !important;pointer-events:none !important;animation:snMeteor3 8s ease-in infinite !important}
@media (prefers-reduced-motion:reduce){[data-wk="body"]::after{animation:none !important;opacity:0 !important}}

/* ───── 第二批：卡片都是磨砂玻璃＋金边，像夜空里的一块星图 ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.05)),rgba(11,15,43,.55) !important;border:1.2px solid rgba(255,217,138,.75) !important;backdrop-filter:blur(5px) !important;-webkit-backdrop-filter:blur(5px) !important;color:#F4F1FF !important;border-radius:18px !important;box-shadow:0 0 18px rgba(255,217,138,.12) !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *{color:#F4F1FF !important;border-color:rgba(255,217,138,.35) !important}
/* 转账：金额是金色，已收是一颗满月章，待收是新月章 */
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.gold} !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,217,138,.7),transparent) !important}
[data-wk="transfernotch"]{background:${C.deep} !important}
[data-wk="transferfoot"]{background:rgba(255,255,255,.06) !important}
[data-wk="transferseal"]{width:52px !important;height:52px !important;border:none !important;box-shadow:none !important;border-radius:50% !important;color:#0B0F2B !important;font-weight:700 !important;background:radial-gradient(circle at 38% 35%,#FFFBEA,#FFE3A3 60%,#E9B25A) !important;opacity:1 !important}
[data-wk="transferseal"] *{color:#0B0F2B !important}
[data-wk="transfercard"][data-status="pending"] [data-wk="transferseal"]{background:rgba(11,15,43,.6) !important;border:1.5px solid ${C.gold} !important;color:${C.gold} !important}
[data-wk="transfercard"][data-status="pending"] [data-wk="transferseal"] *{color:${C.gold} !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{background:rgba(180,176,224,.25) !important;color:${C.dim} !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:linear-gradient(135deg,#6F5BFF,#C56BE0) !important;color:#fff !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:${C.dim} !important;border:1px solid rgba(180,176,224,.5) !important}
/* 红包：留红，像一盏小灯笼，扣子是金色满月 */
[data-wk="rpcard"]{border-radius:18px !important;box-shadow:0 0 22px rgba(255,120,120,.25) !important;border:1.2px solid rgba(255,217,138,.7) !important}
[data-wk="rpseal"]{border:none !important;background:radial-gradient(circle at 38% 35%,#FFFBEA,#FFE3A3 60%,#E9B25A) !important;box-shadow:0 0 10px rgba(255,217,138,.7) !important}
[data-wk="rpseal"] *{display:none !important}
[data-wk="rpenvelope"][data-stage="open"]{background:linear-gradient(180deg,${C.deep},${C.violet}) !important;border:1.2px solid rgba(255,217,138,.7) !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:${C.ink} !important}
[data-wk="rpamount"]{color:${C.gold} !important}
[data-wk="rpopenbtn"]{background:radial-gradient(circle at 38% 35%,#FFFBEA,#FFE3A3 60%,#E9B25A) !important;box-shadow:0 0 18px rgba(255,217,138,.8) !important}
/* 照片：没图时是一块望远镜里的圆形星空 */
[data-wk="photoface"]{background:radial-gradient(circle,rgba(108,123,255,.35),rgba(7,10,34,.9) 70%),${C.night} !important;border:1px solid rgba(255,217,138,.5) !important;border-radius:14px !important}
[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}
/* 语音、天气、位置、名片 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"] [data-wk="voicebar"]{background:transparent !important}
[data-wk="voicewave"] span{background:${C.gold} !important}
[data-wk="wxcardsky"]{background:linear-gradient(170deg,rgba(108,123,255,.35),rgba(74,42,120,.5)) !important;color:${C.ink} !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.gold} !important}
[data-wk="wxcardsay"]{background:transparent !important;color:${C.ink} !important;border-top:1px solid rgba(255,217,138,.35) !important}
[data-wk="geopin"]{background:${C.gold} !important;box-shadow:0 0 10px ${C.gold} !important}
[data-wk="geopinstem"]{background:${C.gold} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px ${C.gold} !important}
/* 拍一拍、通话结束、线下小结 */
[data-wk="note"]{color:${C.dim} !important}
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{background:rgba(11,15,43,.5) !important;border:1px solid rgba(255,217,138,.55) !important;border-radius:999px !important;color:${C.gold} !important;padding:2px 14px !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.gold} !important}
[data-wk="offlogtitle"]{color:${C.gold} !important;letter-spacing:.2em !important}
/* 加号面板：一片夜空里的金边圆星球 */
[data-wk="chatpanel"]{background:linear-gradient(180deg,rgba(7,10,34,.9),rgba(27,26,82,.95)) !important;border-top:1px solid rgba(255,217,138,.5) !important}
[data-wk="chattoolicon"]{background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.18),rgba(11,15,43,.6)) !important;border:1.2px solid rgba(255,217,138,.75) !important;border-radius:50% !important;box-shadow:0 0 12px rgba(255,217,138,.18) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.gold} !important;color:${C.gold} !important}
[data-wk="chattoollabel"]{color:${C.dim} !important}
/* 引用、正在输入 */
[data-wk="quotedraft"]{background:rgba(11,15,43,.7) !important;border-left:2px solid ${C.gold} !important}
[data-wk="quotedraft"] *{background:transparent !important;color:${C.dim} !important;border:none !important}
[data-wk="bubble"][data-kind="typing"]{background:rgba(11,15,43,.45) !important;border:1.2px solid rgba(255,217,138,.6) !important}
[data-wk="bubble"][data-kind="typing"]::before{content:none !important}
[data-wk="typingdot"]{width:10px !important;height:10px !important;border-radius:0 !important;background:${svg(SPARK(C.gold, 9))} center/contain no-repeat !important;animation-duration:1.2s !important}

/* 系统字、动描压在月亮上也看得清：垫一层夜色小底 */
[data-wk="sysnotetext"],[data-wk="narrink"],[data-wk="name"]{background:rgba(7,10,34,.62) !important;border-radius:12px !important;padding:2px 10px !important;-webkit-box-decoration-break:clone !important;box-decoration-break:clone !important;text-shadow:0 1px 2px rgba(0,0,0,.6) !important}
[data-wk="sysnotetext"],[data-wk="narrink"]{display:inline !important;line-height:2 !important;color:#E4E0FF !important}
[data-wk="meta"]{text-shadow:0 1px 2px rgba(0,0,0,.7) !important}

/* 胶囊放大，按键缩一点，全包进去 */
[data-wk="composer"]::before{left:6px !important;right:6px !important;top:2px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 8px) !important}
[data-wk="composer"]{padding-left:16px !important;padding-right:16px !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{width:34px !important;height:34px !important;min-width:34px !important;margin:0 !important}
[data-wk="chatreply"]{background-size:100% !important}
[data-wk="send"]{background-size:118% !important;opacity:1 !important}

/* 头像框：月牙抱着头像；我的那颗左右翻过来 */
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{inset:-30% !important;background:${svg(MOONFRAME)} center/contain no-repeat !important}
span[data-wk="avatar"]:not([data-halo])::before{transform:scaleX(-1) !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{width:58px !important;height:58px !important;left:-11px !important;top:calc(50% - 29px) !important;background:${svg(MOONFRAME)} center/contain no-repeat !important}

/* ───── 第三批：状态卡＝一张星盘 ───── */
[data-wk="statecard"]{background:${svg(STARS)} 0 0/240px 240px,radial-gradient(circle at 50% 32%,rgba(90,70,170,.22),transparent 55%),linear-gradient(180deg,#05061A,#0A0B26 55%,#120E30) !important;border:1.2px solid rgba(255,217,138,.7) !important;border-radius:26px !important;box-shadow:0 0 40px rgba(255,217,138,.15),0 20px 50px rgba(0,0,0,.5) !important;color:${C.ink} !important;position:relative !important;overflow:hidden !important;--sc-heart-mask:${svg(SPARK("#000", 10))} !important;--sc-heart-ink:${C.gold} !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-120px !important;width:420px !important;height:420px !important;margin-left:-210px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-100 -100 200 200'><g fill='none' stroke='${C.gold}' opacity='.35'><circle r='96' stroke-width='.6'/><circle r='80' stroke-width='5' stroke-dasharray='.6 4.6'/><circle r='70' stroke-width='.5'/><circle r='40' stroke-width='.5' stroke-dasharray='2 3'/>${Array.from({length:12},(_, i)=>`<line x1='0' y1='-70' x2='0' y2='-96' transform='rotate(${i*30})' stroke-width='.5'/>`).join("")}</g></svg>`)} center/contain no-repeat !important;pointer-events:none !important;animation:snSpin 120s linear infinite !important}
@keyframes snSpin{to{transform:rotate(360deg)}}
[data-wk="statecard"] *{color:${C.ink} !important;border-color:rgba(255,217,138,.3) !important}
[data-wk="statehead"]{background:transparent !important;position:relative !important}
[data-wk="statehead"] [data-wk="avatar"]{box-shadow:0 0 0 2px ${C.gold},0 0 18px rgba(255,217,138,.6) !important}
[data-wk="statemood"]{color:${C.gold} !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:rgba(11,15,43,.5) !important;border-radius:999px !important;margin:4px 16px 8px !important;padding:3px !important;border:1px solid rgba(255,217,138,.4) !important}
[data-wk="statecard"] button[aria-pressed]{border-radius:999px !important;border:none !important;color:${C.dim} !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:linear-gradient(135deg,#6F5BFF,#C56BE0) !important;color:#fff !important}
[data-wk="stateseen"],[data-wk="statevoice"]{background:rgba(11,15,43,.55) !important;border:1px solid rgba(255,217,138,.5) !important;border-radius:18px !important;margin:10px 16px !important;position:relative !important;backdrop-filter:blur(4px) !important;-webkit-backdrop-filter:blur(4px) !important}
[data-wk="stateseen"] > span[aria-hidden]{border-color:${C.gold} !important}
[data-wk="statevoice"] > span[aria-hidden]{color:${C.gold} !important;opacity:.25 !important}
[data-wk="statewear"]{color:${C.dim} !important}
[data-wk="stateaff"]{border-top:1px solid rgba(255,217,138,.3) !important;background:transparent !important}
[data-wk="stateheartline"]{background:${C.gold} !important}
[data-wk="stateheartbase"]{background:rgba(11,15,43,.8) !important;opacity:1 !important}
[data-wk="stateheartnum"]{color:#0B0F2B !important;-webkit-text-stroke:0 !important;font-weight:700 !important}
[data-wk="statehist"] *{color:${C.ink} !important}
[data-wk="statehistitem"]{border-bottom:1px solid rgba(255,217,138,.25) !important}
[data-wk="statehistmood"],[data-wk="statehisttime"]{color:${C.gold} !important}
[data-wk="statehistbtn"]{color:${C.gold} !important;border-color:rgba(255,217,138,.4) !important;background:transparent !important}
[data-wk="gazepage"]{background:transparent !important}
[data-wk="gazetitle"]{color:${C.gold} !important;text-shadow:0 0 12px rgba(255,217,138,.5) !important}
[data-wk="gazetab"]{background:rgba(11,15,43,.5) !important;color:${C.dim} !important;border:1px solid rgba(255,217,138,.4) !important}
[data-wk="gazetab"][data-on="1"]{background:linear-gradient(135deg,#6F5BFF,#C56BE0) !important;color:#fff !important}
[data-wk="gazecard"],[data-wk="gazeempty"],[data-wk="gazeletter"],[data-wk="gazehistory"]{background:rgba(11,15,43,.6) !important;border:1px solid rgba(255,217,138,.45) !important;border-radius:16px !important}
[data-wk="gazecardname"]{color:${C.gold} !important}
[data-wk="gazecardtext"],[data-wk="gazestatus"]{color:${C.dim} !important}
[data-wk="gazeempty"] button{background:linear-gradient(135deg,#6F5BFF,#C56BE0) !important;color:#fff !important;border-radius:999px !important}

/* ───── 线下：同一片夜空，正文是浮在天上的玻璃纸 ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(STARS)} 0 0/240px 240px,linear-gradient(180deg,${C.night},${C.deep} 50%,${C.violet}) !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="offtitle"]{color:${C.ink} !important}
[data-wk="offline"] [data-wk="chathead"] *{color:${C.dim} !important}
[data-wk="offline"] [data-wk="chathead"] svg{stroke:${C.gold} !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){color:${C.gold} !important;border:1px solid rgba(255,217,138,.6) !important;border-radius:999px !important;padding:2px 12px !important}
[data-wk="offcard"]{background:rgba(11,15,43,.55) !important;border:1px solid rgba(255,217,138,.45) !important;border-radius:20px !important;box-shadow:0 0 20px rgba(108,123,255,.15) !important;backdrop-filter:blur(4px) !important;-webkit-backdrop-filter:blur(4px) !important}
[data-wk="offcard"][data-me="1"]{background:linear-gradient(135deg,rgba(111,91,255,.45),rgba(197,107,224,.4)) !important}
[data-wk="offname"]{color:${C.gold} !important}
[data-wk="offtext"]{color:${C.ink} !important}
[data-wk="offsay"]{color:#FFE9B0 !important}
[data-wk="offthought"]{background:rgba(255,217,138,.08) !important;border-left:2px solid ${C.gold} !important;color:${C.dim} !important}
[data-wk="offreplyopt"]{background:rgba(11,15,43,.6) !important;border:1px solid rgba(255,217,138,.5) !important;color:${C.ink} !important;border-radius:999px !important}
[data-wk="offcomposer"]{background:rgba(7,10,34,.8) !important;border-top:1px solid rgba(255,217,138,.4) !important}
[data-wk="offcomposer"] textarea{background:rgba(11,15,43,.6) !important;color:${C.ink} !important;border:1px solid rgba(255,217,138,.6) !important;border-radius:20px !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/120% no-repeat !important;border:none !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) *{opacity:0 !important}

/* ───── 通话：字幕像星光，大头像套月牙 ───── */
[data-wk="callbubble"]{background:rgba(11,15,43,.6) !important;color:${C.ink} !important;border:1px solid rgba(255,217,138,.55) !important;border-radius:18px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:linear-gradient(135deg,rgba(111,91,255,.75),rgba(197,107,224,.7)) !important;border-color:rgba(255,255,255,.4) !important}
[data-wk="callact"]{color:#FFE9B0 !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.gold},0 0 40px rgba(255,217,138,.5) !important}
[data-wk="offline"] [data-wk="chathead"] + *{margin-top:16px !important}

/* ───── 状态卡改版：一张星座图 ───── */
/* 中间是他的头像当主星，外圈一道金弧＝好感；看得见的、心里想的是两颗卫星，金线连着 */
[data-wk="statecard"]{min-height:600px !important}
[data-wk="statehead"]{justify-content:center !important;text-align:center !important;border-bottom:none !important;padding-bottom:4px !important}
[data-wk="statehead"] > div{flex:0 1 auto !important;text-align:center !important}
[data-wk="statehead"] > [data-wk="avatar"]{position:absolute !important;left:50% !important;top:168px !important;width:76px !important;height:76px !important;margin-left:-38px !important;z-index:3 !important;box-shadow:0 0 0 3px #0B0F2B,0 0 30px 6px rgba(255,217,138,.55) !important}
[data-wk="statehead"] > [data-wk="avatar"] *{width:76px !important;height:76px !important}
[data-wk="statehead"] > button[aria-label="关掉"]{position:absolute !important;right:14px !important;top:14px !important}
/* 好感：头像外一圈金弧，亮到几分画到几分 */
[data-wk="stateaff"]{position:static !important;border:none !important;padding:0 !important;min-height:0 !important}
[data-wk="stateaff"] > div:last-child > *:not([data-wk="stateaffval"]){display:none !important}
[data-wk="stateheart"]{position:absolute !important;left:50% !important;top:150px !important;width:112px !important;height:112px !important;margin-left:-56px !important;z-index:2 !important;border-radius:50% !important;background:conic-gradient(${C.gold} calc(var(--sc-heart-lvl) * 360deg),rgba(255,217,138,.15) 0) !important;-webkit-mask:radial-gradient(circle,transparent 52px,#000 53px,#000 56px,transparent 57px) !important;mask:radial-gradient(circle,transparent 52px,#000 53px,#000 56px,transparent 57px) !important}
[data-wk="stateheart"] > *{display:none !important}
[data-wk="stateaff"]::after{content:"" !important;position:absolute !important;left:50% !important;top:268px !important;transform:translateX(-50%) !important}
[data-wk="stateheart"] [data-wk="stateheartnum"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;left:50% !important;top:276px !important;transform:translateX(-50%) !important;color:${C.gold} !important;font-size:13px !important;letter-spacing:.15em !important;z-index:6 !important;white-space:nowrap !important;background:rgba(11,15,43,.7) !important;padding:1px 10px !important;border-radius:999px !important}
[data-wk="stateaffval"]::before{content:"好感 " !important;color:${C.dim} !important}
/* 星座线：从主星连到两颗卫星，再连几颗小星 */
[data-wk="statecard"] > div.flex-1{position:relative !important;padding-top:178px !important}
[data-wk="statecard"] > div.flex-1::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:0 !important;height:330px !important;pointer-events:none !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 340 330' preserveAspectRatio='none'><g stroke='${C.gold}' stroke-width='.9' opacity='.75' fill='none'><path d='M170 70 L60 190'/><path d='M170 70 L280 260'/><path d='M60 190 L28 120 L72 40'/><path d='M280 260 L318 170 L262 30'/></g><g fill='${C.gold}'><circle cx='28' cy='120' r='2.2'/><circle cx='72' cy='40' r='1.8'/><circle cx='318' cy='170' r='2.2'/><circle cx='262' cy='30' r='1.8'/></g></svg>`)} center top/100% 330px no-repeat !important}
/* 两颗卫星：一左一右错开，各自前面一颗亮星 */
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;width:62% !important;max-height:150px !important;overflow:auto !important;overflow-x:hidden !important;border-radius:16px !important;padding:12px 14px !important;z-index:1 !important}
[data-wk="stateseen"]{margin:0 0 14px 4% !important}
[data-wk="statevoice"]{margin:0 4% 14px auto !important}
[data-wk="stateseen"] > span[aria-hidden]{display:none !important}
[data-wk="stateseen"]::after,[data-wk="statevoice"]::after{content:"" !important;position:absolute !important;top:-9px !important;width:18px !important;height:18px !important;background:${svg(SPARK("#FFFFFF", 9))} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.gold}) !important}
[data-wk="stateseen"]::after{left:-6px !important}
[data-wk="statevoice"]::after{right:-6px !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{font-size:13px !important;line-height:1.6 !important}
[data-wk="statevoice"] > span[aria-hidden]{display:none !important}

/* 翻旧心声：沿着一条金色星轨往下，每条是轨道上的一颗星 */
[data-wk="statehist"]{position:relative !important;padding-left:44px !important}
[data-wk="statehistlist"]{position:relative !important}
[data-wk="statehistlist"]::before{content:"" !important;position:absolute !important;left:-24px !important;top:6px !important;bottom:6px !important;width:1px !important;background:linear-gradient(180deg,transparent,${C.gold} 10%,${C.gold} 90%,transparent) !important;opacity:.7 !important}
[data-wk="statehistitem"]{position:relative !important;background:rgba(11,15,43,.55) !important;border:1px solid rgba(255,217,138,.4) !important;border-radius:16px !important;padding:12px 14px !important;margin-bottom:16px !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;left:-33px !important;top:12px !important;width:18px !important;height:18px !important;background:${svg(SPARK("#FFFFFF", 9))} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.gold}) !important}
[data-wk="statehisttext"]{color:${C.ink} !important;font-style:italic !important}
[data-wk="statehistmeta"] *{color:${C.dim} !important}
[data-wk="statehistend"]{display:block !important;text-align:center !important;color:${C.dim} !important}
[data-wk="statehistend"]::before{content:"✦ " !important;color:${C.gold} !important}
[data-wk="statehistbtn"][data-part="back"]{border:1px solid rgba(255,217,138,.5) !important;border-radius:999px !important;display:inline-block !important;width:auto !important;padding:4px 16px !important}

/* 翻旧那页不摆星座：头像回到抬头，金线收掉 */
[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])) [data-wk="statehead"] > [data-wk="avatar"]{position:static !important;width:44px !important;height:44px !important;margin:0 !important}
[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])) [data-wk="statehead"] > [data-wk="avatar"] *{width:44px !important;height:44px !important}
[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])) > div.flex-1{padding-top:8px !important}
[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])) > div.flex-1::before{display:none !important}
[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])) [data-wk="statehead"]{justify-content:flex-start !important}

[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])) [data-wk="stateheart"],[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])) [data-wk="stateaffval"]{display:none !important}
[data-wk="statecard"]:not(:has([data-wk="stateseen"],[data-wk="statevoice"])){min-height:0 !important}

/* Ta 眼里：每张卡顶上的米色胶带换成一颗小金星 */
[data-wk="gazecard"] > :first-child:not([data-wk]){opacity:0 !important}
[data-wk="gazecard"]{position:relative !important;overflow:visible !important}
[data-wk="gazecard"]::before{content:"" !important;position:absolute !important;top:-10px !important;left:calc(50% - 10px) !important;width:20px !important;height:20px !important;background:${svg(SPARK(C.gold, 9))} center/contain no-repeat !important;filter:drop-shadow(0 0 5px rgba(255,217,138,.8)) !important;z-index:2 !important}
`;

const pack = { kind: "chat-look", v: 1, name: "星空", look: { bubble, layout: { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" }, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "星空-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
