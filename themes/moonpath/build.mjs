// 月下星路（梦核）：褪色的米灰底，颗粒、暗角，一轮太近太亮的月亮；糖果色的星星排着队跟在气泡后面；他是月光雾、我是旧电视屏；头像是月亮带一圈偏开的重影。用法：node themes/moonpath/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { bg: "#A79E8A", bg2: "#8E8674", moon: "#F5EFD2", ink: "#3D3A33", fog: "#E6DFC9", tv: "#3A3833", tv2: "#26251F", pink: "#FF7AC8", yel: "#FFE45C", mint: "#6FF2C8", lila: "#B79CFF", sky: "#7CC8FF" };
const STAR = (c, s = 10) => `<path transform='scale(${s / 10})' d='M5 0 L6.2 3.6 L10 3.8 L7 6.2 L8 10 L5 7.8 L2 10 L3 6.2 L0 3.8 L3.8 3.6Z' fill='${c}'/>`;
const S = (x, y, c, s, o = 1) => `<g transform='translate(${x} ${y})' opacity='${o}'>${STAR(c, s)}</g>`;
// 颗粒（细噪点）
const GRAIN = X(`width='60' height='60' viewBox='0 0 60 60'><g fill='rgba(255,255,255,.07)'><rect x='3' y='5' width='1' height='1'/><rect x='21' y='14' width='1' height='1'/><rect x='44' y='8' width='1' height='1'/><rect x='12' y='33' width='1' height='1'/><rect x='37' y='29' width='1' height='1'/><rect x='52' y='47' width='1' height='1'/><rect x='27' y='52' width='1' height='1'/></g><g fill='rgba(0,0,0,.08)'><rect x='9' y='21' width='1' height='1'/><rect x='31' y='3' width='1' height='1'/><rect x='49' y='25' width='1' height='1'/><rect x='17' y='46' width='1' height='1'/><rect x='41' y='56' width='1' height='1'/></g>`);
// 底色里零星的糖果色星星
const FIELD = X(`width='240' height='300' viewBox='0 0 240 300'>${S(30, 40, C.lila, 7, .7)}${S(190, 90, C.mint, 6, .6)}${S(110, 170, C.yel, 5, .55)}${S(60, 240, C.pink, 6, .6)}${S(210, 260, C.sky, 5, .5)}`);
// 跟在气泡底下排队的星星：他的暖、我的冷
const TRAIL_HIS = X(`width='120' height='16' viewBox='0 0 120 16'>${S(4, 4, C.pink, 9)}${S(30, 6, C.yel, 8)}${S(54, 3, C.mint, 10)}${S(82, 6, C.pink, 7)}${S(104, 5, C.yel, 8)}`);
const TRAIL_ME = X(`width='120' height='16' viewBox='0 0 120 16'>${S(4, 5, C.mint, 9)}${S(28, 3, C.sky, 10)}${S(54, 6, C.lila, 8)}${S(80, 4, C.mint, 9)}${S(104, 6, C.lila, 8)}`);
// 已读：一颗星睁开眼；送达：闭眼
const EYE_OPEN = X(`viewBox='0 0 20 20'>${STAR(C.yel, 20)}<ellipse cx='10' cy='10.5' rx='3.4' ry='2.2' fill='#fff'/><circle cx='10' cy='10.5' r='1.3' fill='#222'/>`);
const EYE_SHUT = X(`viewBox='0 0 20 20'><path d='M10 1 L12.4 7.2 L19 7.6 L14 12.4 L16 19 L10 15.6 L4 19 L6 12.4 L1 7.6 L7.6 7.2Z' fill='none' stroke='${C.fog}' stroke-width='1.4'/><path d='M7 11 Q10 13 13 11' stroke='${C.fog}' stroke-width='1.2' fill='none'/>`);
// 按键
const I_MOON = X(`viewBox='0 0 36 36'><circle cx='18' cy='18' r='15' fill='${C.moon}' opacity='.35'/><circle cx='18' cy='18' r='11' fill='${C.moon}'/><circle cx='14' cy='15' r='2' fill='rgba(0,0,0,.08)'/><circle cx='21' cy='21' r='3' fill='rgba(0,0,0,.07)'/>`);
const I_STAR = X(`viewBox='0 0 30 30'><g transform='translate(3 3)'>${STAR(C.pink, 24)}</g>`);
const I_DOOR = X(`viewBox='0 0 30 30'><rect x='8' y='4' width='14' height='23' fill='${C.tv}' stroke='${C.moon}' stroke-width='1.4'/><circle cx='19' cy='16' r='1.2' fill='${C.yel}'/><path d='M4 27 H26' stroke='${C.moon}' stroke-width='1.4'/>`);
const I_TV = X(`viewBox='0 0 30 30'><rect x='3' y='7' width='24' height='17' rx='3' fill='${C.tv}' stroke='${C.moon}' stroke-width='1.4'/><rect x='6' y='10' width='18' height='11' rx='2' fill='${C.lila}' opacity='.7'/><path d='M11 3 L15 7 L19 3' stroke='${C.moon}' stroke-width='1.3' fill='none'/>`);
const I_REPLY = X(`viewBox='0 0 40 34'><path d='M6 4 H34 Q37 4 37 7 V21 Q37 24 34 24 H16 L9 30 L10 24 H6 Q3 24 3 21 V7 Q3 4 6 4Z' fill='${C.moon}' opacity='.9'/><g transform='translate(14 8)'>${STAR(C.lila, 12)}</g>`);
const bubble = { myBg: C.tv, myText: C.fog, myBorder: "none", charBg: C.moon, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
const HIDE = `font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important`;
// 月亮头像：本体一圈月光，外面一圈偏开的重影
const MOONAV = `0 0 0 3px ${C.moon},0 0 14px 4px rgba(245,239,210,.6),5px -3px 0 5px rgba(245,239,210,.18)`;
const css = `
/* ───── 月下星路 · 第一批 ───── */
/* 底色：褪色的米灰，颗粒、暗角、零星糖果色星星；一轮太近太亮的月亮压在右上 */
[data-wk="chat"]{background:radial-gradient(circle at 82% 16%,#FFFBE6 0 46px,rgba(255,250,224,.55) 50px,rgba(255,248,220,.18) 120px,transparent 200px),${svg(GRAIN)} 0 0/60px 60px,${svg(FIELD)} 0 0/240px 300px,radial-gradient(ellipse at 50% 45%,transparent 45%,rgba(40,36,28,.45) 100%),linear-gradient(180deg,${C.bg},${C.bg2}) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一层旧玻璃，底边一道发虚的月光线 */
[data-wk="chathead"]{background:rgba(120,113,96,.55) !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important;border-bottom:none !important;box-shadow:0 1px 0 rgba(245,239,210,.5),0 4px 14px rgba(245,239,210,.25) !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.moon} !important;letter-spacing:.12em !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:#E3DBC2 !important}
[data-wk="chatback"] svg{stroke:${C.moon} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;height:26px !important;flex-shrink:0 !important;${HIDE};background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_DOOR)} center/contain no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_TV)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chat"] [data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;margin-left:-6px !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:32px !important;height:32px !important;min-width:32px !important;aspect-ratio:1 !important;border-radius:50% !important;box-shadow:0 0 0 2px ${C.moon},0 0 10px 3px rgba(245,239,210,.55) !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important;margin-left:6px !important}

/* 头像：一轮月亮——月光一圈，外面一圈偏开的重影 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:50% !important}
[data-wk="body"] button[data-wk="avatar"],[data-wk="body"] span[data-wk="avatar"]:not([data-halo]){box-shadow:${MOONAV} !important}
[data-wk="body"] [data-wk="avatar"] > img[data-wk="avatar"]{box-shadow:none !important}

/* 气泡：他是一团月光雾（边缘糊开、自己发光）；我是一块旧电视屏（深色、细细一道发光边）；底下排队跟着一串糖果色星星 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:14px !important;line-height:1.65 !important;letter-spacing:.08em !important;margin-bottom:10px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:radial-gradient(ellipse at 50% 40%,#FFFDF0,${C.moon} 70%) !important;color:${C.ink} !important;box-shadow:0 0 18px 6px rgba(245,239,210,.55),0 0 2px 1px rgba(255,255,255,.8) !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,${C.tv},${C.tv2}) !important;color:${C.fog} !important;box-shadow:inset 0 0 0 1px rgba(245,239,210,.7),0 0 10px rgba(245,239,210,.3),inset 0 0 18px rgba(183,156,255,.15) !important;padding:11px 18px !important;text-shadow:0 0 4px rgba(245,239,210,.4) !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;bottom:-12px !important;height:14px !important;background:${svg(TRAIL_HIS)} 0 0/120px 16px repeat-x !important;filter:drop-shadow(0 0 3px rgba(255,255,255,.8)) !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{background:${svg(TRAIL_ME)} right 0 top 0/120px 16px repeat-x !important}
[data-wk="bubble"][data-kind="text"]::before{content:none !important}

/* 时间：时间后面跟一句永远不变的「（这里来过）」 */
[data-wk="time"] > span{background:none !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;font-size:11.5px !important;letter-spacing:.2em !important;text-shadow:0 0 6px rgba(245,239,210,.6) !important}
[data-wk="time"] > span::after{content:"  （这里来过）" !important;opacity:.6 !important;letter-spacing:.1em !important}
/* 已读：一颗星星睁开眼；没读：闭着 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:16px !important;height:16px !important;background:${svg(EYE_OPEN)} center/contain no-repeat !important;filter:drop-shadow(0 0 3px ${C.yel}) !important}
[data-wk="meta"][data-read="0"]::before{background:${svg(EYE_SHUT)} center/contain no-repeat !important;filter:none !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.moon} !important;border:none !important;border-radius:14px !important;box-shadow:0 0 14px 4px rgba(245,239,210,.5) !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.lila} !important}

/* 动描：一张旧拍立得的背面——白边、褪色的字，像照片背后写的 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;background:#EDE7D6 !important;border:none !important;border-radius:2px !important;box-shadow:0 0 0 6px #F7F3E8,0 4px 10px rgba(0,0,0,.25) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;color:#8A8270 !important;opacity:1 !important;font-style:italic !important;font-size:12.5px !important;line-height:1.75 !important;padding:6px 14px !important;margin:8px 0 !important;transform:rotate(-1deg) !important}
[data-wk="myactink"]{transform:rotate(1deg) !important;color:#7E7A92 !important}
/* 系统提示：梦里的告示 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.12em !important}
[data-wk="sysnotetext"]::before{content:"⟡ " !important;color:${C.yel} !important}
[data-wk="sysnotetext"]::after{content:" ⟡" !important;color:${C.yel} !important}
[data-wk="narrbar"]{background:rgba(120,113,96,.7) !important;border-top:1px solid rgba(245,239,210,.4) !important}
[data-wk="narrkind"]{border:1px solid rgba(245,239,210,.4) !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.moon} !important;color:${C.ink} !important}

/* 底栏：同一层旧玻璃；左一颗粉星加号、雾色输入框、右边月亮发送、带星星的对话框回复 */
[data-wk="composer"]{background:rgba(120,113,96,.55) !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important;border-top:none !important;box-shadow:0 -1px 0 rgba(245,239,210,.5),0 -4px 14px rgba(245,239,210,.2) !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:rgba(245,239,210,.25) !important;border:1px solid rgba(245,239,210,.5) !important;border-radius:14px !important;color:#FFFBEA !important}
[data-wk="chatinput"]::placeholder{color:#EDE6CE !important}
[data-wk="chatplus"]{width:28px !important;min-width:28px !important;height:28px !important;${HIDE};background:${svg(I_STAR)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.pink}) !important}
[data-wk="chatplus"] svg{display:none !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;${HIDE};background:${svg(I_MOON)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:40px !important;min-width:40px !important;height:34px !important;${HIDE};background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}

/* 打电话那一屏：同一片褪色的梦，月亮更近 */
[data-wk="call"][data-video="0"]{background:radial-gradient(circle at 50% 20%,#FFFBE6 0 70px,rgba(255,250,224,.5) 76px,transparent 220px),${svg(GRAIN)} 0 0/60px 60px,${svg(FIELD)} 0 0/240px 300px,linear-gradient(180deg,${C.bg},${C.bg2}) !important}
[data-wk="calltitle"]{color:${C.ink} !important;letter-spacing:.15em !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 5px ${C.moon},0 0 40px 14px rgba(245,239,210,.7),12px -8px 0 10px rgba(245,239,210,.2) !important}
[data-wk="callbtns"] button > span:first-child{background:${C.moon} !important;border-radius:50% !important;box-shadow:0 0 16px 4px rgba(245,239,210,.6) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:${C.ink} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:${C.tv} !important;box-shadow:inset 0 0 0 1.5px ${C.pink},0 0 14px ${C.pink} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:${C.pink} !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:${C.ink} !important}
[data-wk="callbubble"]{background:${C.moon} !important;color:${C.ink} !important;border:none !important;border-radius:14px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.tv} !important;color:${C.fog} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;background:#EDE7D6 !important;border:none !important;border-radius:2px !important;box-shadow:0 0 0 5px #F7F3E8 !important;padding:8px 14px !important;color:#8A8270 !important;font-size:12px !important;font-style:italic !important;text-align:left !important}
[data-wk="noteink"]{color:${C.fog} !important}
[data-wk="callact"]{color:${C.lila} !important}
`;
const pack = { kind: "chat-look", v: 1, name: "月下星路", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "月下星路-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
