// 圣诞聊天美化：生成 chat-look 包。用法：node themes/christmas/build.mjs
// 结构：他的话＝挂在顶栏彩灯串上的礼物卡（丝带吊着、微微晃，连发连成一挂）；我的话＝红色雪帽气泡；
//       时间＝牛皮纸挂签；已读＝亮起来的小灯泡；底下一片雪地小木屋常驻；雪一直在落。
// 配色：圣诞红 #B5383A / 深松绿 #1E3B31 / 奶白 #FFF8EA / 金 #E8B85A / 冬青绿 #3E7A55
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => s.replace(/<\/?svg[^>]*>/g, "");
const C = { red: "#B5383A", redD: "#8C2A2C", pine: "#1E3B31", pine2: "#264A3D", cream: "#FFF8EA", gold: "#E8B85A", holly: "#3E7A55", ink: "#3A2A22", snow: "#F4F7F5" };

// ── 小图 ──
const HOLLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 28'><g fill='${C.holly}' stroke='#2C5A3E' stroke-width='1'><path d='M20 16 C14 4 6 6 2 10 C6 12 6 16 4 20 C10 18 14 20 20 16Z'/><path d='M20 16 C26 4 34 6 38 10 C34 12 34 16 36 20 C30 18 26 20 20 16Z'/></g><circle cx='17' cy='18' r='4' fill='#D23B3B'/><circle cx='23' cy='19' r='4' fill='#D23B3B'/><circle cx='20' cy='13.5' r='4' fill='#E04848'/><circle cx='19' cy='12.5' r='1.2' fill='#fff' opacity='.7'/></svg>`;
const STAR = (f = C.gold) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 1 L12.6 7 L19 7.6 L14 11.8 L15.6 18.4 L10 14.8 L4.4 18.4 L6 11.8 L1 7.6 L7.4 7Z' fill='${f}' stroke='#B88A33' stroke-width='.8' stroke-linejoin='round'/></svg>`;
const BULB = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 24'><rect x='5' y='1' width='6' height='5' rx='1' fill='#5B5B5B'/><path d='M8 5 C14 5 15 12 13 17 C12 20 10 22 8 22 C6 22 4 20 3 17 C1 12 2 5 8 5Z' fill='${f}'/><ellipse cx='6' cy='11' rx='1.6' ry='3' fill='#fff' opacity='.55'/></svg>`;
const FLAKE = (o = .5) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><g stroke='#fff' stroke-width='1.4' stroke-linecap='round' opacity='${o}'><path d='M10 1 V19 M2.2 5.5 L17.8 14.5 M2.2 14.5 L17.8 5.5'/><path d='M7.5 2.5 L10 5 L12.5 2.5 M7.5 17.5 L10 15 L12.5 17.5'/></g></svg>`;
const GIFT = (f = C.red, r = C.gold) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect x='6' y='16' width='28' height='20' rx='3' fill='${f}'/><rect x='4' y='11' width='32' height='7' rx='2' fill='${f}' stroke='rgba(0,0,0,.15)'/><rect x='18' y='11' width='4' height='25' fill='${r}'/><path d='M20 11 C14 2 8 6 12 10 C14 12 18 11 20 11 C22 11 26 12 28 10 C32 6 26 2 20 11Z' fill='none' stroke='${r}' stroke-width='2.4'/></svg>`;

