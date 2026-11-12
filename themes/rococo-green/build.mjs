// 翡翠沙龙：法式复古。墨绿暗纹底、奶油顶栏底栏、橘红细边；所有框都顶一枚金色洛可可卷叶饰、角上卷一道金涡卷。
// 我的话＝橘红圆角牌，他的话＝奶油圆角牌；头像＝金珠圈镜框，上贝壳下涡卷。用法：node themes/rococo-green/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { green: "#1F4A40", green2: "#183C34", greenL: "#2E6355", cream: "#F4EAD2", cream2: "#EADBB8", orange: "#D5603A", orangeD: "#A8442A", gold: "#D8B26A", goldD: "#9C7A3C", ink: "#3B2E22", dim: "#C9BFA6" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

// 底纹：一排排叶形暗纹
const DAMASK = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='64'><g fill='none' stroke='#2C5C50' stroke-width='1.2' opacity='.9'><path d='M24 4 Q34 18 24 32 Q14 18 24 4Z'/><path d='M24 32 Q34 46 24 60 Q14 46 24 32Z'/><path d='M0 18 Q8 32 0 46 M48 18 Q40 32 48 46'/></g></svg>`;
// 洛可可饰（rocaille）：正中一簇五瓣卷叶，底下一道托座，两侧各一只朝外卷的 C 形涡卷
const SHELL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'><g fill='${C.gold}' stroke='${C.goldD}' stroke-width='.9' stroke-linejoin='round'><path transform='rotate(-64 30 23)' d='M30 23 C26 18 25.5 9 30 6 C34.5 9 34 18 30 23Z'/><path transform='rotate(64 30 23)' d='M30 23 C26 18 25.5 9 30 6 C34.5 9 34 18 30 23Z'/><path transform='rotate(-32 30 23)' d='M30 23 C26 18 25.5 9 30 6 C34.5 9 34 18 30 23Z'/><path transform='rotate(32 30 23)' d='M30 23 C26 18 25.5 9 30 6 C34.5 9 34 18 30 23Z'/><path transform='rotate(0 30 23)' d='M30 23 C26 18 25.5 9 30 6 C34.5 9 34 18 30 23Z'/></g><g fill='none' stroke='${C.cream}' stroke-width='.8' opacity='.85'><path transform='rotate(-64 30 23)' d='M30 20 V10'/><path transform='rotate(-32 30 23)' d='M30 20 V10'/><path transform='rotate(0 30 23)' d='M30 20 V10'/><path transform='rotate(32 30 23)' d='M30 20 V10'/><path transform='rotate(64 30 23)' d='M30 20 V10'/></g><path d='M20 26 Q30 22 40 26' fill='none' stroke='${C.gold}' stroke-width='2.2' stroke-linecap='round'/><circle cx='30' cy='25' r='2' fill='${C.goldD}'/><g fill='none' stroke='${C.gold}' stroke-width='1.8' stroke-linecap='round'><path d='M20 26 Q12 27 9 21 Q7 15 12 14 Q16 14 15.5 18 Q15 20 12.5 19.5'/><path d='M40 26 Q48 27 51 21 Q53 15 48 14 Q44 14 44.5 18 Q45 20 47.5 19.5'/></g><g fill='${C.gold}'><circle cx='4' cy='24' r='1.4'/><circle cx='56' cy='24' r='1.4'/></g><path d='M9 21 Q5 22 4 24 M51 21 Q55 22 56 24' fill='none' stroke='${C.gold}' stroke-width='1.2'/></svg>`;
// 涡卷（右上朝外卷）
const CURL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M2 20 Q10 20 14 14 Q18 8 14 5 Q10 3 9 7 Q9 10 12 10' fill='none' stroke='${C.gold}' stroke-width='1.6' stroke-linecap='round'/><path d='M18 3 L21 1' stroke='${C.gold}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const CURLB = CURL.replace("viewBox='0 0 24 24'>", "viewBox='0 0 24 24'><g transform='rotate(180 12 12)'>").replace("</svg>", "</g></svg>");
// 头像镜框：金珠圈＋顶贝壳＋底涡卷
const MIRROR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'><circle cx='50' cy='60' r='40' fill='none' stroke='${C.gold}' stroke-width='5'/><circle cx='50' cy='60' r='40' fill='none' stroke='${C.cream}' stroke-width='2' stroke-dasharray='.1 6' stroke-linecap='round'/><circle cx='50' cy='60' r='35.5' fill='none' stroke='${C.goldD}' stroke-width='1'/>${SHELL.replace("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'>","<g transform='translate(20 -2) scale(1)'>").replace('</svg>','</g>')}<path d='M38 104 Q36 112 42 114 Q46 115 46 110 M62 104 Q64 112 58 114 Q54 115 54 110' fill='none' stroke='${C.gold}' stroke-width='2.4' stroke-linecap='round'/><path d='M8 62 Q2 66 6 72 Q10 74 12 70 M92 62 Q98 66 94 72 Q90 74 88 70' fill='none' stroke='${C.gold}' stroke-width='2' stroke-linecap='round'/></svg>`;
// 涡卷花边带
const SCROLLBAND = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><path d='M0 14 Q10 14 14 9 Q17 4 13 3 Q9 3 10 7 Q11 10 16 10 Q24 10 30 14 Q35 17 40 14' fill='none' stroke='${C.gold}' stroke-width='1.5' stroke-linecap='round'/></svg>`;
// 时间：椭圆徽框
const OVAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 60' preserveAspectRatio='none'><ellipse cx='110' cy='34' rx='100' ry='20' fill='${C.cream}' stroke='${C.gold}' stroke-width='2.4' vector-effect='non-scaling-stroke'/><ellipse cx='110' cy='34' rx='94' ry='16' fill='none' stroke='${C.goldD}' stroke-width='1' vector-effect='non-scaling-stroke'/></svg>`;
const SPIRAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8.5' fill='none' stroke='${C.orange}' stroke-width='1.6'/><path d='M10 10 Q13 9 12 6.5 Q10 4.5 7.5 6.5 Q5.5 9.5 8 12.5 Q11.5 14.5 14 11.5' fill='none' stroke='${C.orange}' stroke-width='1.4' stroke-linecap='round'/></svg>`;
const DOT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8' fill='${C.orange}'/></svg>`;
const RB = (fill, inner) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='${fill}' stroke='${C.ink}' stroke-width='1.6'/>${inner}</svg>`;
const I_PLUS = RB(C.greenL, `<path d='M20 12 V28 M12 20 H28' stroke='${C.cream}' stroke-width='2.2' stroke-linecap='round'/>`);
const I_HOUSE = RB(C.greenL, `<path d='M12 20 L20 13 L28 20 V27 H12Z' fill='${C.cream}' stroke='${C.ink}' stroke-width='1.6' stroke-linejoin='round'/>`);
const I_MORE = RB(C.orange, `<g fill='${C.cream}' stroke='${C.ink}' stroke-width='1'><circle cx='13' cy='20' r='2.6'/><circle cx='20' cy='20' r='2.6'/><circle cx='27' cy='20' r='2.6'/></g>`);
const I_REPLY = RB(C.greenL, `<path d='M11 14 H29 V24 H19 L14 28 V24 H11Z' fill='${C.cream}' stroke='${C.ink}' stroke-width='1.4' stroke-linejoin='round'/>`);
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 74'><circle cx='35' cy='40' r='27' fill='none' stroke='${C.gold}' stroke-width='5'/><circle cx='35' cy='40' r='27' fill='none' stroke='${C.cream}' stroke-width='2' stroke-dasharray='.1 5.5' stroke-linecap='round'/><circle cx='35' cy='40' r='22' fill='${C.orange}' stroke='${C.goldD}' stroke-width='1'/><path d='M35 52 V29 M26 37 L35 28 L44 37' fill='none' stroke='${C.cream}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>${SHELL.replace("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'>","<g transform='translate(11 -3) scale(.8)'>").replace('</svg>','</g>')}<path d='M6 50 Q0 56 5 62 Q9 64 10 60 M64 50 Q70 56 65 62 Q61 64 60 60' fill='none' stroke='${C.gold}' stroke-width='2' stroke-linecap='round'/></svg>`;

