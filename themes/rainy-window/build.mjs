// 雨天窗边：傍晚下雨的窗外——深蓝到紫粉的天，彩色光斑，窗台上一只杯子一盆草。
// 顶栏下挂一排小云朵、云底吊着雨滴；顶栏头像撑一把小伞；我的话＝一块会淌水珠的渐变玻璃；
// 他的话＝从小云朵底下吊下来的一张奶白卡；底栏是一只悬浮的磨砂玻璃胶囊。用法：node themes/rainy-window/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { night: "#1B2552", dusk: "#3B3F8C", vio: "#7A5FC0", rose: "#E59AC4", glass: "#9EC8FF", glass2: "#C8B2FF", cream: "#FFFBF4", ink: "#34406A", fog: "#C9D3F2", drop: "#8FC2FF", yel: "#FFD86B", pink: "#FF9EC8" };

const RAIN = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160'><g stroke='#CFE3FF' stroke-linecap='round'><path d='M14 6 l-5 22' stroke-width='1.2' opacity='.55'/><path d='M70 40 l-3 14' stroke-width='.9' opacity='.45'/><path d='M104 86 l-5 24' stroke-width='1.2' opacity='.5'/><path d='M40 100 l-3 13' stroke-width='.9' opacity='.4'/><path d='M60 140 l-2 10' stroke-width='.8' opacity='.4'/><path d='M96 10 l-2 9' stroke-width='.8' opacity='.35'/></g></svg>`;
const g = (i, c) => `<radialGradient id='${i}'><stop offset='0' stop-color='${c}' stop-opacity='.9'/><stop offset='.5' stop-color='${c}' stop-opacity='.35'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient>`;
const BOKEH = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='520'><defs>${g("p", "#FF9EC8")}${g("y", "#FFD86B")}${g("v", "#B79CFF")}${g("b", "#7FC4FF")}</defs><circle cx='40' cy='80' r='46' fill='url(#p)'/><circle cx='340' cy='150' r='56' fill='url(#y)'/><circle cx='260' cy='330' r='40' fill='url(#v)'/><circle cx='70' cy='380' r='36' fill='url(#b)'/><circle cx='200' cy='40' r='24' fill='url(#v)'/><circle cx='360' cy='470' r='26' fill='url(#p)'/><circle cx='150' cy='250' r='14' fill='url(#y)'/></svg>`;
// 窗外：远处一排亮着灯的楼，近处一条窗台，上面一只冒热气的杯子和一盆小草
const SCENE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 170'><path d='M0 120 V70 H30 V55 H58 V82 H80 V40 H112 V90 H140 V62 H170 V96 H200 V50 H236 V80 H262 V58 H290 V92 H318 V44 H350 V76 H390 V120Z' fill='#2A2F6E' opacity='.85'/><g fill='#FFD86B' opacity='.8'><rect x='88' y='50' width='5' height='6'/><rect x='100' y='64' width='5' height='6'/><rect x='88' y='76' width='5' height='6'/><rect x='210' y='60' width='5' height='6'/><rect x='222' y='72' width='5' height='6'/><rect x='326' y='54' width='5' height='6'/><rect x='338' y='66' width='5' height='6'/><rect x='38' y='66' width='5' height='6'/><rect x='150' y='72' width='5' height='6'/><rect x='270' y='68' width='5' height='6'/></g><g fill='#FF9EC8' opacity='.7'><rect x='100' y='52' width='5' height='6'/><rect x='326' y='78' width='5' height='6'/><rect x='48' y='90' width='5' height='6'/></g><rect x='0' y='132' width='390' height='38' fill='#E9D3C2'/><rect x='0' y='126' width='390' height='10' rx='3' fill='#F6E6D8'/><path d='M44 126 V104 Q44 100 48 100 H72 Q76 100 76 104 V126Z' fill='#FFFBF4' stroke='#B79CFF' stroke-width='2'/><path d='M76 106 Q86 108 84 116 Q82 122 76 120' fill='none' stroke='#B79CFF' stroke-width='2'/><path d='M54 94 Q50 88 55 82 M64 94 Q60 86 66 80' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' opacity='.8'/><path d='M318 126 L322 106 H350 L354 126Z' fill='#FF9EC8'/><path d='M336 106 Q328 88 318 84 M336 106 Q338 84 346 76 M336 106 Q346 94 358 92' fill='none' stroke='#6CC59A' stroke-width='3' stroke-linecap='round'/><circle cx='318' cy='84' r='4' fill='#6CC59A'/><circle cx='346' cy='76' r='4' fill='#6CC59A'/><circle cx='358' cy='92' r='4' fill='#6CC59A'/></svg>`;
// 顶栏下：一排小云，云底吊着雨滴
const CLOUD = (x, c = "#fff") => `<path d='M${x + 4} 17 a5 5 0 0 1 2-9 a7 7 0 0 1 12-4 a8 8 0 0 1 14 3 a5 5 0 0 1 2 10 Z' fill='${c}' stroke='#C8B2FF' stroke-width='1'/>`;
const DROPP = (x, y, c) => `<path d='M${x} ${y} q-4 7 0 9 q4 -2 0 -9Z' fill='${c}' stroke='#fff' stroke-width='.8'/>`;
const LINE_C = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 52'>${[0, 1, 2, 3, 4, 5, 6].map(i => { const x = 6 + i * 56; const c = ["#FF9EC8", "#8FC2FF", "#FFD86B", "#B79CFF"][i % 4]; const l = 22 + (i % 3) * 8; return `<path d='M${x + 18} 16 V${l}' stroke='#E6ECFF' stroke-width='.9'/>${DROPP(x + 18, l, c)}${CLOUD(x)}`; }).join("")}</svg>`;
const UMB = (c1 = C.pink, c2 = "#fff") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 34'><path d='M3 16 A17 14 0 0 1 37 16 Q31.5 12.5 26 16 Q20 12.5 14 16 Q8.5 12.5 3 16Z' fill='${c1}' stroke='#fff' stroke-width='1.6' stroke-linejoin='round'/><path d='M20 3 V16 M14 16 Q16 8 20 3 Q24 8 26 16' fill='none' stroke='${c2}' stroke-width='1.1' opacity='.8'/><path d='M20 16 V28 Q20 31 17 31 Q14.5 31 14.5 28.5' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round'/><circle cx='20' cy='2.5' r='1.6' fill='#fff'/></svg>`;
const DROP = (f = C.drop) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 26'><path d='M10 1.5 C10 1.5 2.5 11 2.5 16.5 A7.5 7.5 0 0 0 17.5 16.5 C17.5 11 10 1.5 10 1.5Z' fill='${f}' stroke='#fff' stroke-width='1.4'/><path d='M6.5 16 A3.5 3.5 0 0 0 9 19.5' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const DROPS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 26'><circle cx='10' cy='10' r='6.5' fill='rgba(255,255,255,.55)' stroke='#fff' stroke-width='1.3'/><circle cx='8' cy='8' r='1.8' fill='#fff'/><circle cx='25' cy='17' r='4.2' fill='rgba(255,255,255,.55)' stroke='#fff' stroke-width='1.2'/><circle cx='29' cy='5' r='2.4' fill='rgba(255,255,255,.6)' stroke='#fff' stroke-width='1'/></svg>`;
const CLOUDTAG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 46 30'><path d='M6 24 a8 8 0 0 1 3-15 a12 12 0 0 1 22-2 a9 9 0 0 1 9 17 Z' fill='#fff' stroke='#B79CFF' stroke-width='1.6' stroke-linejoin='round'/><circle cx='17' cy='17' r='1.6' fill='${C.ink}'/><circle cx='28' cy='17' r='1.6' fill='${C.ink}'/><path d='M20.5 20 q2 2 4 0' fill='none' stroke='${C.ink}' stroke-width='1.3' stroke-linecap='round'/><circle cx='13' cy='20' r='2' fill='#FFB8D6' opacity='.8'/><circle cx='32' cy='20' r='2' fill='#FFB8D6' opacity='.8'/></svg>`;
const TIMEC = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 34'><rect x='8' y='9' width='144' height='23' rx='11.5' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><circle cx='22' cy='12' r='8' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><circle cx='34' cy='9' r='7' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><circle cx='136' cy='11' r='8' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><rect x='14' y='12' width='132' height='18' rx='9' fill='#fff'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='#8FC2FF' stroke='#fff' stroke-width='2.4'/><path d='M20 12 V28 M12 20 H28' stroke='#fff' stroke-width='3' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M20 3 C20 3 7 18 7 26 A13 13 0 0 0 33 26 C33 18 20 3 20 3Z' fill='${C.pink}' stroke='#fff' stroke-width='2.4' stroke-linejoin='round'/><path d='M20 31 C14 27 13.5 24.5 13.5 23 C13.5 21 15 20 16.6 20 C18 20 19.3 20.9 20 22 C20.7 20.9 22 20 23.4 20 C25 20 26.5 21 26.5 23 C26.5 24.5 26 27 20 31Z' fill='#fff'/><path d='M12 22 Q12.5 17 15.5 13' fill='none' stroke='#fff' stroke-width='1.8' stroke-linecap='round' opacity='.7'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 40'><path d='M8 30 a9 9 0 0 1 2-17 a12 12 0 0 1 22-3 a10 10 0 0 1 6 19 Z' fill='#fff' stroke='#B79CFF' stroke-width='2.2' stroke-linejoin='round'/><circle cx='16' cy='21' r='2' fill='#B79CFF'/><circle cx='23' cy='21' r='2' fill='#B79CFF'/><circle cx='30' cy='21' r='2' fill='#B79CFF'/><path d='M14 32 q-1 4 -4 6' fill='none' stroke='#8FC2FF' stroke-width='2' stroke-linecap='round'/><path d='M26 32 q-1 3 -2 5' fill='none' stroke='#8FC2FF' stroke-width='2' stroke-linecap='round'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='rgba(255,255,255,.18)' stroke='#fff' stroke-width='1.8'/><path d='M11 20 L20 12 L29 20 V29 H11Z' fill='#FF9EC8' stroke='#fff' stroke-width='1.8' stroke-linejoin='round'/><rect x='17.5' y='22' width='5' height='7' fill='#fff'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 36'><path d='M10 22 a8 8 0 0 1 3-14 a12 12 0 0 1 22-1 a9 9 0 0 1 9 15 Z' fill='#fff'/><path d='M38 22 a6 6 0 0 1 2-10 a8 8 0 0 1 14 0 a6 6 0 0 1 2 10 Z' fill='#C8B2FF'/>${["#8FC2FF", "#FF9EC8", "#FFD86B"].map((c, i) => `<path d='M${16 + i * 9} 26 q-3 5 0 7 q3 -2 0 -7Z' fill='${c}'/>`).join("")}</svg>`;