// 背景：深松绿，散着大小雪点和几朵雪花（一张小图平铺）
const SNOWTILE = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'><g fill='#fff'><circle cx='12' cy='20' r='2' opacity='.5'/><circle cx='70' cy='8' r='1.4' opacity='.4'/><circle cx='130' cy='34' r='2.2' opacity='.5'/><circle cx='40' cy='70' r='1.2' opacity='.35'/><circle cx='160' cy='90' r='1.6' opacity='.45'/><circle cx='96' cy='110' r='2' opacity='.4'/><circle cx='20' cy='140' r='1.6' opacity='.45'/><circle cx='140' cy='160' r='1.2' opacity='.35'/><circle cx='66' cy='170' r='2' opacity='.45'/></g><g transform='translate(100 60) scale(.8)'>${X(FLAKE(.35))}</g><g transform='translate(30 100) scale(.6)'>${X(FLAKE(.3))}</g><g transform='translate(150 130) scale(.7)'>${X(FLAKE(.3))}</g></svg>`;
// 顶栏下沿：雪帽波浪＋一串彩灯（线上挂四色灯泡）
const LIGHTS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 60' preserveAspectRatio='xMidYMin slice'><path d='M0 0 H390 V14 C380 26 370 26 360 16 C350 28 336 28 326 16 C316 26 302 26 292 15 C282 28 266 28 256 16 C246 26 232 26 222 15 C212 28 196 28 186 16 C176 26 162 26 152 15 C142 28 126 28 116 16 C106 26 92 26 82 15 C72 28 56 28 46 16 C36 26 22 26 12 15 C8 20 4 20 0 18Z' fill='#fff'/><path d='M0 30 Q24 44 48 32 Q72 44 96 32 Q120 44 144 32 Q168 44 192 32 Q216 44 240 32 Q264 44 288 32 Q312 44 336 32 Q360 44 390 32' fill='none' stroke='#2B2B2B' stroke-width='1.4'/>${[["#E5484D",24],["#F2C14E",60],["#5CC8A8",96],["#FFF3C4",132],["#E5484D",168],["#F2C14E",204],["#5CC8A8",240],["#FFF3C4",276],["#E5484D",312],["#F2C14E",348],["#5CC8A8",384]].map(([f, x], i) => `<g transform='translate(${x - 6} ${36 + (i % 2) * 2})'><rect x='3.5' y='0' width='5' height='4' rx='1' fill='#555'/><path d='M6 3 C11 3 12 9 10.5 13 C9.5 15.5 8 17 6 17 C4 17 2.5 15.5 1.5 13 C0 9 1 3 6 3Z' fill='${f}'/><ellipse cx='4.5' cy='8' rx='1.2' ry='2.4' fill='#fff' opacity='.6'/></g>`).join("")}</svg>`;
// 底下雪地：起伏的雪坡、一间亮着灯的小木屋、几棵雪松
const TREE = (x, y, s) => `<g transform='translate(${x} ${y}) scale(${s})'><rect x='-3' y='40' width='6' height='10' fill='#6B4A33'/><path d='M0 0 L-16 22 H-8 L-20 40 H20 L8 22 H16Z' fill='#2F6B4A'/><path d='M-10 21 Q0 26 10 21 M-14 38 Q0 44 14 38' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round'/><circle cx='-6' cy='30' r='1.8' fill='#E5484D'/><circle cx='6' cy='14' r='1.6' fill='#F2C14E'/><circle cx='8' cy='32' r='1.6' fill='#5CC8A8'/><path d='M0 -6 L1.8 -1.6 L6.4 -1.2 L2.8 1.8 L4 6.4 L0 3.8 L-4 6.4 L-2.8 1.8 L-6.4 -1.2 L-1.8 -1.6Z' fill='${C.gold}'/></g>`;
const SCENE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 170' preserveAspectRatio='xMidYMax slice'><defs><radialGradient id='w' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#FFE7A8' stop-opacity='.55'/><stop offset='1' stop-color='#FFE7A8' stop-opacity='0'/></radialGradient></defs>${TREE(352, 70, .9)}${TREE(300, 96, .6)}<path d='M0 110 C80 92 150 120 230 104 C300 90 350 100 390 96 V170 H0Z' fill='#DCE7E6'/><path d='M0 124 C90 108 170 134 250 120 C320 108 360 116 390 112 V170 H0Z' fill='${C.snow}'/><circle cx='84' cy='104' r='54' fill='url(#w)'/><g transform='translate(48 62)'><rect x='4' y='26' width='64' height='38' fill='#8A5A3B'/><path d='M-6 30 L36 0 L78 30Z' fill='#fff' stroke='#DCE7E6' stroke-width='2'/><rect x='54' y='4' width='8' height='18' fill='#7A4A32'/><rect x='52' y='0' width='12' height='5' rx='2' fill='#fff'/><rect x='14' y='36' width='16' height='14' fill='#FFE08A' stroke='#6B4A33' stroke-width='2'/><path d='M22 36 V50 M14 43 H30' stroke='#6B4A33' stroke-width='1.6'/><rect x='40' y='38' width='14' height='26' rx='2' fill='#5E3B26'/><circle cx='47' cy='34' r='4' fill='none' stroke='${C.holly}' stroke-width='2'/></g>${TREE(150, 84, .75)}${TREE(22, 92, .55)}</svg>`;

// 花环头像框：一圈冬青叶＋红果＋金点，底下一只红蝴蝶结
const WREATH = (() => {
  // 一整圈闭合的绿环：底下一圈深绿粗环，上面顺着环方向叠两层叶片纹理，不往外戳
  let leaves = "";
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, r = 42 + (i % 2 ? 2.5 : -2.5), x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r, d = a * 180 / Math.PI;
    leaves += `<ellipse cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' rx='6.5' ry='3.4' transform='rotate(${(d + 90 + (i % 2 ? 25 : -25)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})' fill='${i % 3 ? "#3E8A5C" : "#4A9A68"}'/>`;
  }
  let dots = "";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10 + .05) * Math.PI * 2, x = 50 + Math.cos(a) * 42, y = 50 + Math.sin(a) * 42;
    dots += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='${i % 3 === 0 ? 2.4 : 3}' fill='${i % 3 === 0 ? C.gold : "#D23B3B"}' stroke='rgba(0,0,0,.15)' stroke-width='.6'/>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 112'><circle cx='50' cy='50' r='42' fill='none' stroke='#2A5E40' stroke-width='13'/>${leaves}<circle cx='50' cy='50' r='48.5' fill='none' stroke='#22503A' stroke-width='1'/><circle cx='50' cy='50' r='35.5' fill='none' stroke='#22503A' stroke-width='1'/>${dots}<g transform='translate(50 92)'><path d='M0 0 L-16 -8 C-20 -2 -20 6 -16 10Z M0 0 L16 -8 C20 -2 20 6 16 10Z' fill='#C7373A' stroke='#8C2A2C' stroke-width='1.4'/><path d='M-3 2 L-10 18 L-5 16 L-3 20Z M3 2 L10 18 L5 16 L3 20Z' fill='#C7373A' stroke='#8C2A2C' stroke-width='1.2'/><circle r='4' fill='#E04848' stroke='#8C2A2C' stroke-width='1.2'/></g></svg>`;
})();
// 雪帽：气泡顶上一层厚雪，下沿起伏
const SNOWCAP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 22' preserveAspectRatio='none'><path d='M10 2 H190 C198 2 200 8 198 12 C196 18 188 14 184 18 C178 22 170 14 164 18 C156 22 148 13 140 17 C132 21 124 14 116 18 C108 22 98 13 90 17 C82 21 74 14 66 18 C58 22 50 13 42 17 C34 21 26 14 18 18 C10 22 2 16 2 10 C2 5 5 2 10 2Z' fill='#fff' stroke='#E2E8E6' stroke-width='1.2'/></svg>`;
// 礼物卡顶上：一根丝带往上吊，中间一个小蝴蝶结
const RIBBON = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 40'><path d='M15 0 V30' stroke='${C.red}' stroke-width='2.4'/><path d='M15 30 L4 24 C1 28 1 34 4 37Z M15 30 L26 24 C29 28 29 34 26 37Z' fill='${C.red}' stroke='${C.redD}' stroke-width='1'/><circle cx='15' cy='30' r='3' fill='${C.redD}'/></svg>`;
// 牛皮纸挂签（时间）
const TAG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 30' preserveAspectRatio='none'><path d='M14 2 H114 Q118 2 118 6 V24 Q118 28 114 28 H14 L2 15Z' fill='#F7E7C6' stroke='#C9A46A' stroke-width='1.4'/><circle cx='12' cy='15' r='2.6' fill='none' stroke='#8C6A3A' stroke-width='1.2'/></svg>`;