// ── 第二批用的图 ──
const WAX = (c, t) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><path d='M30 4 Q38 2 42 8 Q50 8 52 16 Q58 22 54 30 Q58 38 52 44 Q50 52 42 52 Q38 58 30 56 Q22 58 18 52 Q10 52 8 44 Q2 38 6 30 Q2 22 8 16 Q10 8 18 8 Q22 2 30 4Z' fill='${c}'/><circle cx='30' cy='30' r='17' fill='none' stroke='rgba(255,255,255,.35)' stroke-width='1.6'/><text x='30' y='36.5' text-anchor='middle' font-size='17' font-style='italic' font-weight='700' fill='rgba(255,255,255,.75)' font-family='Georgia,serif'>${t}</text></svg>`;
const ENV = open => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 60'><rect x='3' y='10' width='74' height='46' rx='3' fill='${C.orange}' stroke='${C.gold}' stroke-width='1.6'/>${open ? `<path d='M3 10 L40 -8 L77 10' fill='${C.orangeD}' stroke='${C.gold}' stroke-width='1.4'/><rect x='14' y='2' width='52' height='20' fill='${C.cream}' stroke='${C.gold}' stroke-width='1'/>` : `<path d='M3 10 L40 36 L77 10' fill='${C.orangeD}' stroke='${C.gold}' stroke-width='1.4'/><circle cx='40' cy='34' r='7' fill='#8E2B1C' stroke='${C.gold}' stroke-width='1'/>`}<path d='M3 56 L30 34 M77 56 L50 34' stroke='${C.gold}' stroke-width='1' opacity='.7'/></svg>`;
const HORN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M4 22 H12 L26 6 Q28 16 26 26 L12 24Z' fill='${C.gold}' stroke='${C.goldD}' stroke-width='1.2' stroke-linejoin='round'/><circle cx='8' cy='24' r='3' fill='${C.green}' stroke='${C.gold}' stroke-width='1'/></svg>`;
const OVALF = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120' preserveAspectRatio='none'><ellipse cx='50' cy='62' rx='46' ry='55' fill='none' stroke='${C.gold}' stroke-width='5' vector-effect='non-scaling-stroke'/><ellipse cx='50' cy='62' rx='46' ry='55' fill='none' stroke='${C.cream}' stroke-width='2' stroke-dasharray='.1 6' stroke-linecap='round' vector-effect='non-scaling-stroke'/></svg>`;

// ── 第三批用的图 ──
const PERFUME = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 76'><rect x='22' y='0' width='12' height='8' rx='2'/><rect x='24' y='8' width='8' height='6'/><path d='M14 14 H42 Q52 14 52 28 V60 Q52 74 38 74 H18 Q4 74 4 60 V28 Q4 14 14 14Z'/></svg>`;

