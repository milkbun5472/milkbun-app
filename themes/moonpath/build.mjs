// 月下星路（梦核）：褪色的米灰底，颗粒、暗角，一轮太近太亮的月亮；糖果色的星星排着队跟在气泡后面；他是月光雾、我是旧电视屏；头像是月亮带一圈偏开的重影。用法：node themes/moonpath/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { bg: "#F3EEF6", bg2: "#E9E6F3", moon: "#FFFCEB", ink: "#4A4E52", fog: "#9AA0A4", tv: "#D9CCF7", tv2: "#C6B6F2", pink: "#FF7AC8", yel: "#FFE45C", mint: "#6FF2C8", lila: "#B79CFF", sky: "#7CC8FF" };
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
const I_MOON = X(`viewBox='0 0 36 36'><circle cx='18' cy='18' r='15' fill='#F7E7A6' opacity='.45'/><circle cx='18' cy='18' r='11' fill='#FFF3C2' stroke='#E6CF7A' stroke-width='1.4'/><circle cx='14' cy='15' r='2' fill='rgba(0,0,0,.08)'/><circle cx='21' cy='21' r='3' fill='rgba(0,0,0,.07)'/>`);
const I_STAR = X(`viewBox='0 0 30 30'><g transform='translate(3 3)'>${STAR(C.pink, 24)}</g>`);
const I_DOOR = X(`viewBox='0 0 30 30'><rect x='8' y='4' width='14' height='23' fill='#fff' stroke='${C.ink}' stroke-width='1.4'/><circle cx='19' cy='16' r='1.2' fill='${C.yel}'/><path d='M4 27 H26' stroke='${C.ink}' stroke-width='1.4'/>`);
const I_TV = X(`viewBox='0 0 30 30'><rect x='3' y='7' width='24' height='17' rx='3' fill='#fff' stroke='${C.ink}' stroke-width='1.4'/><rect x='6' y='10' width='18' height='11' rx='2' fill='#BFD3DA'/><path d='M11 3 L15 7 L19 3' stroke='${C.ink}' stroke-width='1.3' fill='none'/>`);
const I_REPLY = X(`viewBox='0 0 40 34'><path d='M6 4 H34 Q37 4 37 7 V21 Q37 24 34 24 H16 L9 30 L10 24 H6 Q3 24 3 21 V7 Q3 4 6 4Z' fill='#fff' stroke='#C9D2D6' stroke-width='1.4'/><g transform='translate(14 8)'>${STAR(C.lila, 12)}</g>`);
// 月亮的脸：闭着眼笑，偶尔睁开一下
const MOONFACE = X(`viewBox='0 0 120 120'><circle cx='60' cy='60' r='56' fill='#FFFCEB'/><g fill='none' stroke='#C9BFA0' stroke-width='3' stroke-linecap='round'><path d='M36 54 Q44 60 52 54'/><path d='M68 54 Q76 60 84 54'/><path d='M48 78 Q60 88 72 78'/></g>`);
const MOONEYES = X(`viewBox='0 0 120 120'><g fill='#5A5470'><circle cx='44' cy='55' r='5'/><circle cx='76' cy='55' r='5'/></g><g fill='#fff'><circle cx='45.5' cy='53.5' r='1.6'/><circle cx='77.5' cy='53.5' r='1.6'/></g>`);
// 远处一片粉白格子地板（透视）
const FLOOR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200' preserveAspectRatio='none'><defs><linearGradient id='f' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='1'/></linearGradient><mask id='m'><rect width='400' height='200' fill='url(#f)'/></mask></defs><g mask='url(#m)'><rect width='400' height='200' fill='#EEF1F2'/><path d='M134.0 0.0 L142.2 0.0 L137.1 3.2 L128.1 3.2ZM150.5 0.0 L158.8 0.0 L155.0 3.2 L146.1 3.2ZM167.0 0.0 L175.2 0.0 L173.0 3.2 L164.0 3.2ZM183.5 0.0 L191.8 0.0 L191.0 3.2 L182.0 3.2ZM200.0 0.0 L208.2 0.0 L209.0 3.2 L200.0 3.2ZM216.5 0.0 L224.8 0.0 L227.0 3.2 L218.0 3.2ZM233.0 0.0 L241.2 0.0 L245.0 3.2 L236.0 3.2ZM249.5 0.0 L257.8 0.0 L262.9 3.2 L253.9 3.2ZM137.1 3.2 L146.1 3.2 L135.0 11.0 L124.2 11.0ZM155.0 3.2 L164.0 3.2 L156.7 11.0 L145.8 11.0ZM173.0 3.2 L182.0 3.2 L178.3 11.0 L167.5 11.0ZM191.0 3.2 L200.0 3.2 L200.0 11.0 L189.2 11.0ZM209.0 3.2 L218.0 3.2 L221.7 11.0 L210.8 11.0ZM227.0 3.2 L236.0 3.2 L243.3 11.0 L232.5 11.0ZM245.0 3.2 L253.9 3.2 L265.0 11.0 L254.2 11.0ZM262.9 3.2 L271.9 3.2 L286.6 11.0 L275.8 11.0ZM113.4 11.0 L124.2 11.0 L104.8 22.9 L91.2 22.9ZM135.0 11.0 L145.8 11.0 L132.0 22.9 L118.4 22.9ZM156.7 11.0 L167.5 11.0 L159.2 22.9 L145.6 22.9ZM178.3 11.0 L189.2 11.0 L186.4 22.9 L172.8 22.9ZM200.0 11.0 L210.8 11.0 L213.6 22.9 L200.0 22.9ZM221.7 11.0 L232.5 11.0 L240.8 22.9 L227.2 22.9ZM243.3 11.0 L254.2 11.0 L268.0 22.9 L254.4 22.9ZM265.0 11.0 L275.8 11.0 L295.2 22.9 L281.6 22.9ZM104.8 22.9 L118.4 22.9 L96.6 38.4 L79.4 38.4ZM132.0 22.9 L145.6 22.9 L131.1 38.4 L113.8 38.4ZM159.2 22.9 L172.8 22.9 L165.5 38.4 L148.3 38.4ZM186.4 22.9 L200.0 22.9 L200.0 38.4 L182.8 38.4ZM213.6 22.9 L227.2 22.9 L234.5 38.4 L217.2 38.4ZM240.8 22.9 L254.4 22.9 L268.9 38.4 L251.7 38.4ZM268.0 22.9 L281.6 22.9 L303.4 38.4 L286.2 38.4ZM295.2 22.9 L308.8 22.9 L337.9 38.4 L320.6 38.4ZM62.1 38.4 L79.4 38.4 L48.3 57.4 L26.6 57.4ZM96.6 38.4 L113.8 38.4 L91.6 57.4 L69.9 57.4ZM131.1 38.4 L148.3 38.4 L135.0 57.4 L113.3 57.4ZM165.5 38.4 L182.8 38.4 L178.3 57.4 L156.6 57.4ZM200.0 38.4 L217.2 38.4 L221.7 57.4 L200.0 57.4ZM234.5 38.4 L251.7 38.4 L265.0 57.4 L243.4 57.4ZM268.9 38.4 L286.2 38.4 L308.4 57.4 L286.7 57.4ZM303.4 38.4 L320.6 38.4 L351.7 57.4 L330.1 57.4ZM48.3 57.4 L69.9 57.4 L38.7 79.7 L11.8 79.7ZM91.6 57.4 L113.3 57.4 L92.4 79.7 L65.5 79.7ZM135.0 57.4 L156.6 57.4 L146.2 79.7 L119.3 79.7ZM178.3 57.4 L200.0 57.4 L200.0 79.7 L173.1 79.7ZM221.7 57.4 L243.4 57.4 L253.8 79.7 L226.9 79.7ZM265.0 57.4 L286.7 57.4 L307.6 79.7 L280.7 79.7ZM308.4 57.4 L330.1 57.4 L361.3 79.7 L334.5 79.7ZM351.7 57.4 L373.4 57.4 L415.1 79.7 L388.2 79.7ZM-15.1 79.7 L11.8 79.7 L-30.0 105.2 L-62.8 105.2ZM38.7 79.7 L65.5 79.7 L35.7 105.2 L2.9 105.2ZM92.4 79.7 L119.3 79.7 L101.4 105.2 L68.6 105.2ZM146.2 79.7 L173.1 79.7 L167.1 105.2 L134.3 105.2ZM200.0 79.7 L226.9 79.7 L232.9 105.2 L200.0 105.2ZM253.8 79.7 L280.7 79.7 L298.6 105.2 L265.7 105.2ZM307.6 79.7 L334.5 79.7 L364.3 105.2 L331.4 105.2ZM361.3 79.7 L388.2 79.7 L430.0 105.2 L397.1 105.2ZM-30.0 105.2 L2.9 105.2 L-37.2 133.8 L-76.7 133.8ZM35.7 105.2 L68.6 105.2 L41.9 133.8 L2.3 133.8ZM101.4 105.2 L134.3 105.2 L120.9 133.8 L81.4 133.8ZM167.1 105.2 L200.0 105.2 L200.0 133.8 L160.5 133.8ZM232.9 105.2 L265.7 105.2 L279.1 133.8 L239.5 133.8ZM298.6 105.2 L331.4 105.2 L358.1 133.8 L318.6 133.8ZM364.3 105.2 L397.1 105.2 L437.2 133.8 L397.7 133.8ZM430.0 105.2 L462.8 105.2 L516.3 133.8 L476.7 133.8ZM-116.3 133.8 L-76.7 133.8 L-128.5 165.4 L-175.4 165.4ZM-37.2 133.8 L2.3 133.8 L-34.6 165.4 L-81.5 165.4ZM41.9 133.8 L81.4 133.8 L59.2 165.4 L12.3 165.4ZM120.9 133.8 L160.5 133.8 L153.1 165.4 L106.2 165.4ZM200.0 133.8 L239.5 133.8 L246.9 165.4 L200.0 165.4ZM279.1 133.8 L318.6 133.8 L340.8 165.4 L293.8 165.4ZM358.1 133.8 L397.7 133.8 L434.6 165.4 L387.7 165.4ZM437.2 133.8 L476.7 133.8 L528.5 165.4 L481.5 165.4ZM-128.5 165.4 L-81.5 165.4 L-130.0 200.0 L-185.0 200.0ZM-34.6 165.4 L12.3 165.4 L-20.0 200.0 L-75.0 200.0ZM59.2 165.4 L106.2 165.4 L90.0 200.0 L35.0 200.0ZM153.1 165.4 L200.0 165.4 L200.0 200.0 L145.0 200.0ZM246.9 165.4 L293.8 165.4 L310.0 200.0 L255.0 200.0ZM340.8 165.4 L387.7 165.4 L420.0 200.0 L365.0 200.0ZM434.6 165.4 L481.5 165.4 L530.0 200.0 L475.0 200.0ZM528.5 165.4 L575.4 165.4 L640.0 200.0 L585.0 200.0Z' fill='#CBD3D7'/></g></svg>`;
const CHECK = X(`width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='#DADFE2'/><rect width='20' height='20' fill='#fff'/><rect x='20' y='20' width='20' height='20' fill='#fff'/>`);
// 好感：月相——新月一线（<20）→ 弯月（20–49）→ 半月（50–79）→ 满月闭眼笑（80+）
const PH = (inner) => X(`viewBox='0 0 92 84'><circle cx='46' cy='42' r='32' fill='#E6EBED'/>${inner}`);
const ST1 = PH(`<path d='M46 10 A32 32 0 0 1 46 74 A30 32 0 0 0 46 10Z' fill='#FFF6CF'/>`);
const ST2 = PH(`<path d='M46 10 A32 32 0 0 1 46 74 A18 32 0 0 0 46 10Z' fill='#FFF6CF'/>`);
const ST3 = PH(`<path d='M46 10 A32 32 0 0 1 46 74Z' fill='#FFF6CF'/>`);
const ST4 = X(`viewBox='0 0 92 84'><circle cx='46' cy='42' r='32' fill='#FFF6CF'/><g fill='none' stroke='#C9BFA0' stroke-width='2.4' stroke-linecap='round'><path d='M32 39 Q37 43 42 39'/><path d='M50 39 Q55 43 60 39'/><path d='M38 53 Q46 60 54 53'/></g>${S(74, 8, C.pink, 10)}${S(10, 60, C.mint, 8)}`);
const WHITE_CARD = `background:rgba(255,255,255,.82) !important;border:none !important;border-radius:14px !important;box-shadow:inset 0 0 0 1.5px #fff,0 0 18px 4px rgba(255,248,226,.8) !important`;
const GLASS_CARD = `background:linear-gradient(180deg,rgba(226,234,238,.95),rgba(208,219,225,.95)) !important;border:none !important;border-radius:14px !important;box-shadow:inset 0 0 0 1.5px #fff,0 0 16px 4px rgba(190,214,224,.7) !important`;
const bubble = { myBg: C.tv, myText: C.fog, myBorder: "none", charBg: C.moon, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
const HIDE = `font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important`;
// 月亮头像：本体一圈月光，外面一圈偏开的重影
const MOONAV = `0 0 0 3px #fff,0 0 18px 5px rgba(255,240,214,.9),6px -4px 0 5px rgba(190,205,212,.4)`;
const css = `
/* ───── 月下星路 · 第一批 ───── */
/* 底色：褪色的米灰，颗粒、暗角、零星糖果色星星；一轮太近太亮的月亮压在右上 */
[data-wk="chat"]{position:relative !important;background:${svg(FLOOR)} center bottom/100% 30% no-repeat,radial-gradient(circle at 80% 18%,rgba(255,252,235,.9) 0 70px,rgba(255,252,240,.5) 90px,transparent 220px),${svg(FIELD)} 0 0/240px 300px,linear-gradient(180deg,#F6F5F0 0%,#ECEEEC 55%,#E3E8EA 100%) !important}
/* 一张太近的月亮脸：闭眼笑着，隔一阵睁一下眼 */
[data-wk="chat"]::before{content:"" !important;position:absolute !important;right:-40px !important;top:90px !important;width:220px !important;height:220px !important;background:${svg(MOONFACE)} center/contain no-repeat !important;filter:drop-shadow(0 0 40px rgba(255,250,232,.9)) !important;opacity:.85 !important;pointer-events:none !important;z-index:0 !important}
[data-wk="chat"]::after{content:"" !important;position:absolute !important;right:-40px !important;top:90px !important;width:220px !important;height:220px !important;background:${svg(MOONEYES)} center/contain no-repeat !important;opacity:0 !important;pointer-events:none !important;z-index:0 !important;animation:mpBlink 9s steps(1) infinite !important}
@keyframes mpBlink{0%,88%{opacity:0}89%,93%{opacity:.85}94%,100%{opacity:0}}
/* 底下一片透视的粉白格子地板，一直铺到看不见的地方 */
[data-wk="body"]::after{content:none !important}
[data-wk="body"] > *{position:relative !important;z-index:1 !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一层旧玻璃，底边一道发虚的月光线 */
[data-wk="chathead"]{background:rgba(255,255,255,.55) !important;backdrop-filter:blur(8px) !important;-webkit-backdrop-filter:blur(6px) !important;border-bottom:none !important;box-shadow:0 1px 0 #fff,0 4px 18px rgba(200,212,218,.4) !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important;letter-spacing:.12em !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
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
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:radial-gradient(ellipse at 50% 40%,#FFFDF0,${C.moon} 70%) !important;color:${C.ink} !important;box-shadow:inset 0 0 0 1.5px #F2E6B8,0 0 22px 8px rgba(255,240,200,.9) !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(226,234,238,.95),rgba(208,219,225,.95)) !important;color:#3E4A52 !important;box-shadow:inset 0 0 0 1.5px #fff,0 0 16px 4px rgba(190,214,224,.7) !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;bottom:-12px !important;height:14px !important;background:${svg(TRAIL_HIS)} 0 0/120px 16px repeat-x !important;filter:drop-shadow(0 0 3px rgba(255,255,255,.9)) !important;pointer-events:none !important;animation:mpDrift 7s ease-in-out infinite !important}
@keyframes mpDrift{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
[data-wk="msg"]:nth-child(3n) [data-wk="bubble"]::after{animation-delay:-2.5s !important}
[data-wk="msg"]:nth-child(3n+1) [data-wk="bubble"]::after{animation-delay:-5s !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{background:${svg(TRAIL_ME)} right 0 top 0/120px 16px repeat-x !important}
[data-wk="bubble"][data-kind="text"]::before{content:none !important}

/* 时间：时间后面跟一句永远不变的「（这里来过）」 */
[data-wk="time"] > span{background:none !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;font-size:11.5px !important;letter-spacing:.2em !important;text-shadow:0 0 6px #fff !important}
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
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;background:#fff !important;border:none !important;border-radius:2px !important;box-shadow:0 0 0 6px #fff,0 6px 16px rgba(120,130,135,.2) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;color:#9CA2A6 !important;opacity:1 !important;font-style:italic !important;font-size:12.5px !important;line-height:1.75 !important;padding:6px 14px !important;margin:8px 0 !important;transform:rotate(-1deg) !important}
[data-wk="myactink"]{transform:rotate(1deg) !important;color:#7E7A92 !important}
/* 系统提示：梦里的告示 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.12em !important}
[data-wk="sysnotetext"]::before{content:"⟡ " !important;color:${C.yel} !important}
[data-wk="sysnotetext"]::after{content:" ⟡" !important;color:${C.yel} !important}
[data-wk="narrbar"]{background:rgba(255,255,255,.7) !important;border-top:1px solid #fff !important}
[data-wk="narrkind"]{border:1px solid #D5DADD !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:#D6DFE3 !important;color:${C.ink} !important}

/* 底栏：同一层旧玻璃；左一颗粉星加号、雾色输入框、右边月亮发送、带星星的对话框回复 */
[data-wk="composer"]{background:rgba(255,255,255,.55) !important;backdrop-filter:blur(8px) !important;-webkit-backdrop-filter:blur(6px) !important;border-top:none !important;box-shadow:0 -1px 0 #fff,0 -4px 18px rgba(200,212,218,.35) !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:rgba(255,255,255,.7) !important;border:1px solid #fff !important;border-radius:14px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#AEB4B8 !important}
[data-wk="chatplus"]{width:28px !important;min-width:28px !important;height:28px !important;${HIDE};background:${svg(I_STAR)} center/contain no-repeat !important;filter:drop-shadow(0 0 4px ${C.pink}) !important}
[data-wk="chatplus"] svg{display:none !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;${HIDE};background:${svg(I_MOON)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:40px !important;min-width:40px !important;height:34px !important;${HIDE};background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}

/* 打电话那一屏：同一片褪色的梦，月亮更近 */
[data-wk="call"][data-video="0"]{background:radial-gradient(circle at 50% 20%,#FFFBE6 0 70px,rgba(255,250,224,.5) 76px,transparent 220px),${svg(FIELD)} 0 0/240px 300px,linear-gradient(180deg,#F6F5F0,#E3E8EA) !important}
[data-wk="calltitle"]{color:${C.ink} !important;letter-spacing:.15em !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 5px ${C.moon},0 0 40px 14px rgba(245,239,210,.7),12px -8px 0 10px rgba(245,239,210,.2) !important}
[data-wk="callbtns"] button > span:first-child{background:${C.moon} !important;border-radius:50% !important;box-shadow:0 0 16px 4px rgba(245,239,210,.6) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:${C.ink} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:#fff !important;box-shadow:inset 0 0 0 1.5px ${C.pink},0 0 14px ${C.pink} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:${C.pink} !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:${C.ink} !important}
[data-wk="callbubble"]{background:${C.moon} !important;color:${C.ink} !important;border:none !important;border-radius:14px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:#DCE5E9 !important;color:#3E4A52 !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;background:#fff !important;border:none !important;border-radius:2px !important;box-shadow:0 0 0 5px #fff !important;padding:8px 14px !important;color:#A39CBC !important;font-size:12px !important;font-style:italic !important;text-align:left !important}
[data-wk="noteink"]{color:${C.fog} !important}
[data-wk="callact"]{color:${C.lila} !important}

/* ───── 月下星路 · 第二批：卡片（形状不动；都是一张发光的月光卡，底下也跟着一串星星） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="wxcard"],[data-wk="rpcard"]{position:relative !important;overflow:visible !important;${WHITE_CARD};color:${C.ink} !important;margin-bottom:10px !important}
[data-wk="transfercard"]::after,[data-wk="photocard"]::after,[data-wk="wxcard"]::after,[data-wk="rpcard"]::after{content:"" !important;position:absolute !important;left:14px !important;right:14px !important;bottom:-12px !important;top:auto !important;width:auto !important;height:14px !important;background:${svg(TRAIL_HIS)} 0 0/120px 16px repeat-x !important;border:none !important;box-shadow:none !important;pointer-events:none !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *,[data-wk="photocard"] *,[data-wk="wxcard"] *{color:${C.ink} !important;border-color:#E3E7E9 !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#8C8460 !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:#E3E7E9 !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:transparent !important;border-top:1px solid #E3E7E9 !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:#FFF6CF !important;color:${C.ink} !important;border:1px solid #E6CF7A !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;border:1px solid #D5DADD !important}
[data-wk="transferseal"]{background:${svg(EYE_OPEN)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;width:36px !important;height:36px !important;font-size:0 !important;color:transparent !important;filter:drop-shadow(0 0 4px ${C.yel}) !important}
[data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.5 !important}
/* 红包：一块冷灰玻璃，左边一轮小月亮；领完月亮暗下去 */
[data-wk="rpcard"]{${GLASS_CARD};padding-left:54px !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:calc(50% - 17px) !important;width:34px !important;height:34px !important;background:${svg(I_MOON)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="rpcard"] *{color:#3E4A52 !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{opacity:.6 !important}
[data-wk="rpcard"][data-status="done"]::before{filter:grayscale(1) !important}
[data-wk="rpenvelope"]{${WHITE_CARD};background:radial-gradient(circle at 50% 22%,#FFFCEB 0 50px,transparent 130px),linear-gradient(180deg,#F6F5F0,#E3E8EA) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:transparent !important;border:none !important}
[data-wk="rpenvelope"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:${svg(I_MOON)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 0 12px rgba(255,240,200,.9)) !important}
[data-wk="rpopenbtn"] *{opacity:0 !important}
[data-wk="rpamount"]{color:#8C8460 !important}
[data-wk="rpavatar"],[data-wk="rpavatar"] *{border-radius:50% !important}
[data-wk="rpavatar"]{box-shadow:${MOONAV} !important}
/* 照片：一张过曝的旧照片；语音跟气泡一样 */
[data-wk="photocard"]{padding:8px 8px 10px !important}
[data-wk="photoface"]{border-radius:6px !important;background:linear-gradient(180deg,#FBFAF5,#E6EBED) !important;border:none !important;box-shadow:inset 0 0 30px rgba(255,255,255,.9) !important}
[data-wk="photoface"] *,[data-wk="photohint"]{color:#9AA0A4 !important}
[data-wk="photoface"] svg{stroke:#9AA0A4 !important}
[data-wk="voice"][data-me]{${WHITE_CARD}}
[data-wk="voice"][data-me="1"]{${GLASS_CARD}}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voicewave"] span{background:${C.lila} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:${C.mint} !important}
/* 天气：太阳换成那轮月亮 */
[data-wk="wxcardsky"]{background:transparent !important}
[data-wk="wxcardsky"] > div:first-child{background:radial-gradient(circle,#FFF6CF 0 12px,rgba(255,246,207,.4) 14px,transparent 60%) !important}
[data-wk="wxcardsky"] svg{stroke:#9AA0A4 !important}
[data-wk="wxcardsky"] span[style*="999"],[data-wk="wxcardrain"]{background:rgba(230,235,237,.7) !important;border:none !important}
[data-wk="wxcardsay"]{background:rgba(246,245,240,.8) !important;border-top:1px solid #E3E7E9 !important}
[data-wk="wxcardsay"],[data-wk="wxcardsay"] *{color:${C.ink} !important}
[data-wk="geopin"]{background:${C.pink} !important;box-shadow:0 0 0 2px #fff,0 0 8px ${C.pink} !important}
[data-wk="geopinstem"]{background:#9AA0A4 !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:${MOONAV} !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]::before{content:"" !important;display:inline-block !important;vertical-align:middle !important;width:14px !important;height:14px !important;margin:0 6px !important;background:${svg(EYE_OPEN)} center/contain no-repeat !important}
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;border:none !important;background:rgba(255,255,255,.7) !important;border-radius:999px !important;padding:3px 14px !important;color:${C.fog} !important;box-shadow:0 0 10px rgba(255,255,255,.9) !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.fog} !important}
[data-wk="offlogtitle"]{letter-spacing:.2em !important;color:${C.ink} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#8C8460 !important}
[data-wk="offlogtranscript"]{border-top:1px solid #E3E7E9 !important}
/* 加号面板：一颗颗发光的小圆窗 */
[data-wk="chatpanel"]{background:rgba(246,245,240,.9) !important;border-top:1px solid #fff !important}
[data-wk="chattoolicon"]{background:rgba(255,255,255,.85) !important;border:none !important;border-radius:50% !important;box-shadow:inset 0 0 0 1.5px #fff,0 0 14px 3px rgba(255,248,226,.9) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}
[data-wk="quotedraft"]{background:rgba(246,245,240,.9) !important;border-top:1px solid #fff !important}
[data-wk="quote"]{background:rgba(255,255,255,.7) !important;color:${C.fog} !important;border:none !important;border-left:3px solid #E6CF7A !important;border-radius:6px !important;opacity:1 !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:#8C8460 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:26px !important;min-width:26px !important;height:26px !important;background:${svg(I_DOOR)} center/contain no-repeat !important;${HIDE}}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_TV)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}

/* ───── 月下星路 · 第三批：状态卡是一扇过曝的窗——白光、远处格子地板；好感是月相 ───── */
[data-wk="statecard"]{background:${svg(FLOOR)} center bottom/100% 22% no-repeat,radial-gradient(circle at 80% 8%,#FFFCEB 0 40px,transparent 140px),linear-gradient(180deg,#F6F5F0,#E3E8EA) !important;border:none !important;border-radius:22px !important;box-shadow:inset 0 0 0 2px #fff,0 0 40px 10px rgba(255,248,226,.6),0 14px 30px rgba(80,90,95,.2) !important;color:${C.ink} !important;overflow:hidden !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1px solid #fff !important}
[data-wk="statehead"] *{color:${C.ink} !important}
[data-wk="statehead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:${MOONAV} !important}
[data-wk="statehead"] button{border:1px solid #D5DADD !important;border-radius:50% !important;background:rgba(255,255,255,.7) !important}
[data-wk="statemood"]{display:inline-block !important;background:#FFF6CF !important;color:${C.ink} !important;padding:0 10px !important;margin-right:4px !important;border-radius:999px !important;box-shadow:0 0 8px rgba(255,240,200,.9) !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:rgba(255,255,255,.6) !important;border:1px solid #fff !important;border-radius:999px !important;padding:3px !important;margin:12px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:999px !important;background:transparent !important;letter-spacing:.15em !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:#fff !important;color:${C.ink} !important;box-shadow:0 0 10px rgba(255,248,226,.9) !important}
[data-wk="stateseen"]{position:relative !important;${WHITE_CARD};margin:14px 16px 12px !important}
[data-wk="statevoice"]{position:relative !important;${GLASS_CARD};margin:14px 16px 12px !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.ink} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:rgba(230,235,237,.6) !important;border:1px solid #fff !important;border-radius:10px !important}
[data-wk="statewear"] > span{background:transparent !important;border:none !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:#8C8460 !important}
[data-wk="statevoice"] + div > button{background:rgba(255,255,255,.7) !important;color:${C.ink} !important;border:1px solid #fff !important;border-radius:999px !important}
[data-wk="stateaff"]{background:rgba(255,255,255,.55) !important;border-top:1px solid #fff !important;position:relative !important;display:block !important;padding:16px 120px 18px 20px !important;min-height:112px !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:absolute !important;right:18px !important;left:auto !important;top:50% !important;margin-top:-44px !important;width:92px !important;height:84px !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10'/></svg>`)} !important}
[data-wk="stateheart"] > div,[data-wk="stateheartknob"]{inset:0 !important;-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important;background-color:transparent !important;border:none !important}
[data-wk="stateheart"] > div:not([data-wk]){display:none !important}
[data-wk="stateheartfill"] > div{display:none !important}
[data-wk="stateheartline"]{background:${svg(ST1)} center/contain no-repeat !important;opacity:calc(1 - clamp(0,(var(--sc-heart-lvl) - 0.195)*1000,1)) !important}
[data-wk="stateheartbase"]{background:${svg(ST2)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.195)*1000,1) - clamp(0,(var(--sc-heart-lvl) - 0.495)*1000,1)) !important}
[data-wk="stateheartfill"]{background:${svg(ST3)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.495)*1000,1) - clamp(0,(var(--sc-heart-lvl) - 0.795)*1000,1)) !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;left:0 !important;bottom:0 !important;width:100% !important;height:100% !important;margin:0 !important;transform:none !important;background:${svg(ST4)} center/contain no-repeat !important;opacity:calc(clamp(0,(var(--sc-heart-lvl) - 0.795)*1000,1)) !important;filter:drop-shadow(0 0 10px rgba(255,240,200,.9)) !important}
[data-wk="stateheartnum"]{position:absolute !important;inset:auto 0 -10px 0 !important;display:flex !important;justify-content:center !important;padding:0 !important;font:500 12px/1 system-ui,sans-serif !important;letter-spacing:.2em !important;color:${C.fog} !important;-webkit-text-stroke:0 !important;text-shadow:0 0 4px #fff !important;z-index:3 !important}
[data-wk="stateaffval"]{display:none !important}
/* 翻旧的：一张张过曝的拍立得，底下写「第 N 次来过」 */
[data-wk="statehistbtn"]{background:rgba(255,255,255,.7) !important;color:${C.ink} !important;border:1px solid #fff !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.ink} !important}
[data-wk="statehistlist"]{counter-reset:pg !important}
[data-wk="statehistitem"]{counter-increment:pg !important;position:relative !important;background:#fff !important;border:none !important;border-radius:2px !important;padding:14px 16px 30px !important;margin:16px 4px !important;box-shadow:0 0 0 6px #fff,0 6px 16px rgba(120,130,135,.2) !important}
[data-wk="statehistitem"]:nth-child(odd){transform:rotate(-1deg) !important}
[data-wk="statehistitem"]:nth-child(even){transform:rotate(1deg) !important}
[data-wk="statehistitem"] *{color:${C.ink} !important}
[data-wk="statehistitem"]::after{content:"第 " counter(pg) " 次来过" !important;position:absolute !important;left:16px !important;bottom:8px !important;font-size:11px !important;font-style:italic !important;color:${C.fog} !important;letter-spacing:.15em !important}
[data-wk="statehistmood"]{background:#FFF6CF !important;border:none !important;border-radius:999px !important;padding:0 6px !important}
[data-wk="statehisttime"]{opacity:.6 !important}
[data-wk="statehistmeta"]{background:rgba(230,235,237,.5) !important;border-radius:6px !important}
[data-wk="statehistend"]{color:${C.fog} !important;letter-spacing:.3em !important}
/* Ta 眼里：贴条换成一颗睁眼的小星星 */
[data-wk="gazepage"]{background:${svg(FLOOR)} center bottom/100% 25% no-repeat,linear-gradient(180deg,#F6F5F0,#E3E8EA) !important}
[data-wk="gazetitle"]{color:${C.ink} !important;letter-spacing:.2em !important}
[data-wk="gazetab"]{background:rgba(255,255,255,.6) !important;color:${C.fog} !important;border:1px solid #fff !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:#fff !important;color:${C.ink} !important;box-shadow:0 0 10px rgba(255,248,226,.9) !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{position:relative !important;overflow:visible !important;${WHITE_CARD}}
[data-wk="gazetape"]{background:${svg(EYE_OPEN)} center/contain no-repeat !important;width:20px !important;height:20px !important;box-shadow:none !important;border:none !important;filter:drop-shadow(0 0 4px ${C.yel}) !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.fog} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{${WHITE_CARD};color:${C.ink} !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:rgba(255,255,255,.7) !important;color:${C.ink} !important;border:1px solid #fff !important;border-radius:14px !important}
[data-wk="gazeempty"] *{color:${C.ink} !important}
[data-wk="gazeempty"] button{background:#FFF6CF !important;color:${C.ink} !important;border:none !important;border-radius:999px !important}

/* ───── 线下：同一间过曝的空房间；他月光卡、我冷灰玻璃卡，底下都跟着星星 ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(FLOOR)} center bottom/100% 30% no-repeat,radial-gradient(circle at 80% 18%,rgba(255,252,235,.9) 0 70px,transparent 220px),${svg(FIELD)} 0 0/240px 300px,linear-gradient(180deg,#F6F5F0,#E3E8EA) !important;background-color:#ECEEEC !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:${C.ink} !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:rgba(255,255,255,.7) !important;color:${C.ink} !important;border:1px solid #fff !important;border-radius:999px !important;font-size:12px !important;padding:3px 12px !important;flex-shrink:0 !important}
[data-wk="offcomposer"]{background:rgba(255,255,255,.55) !important;backdrop-filter:blur(8px) !important;-webkit-backdrop-filter:blur(8px) !important;border:none !important;box-shadow:0 -1px 0 #fff !important}
[data-wk="offcomposer"] textarea{background:rgba(255,255,255,.7) !important;border:1px solid #fff !important;border-radius:14px !important;color:${C.ink} !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_MOON)} center/contain no-repeat !important;${HIDE}}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) *{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{width:38px !important;min-width:38px !important;height:32px !important;${HIDE};background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcard"]{position:relative !important;overflow:visible !important;${WHITE_CARD};margin-bottom:16px !important}
[data-wk="offcard"][data-me="1"]{${GLASS_CARD}}
[data-wk="offcard"]::after{content:"" !important;position:absolute !important;left:14px !important;right:14px !important;bottom:-12px !important;height:14px !important;background:${svg(TRAIL_HIS)} 0 0/120px 16px repeat-x !important;pointer-events:none !important}
[data-wk="offcard"][data-me="1"]::after{background:${svg(TRAIL_ME)} right 0 top 0/120px 16px repeat-x !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:${MOONAV} !important}
[data-wk="offname"]{color:${C.ink} !important;letter-spacing:.1em !important}
[data-wk="offtext"]{color:#5A5F63 !important;letter-spacing:.04em !important}
[data-wk="offsay"]{color:${C.ink} !important;background:linear-gradient(transparent 60%,rgba(255,240,180,.8) 60%) !important;border:none !important;box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important}
[data-wk="offcard"][data-me="1"] [data-wk="offsay"]{background:linear-gradient(transparent 60%,rgba(255,255,255,.8) 60%) !important}
[data-wk="offthought"]{background:transparent !important;border:none !important;color:#A0A7AB !important;font-style:italic !important}
[data-wk="offcardacts"] svg{stroke:${C.fog} !important;color:${C.fog} !important}
[data-wk="offreplyopt"]{background:rgba(255,255,255,.75) !important;border:1px solid #fff !important;border-radius:12px !important;color:${C.ink} !important}
`;
const pack = { kind: "chat-look", v: 1, name: "月下星路", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "月下星路-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