// 圣诞帽：往右下垂的红帽身（带一道暗面）、蓬蓬的白毛边、毛球
const HAT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 48'><path d='M8 34 C10 18 22 6 38 6 C48 6 56 12 58 22 C56 20 52 19 50 22 C46 18 40 20 40 26 L44 34Z' fill='#D9474A' stroke='#8C2A2C' stroke-width='1.6' stroke-linejoin='round'/><path d='M38 7 C46 8 52 14 54 20 C50 18 46 19 44 22 C42 16 40 11 38 7Z' fill='#A93235'/><path d='M4 36 C4 31 8 30 11 31 C13 28 18 28 20 30 C22 27 28 27 30 30 C32 27 38 28 39 31 C42 29 47 31 46 36 C47 41 42 43 39 41 C37 44 32 44 30 41 C27 44 22 44 20 41 C17 44 12 44 11 41 C7 43 3 41 4 36Z' fill='#fff' stroke='#D8DEDC' stroke-width='1.2'/><circle cx='56' cy='26' r='6.5' fill='#fff' stroke='#D8DEDC' stroke-width='1.2'/><path d='M53 23 q2 -1 3 1 M56 28 q2 0 2 -2' fill='none' stroke='#D8DEDC' stroke-width='1'/></svg>`;
// 按键
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='${C.holly}'/><path d='M20 12 V28 M12 20 H28' stroke='#fff' stroke-width='3' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><circle cx='22' cy='22' r='20' fill='${C.pine}' stroke='${C.gold}' stroke-width='2.4'/><g transform='translate(7 6) scale(.75)'>${X(GIFT("#E04848", C.gold))}</g></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 52 50'><path d='M8 18 H42 Q46 18 46 22 V38 Q46 42 42 42 H22 L12 48 L14 42 H8 Q4 42 4 38 V22 Q4 18 8 18Z' fill='#fff' stroke='${C.pine}' stroke-width='2.4' stroke-linejoin='round'/><circle cx='17' cy='30' r='2.2' fill='${C.pine}'/><circle cx='25' cy='30' r='2.2' fill='${C.pine}'/><circle cx='33' cy='30' r='2.2' fill='${C.pine}'/><g transform='translate(22 -1) scale(.5) rotate(12 32 24)'>${X(HAT)}</g></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g stroke='#fff' stroke-width='2.4' stroke-linejoin='round' fill='none'><path d='M5 20 L20 7 L35 20'/><path d='M9 17 V34 H31 V17'/><path d='M17 34 V25 H23 V34'/></g><path d='M4 20 L20 6 L36 20 L33 21 L20 10 L7 21Z' fill='#fff'/></svg>`;
const I_FLAKES = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 66 22'><g transform='translate(0 2)'>${X(FLAKE(1))}</g><g transform='translate(22 1) scale(1.05)'>${X(FLAKE(1))}</g><g transform='translate(45 2)'>${X(FLAKE(1))}</g></svg>`;


