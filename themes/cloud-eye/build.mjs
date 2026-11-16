// 云眸入梦：黄昏转紫的夜空，底下一片粉色的云海。每条气泡是一朵云：他的是粉白的云，我的是一朵暗紫的雨云；
// 云里睁着一只发彩虹光的眼睛。头像＝一只石头眼皮的巨眼，照片就是瞳孔。已送达＝闭着的眼，已读＝睁开的眼。
// 用法：node themes/cloud-eye/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const CLOUD = (f, g) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f}"/><stop offset="1" stop-color="${g}"/></linearGradient></defs><path fill="url(#g)" d="M22 92C9 92 2 84 4 74C6 66 12 62 18 62C10 56 10 42 20 36C27 31 36 33 40 38C40 22 52 12 66 14C76 15 82 21 85 28C90 22 100 20 108 26C116 32 116 42 112 48C122 50 130 58 128 70C126 84 116 92 104 92Z"/></svg>`;
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { s1: "#2B1F55", s2: "#4A3285", s3: "#8A4FA8", pink: "#F6B9DC", cloud: "#FFE8F4", cloudD: "#F2C6E0", storm: "#4E4672", stormD: "#36305A", ink: "#5A3A70", fog: "#D8CCEC" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

const STARS = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='260'>${Array.from({ length: 36 }, (_, i) => `<circle cx='${(i * 61 + (i % 4) * 13) % 220}' cy='${(i * 43 + (i % 6) * 17) % 260}' r='${[0.6, 0.9, 1.2][i % 3]}' fill='#fff' opacity='${(0.3 + (i % 5) * 0.12).toFixed(2)}'/>`).join("")}</svg>`;
// 一只发彩虹光的眼睛：杏仁形眼白、彩虹虹膜、黑瞳孔、一点高光
const RAINBOW_IRIS = `<defs><linearGradient id='ir' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#FF8AD8'/><stop offset='.25' stop-color='#FFE36A'/><stop offset='.5' stop-color='#6AF0C0'/><stop offset='.75' stop-color='#6AB4FF'/><stop offset='1' stop-color='#C98AFF'/></linearGradient></defs>`;
const EYE = (dark = false) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 22'>${RAINBOW_IRIS}<path d='M2 11 Q20 -4 38 11 Q20 26 2 11Z' fill='#fff' stroke='${dark ? "#fff" : C.ink}' stroke-width='1.6'/><circle cx='20' cy='11' r='7' fill='url(#ir)'/><circle cx='20' cy='11' r='3.3' fill='#1E1430'/><circle cx='17.6' cy='8.6' r='1.6' fill='#fff'/></svg>`;
const SHUT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 22'><path d='M3 8 Q20 20 37 8' fill='none' stroke='${C.fog}' stroke-width='1.8' stroke-linecap='round'/>${[8, 14, 20, 26, 32].map((x, i) => `<path d='M${x} ${11 + (i === 2 ? 2 : i % 4 ? 1 : 0)} L${x + (x - 20) * 0.15} ${17 + (i === 2 ? 2 : 0)}' stroke='${C.fog}' stroke-width='1.4' stroke-linecap='round'/>`).join("")}</svg>`;
// 头像框：一只石头眼皮的巨眼——灰紫杏仁形的厚眼皮，内圈一道彩虹光环当虹膜，照片是瞳孔
const BIGEYE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 100'>${RAINBOW_IRIS}<defs><linearGradient id='st' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#9C90C8'/><stop offset='1' stop-color='#5E5390'/></linearGradient><mask id='m'><rect width='140' height='100' fill='#fff'/><circle cx='70' cy='50' r='30' fill='#000'/></mask></defs><path d='M4 50 Q70 -16 136 50 Q70 116 4 50Z' fill='url(#st)' stroke='#3E3570' stroke-width='2' mask='url(#m)'/><path d='M20 50 Q70 4 120 50' fill='none' stroke='#C8BEEA' stroke-width='2' opacity='.7' stroke-linecap='round'/><circle cx='70' cy='50' r='33' fill='none' stroke='url(#ir)' stroke-width='5'/><circle cx='70' cy='50' r='30' fill='none' stroke='#fff' stroke-width='1.2' opacity='.8'/></svg>`;
// 云朵的鼓包边
const PUFF = (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='14'><circle cx='13' cy='14' r='12' fill='${c}'/></svg>`;
const CI = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M8 28 a6 6 0 0 1 2-11 a9 9 0 0 1 17-3 a7 7 0 0 1 5 14Z' fill='rgba(255,255,255,.12)' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/>${inner}</svg>`;
const MINIEYE = `<g transform='translate(11 15) scale(.45)'>${EYE().replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`;
// 按键：主页＝一朵小云里一只眼；更多＝三颗星；加号＝云里一个十字；发送＝一道往右飞的流星；最右「让他回复」＝一颗粉云里睁着的大眼
const I_HOUSE = CI(MINIEYE);
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${[[11, 20], [20, 16], [29, 20]].map(([x, y]) => `<path transform='translate(${x} ${y})' d='M0 -5 Q.4 -.4 3.5 0 Q.4 .4 0 5 Q-.4 .4 -3.5 0 Q-.4 -.4 0 -5Z' fill='#fff'/>`).join("")}</svg>`;
const I_PLUS = CI(`<path d='M20 16 V26 M15 21 H25' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/>`);
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M6 28 L26 16' stroke='#fff' stroke-width='1.2' stroke-linecap='round' opacity='.5'/><path d='M10 30 L28 19' stroke='#FFC8E6' stroke-width='1.6' stroke-linecap='round' opacity='.7'/><path transform='translate(29 15)' d='M0 -6 Q.5 -.5 4.5 0 Q.5 .5 0 6 Q-.5 .5 -4.5 0 Q-.5 -.5 0 -6Z' fill='#fff'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 52 44'>${RAINBOW_IRIS}<path d='M8 36 a8 8 0 0 1 2-15 a12 12 0 0 1 23-5 a10 10 0 0 1 9 20Z' fill='${C.cloud}' stroke='#fff' stroke-width='1.5' stroke-linejoin='round'/><path d='M14 26 Q26 15 38 26 Q26 37 14 26Z' fill='#fff' stroke='${C.ink}' stroke-width='1.3'/><circle cx='26' cy='26' r='5' fill='url(#ir)'/><circle cx='26' cy='26' r='2.3' fill='#1E1430'/><circle cx='24.5' cy='24.5' r='1' fill='#fff'/></svg>`;


// ── 第二批用的图 ──
// 一颗落下来的星（转账）；caught＝被一只眼睛接住；back＝星星熄了
const STAR = st => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 44'>${RAINBOW_IRIS}${st === "caught" ? `<path d='M6 30 Q30 12 54 30 Q30 46 6 30Z' fill='#fff' stroke='#fff' stroke-width='1'/><circle cx='30' cy='30' r='8' fill='url(#ir)'/><circle cx='30' cy='30' r='3.4' fill='#1A1030'/>` : ``}<path d='M8 4 L22 16' stroke='${st === "back" ? "#8C84B0" : "#FFE6F4"}' stroke-width='1.4' stroke-linecap='round' opacity='.6'/><path transform='translate(30 ${st === "caught" ? 14 : 22})' d='M0 -10 Q1.6 -1.6 10 0 Q1.6 1.6 0 10 Q-1.6 1.6 -10 0 Q-1.6 -1.6 0 -10Z' fill='${st === "back" ? "#8C84B0" : "#FFF3B0"}'/></svg>`;
// 红包＝一朵粉云里闭着眼；done＝睁开了
const NAPCLOUD = open => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 46'>${RAINBOW_IRIS}<path d='M12 40 a9 9 0 0 1 1-17 a13 13 0 0 1 24-8 a11 11 0 0 1 17 9 a8 8 0 0 1-2 16Z' fill='${C.cloud}' stroke='#fff' stroke-width='1.2'/>${open ? `<path d='M20 30 Q32 20 44 30 Q32 40 20 30Z' fill='#fff' stroke='${C.ink}' stroke-width='1.2'/><circle cx='32' cy='30' r='5' fill='url(#ir)'/><circle cx='32' cy='30' r='2' fill='#1A1030'/>` : `<path d='M21 28 Q32 36 43 28' fill='none' stroke='${C.ink}' stroke-width='1.6' stroke-linecap='round'/>${[24, 29, 35, 40].map(x => `<path d='M${x} ${x < 32 ? 31 : 31} l${x < 32 ? -1 : 1} 3' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/>`).join("")}<text x='46' y='15' font-size='8' fill='#fff' font-family='serif'>z</text><text x='51' y='9' font-size='6' fill='#fff' font-family='serif'>z</text>`}</svg>`;
const PIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 32'>${RAINBOW_IRIS}<path d='M12 31 C12 31 2 18 2 11 a10 10 0 0 1 20 0 C22 18 12 31 12 31Z' fill='${C.cloud}' stroke='#fff' stroke-width='1.2'/><path d='M5 11 Q12 4 19 11 Q12 18 5 11Z' fill='#fff' stroke='${C.ink}' stroke-width='1'/><circle cx='12' cy='11' r='3.2' fill='url(#ir)'/><circle cx='12' cy='11' r='1.3' fill='#1A1030'/></svg>`;
const OPENEYE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>${RAINBOW_IRIS}<circle cx='40' cy='40' r='38' fill='#FFF6FB' stroke='#fff' stroke-width='2'/><path d='M12 40 Q40 14 68 40 Q40 66 12 40Z' fill='#fff' stroke='${C.ink}' stroke-width='2'/><circle cx='40' cy='40' r='13' fill='url(#ir)'/><circle cx='40' cy='40' r='5.5' fill='#1A1030'/><circle cx='44' cy='35' r='2.4' fill='#fff'/></svg>`;
const CARD = `background:linear-gradient(180deg,rgba(255,232,244,.16),rgba(120,90,180,.22)) !important;border:none !important;border-radius:16px !important;box-shadow:inset 0 0 0 1px rgba(255,220,240,.55),0 0 18px rgba(255,180,230,.25) !important;color:#fff !important`;

// ── 第三批：好感＝一只眼睛，好感越高睁得越大（底图是闭着的睫毛线，上面那只彩虹眼按好感纵向张开）
const AFFBASE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 50'><path d='M6 25 Q40 46 74 25' fill='none' stroke='${C.fog}' stroke-width='1.6' stroke-linecap='round'/>${[14, 24, 34, 46, 56, 66].map((x, i) => `<path d='M${x} ${[30, 34, 36, 36, 34, 30][i]} l${x < 40 ? -2 : 2} 5' stroke='${C.fog}' stroke-width='1.4' stroke-linecap='round'/>`).join("")}</svg>`;
const AFFEYE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 50'>${RAINBOW_IRIS}<path d='M6 25 Q40 -4 74 25 Q40 54 6 25Z' fill='#fff' stroke='${C.cloud}' stroke-width='2'/><circle cx='40' cy='25' r='13' fill='url(#ir)'/><circle cx='40' cy='25' r='5.5' fill='#1A1030'/><circle cx='44' cy='20' r='2.4' fill='#fff'/></svg>`;
const CLOUDTOP = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='26'><g fill='${C.cloud}'><circle cx='14' cy='22' r='13'/><circle cx='38' cy='18' r='16'/><circle cx='64' cy='22' r='12'/><circle cx='88' cy='17' r='15'/><circle cx='110' cy='22' r='12'/><rect x='0' y='22' width='120' height='4'/></g></svg>`;

const bubble = { myBg: C.storm, myText: "#fff", myBorder: "none", charBg: C.cloud, charText: C.ink, charBorder: "none", radius: 26, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 云眸入梦 · 第一批 ───── */
[data-wk="chat"]{background:${svg(STARS)} 0 0/220px 260px,radial-gradient(ellipse at 50% 108%,#FFB8DE 0 18%,rgba(246,185,220,.55) 30%,transparent 55%),linear-gradient(180deg,${C.s1} 0%,${C.s2} 45%,${C.s3} 85%,#C46AB0 100%) !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：不做框，往下淡出，底下一道淡粉细线 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,rgba(43,31,85,.9),rgba(43,31,85,0)) !important;border-bottom:none !important;box-shadow:none !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;margin-top:-10px !important;height:20px !important;opacity:.85 !important;border-radius:0 0 10px 10px !important;background:radial-gradient(circle,#FBE1F0 7px,transparent 8.5px) 0 2px/29px 18px repeat-x,radial-gradient(circle,#FBE1F0 5px,transparent 6.5px) 9px 6px/19px 14px repeat-x,radial-gradient(circle,#FBE1F0 9px,transparent 10.5px) 17px 0/43px 22px repeat-x,linear-gradient(#FBE1F0,#FBE1F0) 0 12px/100% 8px repeat-x !important;-webkit-mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent) !important;mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent) !important;animation:ceDrift 40s linear infinite !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:50% !important;top:100% !important;width:52px !important;height:36px !important;margin:-6px 0 0 -26px !important;background:${svg(NAPCLOUD(true))} center/contain no-repeat !important;filter:drop-shadow(0 0 8px rgba(255,190,230,.7)) !important;animation:ceFloat 4s ease-in-out infinite !important;pointer-events:none !important;z-index:1 !important}
@keyframes ceDrift{to{background-position:348px 2px,399px 6px,387px 0,0 12px}}
[data-wk="headname"] > [data-wk="headink"]{text-shadow:none !important}
[data-wk="headname"],[data-wk="headname"] *{background-color:transparent !important;box-shadow:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.15em !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:#fff !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{flex:none !important;width:36px !important;min-width:36px !important;height:36px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]),[data-wk="chathead"] + *:not([data-wk="body"]) *{color:#fff !important}

/* 头像：一只石头眼皮的巨眼，照片就是瞳孔，外圈一道彩虹光 */
button[data-wk="avatar"],span[data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:50% !important;box-shadow:0 0 14px 3px rgba(255,200,240,.5) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important;border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-42% !important;right:-42% !important;top:-12% !important;bottom:-12% !important;background:${svg(BIGEYE)} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important;border:none !important;border-radius:0 !important;filter:drop-shadow(0 3px 5px rgba(20,10,50,.45)) !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before{content:none !important}
[data-wk="chathead"] img[data-wk="avatar"]{box-shadow:0 0 0 2.5px #fff,0 0 0 5px rgba(201,138,255,.6) !important}
[data-wk="msg"] [data-wk="row"]{gap:22px !important}
[data-wk="msg"][data-me="0"] [data-wk="row"]{padding-left:12px !important}
[data-wk="msg"][data-me="1"] [data-wk="row"]{padding-right:12px !important}

/* 气泡：一朵云——上下两排圆鼓鼓的边；他的粉白云，我的暗紫雨云。一串第一条里睁着一只彩虹眼 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border:none !important;border-radius:14px !important;letter-spacing:.1em !important;padding:11px 20px !important;margin:16px 16px 12px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;left:-8px !important;right:-8px !important;top:-9px !important;bottom:-8px !important;z-index:-1 !important;border:none !important;transform:none !important;width:auto !important;height:auto !important;pointer-events:none !important;border-radius:24px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:#FDEAF4 !important;color:${C.ink} !important;box-shadow:0 0 22px 6px rgba(255,190,225,.5) !important;filter:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{background:radial-gradient(circle,#FDEAF4 10.5px,transparent 13px) 4px 0/31px 26px repeat-x,radial-gradient(circle,#FDEAF4 7.5px,transparent 10px) 15px 5px/23px 20px repeat-x,radial-gradient(circle,#FDEAF4 11.5px,transparent 14px) 26px 1px/43px 28px repeat-x,radial-gradient(circle,#FDEAF4 8.5px,transparent 11px) 9px calc(100% - 2px)/27px 22px repeat-x,radial-gradient(circle,#FDEAF4 10.5px,transparent 13px) 0 100%/37px 26px repeat-x,radial-gradient(circle,#FDEAF4 6.5px,transparent 9px) 12px calc(100% - 5px)/19px 18px repeat-x,radial-gradient(circle,#FDEAF4 8.5px,transparent 11px) 0 3px/22px 21px repeat-y,radial-gradient(circle,#FDEAF4 6.5px,transparent 9px) 4px 12px/18px 17px repeat-y,radial-gradient(circle,#FDEAF4 8.5px,transparent 11px) 100% 6px/22px 23px repeat-y,radial-gradient(circle,#FDEAF4 6.5px,transparent 9px) calc(100% - 4px) 0/18px 15px repeat-y !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:#5A5288 !important;color:#fff !important;box-shadow:0 0 20px 5px rgba(150,130,220,.45) !important;filter:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{background:radial-gradient(circle,#5A5288 10.5px,transparent 13px) 4px 0/31px 26px repeat-x,radial-gradient(circle,#5A5288 7.5px,transparent 10px) 15px 5px/23px 20px repeat-x,radial-gradient(circle,#5A5288 11.5px,transparent 14px) 26px 1px/43px 28px repeat-x,radial-gradient(circle,#5A5288 8.5px,transparent 11px) 9px calc(100% - 2px)/27px 22px repeat-x,radial-gradient(circle,#5A5288 10.5px,transparent 13px) 0 100%/37px 26px repeat-x,radial-gradient(circle,#5A5288 6.5px,transparent 9px) 12px calc(100% - 5px)/19px 18px repeat-x,radial-gradient(circle,#5A5288 8.5px,transparent 11px) 0 3px/22px 21px repeat-y,radial-gradient(circle,#5A5288 6.5px,transparent 9px) 4px 12px/18px 17px repeat-y,radial-gradient(circle,#5A5288 8.5px,transparent 11px) 100% 6px/22px 23px repeat-y,radial-gradient(circle,#5A5288 6.5px,transparent 9px) calc(100% - 4px) 0/18px 15px repeat-y !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"]{padding-right:50px !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;right:14px !important;top:50% !important;width:30px !important;height:17px !important;margin-top:-9px !important;background:${svg(EYE())} center/contain no-repeat !important;border:none !important;transform:none !important;left:auto !important;bottom:auto !important;animation:ceBlink 5s ease-in-out infinite !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]{padding-right:20px !important;padding-left:50px !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::after{right:auto !important;left:14px !important;background:${svg(EYE(true))} center/contain no-repeat !important}
@keyframes ceBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}

/* 时间：一行淡紫小字 */
[data-wk="time"] > span{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;letter-spacing:.3em !important;font-size:11.5px !important}
/* 已送达＝闭着的眼；已读＝睁开的彩虹眼 */
[data-wk="meta"]{color:${C.fog} !important;font-size:11px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:8px !important}
[data-wk="meta"]::after{content:"" !important;width:20px !important;height:11px !important;flex:none !important;background:${svg(SHUT)} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(EYE(true))} center/contain no-repeat !important;filter:drop-shadow(0 0 4px rgba(255,200,240,.8)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cloud} !important;border:none !important;border-radius:26px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.ink} !important}
[data-wk="name"]{color:${C.fog} !important}

/* 动描：一缕飘着的薄云，字是粉白斜体，左边一只半睁的眼 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{position:relative !important;display:block !important;background:radial-gradient(ellipse at 50% 50%,rgba(255,220,240,.22),transparent 72%) !important;border:none !important;border-radius:40px !important;box-shadow:none !important;color:#FFE4F2 !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.08em !important;text-shadow:0 0 8px rgba(255,190,225,.5) !important;padding:8px 18px 8px 44px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:24px !important;height:13px !important;margin-top:-7px !important;background:${svg(EYE(true))} center/contain no-repeat !important;opacity:.85 !important}
[data-wk="myactink"]{padding:8px 44px 8px 18px !important;text-align:right !important}
[data-wk="myactink"]::before{left:auto !important;right:12px !important}
[data-wk="narrbar"]{background:rgba(43,31,85,.95) !important;border-top:1px solid rgba(255,200,230,.4) !important}
[data-wk="narrkind"]{border:1px solid rgba(216,204,236,.5) !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.cloud} !important;border-color:${C.cloud} !important;color:${C.ink} !important}
/* 系统提示：一行小字，两头各一颗星 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{display:inline-block !important;background:radial-gradient(circle,#fff 1.4px,transparent 2px) left center/8px 8px no-repeat,radial-gradient(circle,#fff 1.4px,transparent 2px) right center/8px 8px no-repeat !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.12em !important;padding:0 16px !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 底栏：不做框，往上透出底下那片粉云，上沿一道淡粉线；最右「让他回复」＝粉云里睁着的大眼 */
[data-wk="composer"]{position:relative !important;background:linear-gradient(180deg,rgba(196,106,176,0),rgba(150,80,160,.6)) !important;border-top:none !important;box-shadow:none !important;align-items:center !important;gap:10px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:10% !important;right:10% !important;top:0 !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,200,230,.8),transparent) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:rgba(255,255,255,.14) !important;border:1px solid rgba(255,220,240,.6) !important;border-radius:999px !important;color:#fff !important}
[data-wk="chatinput"]::placeholder{color:#F4DDF0 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:52px !important;min-width:52px !important;height:44px !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 10px rgba(255,200,235,.8)) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:rgba(43,31,85,.96) !important;border-top:1px solid rgba(255,200,230,.4) !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}

/* ───── 云眸入梦 · 第二批：卡片 ───── */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{${CARD}}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:#fff !important;border-color:rgba(255,220,240,.4) !important}

/* 转账＝一颗落进云里的星：收下了被一只眼睛接住，退回了星星熄灭 */
[data-wk="transfercard"]{position:relative !important;${CARD};padding-left:78px !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:56px !important;height:42px !important;margin-top:-24px !important;background:${svg(STAR("fall"))} center/contain no-repeat !important;filter:drop-shadow(0 0 6px rgba(255,240,170,.8)) !important}
[data-wk="transfercard"] *{color:#fff !important;border-color:rgba(255,220,240,.4) !important}
[data-wk="transferlabel"]{color:${C.pink} !important;letter-spacing:.2em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#FFF3B0 !important;text-shadow:0 0 8px rgba(255,240,170,.6) !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:linear-gradient(90deg,transparent,rgba(255,220,240,.7),transparent) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(43,31,85,.5) !important}
[data-wk="transferbtn"]{border-radius:999px !important;letter-spacing:.15em !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.cloud} !important;color:${C.ink} !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:#fff !important;border:1px solid rgba(255,220,240,.7) !important}
[data-wk="transferseal"]{background:transparent !important;border:1px solid ${C.pink} !important;color:${C.pink} !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"]::before{background:${svg(STAR("caught"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"]::before{background:${svg(STAR("back"))} center/contain no-repeat !important;filter:none !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.6 !important}

/* 红包＝一朵睡着的粉云（闭眼打呼）；领完了云睁开眼 */
[data-wk="rpcard"]{position:relative !important;width:220px !important;min-height:80px !important;padding:16px 16px 16px 84px !important;${CARD}}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:64px !important;height:46px !important;margin-top:-24px !important;background:${svg(NAPCLOUD(false))} center/contain no-repeat !important;animation:ceFloat 4s ease-in-out infinite !important}
[data-wk="rpcard"]::after{content:"别吵醒它" !important;position:absolute !important;right:14px !important;bottom:7px !important;font-size:10.5px !important;letter-spacing:.15em !important;color:${C.pink} !important}
[data-wk="rpcard"] *{color:#fff !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(NAPCLOUD(true))} center/contain no-repeat !important;animation:none !important}
[data-wk="rpcard"][data-status="done"]::after{content:"它醒了" !important}
@keyframes ceFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
/* 拆红包：关着＝一整朵睡着的大云（四周云团、中间一道闭眼），「开」＝一只彩虹眼；拆开＝云散开，里面一片星空，钱是星光写的 */
[data-wk="rpenvelope"]{position:relative !important;overflow:visible !important}
[data-wk="rpenvelope"][data-stage="closed"]{background:radial-gradient(ellipse at 50% 35%,#FFFAFD,${C.cloud} 60%,${C.cloudD}) !important;border:none !important;border-radius:40px !important;isolation:isolate !important;box-shadow:0 0 40px 10px rgba(255,190,230,.45) !important}
[data-wk="rpenvelope"][data-stage="closed"]::before{content:"" !important;position:absolute !important;left:-10px !important;right:-10px !important;top:-11px !important;bottom:-10px !important;z-index:-1 !important;border-radius:60px !important;background:radial-gradient(circle,${C.cloud} 11.5px,transparent 14px) 4px 0/33px 28px repeat-x,radial-gradient(circle,${C.cloud} 8.5px,transparent 11px) 15px 5px/25px 22px repeat-x,radial-gradient(circle,${C.cloud} 13.5px,transparent 16px) 26px 1px/47px 32px repeat-x,radial-gradient(circle,${C.cloud} 9.5px,transparent 12px) 9px calc(100% - 2px)/29px 24px repeat-x,radial-gradient(circle,${C.cloud} 11.5px,transparent 14px) 0 100%/39px 28px repeat-x,radial-gradient(circle,${C.cloud} 9.5px,transparent 12px) 0 5px/24px 25px repeat-y,radial-gradient(circle,${C.cloud} 7.5px,transparent 10px) 5px 14px/20px 19px repeat-y,radial-gradient(circle,${C.cloud} 9.5px,transparent 12px) 100% 8px/24px 27px repeat-y,radial-gradient(circle,${C.cloud} 7.5px,transparent 10px) calc(100% - 5px) 0/20px 17px repeat-y !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rparc"]{display:none !important}
[data-wk="rpenvelope"][data-stage="closed"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:${svg(OPENEYE)} center/contain no-repeat !important;border:none !important;border-radius:50% !important;box-shadow:0 0 20px 6px rgba(255,200,240,.7) !important;animation:ceGlow 2.4s ease-in-out infinite !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
@keyframes ceGlow{0%,100%{box-shadow:0 0 14px 4px rgba(255,200,240,.55)}50%{box-shadow:0 0 26px 10px rgba(255,200,240,.9)}}
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(STARS)} 0 0/220px 260px,radial-gradient(ellipse at 50% 115%,#FFB8DE 0 20%,transparent 60%),linear-gradient(180deg,${C.s1},${C.s2} 60%,${C.s3}) !important;border:none !important;border-radius:28px !important;box-shadow:inset 0 0 0 1px rgba(255,220,240,.5),0 0 40px rgba(255,180,230,.4) !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"]{display:none !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:#fff !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.cloud},0 0 14px 4px rgba(255,200,240,.7) !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rpamount"] + *::after{content:" · 梦醒了" !important}
[data-wk="rpamount"]{color:#FFF3B0 !important;background:none !important;text-shadow:0 0 12px rgba(255,240,170,.8) !important}
[data-wk="rpclose"]{background:rgba(255,255,255,.15) !important;border:1px solid rgba(255,220,240,.7) !important;color:#fff !important}

/* 照片：透过一只巨眼看出去——相片四角圆，外圈一道彩虹光，上下两片眼皮弧 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:#1A1030 !important;border:none !important;border-radius:50% / 34% !important;padding:16px 12px !important;box-shadow:0 0 0 2px #fff,0 0 0 5px rgba(255,138,216,.6),0 0 0 8px rgba(106,240,192,.35),0 0 24px 8px rgba(255,190,230,.4) !important}
[data-wk="photoface"]{background:linear-gradient(180deg,${C.s2},${C.s3}) !important;border:none !important;border-radius:40% / 30% !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:#fff !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.fog} !important}

/* 语音：小云卡，前面一只眨着的眼当播放，波纹是粉色 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:#fff !important}
[data-wk="voice"][data-me]{padding:0 14px 0 44px !important;position:relative !important;border-radius:999px !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:24px !important;height:14px !important;margin-top:-7px !important;background:${svg(EYE(true))} center/contain no-repeat !important;animation:ceBlink 4s ease-in-out infinite !important}
[data-wk="voice"][data-me="0"]{background:${C.cloud} !important;box-shadow:0 0 14px rgba(255,190,225,.45) !important}
[data-wk="voice"][data-me="0"] > *{color:${C.ink} !important}
[data-wk="voice"][data-me="0"]::before{background:${svg(EYE())} center/contain no-repeat !important}
[data-wk="voice"][data-me="0"] [data-wk="voicewave"] span{background:${C.ink} !important}
[data-wk="voice"][data-me="1"]{background:#5A5288 !important}
[data-wk="voicewave"] span{background:${C.pink} !important}

[data-wk="wxcardsky"]{background:linear-gradient(180deg,${C.s2},${C.s3}) !important}
[data-wk="wxcardsky"] *{color:#fff !important}
[data-wk="wxcardsky"] svg{stroke:#fff !important}
[data-wk="wxcardsay"]{background:rgba(43,31,85,.6) !important;color:${C.pink} !important;border-top:1px solid rgba(255,220,240,.35) !important}
/* 定位：一颗云做的大头针，针头一只眼 */
[data-wk="geopin"]{background:${svg(PIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:22px !important;height:30px !important;border-radius:0 !important;filter:drop-shadow(0 0 6px rgba(255,200,240,.8)) !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.pink} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px #fff,0 0 10px 3px rgba(255,200,240,.7) !important}

/* 拍一拍、通话结束：一行粉字，前面一只眨眼 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${svg(EYE(true))} left center/18px 10px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 0 2px 24px !important;color:${C.pink} !important;letter-spacing:.12em !important;box-shadow:none !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.pink} !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;max-width:86% !important;${CARD};padding:9px 14px !important}
[data-wk="noteink"]{color:${C.fog} !important}

/* 线下小结：一页「梦的记录」，标题前一只眼，底下一行「醒来后记下的」 */
[data-part="offlog"]{position:relative !important;padding-top:24px !important;padding-bottom:30px !important}
[data-part="offlog"]::after{content:"— 醒来后记下的" !important;position:absolute !important;right:16px !important;bottom:10px !important;font-size:11px !important;letter-spacing:.15em !important;color:${C.pink} !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 8px !important;padding:0 0 0 30px !important;background:${svg(EYE(true))} left center/22px 12px no-repeat !important;color:#fff !important;letter-spacing:.2em !important}
[data-wk="offlogtitle"] *{color:#fff !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.pink} !important}
[data-wk="offlogtranscript"]{border-top:1px solid rgba(255,220,240,.35) !important;color:${C.fog} !important}

/* 加号面板：一格格小云 */
[data-wk="chattoolicon"]{background:radial-gradient(ellipse at 50% 35%,#FFFAFD,${C.cloud} 70%,${C.cloudD}) !important;border:none !important;border-radius:44% 44% 38% 38% !important;box-shadow:0 0 12px rgba(255,190,225,.5) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}

/* 引用 */
[data-wk="quotedraft"]{background:rgba(43,31,85,.9) !important;border:none !important;border-top:1px solid rgba(255,220,240,.4) !important}
[data-wk="quotedraft"] *{color:${C.fog} !important;border-color:${C.pink} !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:#fff !important}
[data-wk="quote"]{background:rgba(255,255,255,.08) !important;color:${C.fog} !important;border:none !important;border-left:2px solid ${C.pink} !important;border-radius:0 8px 8px 0 !important;padding:3px 10px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}

/* 打电话那一屏：同一片紫夜和粉云海；他的头像是那只巨眼；挂断＝一颗粉云 */
[data-wk="call"][data-video="0"]{background:${svg(STARS)} 0 0/220px 260px,radial-gradient(ellipse at 50% 108%,#FFB8DE 0 18%,rgba(246,185,220,.55) 30%,transparent 55%),linear-gradient(180deg,${C.s1} 0%,${C.s2} 45%,${C.s3}) !important}
[data-wk="call"][data-video="0"] [data-wk="calltitle"]{color:#fff !important;letter-spacing:.25em !important}
[data-wk="call"][data-video="0"] [data-wk="callhead"] > div:not([data-wk]){color:${C.fog} !important}
[data-wk="call"][data-video="0"] > button:first-child{background:rgba(255,255,255,.12) !important;box-shadow:0 0 0 1px rgba(255,220,240,.6) !important}
[data-wk="call"][data-video="0"] > button:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button > span:first-child{background:rgba(255,255,255,.12) !important;border-radius:50% !important;box-shadow:0 0 0 1px rgba(255,220,240,.6) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:#fff !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:radial-gradient(ellipse at 50% 35%,#FFFAFD,${C.cloud} 70%,${C.cloudD}) !important;box-shadow:0 0 18px 4px rgba(255,190,230,.6) !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:${C.ink} !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:${C.fog} !important}
[data-wk="callbubble"]{background:${C.cloud} !important;color:${C.ink} !important;border:none !important;border-radius:14px !important;box-shadow:0 0 14px rgba(255,190,225,.45) !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:#5A5288 !important;color:#fff !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callbubble"][data-kind="typing"] [data-wk="typingdot"]{background:${C.ink} !important}
[data-wk="callact"]{color:${C.pink} !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 4px #fff,0 0 0 9px rgba(255,138,216,.55),0 0 0 14px rgba(106,240,192,.3),0 0 40px 14px rgba(255,190,230,.5) !important;animation:ceGlow 3s ease-in-out infinite !important}

/* ───── 云眸入梦 · 第三批：状态卡＝一片紫夜，顶上压着一排粉云；好感是一只眼，越喜欢睁得越大 ───── */
[data-wk="statecard"]{position:relative !important;overflow:visible !important;background:${svg(STARS)} 0 0/220px 260px,radial-gradient(ellipse at 50% 112%,rgba(255,184,222,.55) 0 18%,transparent 55%),linear-gradient(180deg,${C.s1},${C.s2} 60%,${C.s3}) !important;border:none !important;border-radius:22px !important;box-shadow:inset 0 0 0 1px rgba(255,220,240,.45),0 20px 50px rgba(20,10,50,.5),0 0 40px rgba(255,180,230,.25) !important;margin-top:18px !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;left:14px !important;right:14px !important;top:-16px !important;height:26px !important;background:${svg(CLOUDTOP)} 0 0/120px 26px repeat-x !important;pointer-events:none !important;-webkit-mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent) !important;mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent) !important}
[data-wk="statecard"] *{font-family:${SERIF} !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:none !important;box-shadow:0 1px 0 rgba(255,220,240,.3) !important}
[data-wk="statehead"] *{color:#fff !important}
[data-wk="statehead"] button{border:1px solid rgba(255,220,240,.6) !important;background:rgba(255,255,255,.1) !important;border-radius:50% !important}
[data-wk="statemood"]{display:inline-block !important;background:${C.cloud} !important;color:${C.ink} !important;border:none !important;border-radius:999px !important;padding:1px 10px !important;margin-right:6px !important;box-shadow:0 0 10px rgba(255,190,230,.6) !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:rgba(255,255,255,.08) !important;border:none !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:999px !important;letter-spacing:.15em !important;background:transparent !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.cloud} !important;color:${C.ink} !important}
/* 看得见的＝一朵小粉云；心里想的＝一缕云雾里的字，左边一只半睁的眼 */
[data-wk="stateseen"]{background:radial-gradient(ellipse at 50% 30%,#FFFAFD,${C.cloud} 70%,${C.cloudD}) !important;border:none !important;border-radius:18px !important;margin:12px 16px !important;color:${C.ink} !important;box-shadow:0 0 16px rgba(255,190,225,.4) !important}
[data-wk="stateseen"] *{color:${C.ink} !important}
[data-wk="statevoice"]{position:relative !important;background:radial-gradient(ellipse at 50% 50%,rgba(255,220,240,.18),transparent 75%) !important;border:none !important;border-radius:0 !important;margin:14px 16px !important;padding-left:44px !important;color:#fff !important;box-shadow:none !important;font-style:italic !important}
[data-wk="statevoice"]::before{content:"" !important;position:absolute !important;left:10px !important;top:12px !important;width:26px !important;height:15px !important;background:${svg(EYE(true))} center/contain no-repeat !important;animation:ceBlink 5s ease-in-out infinite !important}
[data-wk="statevoice"] *{color:#fff !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:rgba(255,255,255,.08) !important;border:1px solid rgba(255,220,240,.35) !important;border-radius:14px !important}
[data-wk="statewear"] *{color:#fff !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.pink} !important}
[data-wk="statevoice"] + div > button{background:rgba(255,255,255,.1) !important;color:#fff !important;border:1px solid rgba(255,220,240,.6) !important;border-radius:999px !important}
/* 好感：左边一只眼——低分只是一道闭着的睫毛，越喜欢那只彩虹眼睁得越大；右边是数字 */
[data-wk="stateaff"]{background:transparent !important;border-top:none !important;box-shadow:0 -1px 0 rgba(255,220,240,.3) !important;display:flex !important;align-items:center !important;gap:16px !important;padding:14px 20px 18px !important}
[data-wk="stateaff"] *{color:#fff !important}
[data-wk="stateheart"]{position:relative !important;width:80px !important;height:50px !important;flex:none !important;background:${svg(AFFBASE)} center/contain no-repeat !important;order:-1 !important}
[data-wk="stateheart"] > div{display:none !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;inset:0 !important;left:0 !important;bottom:0 !important;width:auto !important;height:auto !important;margin:0 !important;border:none !important;border-radius:0 !important;box-shadow:none !important;background:${svg(AFFEYE)} center/contain no-repeat !important;transform-origin:50% 50% !important;transform:scaleY(calc(.06 + var(--sc-heart-lvl) * .94)) !important;opacity:calc(.3 + var(--sc-heart-lvl) * .7) !important;filter:drop-shadow(0 0 calc(var(--sc-heart-lvl) * 10px) rgba(255,200,240,.9)) !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateaffval"]{display:inline-block !important;margin:0 !important;padding:0 !important;background:transparent !important;border:none !important;color:#FFF3B0 !important;font-size:22px !important;text-shadow:0 0 10px rgba(255,240,170,.6) !important}
/* 翻旧的：一页页小夜空，右下角一只闭着的眼（睡着了的那一天） */
[data-wk="statehistbtn"]{background:rgba(255,255,255,.1) !important;color:#fff !important;border:1px solid rgba(255,220,240,.6) !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.fog} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1px solid rgba(255,220,240,.6) !important;border-radius:999px !important;color:#fff !important;background:transparent !important}
[data-wk="statehistitem"]{position:relative !important;background:linear-gradient(180deg,rgba(255,232,244,.12),rgba(120,90,180,.2)) !important;border:none !important;border-radius:16px !important;padding:16px 18px 28px !important;margin:0 0 14px !important;box-shadow:inset 0 0 0 1px rgba(255,220,240,.4) !important}
[data-wk="statehistitem"]::after{content:"" !important;position:absolute !important;right:14px !important;bottom:8px !important;width:26px !important;height:14px !important;background:${svg(SHUT)} center/contain no-repeat !important}
[data-wk="statehistitem"] *{color:#fff !important}
[data-wk="statehistmood"]{background:${C.cloud} !important;border:none !important;color:${C.ink} !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:${C.fog} !important}
[data-wk="statehistmeta"]{background:rgba(255,255,255,.08) !important;border-radius:10px !important}
[data-wk="statehistend"]{color:${C.fog} !important}
/* Ta 眼里：同一片紫夜，每张卡是一朵飘着的云 */
[data-wk="gazepage"]{background:${svg(STARS)} 0 0/220px 260px,linear-gradient(180deg,${C.s1},${C.s2} 60%,${C.s3}) !important}
[data-wk="gazetitle"]{color:#fff !important;letter-spacing:.2em !important}
[data-wk="gazetab"]{background:transparent !important;color:${C.fog} !important;border:none !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.cloud} !important;color:${C.ink} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{background:radial-gradient(ellipse at 50% 30%,#FFFAFD,${C.cloud} 70%,${C.cloudD}) !important;border:none !important;border-radius:20px !important;box-shadow:0 0 18px rgba(255,190,225,.45) !important}
[data-wk="gazetape"]{background:${svg(EYE())} center/contain no-repeat !important;box-shadow:none !important;border:none !important;transform:none !important;width:26px !important;height:15px !important;animation:ceBlink 5s ease-in-out infinite !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.ink} !important;opacity:.75 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{${CARD}}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:#fff !important}
[data-wk="gazeempty"]{background:transparent !important;border:1px dashed rgba(255,220,240,.5) !important;border-radius:18px !important;color:#fff !important}
[data-wk="gazeempty"] *{color:#fff !important}
[data-wk="gazeempty"] button,[data-wk="gazeempty"] button *{color:${C.ink} !important}
[data-wk="gazeempty"] button{background:${C.cloud} !important;color:${C.ink} !important;border:none !important;border-radius:999px !important}
`;

const pack = { kind: "chat-look", v: 1, name: "云眸入梦", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "云眸入梦-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