// ── 第四批用的图 ──
// 沙龙墙上一面大椭圆金镜，镜里映着一座三头烛台
const MIRRORBIG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 340'><defs><radialGradient id='m' cx='50%' cy='45%' r='60%'><stop offset='0' stop-color='#3E7466'/><stop offset='1' stop-color='#13302A'/></radialGradient><radialGradient id='f'><stop offset='0' stop-color='#FFE9B0' stop-opacity='.55'/><stop offset='.5' stop-color='#F2B44A' stop-opacity='.15'/><stop offset='1' stop-color='#F2B44A' stop-opacity='0'/></radialGradient></defs><ellipse cx='150' cy='190' rx='118' ry='138' fill='url(#m)'/><g opacity='.8'><rect x='117' y='212' width='6' height='26' rx='1.5' fill='#F4EAD2' opacity='.85'/><circle cx='120' cy='206' r='11' fill='url(#f)'/><path d='M120 200 Q124 207 120 211 Q116 207 120 200Z' fill='#FFE9B0'/><rect x='147' y='198' width='6' height='26' rx='1.5' fill='#F4EAD2' opacity='.85'/><circle cx='150' cy='192' r='11' fill='url(#f)'/><path d='M150 186 Q154 193 150 197 Q146 193 150 186Z' fill='#FFE9B0'/><rect x='177' y='212' width='6' height='26' rx='1.5' fill='#F4EAD2' opacity='.85'/><circle cx='180' cy='206' r='11' fill='url(#f)'/><path d='M180 200 Q184 207 180 211 Q176 207 180 200Z' fill='#FFE9B0'/><path d='M110 238 Q150 252 190 238 M150 224 V266 M134 266 H166' fill='none' stroke='${C.gold}' stroke-width='3' stroke-linecap='round'/><path d='M117 238 Q112 228 117 224 M183 238 Q188 228 183 224' fill='none' stroke='${C.gold}' stroke-width='2.4' stroke-linecap='round'/></g><path d='M60 120 Q90 90 120 110' fill='none' stroke='#fff' stroke-width='3' opacity='.18' stroke-linecap='round'/><ellipse cx='150' cy='190' rx='118' ry='138' fill='none' stroke='${C.gold}' stroke-width='12'/><ellipse cx='150' cy='190' rx='118' ry='138' fill='none' stroke='${C.cream}' stroke-width='4' stroke-dasharray='.1 11' stroke-linecap='round'/><ellipse cx='150' cy='190' rx='108' ry='128' fill='none' stroke='${C.goldD}' stroke-width='2'/>${SHELL.replace("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'>", "<g transform='translate(90 20) scale(2)'>").replace("</svg>", "</g>")}<path d='M100 326 Q90 340 106 338 M200 326 Q210 340 194 338' fill='none' stroke='${C.gold}' stroke-width='4' stroke-linecap='round'/><path d='M28 190 Q14 200 22 214 Q30 218 32 210 M272 190 Q286 200 278 214 Q270 218 268 210' fill='none' stroke='${C.gold}' stroke-width='4' stroke-linecap='round'/></svg>`;

// 好感：一座洛可可座钟的钟面（指针由 --sc-heart-lvl 转）
const CLOCK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='44' fill='${C.cream}' stroke='${C.gold}' stroke-width='5'/><circle cx='50' cy='50' r='44' fill='none' stroke='#FFF6E0' stroke-width='1.6' stroke-dasharray='.1 5.6' stroke-linecap='round'/><circle cx='50' cy='50' r='37' fill='none' stroke='${C.goldD}' stroke-width='1'/>${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180,r1=i%3?32:29,r2=36;return `<path d='M${(50+r1*Math.sin(a)).toFixed(1)} ${(50-r1*Math.cos(a)).toFixed(1)} L${(50+r2*Math.sin(a)).toFixed(1)} ${(50-r2*Math.cos(a)).toFixed(1)}' stroke='${C.ink}' stroke-width='${i%3?1:2}'/>`}).join("")}<path d='M50 50 m-12 0 a12 12 0 0 1 24 0' fill='none' stroke='${C.orange}' stroke-width='1' opacity='.5'/><circle cx='50' cy='50' r='3.5' fill='${C.gold}' stroke='${C.goldD}' stroke-width='1'/></svg>`;
const HAND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 40'><path d='M5 0 L8 10 Q5 13 6.5 20 L5.8 38 H4.2 L3.5 20 Q5 13 2 10Z' fill='${C.orangeD}' stroke='${C.goldD}' stroke-width='.6'/><circle cx='5' cy='10' r='2' fill='${C.gold}'/></svg>`;