// ── 第二批用的图 ──
// 圣诞袜（红包）：红袜身、白毛边、脚尖脚跟绿格、袜口挂一颗铃铛
const STOCKING = (body = "#D9474A", full = true) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 74'><path d='M16 14 H44 V44 C44 50 42 52 40 56 L30 66 C24 72 12 72 8 64 C4 56 10 50 16 46Z' fill='${body}' stroke='${C.redD}' stroke-width='1.8' stroke-linejoin='round'/><path d='M8 64 C12 72 24 72 30 66 L24 60 C20 64 12 62 10 58Z' fill='${C.holly}'/><path d='M44 44 C44 50 42 52 40 56 L34 50 C38 48 40 46 40 42Z' fill='${C.holly}'/><rect x='12' y='6' width='36' height='12' rx='6' fill='#fff' stroke='#D8DEDC' stroke-width='1.2'/>${full ? `<g transform='translate(18 -4) scale(.6)'>${X(GIFT(C.gold, C.red))}</g>` : ""}<g transform='translate(38 14) scale(.55)'><circle cx='9' cy='9' r='8' fill='${C.gold}' stroke='#B88A33' stroke-width='1.4'/><path d='M2 8 H16' stroke='#B88A33' stroke-width='1.2'/><circle cx='9' cy='12' r='1.6' fill='#7A5A1E'/></g></svg>`;
// 金色火漆封（已收）；灰的（退回）
const SEAL = (f = C.gold, k = "#B88A33") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><path d='M30 3 C36 6 40 3 44 8 C50 10 50 16 54 20 C57 26 54 30 57 36 C55 42 50 44 48 50 C42 54 38 52 32 57 C26 55 22 58 16 54 C11 50 8 46 5 40 C4 34 7 30 4 24 C7 18 10 14 14 9 C20 6 24 6 30 3Z' fill='${f}' stroke='${k}' stroke-width='1.6'/><circle cx='30' cy='30' r='17' fill='none' stroke='${k}' stroke-width='1.4' opacity='.7'/><g transform='translate(18 17) scale(1.2)'>${X(STAR("rgba(255,255,255,.55)"))}</g></svg>`;
const BELL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M15 4 C22 4 23 11 23 16 C23 19 25 21 26 22 H4 C5 21 7 19 7 16 C7 11 8 4 15 4Z' fill='${C.gold}' stroke='#B88A33' stroke-width='1.4' stroke-linejoin='round'/><circle cx='15' cy='25' r='3' fill='#B88A33'/><path d='M10 2 Q15 6 20 2' fill='none' stroke='${C.red}' stroke-width='2'/></svg>`;
// 邮票（线下小结卡角上）
const STAMP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 52'><path d='M2 2 H42 V50 H2Z' fill='#fff' stroke='#C9A46A' stroke-width='1.4' stroke-dasharray='3 2.4'/><rect x='6' y='6' width='32' height='40' fill='${C.pine}'/>${TREE(22, 12, .55)}<text x='22' y='44' font-size='6' text-anchor='middle' fill='#fff' font-family='sans-serif'>NOEL</text></svg>`;
const bubble = { myBg: C.red, myText: "#fff", myBorder: "none", charBg: C.cream, charText: C.ink, charBorder: "1.5px solid " + C.gold, radius: 20, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 圣诞 · 第一批 ───── */
/* 背景：深松绿，雪一直往下落；底下一片雪地小木屋常驻 */
[data-wk="chat"]{background:linear-gradient(180deg,#1A3329,${C.pine} 40%,${C.pine2}) !important;position:relative !important}
[data-wk="chat"]::before{content:"" !important;position:absolute !important;inset:0 !important;background:${svg(SNOWTILE)} 0 0/180px 180px repeat,${svg(SNOWTILE)} 60px 40px/260px 260px repeat !important;opacity:.9 !important;pointer-events:none !important;z-index:0 !important;animation:xmSnow 18s linear infinite !important}
@keyframes xmSnow{from{background-position:0 0,60px 40px}to{background-position:20px 180px,40px 300px}}
[data-wk="chat"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:0 !important;height:170px !important;background:${svg(SCENE)} center bottom/100% auto no-repeat !important;pointer-events:none !important;z-index:0 !important}
[data-wk="body"]{background:transparent !important;position:relative !important;z-index:1 !important;padding-top:58px !important}

/* 顶栏：圣诞红，下沿一圈雪帽，雪帽下挂一串彩灯 */
[data-wk="chathead"]{background:${C.red} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% - 1px) !important;height:52px !important;background:${svg(LIGHTS)} center top/100% auto no-repeat !important;pointer-events:none !important;animation:xmTwinkle 2.4s ease-in-out infinite !important}
@keyframes xmTwinkle{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25) drop-shadow(0 0 4px rgba(255,230,150,.6))}}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headdim"]{color:rgba(255,255,255,.75) !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="sameroom"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;padding:0 !important;background:${svg(I_HOUSE)} center/30px 30px no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="chatmore"]{font-size:0 !important;color:transparent !important;width:42px !important;min-width:42px !important;height:30px !important;background:${svg(I_FLAKES)} center/40px auto no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
/* 顶栏头像戴一顶圣诞帽 */
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]) > [data-wk="avatar"]{box-shadow:0 0 0 2.5px #fff !important;border-radius:50% !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:42px !important;height:32px !important;left:-2px !important;top:calc(50% - 34px) !important;background:${svg(HAT)} center/contain no-repeat !important;filter:drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 2px 2px rgba(0,0,0,.25)) !important;transform:rotate(-16deg) !important;z-index:3 !important;pointer-events:none !important}

/* 头像：花环＋红蝴蝶结（垫在头像图底下，不挪头像位置） */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;isolation:isolate !important;border-radius:50% !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important;border-radius:50% !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:-22% !important;right:-22% !important;top:-22% !important;bottom:-40% !important;background:${svg(WREATH)} center top/contain no-repeat !important;z-index:0 !important;pointer-events:none !important}
[data-wk="chathead"] button[data-wk="avatar"]::before,[data-wk="chathead"] span[data-wk="avatar"]::before{content:none !important}

