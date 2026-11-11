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
    return `<g transform='translate(${240 + x} 12)'>${on ? `<circle r='13' fill='${C.gold}' opacity='.25'/>` : ""}${MOONDOT(seq[i], on ? 9 : 6)}</g>`;
  }).join("");
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 24' preserveAspectRatio='xMidYMid meet'><defs><linearGradient id='a' x1='0' x2='1'><stop offset='0' stop-color='${C.gold}' stop-opacity='0'/><stop offset='1' stop-color='${C.gold}'/></linearGradient><linearGradient id='b' x1='1' x2='0'><stop offset='0' stop-color='${C.gold}' stop-opacity='0'/><stop offset='1' stop-color='${C.gold}'/></linearGradient></defs><rect x='0' y='11.4' width='140' height='1.2' fill='url(#a)'/><rect x='340' y='11.4' width='140' height='1.2' fill='url(#b)'/>${dots}</svg>`;
};
// 满天星（平铺）
const STARS = (() => { let r = 7, out = ""; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const cols = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#F5B8FF", "#A8F0FF", "#FFE9B0"];
  for (let i = 0; i < 70; i++) out += `<circle cx='${(rnd() * 240).toFixed(1)}' cy='${(rnd() * 240).toFixed(1)}' r='${(.5 + rnd() * 1.1).toFixed(2)}' fill='${cols[Math.floor(rnd() * cols.length)]}' opacity='${(.35 + rnd() * .6).toFixed(2)}'/>`;
  for (const [x, y, s, f] of [[30, 60, 7, "#FFFFFF"], [190, 150, 5, "#A8F0FF"], [120, 210, 6, "#F5B8FF"]]) out += `<g transform='translate(${x} ${y})'>${SPARK(f, s).replace(/<\/?svg[^>]*>/g, "")}</g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>${out}</svg>`; })();