const bubble = { myBg: C.orange, myText: C.cream, myBorder: "none", charBg: C.cream, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 翡翠沙龙 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DAMASK)} 0 0/48px 64px,radial-gradient(ellipse at 50% 30%,#245447,${C.green2} 80%) !important}
[data-wk="body"]{background:transparent !important}
[data-wk="chat"] *{font-family:${SERIF} !important}

/* 顶栏：奶油底，下沿一道橘红边，再垂一条金涡卷花边带、正中一枚洛可可饰 */
[data-wk="chathead"]{background:${C.cream} !important;border-bottom:none !important;box-shadow:0 5px 0 ${C.orange},0 7px 0 ${C.orangeD} !important;position:relative !important;overflow:visible !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% + 8px) !important;height:20px !important;background:${svg(SHELL)} center top/56px 28px no-repeat,${svg(SCROLLBAND)} 0 0/40px 20px repeat-x !important;pointer-events:none !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:28px !important}
[data-wk="body"]{padding-top:14px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.12em !important;white-space:nowrap !important}
[data-wk="headname"] > [data-wk="headink"] > span{flex:none !important}
[data-wk="headname"] > [data-wk="headink"]::after{content:"mon ange" !important;flex:0 1 auto !important;min-width:0 !important;overflow:hidden !important;margin-left:8px !important;font:italic 400 13px/1 Georgia,"Times New Roman",serif !important;letter-spacing:.02em !important;color:${C.orange} !important}
[data-wk="headdim"]{color:#8C7F66 !important;white-space:nowrap !important;letter-spacing:.12em !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.ink} !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆的，套一面金珠圈镜框，顶上洛可可饰、底下一对涡卷 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important;box-shadow:none !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-25% !important;right:-25% !important;top:-38% !important;bottom:-38% !important;background:${svg(MIRROR)} center/contain no-repeat !important;pointer-events:none !important;border:none !important;border-radius:0 !important;z-index:2 !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> img[data-wk="avatar"])::before{content:"" !important;position:absolute !important;left:-4px !important;top:50% !important;width:44px !important;height:44px !important;margin-top:-22px !important;border-radius:50% !important;box-shadow:0 0 0 3px ${C.gold},0 0 0 4.5px ${C.goldD} !important;background:radial-gradient(circle,transparent 60%,transparent 61%) !important;pointer-events:none !important;z-index:2 !important}
[data-wk="chathead"] img[data-wk="avatar"]{border-radius:50% !important}

/* 气泡：圆角牌，金细边；顶上正中一枚洛可可饰，右上、左下各卷一道金涡卷 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:14px !important;letter-spacing:.06em !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-13px !important;width:40px !important;height:20px !important;margin-left:-20px !important;background:${svg(SHELL)} center/contain no-repeat !important;pointer-events:none !important;border:none !important;transform:none !important;right:auto !important;bottom:auto !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;inset:-12px !important;background:${svg(CURL)} right top/18px 18px no-repeat,${svg(CURLB)} left bottom/18px 18px no-repeat !important;pointer-events:none !important;border:none !important;transform:none !important;width:auto !important;height:auto !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,#DC6A44,${C.orange}) !important;color:${C.cream} !important;border:none !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD},0 4px 0 3px rgba(0,0,0,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.cream} !important;color:${C.ink} !important;border:none !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD},0 4px 0 3px rgba(0,0,0,.18) !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"]::before{content:none !important}

/* 时间：一枚椭圆徽框，顶上洛可可饰、两侧涡卷 */
[data-wk="time"]{display:flex !important;justify-content:center !important;margin-top:10px !important}
[data-wk="time"] > span{position:relative !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;min-width:150px !important;height:34px !important;padding:6px 34px 0 !important;background:${svg(OVAL)} center/100% 100% no-repeat !important;border:none !important;box-shadow:none !important;color:${C.ink} !important;letter-spacing:.15em !important;font-size:12.5px !important}
[data-wk="time"] > span::before{content:"" !important;position:absolute !important;left:50% !important;top:-14px !important;width:40px !important;height:20px !important;margin-left:-20px !important;background:${svg(SHELL)} center/contain no-repeat !important}
[data-wk="time"] > span::after{content:"" !important;position:absolute !important;left:-14px !important;right:-14px !important;top:6px !important;height:26px !important;background:${svg(CURLB)} left center/20px 20px no-repeat,${svg(CURL)} right center/20px 20px no-repeat !important}
/* 已送达＝后面一颗橘红涡纹；已读＝前面一颗橘红圆点 */
[data-wk="meta"]{color:${C.dim} !important;font-size:10.5px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"][data-read="0"]::after{content:"" !important;width:12px !important;height:12px !important;flex:none !important;background:${svg(SPIRAL)} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::before{content:"" !important;width:11px !important;height:11px !important;flex:none !important;order:-1 !important;background:${svg(DOT)} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cream} !important;border:none !important;box-shadow:0 0 0 2px ${C.gold} !important;border-radius:14px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.orange} !important}
[data-wk="name"]{color:${C.dim} !important}

/* 动描：一卷展开的羊皮纸条——两头卷起，中间淡奶油底、墨绿斜体字 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:linear-gradient(90deg,${C.cream2},${C.cream} 12%,${C.cream} 88%,${C.cream2}) !important;border:none !important;border-top:1px solid ${C.gold} !important;border-bottom:1px solid ${C.gold} !important;border-radius:0 !important;box-shadow:0 4px 10px rgba(0,0,0,.25) !important;color:${C.green} !important;font-style:italic !important;font-size:13px !important;line-height:1.8 !important;letter-spacing:.06em !important;padding:12px 30px !important;margin:0 14px !important;overflow:visible !important}
[data-wk="narrink"]::before,[data-wk="narrink"]::after{content:"" !important;position:absolute !important;top:-4px !important;bottom:-4px !important;width:14px !important;background:linear-gradient(90deg,${C.goldD},${C.gold} 40%,${C.cream2} 60%,${C.goldD}) !important;border-radius:7px !important;box-shadow:0 2px 4px rgba(0,0,0,.3) !important}
[data-wk="narrink"]::before{left:-8px !important}
[data-wk="narrink"]::after{right:-8px !important}
/* 系统提示：一行奶油小字，两头各一道小涡卷 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.dim} !important;font-size:11.5px !important;font-style:normal !important;letter-spacing:.1em !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:13px !important;height:13px !important;margin-right:6px !important;vertical-align:-2px !important;background:${svg(CURLB)} center/contain no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.dim} !important}

/* 底栏：奶油底，上沿一道墨绿边＋一条涡卷花边带；右边是一枚大的橘红发送章，戴金珠圈、顶洛可可饰 */
[data-wk="composer"]{background:${C.cream} !important;border-top:none !important;box-shadow:0 -4px 0 ${C.greenL} !important;position:relative !important;overflow:visible !important;align-items:center !important;gap:10px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:calc(100% + 4px) !important;height:20px !important;background:${svg(SCROLLBAND)} 0 0/40px 20px repeat-x !important;transform:scaleY(-1) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:#FBF5E6 !important;border:1.6px solid ${C.gold} !important;border-radius:999px !important;color:${C.ink} !important;box-shadow:inset 0 0 0 3px #FBF5E6,inset 0 0 0 4px rgba(156,122,60,.4) !important}
[data-wk="chatinput"]::placeholder{color:#A89B80 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="chatreply"]{width:36px !important;min-width:36px !important;height:36px !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="send"]{width:54px !important;min-width:54px !important;height:56px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important;margin-top:-10px !important;order:9 !important}
/* 参考图里回复在左、发送在最右，照图挪 */
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:${C.cream} !important;border-top:2px solid ${C.gold} !important}
/* ───── 翡翠沙龙 · 第二批：卡片 ───── */
/* 卡片统一：奶油底、金边双线，顶上正中一枚洛可可饰 */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.cream} !important;border:none !important;border-radius:14px !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD},0 6px 14px rgba(0,0,0,.3) !important;color:${C.ink} !important}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:rgba(156,122,60,.35) !important}