/* 我的话：红色雪帽气泡，左下角别一枝冬青 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,#C8423F,${C.red}) !important;color:#fff !important;border:none !important;border-radius:22px 22px 8px 22px !important;box-shadow:0 3px 0 ${C.redD} !important;padding-top:16px !important;margin-top:10px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{content:"" !important;position:absolute !important;left:-3px !important;right:-3px !important;top:-5px !important;height:20px !important;background:${svg(SNOWCAP)} center/100% 100% no-repeat !important;pointer-events:none !important;border:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;left:-12px !important;right:auto !important;bottom:-8px !important;width:32px !important;height:22px !important;background:${svg(HOLLY)} center/contain no-repeat !important;border:none !important;transform:rotate(-12deg) !important}

/* 他的话：一张挂在灯串上的礼物卡——丝带往上吊，卡片轻轻晃，右下角一颗金星 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.cream} !important;color:${C.ink} !important;border:1.5px solid ${C.gold} !important;border-radius:6px 18px 18px 18px !important;box-shadow:0 4px 10px rgba(0,0,0,.25) !important;margin-top:26px !important;transform-origin:30px -26px !important;animation:xmSwing 4.5s ease-in-out infinite !important}
@keyframes xmSwing{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;left:16px !important;top:-31px !important;width:30px !important;height:40px !important;background:${svg(RIBBON)} center top/contain no-repeat !important;border:none !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"" !important;position:absolute !important;right:-8px !important;left:auto !important;bottom:-8px !important;width:18px !important;height:18px !important;background:${svg(STAR())} center/contain no-repeat !important;border:none !important;transform:none !important}
/* 连发：后面几张只用一截短丝带连在上一张底下，像一挂礼物卡 */
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]{margin-top:12px !important;animation:none !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]::before{top:-34px !important;height:34px !important;z-index:-1 !important;width:4px !important;left:29px !important;background:${C.red} !important;border-radius:2px !important}
/* 我连发的第二条起不再顶雪，只第一条有 */
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="1"]{padding-top:10px !important;margin-top:4px !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="1"]::before{display:none !important}