const bubble = { myBg: C.glass, myText: C.ink, myBorder: "none", charBg: C.cream, charText: C.ink, charBorder: "none", radius: 18, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 雨天窗边 · 第一批 ───── */
[data-wk="chat"]{background:${svg(BOKEH)} 0 0/390px 520px repeat,linear-gradient(180deg,#141C44 0%,${C.night} 25%,${C.dusk} 55%,${C.vio} 80%,${C.rose} 100%) !important;position:relative !important}
/* 雨丝往下落 */
[data-wk="chat"]::before{content:"" !important;position:absolute !important;inset:0 !important;background:${svg(RAIN)} 0 0/120px 160px repeat,${svg(RAIN)} 50px 30px/170px 220px repeat !important;pointer-events:none !important;z-index:0 !important;animation:rwRain 1.4s linear infinite !important}
@keyframes rwRain{from{background-position:0 0,50px 30px}to{background-position:-40px 160px,10px 250px}}
/* 窗外楼群＋窗台（抬到底栏上面露出来） */
[data-wk="chat"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:0 !important;height:calc(env(safe-area-inset-bottom) * .4 + 62px + 150px) !important;background:${svg(SCENE)} center bottom calc(env(safe-area-inset-bottom) * .4 + 30px)/100% auto no-repeat,linear-gradient(#E9D3C2,#E9D3C2) center bottom/100% calc(env(safe-area-inset-bottom) * .4 + 34px) no-repeat !important;pointer-events:none !important;z-index:0 !important}
@media (prefers-reduced-motion:reduce){[data-wk="chat"]::before{animation:none !important}}
[data-wk="body"]{background:transparent !important;position:relative !important;z-index:1 !important;padding-top:40px !important}

/* 顶栏：深夜蓝磨砂，下沿挂一排小云、云底吊彩色雨滴 */
[data-wk="chathead"]{background:rgba(20,28,68,.78) !important;backdrop-filter:blur(8px) !important;-webkit-backdrop-filter:blur(8px) !important;border-bottom:1.5px solid rgba(200,178,255,.5) !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% - 6px) !important;height:52px !important;background:${svg(LINE_C)} center top/100% auto no-repeat !important;pointer-events:none !important;transform-origin:center top !important;animation:rwSway 5s ease-in-out infinite !important}
@keyframes rwSway{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:34px !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="sameroom"]{width:36px !important;min-width:36px !important;height:36px !important;font-size:0 !important;padding:0 !important;background:${svg(I_HOUSE)} center/34px no-repeat !important;border:none !important;box-shadow:none !important;margin-left:auto !important}
[data-wk="chatmore"]{width:52px !important;min-width:52px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;background:${svg(I_MORE)} center/48px auto no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
/* 顶栏头像撑一把小粉伞 */
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]) > [data-wk="avatar"]{box-shadow:0 0 0 2.5px #fff,0 0 12px rgba(143,194,255,.7) !important;border-radius:50% !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:40px !important;height:34px !important;left:-12px !important;top:calc(50% - 38px) !important;background:${svg(UMB())} center/contain no-repeat !important;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3)) !important;transform:rotate(-20deg) !important;z-index:3 !important;pointer-events:none !important}

/* 聊天头像：白圈＋底下托一朵小云 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:50% !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important;border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 2.5px #fff,0 0 10px rgba(183,156,255,.8) !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;left:-18% !important;right:-18% !important;bottom:-22% !important;height:46% !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 22'><path d='M6 20 a7 7 0 0 1 4-12 a10 10 0 0 1 18-4 a11 11 0 0 1 20 3 a7 7 0 0 1 6 13 Z' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/></svg>`)} center bottom/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}
[data-wk="chathead"] button[data-wk="avatar"]::after,[data-wk="chathead"] span[data-wk="avatar"]::after{content:none !important}

/* 我的话：蓝到淡紫的玻璃，右上一串水珠，一颗水珠沿右边慢慢淌下来 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;color:${C.ink} !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(160deg,rgba(255,255,255,.75),rgba(255,255,255,0) 42%),linear-gradient(135deg,${C.glass},${C.glass2}) !important;border:2px solid rgba(255,255,255,.9) !important;border-radius:22px 22px 6px 22px !important;box-shadow:0 0 0 1.5px rgba(143,194,255,.6),0 6px 16px rgba(80,60,180,.35) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"" !important;position:absolute !important;left:-12px !important;top:-10px !important;right:auto !important;bottom:auto !important;width:30px !important;height:23px !important;background:${svg(DROPS)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;right:10px !important;top:4px !important;left:auto !important;bottom:auto !important;width:8px !important;height:11px !important;background:${svg(DROP("rgba(255,255,255,.7)"))} center/contain no-repeat !important;border:none !important;transform:none !important;animation:rwSlide 6s ease-in infinite !important}
@keyframes rwSlide{0%,40%{transform:translateY(0);opacity:0}50%{opacity:1}90%{transform:translateY(calc(100% + 18px));opacity:1}100%{transform:translateY(calc(100% + 22px));opacity:0}}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:none !important}

/* 他的话：一张奶白卡，从一朵笑脸小云底下吊下来；连发的后几张只用一根细线挂在上一张底下 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:8px 22px 22px 22px !important;box-shadow:0 4px 0 rgba(183,156,255,.55),0 8px 16px rgba(20,28,68,.35) !important;margin-top:16px !important;transform-origin:24px -16px !important;animation:rwSwing 5s ease-in-out infinite !important}
@keyframes rwSwing{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(1deg)}}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;left:-10px !important;top:-18px !important;right:auto !important;bottom:auto !important;width:44px !important;height:29px !important;z-index:2 !important;background:${svg(CLOUDTAG)} center/contain no-repeat !important;border:none !important;transform:none !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;right:-9px !important;left:auto !important;bottom:-9px !important;top:auto !important;width:20px !important;height:20px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4Z' fill='${C.yel}' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/></svg>`)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]{margin-top:10px !important;animation:none !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]::before{top:-14px !important;left:22px !important;width:2px !important;height:14px !important;background:#C8B2FF !important;border-radius:1px !important}
[data-msg] [data-wk="bubble"][data-kind="text"][data-me="0"]::after,[data-wk="msg"][data-last="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:none !important}

/* 时间：一朵白云胶囊 */
[data-wk="time"]{margin-top:20px !important}
[data-wk="time"] > span{min-width:150px !important;background:${svg(TIMEC)} center/100% 100% no-repeat !important;border:none !important;border-radius:0 !important;padding:7px 22px 5px !important;color:${C.ink} !important;font-weight:600 !important;letter-spacing:.08em !important;box-shadow:none !important}
/* 已读：前面一颗小水滴 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important}
[data-wk="meta"][data-read="1"]::before{content:"" !important;display:inline-block !important;width:9px !important;height:12px !important;margin-right:4px !important;vertical-align:-2px !important;background:${svg(DROP())} center/contain no-repeat !important;filter:drop-shadow(0 0 3px rgba(143,194,255,.9)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:8px 22px 22px 22px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{width:8px !important;height:11px !important;border-radius:0 !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="name"]{color:#fff !important}

/* 动描：像用手指写在起雾玻璃上——磨砂透明一条，白色斜体字，左边一道往下淌的水痕 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{background:rgba(255,255,255,.14) !important;backdrop-filter:blur(4px) !important;-webkit-backdrop-filter:blur(4px) !important;border:1px solid rgba(255,255,255,.35) !important;border-left:3px solid ${C.drop} !important;border-radius:4px 14px 14px 4px !important;box-shadow:none !important;color:#F1F4FF !important;font-style:italic !important;font-size:13px !important;padding:6px 12px !important}
/* 系统提示：不带框的一行小字，前面一把小伞 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11.5px !important;font-style:normal !important;letter-spacing:.06em !important}
[data-wk="sysnotetext"]::before{content:"☂ " !important;color:${C.pink} !important}

/* 底栏：一只悬浮的磨砂玻璃胶囊，加号、输入、发送、回复全包进去 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important;align-items:center !important;gap:6px !important;padding-left:16px !important;padding-right:16px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:6px !important;right:6px !important;top:2px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 8px) !important;border-radius:999px !important;background:linear-gradient(180deg,#FFFFFF,#F1ECFF) !important;border:2px solid #C8B2FF !important;box-shadow:0 4px 0 rgba(183,156,255,.6),0 8px 18px rgba(20,28,68,.35) !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="chatinput"]{background:transparent !important;border:none !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#9A92C4 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;width:36px !important;height:36px !important;min-width:36px !important;align-self:center !important;margin:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important;filter:drop-shadow(0 0 6px rgba(255,158,200,.7)) !important}
[data-wk="chatreply"]{width:40px !important;min-width:40px !important;background:${svg(I_REPLY)} center/contain no-repeat !important;margin-right:4px !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}
[data-wk="chatpanel"]{background:rgba(20,28,68,.92) !important;position:relative !important;z-index:3 !important;border-top:1.5px solid rgba(200,178,255,.5) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "雨天窗边", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "雨天窗边-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