/* 转账＝一张烫金邀请函：奶油卡、双金框、顶洛可可饰；收下盖橘红火漆「R」，退回盖灰火漆 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;background:linear-gradient(${C.cream},${C.cream}) padding-box !important;border:none !important;border-radius:6px !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 5px ${C.cream},0 0 0 6px ${C.goldD},0 8px 18px rgba(0,0,0,.35) !important;margin-top:16px !important;color:${C.ink} !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-20px !important;width:56px !important;height:28px !important;margin-left:-28px !important;background:${svg(SHELL)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="transfercard"]::after{content:"Invitation" !important;position:absolute !important;right:14px !important;top:10px !important;font:italic 11px/1 Georgia,serif !important;color:${C.orange} !important;letter-spacing:.06em !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:rgba(156,122,60,.35) !important}
[data-wk="transferlabel"]{color:#8C7F66 !important;letter-spacing:.2em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.orangeD} !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:20px !important;background:${svg(CURLB)} left center/16px 16px no-repeat,${svg(CURL)} right center/16px 16px no-repeat,linear-gradient(${C.gold},${C.gold}) center/calc(100% - 44px) 1px no-repeat !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${C.cream2} !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.orange} !important;color:${C.cream} !important;border:none !important;box-shadow:0 0 0 1.5px ${C.gold} !important}
[data-wk="transferbtn"][data-part="back"]{background:${C.cream} !important;color:${C.green} !important;border:1.5px solid ${C.greenL} !important}
[data-wk="transferseal"]{background:${C.cream} !important;border:1.5px solid ${C.gold} !important;color:${C.goldD} !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:54px !important;height:54px !important;flex-shrink:0 !important;border:none !important;background:${svg(WAX("#B8452A", "R"))} center/contain no-repeat !important;transform:rotate(-10deg) !important;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35)) !important}
[data-wk="transfercard"][data-status="returned"]{filter:grayscale(.6) !important;opacity:.85 !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:54px !important;height:54px !important;flex-shrink:0 !important;border:none !important;background:${svg(WAX("#8A8478", "×"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{display:none !important}

/* 红包＝一封橘红信封封着火漆；领完了信封打开、露出一张奶油信纸 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:220px !important;min-height:90px !important;padding:16px 16px 16px 98px !important;background:${C.cream} !important;border:none !important;border-radius:14px !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD},0 6px 14px rgba(0,0,0,.3) !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:80px !important;height:60px !important;margin-top:-28px !important;background:${svg(ENV(false))} center/contain no-repeat !important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25)) !important}
[data-wk="rpcard"]::after{content:"pour toi" !important;position:absolute !important;right:12px !important;bottom:6px !important;font:italic 10.5px/1 Georgia,serif !important;color:${C.orange} !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important;color:${C.orangeD} !important}
[data-wk="rpcard"][data-status="done"]{opacity:.85 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(ENV(true))} center/contain no-repeat !important}
[data-wk="rpcard"][data-status="done"]::after{content:"merci" !important}
[data-wk="rpenvelope"][data-stage="closed"],[data-wk="rpenvelope"][data-stage="open"]{background:${svg(DAMASK)} 0 0/48px 64px,linear-gradient(180deg,#DC6A44,${C.orangeD}) !important;border:none !important;border-radius:20px !important;box-shadow:0 0 0 3px ${C.gold},0 0 0 5px ${C.goldD},0 20px 40px rgba(0,0,0,.5) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:${C.cream} !important;border-color:${C.gold} !important;box-shadow:none !important}
[data-wk="rpenvelope"] [data-wk="rparc"]::after{content:none !important}
[data-wk="rpenvelope"] *{color:${C.cream} !important}
[data-wk="rpenvelope"] [data-wk="rparc"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:${svg(WAX("#8E2B1C", "♥"))} center/contain no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4)) !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.gold},0 0 0 4.5px ${C.goldD} !important}
[data-wk="rpamount"]{color:${C.cream} !important;background:none !important}
[data-wk="rpclose"]{background:${C.cream} !important;border:2px solid ${C.gold} !important;color:${C.ink} !important}

/* 照片＝镶在一面椭圆金珠镜框里，顶上洛可可饰 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:${C.cream} !important;border:none !important;border-radius:50% / 46% !important;padding:24px 30px 36px !important;box-shadow:0 8px 18px rgba(0,0,0,.35) !important;margin-top:16px !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;inset:0 !important;background:${svg(OVALF)} center/100% 100% no-repeat !important;pointer-events:none !important;z-index:2 !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;left:50% !important;top:-16px !important;width:52px !important;height:26px !important;margin-left:-26px !important;background:${svg(SHELL)} center/contain no-repeat !important;z-index:3 !important}
[data-wk="photoface"]{background:${svg(DAMASK)} 0 0/48px 64px,${C.green} !important;border:none !important;border-radius:50% / 46% !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:${C.cream} !important}
[data-wk="photocap"],[data-wk="photohint"]{color:#8C7F66 !important;font-style:italic !important}

/* 语音：前面一只金色留声机喇叭 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"][data-me]{padding:0 14px 0 42px !important;position:relative !important;border-radius:999px !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:24px !important;height:24px !important;margin-top:-12px !important;background:${svg(HORN)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:linear-gradient(180deg,#DC6A44,${C.orange}) !important}
[data-wk="voice"][data-me="1"] *{color:${C.cream} !important}
[data-wk="voicewave"] span{background:${C.green} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:${C.cream} !important}

/* 天气：墨绿叶纹天，金字；下面奶油一行 */
[data-wk="wxcardsky"]{background:${svg(DAMASK)} 0 0/48px 64px,linear-gradient(170deg,${C.greenL},${C.green2}) !important}
[data-wk="wxcardsky"] *{color:${C.cream} !important}
[data-wk="wxcardsky"] svg{stroke:${C.gold} !important}
[data-wk="wxcardsay"]{background:${C.cream} !important;color:${C.ink} !important;border-top:2px solid ${C.gold} !important}
/* 位置：一枚洛可可饰当图钉 */
[data-wk="geopin"]{background:${svg(SHELL)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:40px !important;height:20px !important;border-radius:0 !important;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35)) !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.gold} !important}
/* 名片 */
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.gold},0 0 0 4px ${C.goldD} !important}