/* 时间：牛皮纸挂签；已读：一颗亮起来的小灯泡 */
[data-wk="time"] > span{background:${svg(TAG)} center/100% 100% no-repeat !important;border:none !important;border-radius:0 !important;padding:4px 16px 4px 24px !important;color:#6B4A2E !important;box-shadow:none !important}
[data-wk="meta"]{color:rgba(255,255,255,.75) !important}
[data-wk="meta"]::before{content:"" !important;display:inline-block !important;width:9px !important;height:13px !important;margin-right:4px !important;vertical-align:-2px !important;background:${svg(BULB("#F2C14E"))} center/contain no-repeat !important;filter:drop-shadow(0 0 3px rgba(242,193,78,.8)) !important}
[data-wk="typingdot"]{width:10px !important;height:14px !important;border-radius:0 !important;background:${svg(BULB("#F2C14E"))} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cream} !important;border:1.5px solid ${C.gold} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
/* 动描、系统字：深底上用奶白小卡片垫着 */
[data-wk="narrink"]{background:rgba(255,248,234,.92) !important;border:1.5px dashed transparent !important;border-radius:14px !important;color:${C.ink} !important;padding:4px 12px !important}
[data-wk="sysnotetext"]{color:rgba(255,255,255,.8) !important}
[data-wk="name"]{color:#fff !important}

/* 底栏：奶白胶囊把加号、输入、礼物、回复全包进去 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important;align-items:center !important;padding-left:16px !important;padding-right:16px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:6px !important;right:6px !important;top:2px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 8px) !important;border-radius:999px !important;background:${C.cream} !important;border:2px solid ${C.gold} !important;box-shadow:0 4px 0 #C9A46A !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="chatinput"]{background:transparent !important;border:none !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#A8957A !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;width:34px !important;height:34px !important;min-width:34px !important;align-self:center !important;margin:0 !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}
[data-wk="time"]{margin-top:26px !important}
[data-wk="chatpanel"]{background:${C.cream} !important;position:relative !important;z-index:3 !important;border-top:2px solid ${C.gold} !important}
/* 雪地小木屋抬到底栏上面露出来 */
[data-wk="chat"]::after{bottom:0 !important;height:calc(env(safe-area-inset-bottom) * .4 + 62px + 150px) !important;background:${svg(SCENE)} center bottom calc(env(safe-area-inset-bottom) * .4 + 60px)/100% auto no-repeat,linear-gradient(${C.snow},${C.snow}) center bottom/100% calc(env(safe-area-inset-bottom) * .4 + 64px) no-repeat !important}
/* 回复键：帽子别顶出胶囊，跟发送键对齐 */
[data-wk="chatreply"]{background-size:88% !important;background-position:center 60% !important;margin-right:4px !important}
/* 他连发的一挂里，已读只留在最后一张底下，不让丝带穿过字 */
[data-wk="msg"][data-me="0"][data-last="0"] [data-wk="meta"]{display:none !important}

/* ───── 圣诞 · 第二批：卡片 ───── */
/* 卡片统一：奶白底、金边、底下一层暖棕影 */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.cream} !important;border:1.8px solid ${C.gold} !important;border-radius:18px !important;box-shadow:0 4px 0 #C9A46A,0 8px 18px rgba(0,0,0,.25) !important;color:${C.ink} !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:rgba(201,164,106,.5) !important}

/* 转账：一份包好的礼物——十字红丝带，收下盖金色火漆，退回盖灰的 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;padding-top:28px !important;background:linear-gradient(90deg,transparent calc(100% - 46px),${C.red} calc(100% - 46px),${C.red} calc(100% - 36px),transparent calc(100% - 36px)),${C.cream} !important}
[data-wk="transfercard"]::before{content:"✦ 圣诞礼单" !important;position:absolute !important;left:16px !important;top:9px !important;font-size:10px !important;letter-spacing:.2em !important;color:${C.red} !important}
[data-wk="transfercard"]::after{content:"" !important;position:absolute !important;right:22px !important;top:-14px !important;width:58px !important;height:30px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 58 30'><path d='M29 22 C18 2 4 6 8 16 C10 22 22 22 29 22 C36 22 48 22 50 16 C54 6 40 2 29 22Z' fill='#D9474A' stroke='${C.redD}' stroke-width='1.6'/><path d='M27 22 L20 30 M31 22 L38 30' stroke='${C.red}' stroke-width='4'/><circle cx='29' cy='22' r='4' fill='${C.redD}'/></svg>`)} center/contain no-repeat !important}
[data-wk="transferlabel"],[data-wk="transfernote"]::before{color:#8C6A3A !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.red} !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:2px !important;background:repeating-linear-gradient(90deg,${C.red} 0 10px,#fff 10px 14px,${C.holly} 14px 24px,#fff 24px 28px) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:#F6EAD0 !important;border-radius:0 0 16px 16px !important}
[data-wk="transfernote"]::before{content:"贺词：" !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.red} !important;color:#fff !important;border:none !important;box-shadow:0 3px 0 ${C.redD} !important}
[data-wk="transferbtn"][data-part="back"]{background:#fff !important;color:${C.holly} !important;border:1.5px solid ${C.holly} !important}
[data-wk="transferseal"]{border:1.8px solid ${C.gold} !important;box-shadow:none !important;color:#8C6A3A !important;background:#fff !important;border-radius:50% !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"],[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:62px !important;height:62px !important;flex-shrink:0 !important;border:none !important;border-radius:0 !important;opacity:1 !important;transform:rotate(-10deg) !important;background:${svg(SEAL())} center/contain no-repeat !important;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25)) !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{background:${svg(SEAL("#C9CFCB", "#8E9893"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{display:none !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.85 !important}

/* 红包：挂一只圣诞袜，袜口露出礼物；领完了袜子空了 */
[data-wk="rpcard"]{background:${C.cream} !important;border:1.8px solid ${C.gold} !important;border-radius:18px !important;box-shadow:0 4px 0 #C9A46A,0 8px 18px rgba(0,0,0,.25) !important;padding-left:86px !important;min-height:96px !important;position:relative !important;overflow:visible !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:14px !important;top:-10px !important;width:60px !important;height:74px !important;background:${svg(STOCKING())} center/contain no-repeat !important;transform-origin:50% 0 !important;animation:xmSwing 3s ease-in-out infinite !important}
[data-wk="rpcard"]::after{content:"圣诞袜" !important;position:absolute !important;left:26px !important;bottom:6px !important;font-size:10px !important;letter-spacing:.2em !important;color:${C.red} !important}
[data-wk="rpflap"],[data-wk="rpseal"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{background:#F3EDE0 !important;filter:none !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(STOCKING("#C9A0A0", false))} center/contain no-repeat !important;animation:none !important}
[data-wk="rpcard"][data-status="done"]::after{content:"掏空啦" !important}
[data-wk="rpenvelope"][data-stage="closed"]{background:${svg(SNOWTILE)} 0 0/180px 180px,linear-gradient(180deg,#C8423F,${C.redD}) !important;border:2px solid ${C.gold} !important;border-radius:28px !important;box-shadow:0 10px 30px rgba(0,0,0,.35) !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rparc"]{background:${C.pine} !important;border-top:2px solid ${C.gold} !important}
[data-wk="rpenvelope"][data-stage="closed"] *{color:#FFF1D6 !important}
[data-wk="rpopenbtn"]{background:${C.cream} ${svg(BELL)} center/60% no-repeat !important;border:2.5px solid ${C.gold} !important;box-shadow:0 4px 0 #B88A33 !important;animation:xmSwing 1.6s ease-in-out infinite !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(SNOWTILE)} 0 0/180px 180px,linear-gradient(180deg,${C.pine},#16302A) !important;border:2px solid ${C.gold} !important;border-radius:28px !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"][data-part="top"]{background:${C.red} !important;border-bottom:2px solid ${C.gold} !important;box-shadow:none !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"][data-part="top"]::after{content:none !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:#FFF1D6 !important}
[data-wk="rpavatar"]{box-shadow:0 0 0 3px ${C.cream},0 0 0 5px ${C.gold} !important;border-radius:50% !important}
[data-wk="rpamount"]{color:${C.gold} !important;background:none !important}
[data-wk="rpclose"]{background:${C.cream} !important;border:2px solid ${C.gold} !important;color:${C.red} !important}

/* 照片：拍立得，右上角别一枝冬青 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;padding:8px 8px 22px !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;right:-10px !important;top:-10px !important;width:40px !important;height:28px !important;background:${svg(HOLLY)} center/contain no-repeat !important;transform:rotate(20deg) !important}
[data-wk="photoface"]{background:${svg(SNOWTILE)} 0 0/120px 120px,${C.pine} !important;border-radius:10px !important;border:none !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:#FFF1D6 !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}
/* 语音：前面一颗会晃的金铃铛 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"]{padding-left:40px !important;position:relative !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:22px !important;height:22px !important;margin-top:-12px !important;background:${svg(BELL)} center/contain no-repeat !important;transform-origin:50% 0 !important;animation:xmSwing 1.4s ease-in-out infinite !important;z-index:2 !important}
[data-wk="voicewave"] span{background:${C.red} !important}
/* 天气 */
[data-wk="wxcardsky"]{background:${svg(SNOWTILE)} 0 0/120px 120px,linear-gradient(170deg,${C.pine2},${C.pine}) !important}
[data-wk="wxcardsky"] *{color:#FFF1D6 !important}
[data-wk="wxcardsky"] svg{stroke:${C.gold} !important}
[data-wk="wxcardsay"]{background:${C.cream} !important;color:${C.ink} !important;border-top:1.5px solid ${C.gold} !important}
/* 位置：一颗金星钉着 */
[data-wk="geopin"]{background:${svg(STAR())} center/contain no-repeat !important;box-shadow:0 0 8px rgba(232,184,90,.8) !important;border:none !important;width:24px !important;height:24px !important;border-radius:0 !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.gold} !important}
/* 名片 */
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px ${C.cream},0 0 0 4px ${C.holly} !important}

/* 拍一拍：冬青小胶囊；通话结束胶囊同款 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${C.cream} ${svg(HOLLY)} 8px center/20px 14px no-repeat !important;border:1.5px solid ${C.gold} !important;border-radius:999px !important;padding:3px 14px 3px 32px !important;color:${C.ink} !important;box-shadow:0 2px 0 #C9A46A !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.red} !important}
[data-wk="note"][data-part="callsum"]{color:rgba(255,255,255,.8) !important}
/* 系统提示：前面一朵雪花 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:rgba(0,0,0,.25) !important;border-radius:12px !important;padding:2px 10px !important;-webkit-box-decoration-break:clone !important;box-decoration-break:clone !important;line-height:2 !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:12px !important;height:12px !important;margin-right:6px !important;vertical-align:-1px !important;background:${svg(FLAKE(1))} center/contain no-repeat !important}
[data-wk="sysnoteclose"]{color:rgba(255,255,255,.7) !important}

/* 线下小结：一张圣诞明信片——右上角贴邮票、盖一圈邮戳，标题是红丝带 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:26px !important;padding-right:64px !important;background:repeating-linear-gradient(180deg,transparent 0 27px,rgba(201,164,106,.25) 27px 28px),${C.cream} !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;right:12px !important;top:12px !important;width:40px !important;height:48px !important;background:${svg(STAMP)} center/contain no-repeat !important;transform:rotate(4deg) !important}
[data-part="offlog"]::after{content:"" !important;position:absolute !important;right:4px !important;top:40px !important;width:34px !important;height:34px !important;border:1.6px solid rgba(181,56,58,.55) !important;border-radius:50% !important;pointer-events:none !important}
[data-wk="offlogtitle"]{display:inline-block !important;position:absolute !important;top:-13px !important;left:16px !important;margin:0 !important;padding:4px 18px !important;background:${C.red} !important;color:#fff !important;border-radius:4px !important;letter-spacing:.12em !important;clip-path:polygon(0 0,100% 0,calc(100% - 8px) 50%,100% 100%,0 100%,8px 50%) !important}
[data-wk="offlogtitle"] *{color:#fff !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.red} !important}
[data-wk="offlogtranscript"]{border-top:1.5px solid rgba(201,164,106,.6) !important;color:#8C6A3A !important}

/* 加号面板：一排排挂在树上的彩球 */
[data-wk="chattoolicon"]{background:radial-gradient(circle at 35% 30%,#fff,${C.cream} 60%) !important;border:2px solid ${C.gold} !important;border-radius:50% !important;box-shadow:0 3px 0 #C9A46A !important;position:relative !important}
[data-wk="chattoolicon"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-7px !important;width:10px !important;height:8px !important;margin-left:-5px !important;background:${C.gold} !important;border-radius:2px 2px 0 0 !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.red} !important;color:${C.red} !important}
[data-wk="chattoollabel"]{color:${C.ink} !important}

/* 引用三处：待发送那条＝一张挂签；气泡上方＝小牛皮纸条；气泡里＝左边一条红绿丝带 */
[data-wk="quotedraft"]{background:${C.cream} !important;border:1.5px solid ${C.gold} !important;border-radius:14px !important;position:relative !important;padding-left:34px !important}
[data-wk="quotedraft"]::before{content:"" !important;position:absolute !important;left:8px !important;top:50% !important;width:20px !important;height:20px !important;margin-top:-10px !important;background:${svg(BELL)} center/contain no-repeat !important}
[data-wk="quotedraft"] *{background:transparent !important;color:${C.ink} !important;border:none !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.red} !important}
[data-wk="quote"]{background:#F7E7C6 !important;color:#6B4A2E !important;border:1px solid #C9A46A !important;border-radius:8px !important;padding:3px 10px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:3px solid transparent !important;border-image:linear-gradient(${C.red} 0 50%,${C.holly} 50% 100%) 1 !important;padding-left:8px !important;opacity:.9 !important}
[data-wk="offlogtext"]{padding-right:50px !important}
`;

const pack = { kind: "chat-look", v: 1, name: "圣诞", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "圣诞-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