// 右下角那轮大月亮＋刻度光环＋山和树的剪影、坐着的小兔
const TREE = `<path d='M0 -44 L11 -22 H5 L15 -4 H7 L19 16 H-19 L-7 -4 H-15 L-5 -22 H-11 Z'/><rect x='-2.5' y='16' width='5' height='8'/>`;
const SCENE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 560 480 390' preserveAspectRatio='xMidYMax slice'><defs><radialGradient id='m' cx='.38' cy='.35' r='.75'><stop offset='0' stop-color='#FFFBEA'/><stop offset='.6' stop-color='#FFE3A3'/><stop offset='1' stop-color='#E9B25A'/></radialGradient><radialGradient id='g'><stop offset='.3' stop-color='#FFE3A3' stop-opacity='.45'/><stop offset='1' stop-color='#FFE3A3' stop-opacity='0'/></radialGradient></defs><circle cx='366' cy='690' r='170' fill='url(#g)'/><circle cx='366' cy='690' r='112' fill='none' stroke='${C.gold}' stroke-width='.8' opacity='.7'/><circle cx='366' cy='690' r='103' fill='none' stroke='${C.gold}' stroke-width='7' stroke-dasharray='1 9.78' opacity='.8'/><circle cx='366' cy='690' r='94' fill='none' stroke='${C.gold}' stroke-width='.8' opacity='.7'/><circle cx='366' cy='690' r='76' fill='url(#m)'/><g fill='#C98F3F' opacity='.22'><circle cx='342' cy='668' r='15'/><circle cx='392' cy='698' r='20'/><circle cx='354' cy='724' r='10'/><circle cx='396' cy='654' r='7'/></g><path d='M0 800 Q90 740 190 786 T400 770 T480 790 V950 H0 Z' fill='#2A1B5E'/><g fill='#2A1B5E'><g transform='translate(232 778) scale(.7)'>${TREE}</g><g transform='translate(452 776) scale(.8)'>${TREE}</g></g><path d='M0 838 Q70 778 160 812 T330 830 T480 812 V950 H0 Z' fill='#150F3A'/><g fill='#150F3A'><g transform='translate(30 810)'>${TREE}</g><g transform='translate(60 806) scale(.7)'>${TREE}</g><g transform='translate(300 826) scale(.9)'>${TREE}</g><g transform='translate(122 780)'><ellipse cx='0' cy='6' rx='10' ry='13'/><circle cx='4' cy='-13' r='9'/><ellipse cx='-3' cy='-12' rx='4' ry='8.5' transform='rotate(18 -3 -12)'/><ellipse cx='5' cy='-14' rx='3.5' ry='8' transform='rotate(-8 5 -14)'/></g></g></svg>`;
// 头像外圈：金色刻度光环＋右上一颗小金点
const RING = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-40 -40 80 80'><defs><radialGradient id='h'><stop offset='.55' stop-color='${C.gold}' stop-opacity='.35'/><stop offset='1' stop-color='${C.gold}' stop-opacity='0'/></radialGradient></defs><circle r='38' fill='url(#h)'/><circle r='32' fill='none' stroke='${C.gold}' stroke-width='5' stroke-dasharray='1.2 7.2' opacity='.9'/><circle r='27.5' fill='none' stroke='${C.gold}' stroke-width='.8' opacity='.7'/><circle r='24' fill='none' stroke='${C.gold}' stroke-width='2'/><circle cx='22.6' cy='-22.6' r='4.5' fill='${C.gold}'/></svg>`;
// 按键
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='15' fill='none' stroke='${C.gold}' stroke-width='2'/><path d='M13.5 20 h13 M20 13.5 v13' stroke='${C.gold}' stroke-width='2' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><defs><radialGradient id='m' cx='.38' cy='.35' r='.75'><stop offset='0' stop-color='#FFFBEA'/><stop offset='.6' stop-color='#FFE3A3'/><stop offset='1' stop-color='#E9B25A'/></radialGradient><radialGradient id='h'><stop offset='.55' stop-color='${C.gold}' stop-opacity='.4'/><stop offset='1' stop-color='${C.gold}' stop-opacity='0'/></radialGradient></defs><circle cx='28' cy='28' r='27' fill='url(#h)'/><circle cx='28' cy='28' r='19' fill='url(#m)'/><g transform='rotate(-35 28 28)'><rect x='16' y='26.8' width='14' height='2.4' rx='1.2' fill='#0B0F2B' opacity='.7'/></g><g transform='translate(33 24)'>${SPARK("#0B0F2B", 6.5).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='#fff' fill-opacity='.1' stroke='${C.gold}' stroke-width='1.2'/><path d='M12 12 h16 a5 5 0 0 1 5 5 v5 a5 5 0 0 1 -5 5 h-9 l-6 5 l1 -5 a5 5 0 0 1 -7 -5 v-5 a5 5 0 0 1 5 -5 z' fill='none' stroke='${C.ink}' stroke-width='1.8' stroke-linejoin='round'/><circle cx='14.5' cy='19.5' r='1.4' fill='${C.ink}'/><circle cx='20' cy='19.5' r='1.4' fill='${C.ink}'/><circle cx='25.5' cy='19.5' r='1.4' fill='${C.ink}'/></svg>`;
const I_PLANET = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-22 -22 44 44'><circle r='11' fill='${C.gold}' fill-opacity='.35' stroke='${C.gold}' stroke-width='2'/><ellipse rx='19' ry='6' fill='none' stroke='${C.gold}' stroke-width='1.6' transform='rotate(-20)'/></svg>`;
const I_SPARKS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 20'><g transform='translate(8 10)'>${SPARK(C.gold, 5).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(22 10)'>${SPARK(C.gold, 7).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(36 10)'>${SPARK(C.gold, 5).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;

const bubble = { myBg: "#6F5BFF", myText: C.ink, myBorder: "1px solid rgba(255,255,255,.45)", charBg: C.glass, charText: C.ink, charBorder: "1.2px solid rgba(255,217,138,.75)", radius: 22, shadow: "none", myAlpha: 100, charAlpha: 100 };
const strip = [0, 1, 2, 3, 4, 5, 6, 7].map(k => `html[data-lisa-moon="${k}"] [data-wk="chathead"]::after{background-image:${svg(STRIP(k))} !important}`).join("\n");

const css = `
/* ───── 星空 · 第一批：夜空、月亮、顶栏月相、气泡、头像光环、底栏 ───── */
[data-wk="chat"]{background:${svg(STARS)} 0 0/240px 240px,radial-gradient(ellipse at 15% 35%,rgba(63,208,201,.18),transparent 55%),radial-gradient(ellipse at 90% 55%,rgba(230,107,208,.18),transparent 55%),linear-gradient(180deg,${C.night} 0%,${C.deep} 45%,${C.violet} 78%,${C.dusk} 93%,${C.glow} 100%) !important;position:relative !important}
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
[data-wk="chatinput"]{color:${C.ink} !important;border:1.3px solid rgba(255,217,138,.8) !important;border-radius:999px !important;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.04)),rgba(7,10,34,.6) !important}
[data-wk="chatinput"]::placeholder{color:${C.dim} !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;transition:transform .12s !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "星空", look: { bubble, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "星空-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