/* 拍一拍、通话结束：奶油小胶囊，两头小涡卷 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${svg(CURLB)} 8px center/12px 12px no-repeat,${svg(CURL)} calc(100% - 8px) center/12px 12px no-repeat,${C.cream} !important;border:none !important;border-radius:999px !important;padding:3px 26px !important;color:${C.ink} !important;box-shadow:0 0 0 1.5px ${C.gold} !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.orange} !important}
[data-wk="note"][data-part="callsum"]{color:${C.dim} !important}

/* 线下小结：一封信，信头一枚洛可可饰，标题是橘红缎带 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:30px !important;margin-top:16px !important;background:repeating-linear-gradient(180deg,transparent 0 27px,rgba(156,122,60,.18) 27px 28px),${C.cream} !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-18px !important;width:52px !important;height:26px !important;margin-left:-26px !important;background:${svg(SHELL)} center/contain no-repeat !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 6px !important;padding:3px 16px !important;background:${C.orange} !important;color:${C.cream} !important;border-radius:3px !important;box-shadow:0 0 0 1.5px ${C.gold} !important;letter-spacing:.15em !important}
[data-wk="offlogtitle"] *{color:${C.cream} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.orangeD} !important}
[data-wk="offlogtranscript"]{border-top:1.5px dashed ${C.gold} !important;color:#8C7F66 !important}

/* 加号面板：一颗颗墨绿圆钮戴金圈 */
[data-wk="chattoolicon"]{background:${C.greenL} !important;border:none !important;border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.gold},0 0 0 4px ${C.goldD} !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.cream} !important;color:${C.cream} !important}
[data-wk="chattoollabel"]{color:${C.ink} !important}

/* 引用三处：待发送那条＝奶油胶囊金边；气泡上方＝奶油小签；气泡里＝左边一道金线 */
[data-wk="quotedraft"]{background:${C.cream} !important;border:none !important;border-top:1.5px solid ${C.gold} !important;position:relative !important;z-index:3 !important}
[data-wk="quotedraft"] *{background:transparent !important;color:${C.ink} !important;border:none !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.orange} !important}
[data-wk="quote"]{background:${C.cream} !important;color:#6B5E48 !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.2px ${C.gold} !important;padding:3px 12px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid ${C.gold} !important;padding-left:8px !important;opacity:.85 !important}
/* ───── 翡翠沙龙 · 第三批：状态卡＝一面挂在沙龙墙上的金框画：奶油画布、双金框、顶洛可可饰、四角涡卷；好感是一只香水瓶 ───── */
[data-wk="statecard"]{background:${C.cream} !important;border:none !important;border-radius:18px !important;box-shadow:0 0 0 3px ${C.gold},0 0 0 7px ${C.green},0 0 0 9px ${C.gold},0 0 0 10px ${C.goldD},0 20px 40px rgba(0,0,0,.5) !important;overflow:visible !important;position:relative !important;padding-top:22px !important;--sc-heart-ink:${C.orange} !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-30px !important;width:76px !important;height:38px !important;margin-left:-38px !important;background:${svg(SHELL)} center/contain no-repeat !important;z-index:3 !important;pointer-events:none !important}
[data-wk="statecard"]::after{content:"" !important;position:absolute !important;inset:-16px !important;background:${svg(CURLB)} left top/22px 22px no-repeat,${svg(CURL)} right top/22px 22px no-repeat,${svg(CURLB)} left bottom/22px 22px no-repeat,${svg(CURL)} right bottom/22px 22px no-repeat !important;pointer-events:none !important;z-index:3 !important;transform:none !important}
[data-wk="statecard"] *{font-family:${SERIF} !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1.5px solid ${C.gold} !important}
[data-wk="statehead"] *{color:${C.ink} !important}
[data-wk="statehead"] [data-wk="avatar"],[data-wk="statehead"] img{border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.gold},0 0 0 4px ${C.goldD} !important}
[data-wk="statehead"] [data-wk="avatar"]::before{content:none !important}
[data-wk="statehead"] button{border:none !important;background:${C.greenL} !important;border-radius:50% !important;box-shadow:0 0 0 2px ${C.gold} !important}
[data-wk="statehead"] button *{color:${C.cream} !important}
[data-wk="statemood"]{display:inline-block !important;background:${C.orange} !important;color:${C.cream} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.cream2} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:#8C7F66 !important;border:none !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.greenL} !important;color:${C.cream} !important;box-shadow:0 0 0 1.5px ${C.gold} !important}
/* 看得见的＝一块奶油小牌；心里想的＝墨绿底奶油斜体字，两头卷轴（跟聊天里的动描一样是卷轴） */
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;background:#FBF5E6 !important;border:none !important;border-radius:12px !important;margin:12px 16px !important;color:${C.ink} !important;box-shadow:0 0 0 1.5px ${C.gold},inset 0 0 0 4px #FBF5E6,inset 0 0 0 5px rgba(156,122,60,.35) !important}
[data-wk="statevoice"]{background:${svg(DAMASK)} 0 0/48px 64px,${C.green} !important;border-radius:2px !important;margin:14px 26px !important;font-style:italic !important;box-shadow:0 0 0 1.5px ${C.gold},0 4px 10px rgba(0,0,0,.25) !important;overflow:visible !important}
[data-wk="statevoice"]::before,[data-wk="statevoice"]::after{content:"" !important;position:absolute !important;top:-4px !important;bottom:-4px !important;width:12px !important;background:linear-gradient(90deg,${C.goldD},${C.gold} 40%,${C.cream2} 60%,${C.goldD}) !important;border-radius:6px !important}
[data-wk="statevoice"]::before{left:-9px !important}
[data-wk="statevoice"]::after{right:-9px !important}
[data-wk="stateseen"] *{color:${C.ink} !important}
[data-wk="statevoice"] *{color:${C.cream} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:${C.cream2} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1px ${C.gold} !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:#8C7F66 !important}
[data-wk="statevoice"] [data-wk="statevoicedel"]{color:${C.dim} !important}
[data-wk="statevoice"] + div > button{background:${C.orange} !important;color:${C.cream} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important}
/* 好感：壁炉上一座洛可可座钟——钟面顶一枚洛可可饰，一根橘红指针从十二点顺时针走，走到哪就是多少好感；数字写在钟下一块小铭牌上 */
[data-wk="stateaff"]{background:transparent !important;border-top:1.5px solid ${C.gold} !important;position:relative !important;display:block !important;padding:16px 22px 140px !important;overflow:hidden !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:absolute !important;width:86px !important;height:86px !important;left:calc(50% - 43px) !important;bottom:40px !important;transform:none !important;background:${svg(CLOCK)} center/contain no-repeat !important;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25)) !important}
[data-wk="stateheart"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-20px !important;width:48px !important;height:24px !important;margin-left:-24px !important;background:${svg(SHELL)} center/contain no-repeat !important}
[data-wk="stateheart"] > div{display:none !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;left:50% !important;bottom:50% !important;top:auto !important;width:8px !important;height:34px !important;margin-left:-4px !important;background:${svg(HAND)} center/contain no-repeat !important;transform-origin:50% 100% !important;transform:rotate(calc(var(--sc-heart-lvl) * 360deg)) !important;z-index:2 !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;left:50% !important;right:auto !important;top:auto !important;bottom:12px !important;transform:translateX(-50%) !important;z-index:3 !important;min-width:56px !important;padding:3px 12px !important;text-align:center !important;background:${C.orange} !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold},0 0 0 2.5px ${C.goldD} !important;font-size:14px !important;line-height:1.2 !important;font-weight:700 !important;font-style:italic !important;color:${C.cream} !important;pointer-events:none !important}
/* 翻旧的：一封封奶油信笺，右上角一颗橘红火漆 */
[data-wk="statehistbtn"]{background:${C.greenL} !important;color:${C.cream} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:#8C7F66 !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:none !important;border-radius:999px !important;color:${C.orange} !important;background:transparent !important;box-shadow:0 0 0 1.2px ${C.gold} !important}
[data-wk="statehistitem"]{position:relative !important;background:repeating-linear-gradient(180deg,transparent 0 27px,rgba(156,122,60,.16) 27px 28px),#FBF5E6 !important;border:none !important;border-radius:4px !important;padding:16px 46px 14px 18px !important;margin:0 0 14px !important;box-shadow:0 0 0 1.2px ${C.gold},0 4px 10px rgba(0,0,0,.18) !important;overflow:visible !important}
[data-wk="statehistitem"]::after{content:"" !important;position:absolute !important;right:8px !important;top:8px !important;width:30px !important;height:30px !important;background:${svg(WAX("#B8452A", "♥"))} center/contain no-repeat !important;transform:rotate(12deg) !important}
[data-wk="statehistitem"] *{color:${C.ink} !important}
[data-wk="statehistmood"]{background:${C.orange} !important;border:none !important;color:${C.cream} !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:#8C7F66 !important;font-style:italic !important}
[data-wk="statehistmeta"]{background:rgba(31,74,64,.07) !important;border-radius:6px !important}
[data-wk="statehistend"]{color:#8C7F66 !important}
/* Ta 眼里：墨绿叶纹底，卡片奶油金边，贴条换成一枚小洛可可饰 */
[data-wk="gazepage"]{background:${svg(DAMASK)} 0 0/48px 64px,radial-gradient(ellipse at 50% 30%,#245447,${C.green2} 80%) !important}
[data-wk="gazepage"] *{font-family:${SERIF} !important}
[data-wk="gazetitle"]{color:${C.cream} !important;letter-spacing:.2em !important}
[data-wk="gazetab"]{background:${C.cream2} !important;color:#8C7F66 !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.orange} !important;color:${C.cream} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.dim} !important}
[data-wk="gazecard"]{background:${C.cream} !important;border:none !important;border-radius:14px !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD} !important}
[data-wk="gazetape"]{background:${svg(SHELL)} center/40px 20px no-repeat !important;box-shadow:none !important;border:none !important;width:44px !important;height:22px !important;transform:none !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#8C7F66 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.cream} !important;border:none !important;border-radius:16px !important;box-shadow:0 0 0 2px ${C.gold} !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:rgba(244,234,210,.1) !important;border:1.5px dashed ${C.gold} !important;border-radius:16px !important;color:${C.cream} !important}
[data-wk="gazeempty"] > div:first-child{color:${C.cream} !important}
[data-wk="gazeempty"] button{background:${C.orange} !important;color:${C.cream} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important}
/* ───── 翡翠沙龙 · 第四批：线下＝沙龙墙上一面大椭圆金镜，镜里映着烛光；卡片顶洛可可饰 ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(MIRRORBIG)} center bottom 70px/86% auto no-repeat,${svg(DAMASK)} 0 0/48px 64px,radial-gradient(ellipse at 50% 30%,#245447,${C.green2} 80%) !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] *{font-family:${SERIF} !important}
[data-wk="offline"] [data-wk="chathead"]::after{display:none !important}
[data-wk="offline"] [data-wk="chathead"] + *{margin-top:0 !important;padding-top:14px !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:${C.ink} !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:32px !important;height:32px !important;background:${svg(I_PLUS)} center/contain no-repeat !important;border:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:${C.orange} !important;color:${C.cream} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important;font-size:12px !important;padding:3px 14px !important}
[data-wk="offcomposer"]{background:${C.cream} !important;border-top:none !important;box-shadow:0 -4px 0 ${C.greenL} !important}
[data-wk="offcomposer"] textarea{background:#FBF5E6 !important;border:1.6px solid ${C.gold} !important;border-radius:18px !important;color:${C.ink} !important}
[data-wk="offcomposer"] textarea::placeholder{color:#A89B80 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:34px !important;height:34px !important;min-width:34px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/44px no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{position:relative !important;width:60px !important;min-width:60px !important;height:34px !important;border:none !important;border-radius:999px !important;background:${C.greenL} !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD} !important;font-size:0 !important;color:transparent !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]::before{content:"演绎" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;font-size:13px !important;letter-spacing:.15em !important;color:${C.cream} !important}
/* 卡片：他的奶油、你的橘红，金边双线，顶上正中一枚洛可可饰 */
[data-wk="offcard"]{position:relative !important;background:${C.cream} !important;border:none !important;border-radius:16px !important;box-shadow:0 0 0 2px ${C.gold},0 0 0 3px ${C.goldD},0 8px 18px rgba(0,0,0,.35) !important;overflow:visible !important;margin-top:24px !important;color:${C.ink} !important}
[data-wk="offcard"][data-me="1"]{background:linear-gradient(180deg,#DC6A44,${C.orange}) !important;color:${C.cream} !important}
[data-wk="offcard"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-17px !important;width:48px !important;height:24px !important;margin-left:-24px !important;background:${svg(SHELL)} center/contain no-repeat !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.gold},0 0 0 4px ${C.goldD} !important}
[data-wk="offhead"] [data-wk="avatar"]::before{content:none !important}
[data-wk="offname"],[data-wk="offtext"]{color:${C.ink} !important}
[data-wk="offname"]{font-weight:700 !important;letter-spacing:.12em !important}
[data-wk="offcard"][data-me="1"] [data-wk="offname"],[data-wk="offcard"][data-me="1"] [data-wk="offtext"]{color:${C.cream} !important}
[data-wk="offsay"]{color:${C.orangeD} !important;background:none !important;font-weight:700 !important;border-bottom:1.5px solid ${C.gold} !important}
[data-wk="offcard"][data-me="1"] [data-wk="offsay"]{color:#FFF6E4 !important;border-bottom-color:${C.cream} !important}
[data-wk="offthought"]{position:relative !important;background:${svg(DAMASK)} 0 0/48px 64px,${C.green} !important;border:none !important;border-radius:2px !important;color:${C.cream} !important;font-style:italic !important;box-shadow:0 0 0 1.2px ${C.gold} !important;margin:10px 10px !important;overflow:visible !important}
[data-wk="offthought"]::before,[data-wk="offthought"]::after{content:"" !important;position:absolute !important;top:-3px !important;bottom:-3px !important;width:10px !important;background:linear-gradient(90deg,${C.goldD},${C.gold} 40%,${C.cream2} 60%,${C.goldD}) !important;border-radius:5px !important}
[data-wk="offthought"]::before{left:-7px !important}
[data-wk="offthought"]::after{right:-7px !important}
[data-wk="offcardacts"] svg{stroke:${C.goldD} !important;color:${C.goldD} !important}
[data-wk="offreplyopt"]{background:${C.cream} !important;border:none !important;border-radius:999px !important;box-shadow:0 0 0 1.5px ${C.gold} !important;color:${C.ink} !important}

/* ───── 翡翠沙龙 · 通话：气泡同线上，大头像套金珠圈镜框 ───── */
[data-wk="callbubble"]{background:${C.cream} !important;color:${C.ink} !important;border:none !important;border-radius:14px !important;box-shadow:0 0 0 2px ${C.gold} !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:linear-gradient(180deg,#DC6A44,${C.orange}) !important;color:${C.cream} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callbubble"][data-kind="typing"] [data-wk="typingdot"]{background:${C.orange} !important}
[data-wk="callact"]{color:${C.dim} !important;font-style:italic !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 5px ${C.gold},0 0 0 7px ${C.goldD},0 0 0 12px rgba(216,178,106,.25),0 0 40px rgba(242,180,74,.4) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "翡翠沙龙", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "翡翠沙龙-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
