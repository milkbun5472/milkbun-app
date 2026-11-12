// 雨天窗边：傍晚下雨的窗外——深蓝到紫粉的天，彩色光斑，窗台上一只杯子一盆草。
// 顶栏是一块起雾的窗玻璃，下沿往下淌水痕、雨滴会掉下去；顶栏头像撑一把小伞；我的话＝一块会淌水珠的渐变玻璃；
// 他的话＝从小云朵底下吊下来的一张奶白卡；底栏是一只悬浮的磨砂玻璃胶囊。用法：node themes/rainy-window/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { night: "#1B2552", dusk: "#3B3F8C", vio: "#7A5FC0", rose: "#E59AC4", glass: "#9EC8FF", glass2: "#C8B2FF", cream: "#FFFBF4", ink: "#34406A", fog: "#C9D3F2", drop: "#8FC2FF", yel: "#FFD86B", pink: "#FF9EC8" };

const RAIN = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160'><g stroke='#CFE3FF' stroke-linecap='round'><path d='M14 6 l-6 28' stroke-width='1.4' opacity='.7'/><path d='M70 40 l-3 14' stroke-width='.9' opacity='.45'/><path d='M104 86 l-6 28' stroke-width='1.4' opacity='.65'/><path d='M40 100 l-3 13' stroke-width='.9' opacity='.4'/><path d='M60 140 l-2 10' stroke-width='.8' opacity='.4'/><path d='M96 10 l-2 9' stroke-width='.8' opacity='.35'/></g></svg>`;
const g = (i, c) => `<radialGradient id='${i}'><stop offset='0' stop-color='${c}' stop-opacity='.9'/><stop offset='.5' stop-color='${c}' stop-opacity='.35'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient>`;
const BOKEH = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='520'><defs>${g("p", "#FF9EC8")}${g("y", "#FFD86B")}${g("v", "#B79CFF")}${g("b", "#7FC4FF")}</defs><circle cx='40' cy='80' r='46' fill='url(#p)'/><circle cx='340' cy='150' r='56' fill='url(#y)'/><circle cx='260' cy='330' r='40' fill='url(#v)'/><circle cx='70' cy='380' r='36' fill='url(#b)'/><circle cx='200' cy='40' r='24' fill='url(#v)'/><circle cx='360' cy='470' r='26' fill='url(#p)'/><circle cx='150' cy='250' r='14' fill='url(#y)'/></svg>`;
// 窗外：远处一排亮着灯的楼，近处一条窗台，上面一只冒热气的杯子和一盆小草
const SCENE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 170'><path d='M0 120 V70 H30 V55 H58 V82 H80 V40 H112 V90 H140 V62 H170 V96 H200 V50 H236 V80 H262 V58 H290 V92 H318 V44 H350 V76 H390 V120Z' fill='#2A2F6E' opacity='.85'/><g fill='#FFD86B' opacity='.8'><rect x='88' y='50' width='5' height='6'/><rect x='100' y='64' width='5' height='6'/><rect x='88' y='76' width='5' height='6'/><rect x='210' y='60' width='5' height='6'/><rect x='222' y='72' width='5' height='6'/><rect x='326' y='54' width='5' height='6'/><rect x='338' y='66' width='5' height='6'/><rect x='38' y='66' width='5' height='6'/><rect x='150' y='72' width='5' height='6'/><rect x='270' y='68' width='5' height='6'/></g><g fill='#FF9EC8' opacity='.7'><rect x='100' y='52' width='5' height='6'/><rect x='326' y='78' width='5' height='6'/><rect x='48' y='90' width='5' height='6'/></g><rect x='0' y='132' width='390' height='38' fill='#E9D3C2'/><rect x='0' y='126' width='390' height='10' rx='3' fill='#F6E6D8'/><path d='M44 126 V104 Q44 100 48 100 H72 Q76 100 76 104 V126Z' fill='#FFFBF4' stroke='#B79CFF' stroke-width='2'/><path d='M76 106 Q86 108 84 116 Q82 122 76 120' fill='none' stroke='#B79CFF' stroke-width='2'/><path d='M54 94 Q50 88 55 82 M64 94 Q60 86 66 80' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' opacity='.8'/><path d='M318 126 L322 106 H350 L354 126Z' fill='#FF9EC8'/><path d='M336 106 Q328 88 318 84 M336 106 Q338 84 346 76 M336 106 Q346 94 358 92' fill='none' stroke='#6CC59A' stroke-width='3' stroke-linecap='round'/><circle cx='318' cy='84' r='4' fill='#6CC59A'/><circle cx='346' cy='76' r='4' fill='#6CC59A'/><circle cx='358' cy='92' r='4' fill='#6CC59A'/></svg>`;
// 顶栏下：一排小云，云底吊着雨滴
const DRIPEDGE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 40' preserveAspectRatio='none'><defs><linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ECE8FF' stop-opacity='.92'/><stop offset='1' stop-color='#C9DCFF' stop-opacity='.8'/></linearGradient><linearGradient id='d' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#DDEBFF'/><stop offset='1' stop-color='#9EC8FF'/></linearGradient></defs><path d='M0 0 H390 V9 Q375 13 360 9 Q345 5 330 9 Q315 13 300 9 Q285 5 270 9 Q255 13 240 9 Q225 5 210 9 Q195 13 180 9 Q165 5 150 9 Q135 13 120 9 Q105 5 90 9 Q75 13 60 9 Q45 5 30 9 Q15 13 0 9Z' fill='url(#w)'/><path d='M0 9 Q15 13 30 9 Q45 5 60 9 Q75 13 90 9 Q105 5 120 9 Q135 13 150 9 Q165 5 180 9 Q195 13 210 9 Q225 5 240 9 Q255 13 270 9 Q285 5 300 9 Q315 13 330 9 Q345 5 360 9 Q375 13 390 9' fill='none' stroke='#fff' stroke-width='1.2' opacity='.8'/><path d='M23 8 Q24 17 30 17 Q36 17 37 8Z' fill='url(#w)'/><circle cx='30' cy='26' r='3.2' fill='url(#d)' stroke='#fff' stroke-width='.9'/><circle cx='29' cy='25' r='.9' fill='#fff'/><path d='M88 8 Q89 21 95 21 Q101 21 102 8Z' fill='url(#w)'/><circle cx='95' cy='30' r='3.2' fill='url(#d)' stroke='#fff' stroke-width='.9'/><circle cx='94' cy='29' r='.9' fill='#fff'/><path d='M153 8 Q154 16 160 16 Q166 16 167 8Z' fill='url(#w)'/><circle cx='160' cy='25' r='3.2' fill='url(#d)' stroke='#fff' stroke-width='.9'/><circle cx='159' cy='24' r='.9' fill='#fff'/><path d='M215 8 Q216 22 222 22 Q228 22 229 8Z' fill='url(#w)'/><circle cx='222' cy='31' r='3.2' fill='url(#d)' stroke='#fff' stroke-width='.9'/><circle cx='221' cy='30' r='.9' fill='#fff'/><path d='M283 8 Q284 17 290 17 Q296 17 297 8Z' fill='url(#w)'/><circle cx='290' cy='26' r='3.2' fill='url(#d)' stroke='#fff' stroke-width='.9'/><circle cx='289' cy='25' r='.9' fill='#fff'/><path d='M345 8 Q346 20 352 20 Q358 20 359 8Z' fill='url(#w)'/><circle cx='352' cy='29' r='3.2' fill='url(#d)' stroke='#fff' stroke-width='.9'/><circle cx='351' cy='28' r='.9' fill='#fff'/></svg>`;
const FALL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 20'>${[[95,'#8FC2FF'],[222,'#FF9EC8'],[352,'#B79CFF']].map(([x,c])=>`<path d='M${x} 2 q-4 8 0 11 q4 -3 0 -11Z' fill='${c}' stroke='#fff' stroke-width='1'/>`).join('')}</svg>`;
const UMB = (c1 = C.pink, c2 = "#fff") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 34'><path d='M3 16 A17 14 0 0 1 37 16 Q31.5 12.5 26 16 Q20 12.5 14 16 Q8.5 12.5 3 16Z' fill='${c1}' stroke='#fff' stroke-width='1.6' stroke-linejoin='round'/><path d='M20 3 V16 M14 16 Q16 8 20 3 Q24 8 26 16' fill='none' stroke='${c2}' stroke-width='1.1' opacity='.8'/><path d='M20 16 V28 Q20 31 17 31 Q14.5 31 14.5 28.5' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round'/><circle cx='20' cy='2.5' r='1.6' fill='#fff'/></svg>`;
const DROP = (f = C.drop) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 26'><path d='M10 1.5 C10 1.5 2.5 11 2.5 16.5 A7.5 7.5 0 0 0 17.5 16.5 C17.5 11 10 1.5 10 1.5Z' fill='${f}' stroke='#fff' stroke-width='1.4'/><path d='M6.5 16 A3.5 3.5 0 0 0 9 19.5' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const DROPS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 26'><circle cx='10' cy='10' r='6.5' fill='rgba(255,255,255,.55)' stroke='#fff' stroke-width='1.3'/><circle cx='8' cy='8' r='1.8' fill='#fff'/><circle cx='25' cy='17' r='4.2' fill='rgba(255,255,255,.55)' stroke='#fff' stroke-width='1.2'/><circle cx='29' cy='5' r='2.4' fill='rgba(255,255,255,.6)' stroke='#fff' stroke-width='1'/></svg>`;
const CLOUDTAG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 46 30'><path d='M6 24 a8 8 0 0 1 3-15 a12 12 0 0 1 22-2 a9 9 0 0 1 9 17 Z' fill='#fff' stroke='#B79CFF' stroke-width='1.6' stroke-linejoin='round'/><circle cx='17' cy='17' r='1.6' fill='${C.ink}'/><circle cx='28' cy='17' r='1.6' fill='${C.ink}'/><path d='M20.5 20 q2 2 4 0' fill='none' stroke='${C.ink}' stroke-width='1.3' stroke-linecap='round'/><circle cx='13' cy='20' r='2' fill='#FFB8D6' opacity='.8'/><circle cx='32' cy='20' r='2' fill='#FFB8D6' opacity='.8'/></svg>`;
const TIMEC = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 34'><rect x='8' y='9' width='144' height='23' rx='11.5' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><circle cx='22' cy='12' r='8' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><circle cx='34' cy='9' r='7' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><circle cx='136' cy='11' r='8' fill='#fff' stroke='#C8B2FF' stroke-width='1.4'/><rect x='14' y='12' width='132' height='18' rx='9' fill='#fff'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='#8FC2FF' stroke='#fff' stroke-width='2.4'/><path d='M20 12 V28 M12 20 H28' stroke='#fff' stroke-width='3' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><path d='M20 3 C20 3 7 18 7 26 A13 13 0 0 0 33 26 C33 18 20 3 20 3Z' fill='${C.pink}' stroke='#fff' stroke-width='2.4' stroke-linejoin='round'/><path d='M20 31 C14 27 13.5 24.5 13.5 23 C13.5 21 15 20 16.6 20 C18 20 19.3 20.9 20 22 C20.7 20.9 22 20 23.4 20 C25 20 26.5 21 26.5 23 C26.5 24.5 26 27 20 31Z' fill='#fff'/><path d='M12 22 Q12.5 17 15.5 13' fill='none' stroke='#fff' stroke-width='1.8' stroke-linecap='round' opacity='.7'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 40'><path d='M8 30 a9 9 0 0 1 2-17 a12 12 0 0 1 22-3 a10 10 0 0 1 6 19 Z' fill='#fff' stroke='#B79CFF' stroke-width='2.2' stroke-linejoin='round'/><circle cx='16' cy='21' r='2' fill='#B79CFF'/><circle cx='23' cy='21' r='2' fill='#B79CFF'/><circle cx='30' cy='21' r='2' fill='#B79CFF'/><path d='M14 32 q-1 4 -4 6' fill='none' stroke='#8FC2FF' stroke-width='2' stroke-linecap='round'/><path d='M26 32 q-1 3 -2 5' fill='none' stroke='#8FC2FF' stroke-width='2' stroke-linecap='round'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='#fff' stroke='#C8B2FF' stroke-width='1.8'/><path d='M11 20 L20 12 L29 20 V29 H11Z' fill='#FF9EC8' stroke='#fff' stroke-width='1.8' stroke-linejoin='round'/><rect x='17.5' y='22' width='5' height='7' fill='#fff'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 36'><path d='M10 22 a8 8 0 0 1 3-14 a12 12 0 0 1 22-1 a9 9 0 0 1 9 15 Z' fill='#fff' stroke='#9EC8FF' stroke-width='1.4'/><path d='M38 22 a6 6 0 0 1 2-10 a8 8 0 0 1 14 0 a6 6 0 0 1 2 10 Z' fill='#C8B2FF'/>${["#8FC2FF", "#FF9EC8", "#FFD86B"].map((c, i) => `<path d='M${16 + i * 9} 26 q-3 5 0 7 q3 -2 0 -7Z' fill='${c}'/>`).join("")}</svg>`;

// ── 第二批用的图 ──
const LID = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 30'><rect x='14' y='4' width='92' height='18' rx='5' fill='#FF9EC8' stroke='#fff' stroke-width='2'/><path d='M20 8 H100 M20 13 H100 M20 18 H100' stroke='#fff' stroke-width='1' opacity='.6'/><rect x='8' y='20' width='104' height='8' rx='4' fill='#E57FAF' stroke='#fff' stroke-width='1.6'/></svg>`;
const BOAT = (sail = "#fff", hull = "#FFFBF4", edge = "#B79CFF") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 120'><path d='M78 10 V74' stroke='${edge}' stroke-width='2'/><path d='M80 12 L124 70 H80Z' fill='${sail}' stroke='${edge}' stroke-width='2' stroke-linejoin='round'/><path d='M76 26 L44 70 H76Z' fill='#FFD9EA' stroke='${edge}' stroke-width='2' stroke-linejoin='round'/><path d='M8 74 H152 L128 104 H32Z' fill='${hull}' stroke='${edge}' stroke-width='2.4' stroke-linejoin='round'/><path d='M8 74 L40 88 L80 74 L120 88 L152 74' fill='none' stroke='${edge}' stroke-width='1.6' stroke-linejoin='round'/><path d='M0 112 Q20 104 40 112 T80 112 T120 112 T160 112' fill='none' stroke='#8FC2FF' stroke-width='3' stroke-linecap='round'/></svg>`;
const TAPE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 20'><path d='M2 3 L58 1 L56 9 L58 17 L3 19 L5 11Z' fill='rgba(255,158,200,.75)'/><path d='M8 5 V15 M16 5 V15 M24 4 V16 M32 4 V16 M40 4 V16 M48 4 V16' stroke='#fff' stroke-width='1.2' opacity='.5'/></svg>`;
const RIPPLE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><path d='M15 3 q-5 8 0 11 q5 -3 0 -11Z' fill='#8FC2FF' stroke='#fff' stroke-width='1'/><ellipse cx='15' cy='22' rx='6' ry='2.4' fill='none' stroke='#8FC2FF' stroke-width='1.6'/><ellipse cx='15' cy='22' rx='12' ry='5' fill='none' stroke='#B79CFF' stroke-width='1.2' opacity='.7'/></svg>`;
const UPIN = UMB("#FF9EC8");

// ── 第三批用的图 ──
const CURTAIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 64'><path d='M40.0 6 L67.5 6 L37.5 38 L0.0 38Z' fill='#FF9EC8'/><path d='M67.5 6 L95.0 6 L75.0 38 L37.5 38Z' fill='#FFFFFF'/><path d='M95.0 6 L122.5 6 L112.5 38 L75.0 38Z' fill='#FF9EC8'/><path d='M122.5 6 L150.0 6 L150.0 38 L112.5 38Z' fill='#FFFFFF'/><path d='M150.0 6 L177.5 6 L187.5 38 L150.0 38Z' fill='#FF9EC8'/><path d='M177.5 6 L205.0 6 L225.0 38 L187.5 38Z' fill='#FFFFFF'/><path d='M205.0 6 L232.5 6 L262.5 38 L225.0 38Z' fill='#FF9EC8'/><path d='M232.5 6 L260.0 6 L300.0 38 L262.5 38Z' fill='#FFFFFF'/><path d='M40 6 H260 L300 38 H0Z' fill='none' stroke='#E57FAF' stroke-width='1.6' stroke-linejoin='round'/><rect x='34' y='1' width='232' height='7' rx='3.5' fill='#E9D3C2' stroke='#fff' stroke-width='1'/><path d='M0.0 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FF9EC8' stroke='#E57FAF' stroke-width='1.2'/><path d='M18.75 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/><path d='M37.5 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FFFFFF' stroke='#E57FAF' stroke-width='1.2'/><path d='M56.25 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/><path d='M75.0 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FF9EC8' stroke='#E57FAF' stroke-width='1.2'/><path d='M93.75 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/><path d='M112.5 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FFFFFF' stroke='#E57FAF' stroke-width='1.2'/><path d='M131.25 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/><path d='M150.0 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FF9EC8' stroke='#E57FAF' stroke-width='1.2'/><path d='M168.75 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/><path d='M187.5 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FFFFFF' stroke='#E57FAF' stroke-width='1.2'/><path d='M206.25 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/><path d='M225.0 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FF9EC8' stroke='#E57FAF' stroke-width='1.2'/><path d='M243.75 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/><path d='M262.5 38 a18.75 15.625 0 0 0 37.5 0Z' fill='#FFFFFF' stroke='#E57FAF' stroke-width='1.2'/><path d='M281.25 55.625 q-2.5 4.5 0 6 q2.5 -1.5 0 -6Z' fill='#9EC8FF' stroke='#fff' stroke-width='.7'/></svg>`;
const DROPMASK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 180'>${[0,1,2,3,4].map(i=>`<path transform='translate(0 ${i*36}) rotate(-90 18 18)' d='M18 3 C18 3 7 16 7 23 A11 11 0 0 0 29 23 C29 16 18 3 18 3Z'/>`).join("")}</svg>`;

// 玻璃上的水：一颗颗水珠往下淌（不拖水痕），另有几颗静止的小凝珠
const GLASS = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='760'>${[[40,60,70],[120,300,110],[205,140,60],[290,420,90],[350,80,130],[70,520,80],[240,620,70],[170,470,50]].map(([x,y,l])=>`<ellipse cx='${x}' cy='${y+3}' rx='4.2' ry='5.2' fill='rgba(220,235,255,.5)' stroke='rgba(255,255,255,.75)' stroke-width='1'/><circle cx='${x-1.4}' cy='${y+1.5}' r='1.3' fill='#fff'/>`).join('')}</svg>`;
const BEADS = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='260'>${[[20,30,2],[90,12,1.4],[150,60,2.4],[60,110,1.6],[180,150,1.8],[30,200,2.2],[120,230,1.3],[100,170,2]].map(([x,y,r])=>`<circle cx='${x}' cy='${y}' r='${r}' fill='rgba(220,235,255,.45)' stroke='rgba(255,255,255,.6)' stroke-width='.6'/>`).join('')}</svg>`;

// ── 第四批用的图 ──
const OFFWIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 230'><defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#5B4C8C'/><stop offset='.6' stop-color='#B07AA8'/><stop offset='1' stop-color='#F2A99B'/></linearGradient></defs><path d='M70 226 V90 A125 80 0 0 1 320 90 V226Z' fill='url(#s)' stroke='#fff' stroke-width='10'/><path d='M195 12 V226 M70 128 H320' stroke='#fff' stroke-width='7'/><g stroke='#CFE3FF' stroke-linecap='round' opacity='.7'><path d='M100 60 l-4 18 M150 40 l-4 16 M240 50 l-4 18 M290 90 l-4 16 M110 150 l-4 18 M170 170 l-4 16 M230 150 l-4 18 M280 180 l-4 16 M130 100 l-3 12 M260 120 l-3 12'/></g><circle cx='120' cy='196' r='14' fill='#FFD86B' opacity='.45'/><circle cx='270' cy='176' r='18' fill='#FF9EC8' opacity='.4'/><rect x='54' y='220' width='282' height='12' rx='4' fill='#E9D3C2'/><path d='M60 6 H130 Q112 60 118 226 H60Z' fill='#FFB8D6' stroke='#fff' stroke-width='3' opacity='.95'/><path d='M330 6 H260 Q278 60 272 226 H330Z' fill='#FFB8D6' stroke='#fff' stroke-width='3' opacity='.95'/><rect x='48' y='0' width='294' height='9' rx='4' fill='#E9D3C2'/></svg>`;

const CUPMASK = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 54 66'><path d='M4 4 H50 L44 60 Q43.5 63 40 63 H14 Q10.5 63 10 60Z'/></svg>`;
const bubble = { myBg: C.glass, myText: C.ink, myBorder: "none", charBg: C.cream, charText: C.ink, charBorder: "none", radius: 18, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 雨天窗边 · 第一批 ───── */
[data-wk="chat"]{background:${svg(BOKEH)} 0 0/390px 520px repeat,linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important;position:relative !important}
/* 雨丝往下落 */
/* 斜雨：一层贴着屏幕的小层（不跟聊天内容一样高），整层顺着雨丝斜度往左下滑，一圈 2.4 秒接缝对上 */
[data-wk="body"]::after{content:"" !important;position:fixed !important;left:0 !important;top:-480px !important;width:calc(100vw + 120px) !important;height:calc(100vh + 480px) !important;background:${svg(RAIN)} 0 0/120px 160px repeat,${svg(RAIN)} 60px 80px/120px 160px repeat !important;pointer-events:none !important;z-index:-1 !important;animation:rwRain 2.4s linear infinite !important}
@keyframes rwRain{0%{transform:translate(0,0)}100%{transform:translate(-120px,480px)}}
/* 玻璃上：凝珠不动，水珠拖着水痕慢慢往下淌 */
[data-wk="body"]::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:-760px !important;height:calc(100vh + 760px) !important;background:${svg(GLASS)} 0 0/390px 760px repeat !important;pointer-events:none !important;z-index:-1 !important;animation:rwTrickle 16s linear infinite !important}
@keyframes rwTrickle{0%{transform:translate(0,0)}100%{transform:translate(0,760px)}}
[data-wk="chat"]{background-image:${svg(BEADS)},${svg(BOKEH)},linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important;background-size:200px 260px,390px 520px,auto !important;background-repeat:repeat,repeat,no-repeat !important}
/* 窗外楼群＋窗台（抬到底栏上面露出来） */
[data-wk="chat"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:0 !important;height:calc(env(safe-area-inset-bottom) * .4 + 62px + 150px) !important;background:${svg(SCENE)} center bottom calc(env(safe-area-inset-bottom) * .4 + 30px)/100% auto no-repeat,linear-gradient(#E9D3C2,#E9D3C2) center bottom/100% calc(env(safe-area-inset-bottom) * .4 + 34px) no-repeat !important;pointer-events:none !important;z-index:0 !important}
[data-wk="body"]{background:transparent !important;position:relative !important;z-index:1 !important;padding-top:40px !important}

/* 顶栏：一块起了雾的窗玻璃（淡紫磨砂），下沿是长短不一往下淌的水痕，水痕尖上的雨滴隔一会儿掉下去 */
[data-wk="chathead"]{background:linear-gradient(180deg,rgba(236,232,255,.82),rgba(236,232,255,.9)) !important;backdrop-filter:blur(10px) !important;-webkit-backdrop-filter:blur(10px) !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% - 9px) !important;height:40px !important;background:${svg(DRIPEDGE)} center top/100% 100% no-repeat !important;pointer-events:none !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% + 22px) !important;height:20px !important;background:${svg(FALL)} center top/100% 100% no-repeat !important;pointer-events:none !important;z-index:6 !important;animation:rwFall 3.2s ease-in infinite !important}
@keyframes rwFall{0%,30%{transform:translateY(0);opacity:0}40%{opacity:1}100%{transform:translateY(160px);opacity:0}}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:28px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headdim"]{color:#7E78A8 !important;white-space:nowrap !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.ink} !important}
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
[data-wk="time"]{display:flex !important;justify-content:center !important}
[data-wk="time"] > span{display:inline-flex !important;justify-content:center !important;align-items:center !important;text-align:center !important;min-width:150px !important;background:${svg(TIMEC)} center/100% 100% no-repeat !important;border:none !important;border-radius:0 !important;padding:7px 22px 5px !important;color:${C.ink} !important;font-weight:600 !important;letter-spacing:.08em !important;box-shadow:none !important}
/* 已读：前面一颗小水滴 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important}
[data-wk="meta"][data-read="1"]::before{content:"" !important;display:inline-block !important;width:9px !important;height:12px !important;margin-right:4px !important;vertical-align:-2px !important;background:${svg(DROP())} center/contain no-repeat !important;filter:drop-shadow(0 0 3px rgba(143,194,255,.9)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:8px 22px 22px 22px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{width:8px !important;height:11px !important;border-radius:0 !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="name"]{color:#fff !important}

/* 动描：像用手指写在起雾玻璃上——磨砂透明一条，白色斜体字，左边一道往下淌的水痕 */
/* 动描：一块挂在雨里的雾玻璃——上沿一根细绳吊着两颗小云扣，中间一道指尖擦亮的斜痕，字写在擦亮的地方，右下角凝着一颗要掉的水珠 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important;position:relative !important;overflow:visible !important;padding-top:14px !important}
[data-wk="narrink"]{position:relative !important;overflow:visible !important;display:block !important;background:linear-gradient(115deg,transparent 0 18%,rgba(255,255,255,.22) 18% 30%,transparent 30% 100%),linear-gradient(160deg,rgba(255,236,246,.42),rgba(214,200,255,.28) 55%,rgba(255,214,190,.3)) !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important;border:1.5px solid rgba(255,255,255,.75) !important;border-radius:18px !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 6px 16px rgba(91,76,140,.28) !important;color:#fff !important;font-style:italic !important;font-size:13px !important;line-height:1.75 !important;letter-spacing:.03em !important;text-shadow:0 1px 6px rgba(91,76,140,.55) !important;padding:12px 18px 12px 18px !important}
[data-wk="narrink"]::before{content:"" !important;position:absolute !important;left:22px !important;right:22px !important;top:-15px !important;height:16px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 16' preserveAspectRatio='none'><path d='M6 8 Q100 -2 194 8' fill='none' stroke='#fff' stroke-width='1.2' opacity='.85' vector-effect='non-scaling-stroke'/></svg>`)} center/100% 100% no-repeat,${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 18'><path d='M5 16 a4.5 4.5 0 0 1 1.5-8.5 a6.5 6.5 0 0 1 12-1.5 a5 5 0 0 1 3 10Z' fill='#fff' stroke='#C8B2FF' stroke-width='1.2'/></svg>`)} left top/22px 16px no-repeat,${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 18'><path d='M5 16 a4.5 4.5 0 0 1 1.5-8.5 a6.5 6.5 0 0 1 12-1.5 a5 5 0 0 1 3 10Z' fill='#fff' stroke='#C8B2FF' stroke-width='1.2'/></svg>`)} right top/22px 16px no-repeat !important;pointer-events:none !important}
[data-wk="narrink"]::after{content:"" !important;position:absolute !important;right:16px !important;bottom:-9px !important;width:9px !important;height:12px !important;background:${svg(DROP("rgba(220,235,255,.9)"))} center/contain no-repeat !important;animation:rwDrip 3.6s ease-in infinite !important}
@keyframes rwDrip{0%,55%{transform:translateY(0) scale(.6);opacity:0}65%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(26px) scale(1);opacity:0}}
/* 系统提示：不带框的一行小字，前面一把小伞 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11.5px !important;font-style:normal !important;letter-spacing:.06em !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:14px !important;height:14px !important;margin-right:5px !important;vertical-align:-2px !important;background:${svg(UMB("#FF9EC8"))} center/contain no-repeat !important}

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
[data-wk="chatpanel"]{background:rgba(91,76,140,.94) !important;position:relative !important;z-index:3 !important;border-top:1.5px solid rgba(200,178,255,.5) !important}
/* ───── 雨天窗边 · 第二批：卡片 ───── */
/* 卡片统一：奶白底、淡紫描边、底下一层紫影 */
[data-wk="photocard"],[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:20px !important;box-shadow:0 4px 0 rgba(183,156,255,.55),0 8px 18px rgba(20,28,68,.35) !important;color:${C.ink} !important}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:rgba(183,156,255,.45) !important}

/* 转账＝一只「存雨罐」：玻璃罐、粉盖子，金额浮在罐里；收下罐里涨满蓝水、冒一颗星；退回罐子空了起一层雾 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;width:220px !important;margin-top:20px !important;padding-top:20px !important;background:linear-gradient(100deg,rgba(255,255,255,.65) 0 10%,transparent 10% 16%,rgba(255,255,255,.3) 16% 19%,transparent 19%),linear-gradient(180deg,rgba(236,232,255,.9),rgba(200,220,255,.85)) !important;border:2.5px solid #fff !important;border-radius:26px 26px 30px 30px !important;box-shadow:0 0 0 1.5px #9EC8FF,0 8px 18px rgba(20,28,68,.4) !important;color:${C.ink} !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:12% !important;right:12% !important;top:-22px !important;height:28px !important;background:${svg(LID)} center/100% 100% no-repeat !important;z-index:2 !important}
[data-wk="transfercard"]::after{content:"存雨罐" !important;position:absolute !important;right:14px !important;top:12px !important;font-size:10px !important;letter-spacing:.2em !important;color:#9A92C4 !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:rgba(183,156,255,.4) !important}
[data-wk="transferlabel"]{color:#7E78A8 !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:#5B6FD8 !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:2px !important;background:repeating-linear-gradient(90deg,#9EC8FF 0 6px,transparent 6px 10px) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:transparent !important;border-radius:0 0 28px 28px !important;overflow:hidden !important}
[data-wk="transfernote"]::before{content:"" !important;display:inline-block !important;width:13px !important;height:13px !important;margin-right:5px !important;vertical-align:-2px !important;background:${svg(UMB("#FF9EC8"))} center/contain no-repeat !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:linear-gradient(135deg,#7FB0FF,#B79CFF) !important;color:#fff !important;border:none !important;box-shadow:0 3px 0 #7E6CD0 !important}
[data-wk="transferbtn"][data-part="back"]{background:#fff !important;color:#7E78A8 !important;border:1.5px solid #C8B2FF !important}
[data-wk="transferseal"]{background:#fff !important;border:1.5px solid #C8B2FF !important;color:#7E78A8 !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"]{background:linear-gradient(100deg,rgba(255,255,255,.6) 0 10%,transparent 10% 16%,rgba(255,255,255,.3) 16% 19%,transparent 19%),linear-gradient(180deg,rgba(236,232,255,.9) 0 30%,#BFDBFF 30% 33%,#9EC8FF 33%,#8FB5FF) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{width:46px !important;height:46px !important;flex-shrink:0 !important;border:none !important;border-radius:0 !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4Z' fill='${C.yel}' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/></svg>`)} center/contain no-repeat !important;filter:drop-shadow(0 0 8px rgba(255,216,107,.9)) !important;animation:rwBob 2.4s ease-in-out infinite !important}
@keyframes rwBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
[data-wk="transfercard"][data-status="returned"]{background:linear-gradient(180deg,rgba(220,224,236,.95),rgba(200,206,222,.95)) !important;box-shadow:0 0 0 1.5px #B9C0D4,0 6px 14px rgba(20,28,68,.3) !important;opacity:.85 !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:46px !important;height:46px !important;flex-shrink:0 !important;border:none !important;background:${svg(DROP("#C9CFE0"))} center/50% no-repeat,rgba(255,255,255,.6) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{display:none !important}

/* 红包＝一张奶白卡，底下一道水，左边一只纸船在水上一上一下地漂；领完了船歪着靠岸、变灰 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;width:210px !important;min-height:84px !important;padding:14px 16px 22px 92px !important;background:linear-gradient(transparent calc(100% - 16px),rgba(143,194,255,.35) calc(100% - 16px)),${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:20px !important;box-shadow:0 4px 0 rgba(183,156,255,.55),0 8px 18px rgba(20,28,68,.35) !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:6px !important;bottom:4px !important;width:82px !important;height:62px !important;background:${svg(BOAT())} center bottom/contain no-repeat !important;animation:rwFloat 3.6s ease-in-out infinite !important;filter:drop-shadow(0 3px 4px rgba(20,28,68,.25)) !important}
@keyframes rwFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-4px) rotate(3deg)}}
[data-wk="rpcard"]::after{content:"一只纸船" !important;position:absolute !important;right:12px !important;bottom:3px !important;font-size:9.5px !important;letter-spacing:.2em !important;color:#7E78A8 !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important}
[data-wk="rpcard"][data-status="done"]{background:#EEEDF4 !important;filter:grayscale(.2) !important;opacity:.85 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(BOAT("#E4E2EE", "#EEEDF4", "#A9A5C4"))} center bottom/contain no-repeat !important;animation:none !important;transform:rotate(-8deg) translateY(4px) !important}
[data-wk="rpcard"][data-status="done"]::after{content:"靠岸了" !important}
[data-wk="rpenvelope"][data-stage="closed"]{background:${svg(RAIN)} 0 0/120px 160px,linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important;border:2.5px solid #C8B2FF !important;border-radius:28px !important;box-shadow:0 10px 30px rgba(0,0,0,.35) !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rparc"]{background:#ECE8FF !important;border-top:2px solid #C8B2FF !important}
[data-wk="rpenvelope"][data-stage="closed"] *{color:#fff !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rparc"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:#fff ${svg(UMB("#FF9EC8"))} center 55%/62% no-repeat !important;border:3px solid #C8B2FF !important;box-shadow:0 4px 0 #9A84E0,0 0 18px rgba(255,158,200,.6) !important;animation:rwBob 1.6s ease-in-out infinite !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(BOKEH)} 0 0/390px 520px,linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important;border:2.5px solid #C8B2FF !important;border-radius:28px !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"][data-part="top"]{background:#ECE8FF !important;border-bottom:2px solid #C8B2FF !important;box-shadow:none !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"][data-part="top"]::after{content:none !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:#fff !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"] *{color:${C.ink} !important}
[data-wk="rpavatar"]{box-shadow:0 0 0 3px #fff,0 0 0 5px #C8B2FF !important;border-radius:50% !important}
[data-wk="rpamount"]{color:${C.yel} !important;background:none !important;text-shadow:0 0 12px rgba(255,216,107,.6) !important}
[data-wk="rpclose"]{background:#fff !important;border:2px solid #C8B2FF !important;color:${C.ink} !important}

/* 照片＝一张用粉胶带贴在起雾玻璃上的照片，四周一圈雾，有点歪 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:#fff !important;border:none !important;border-radius:4px !important;padding:9px 9px 24px !important;box-shadow:0 0 0 8px rgba(236,232,255,.35),0 8px 16px rgba(20,28,68,.4) !important;transform:rotate(-2deg) !important;margin-top:14px !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-11px !important;width:64px !important;height:22px !important;margin-left:-32px !important;background:${svg(TAPE)} center/contain no-repeat !important;z-index:2 !important;transform:rotate(3deg) !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;right:10px !important;bottom:6px !important;width:10px !important;height:13px !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="photoface"]{background:${svg(RAIN)} 0 0/90px 120px,linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important;border-radius:2px !important;border:none !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:#fff !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}

/* 语音：小胶囊，前面一颗落进水洼的雨滴，荡开两圈 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"][data-me]{border-radius:999px !important;padding:0 12px 0 38px !important;position:relative !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:9px !important;top:50% !important;width:24px !important;height:24px !important;margin-top:-12px !important;background:${svg(RIPPLE)} center/contain no-repeat !important;animation:rwBob 1.8s ease-in-out infinite !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:linear-gradient(135deg,${C.glass},${C.glass2}) !important;border-color:#fff !important}
[data-wk="voicewave"] span{background:#7E6CD0 !important}

/* 天气：雨夜的天，下面一行奶白 */
[data-wk="wxcardsky"]{background:${svg(RAIN)} 0 0/90px 120px,linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important}
[data-wk="wxcardsky"] *{color:#fff !important}
[data-wk="wxcardsky"] svg{stroke:${C.yel} !important}
[data-wk="wxcardsay"]{background:${C.cream} !important;color:${C.ink} !important;border-top:2px solid #C8B2FF !important}
/* 位置：一把小粉伞插在地图上 */
[data-wk="geopin"]{background:${svg(UPIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:30px !important;height:26px !important;border-radius:0 !important;filter:drop-shadow(0 2px 3px rgba(20,28,68,.4)) !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:#C8B2FF !important}
/* 名片 */
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px #fff,0 0 0 4px #C8B2FF !important}

/* 拍一拍、通话结束：一朵白云小胶囊，前面一颗雨滴 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:#fff ${svg(DROP())} 10px center/10px 13px no-repeat !important;border:1.5px solid #C8B2FF !important;border-radius:999px !important;padding:3px 14px 3px 28px !important;color:${C.ink} !important;box-shadow:0 2px 0 rgba(183,156,255,.6) !important}
[data-wk="note"][data-part="call"] svg{stroke:#7E6CD0 !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 线下小结：一张信纸，横线像雨后玻璃上的水痕；右上角贴一只纸船邮票 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:26px !important;padding-right:60px !important;background:repeating-linear-gradient(180deg,transparent 0 27px,rgba(158,200,255,.35) 27px 28px),${C.cream} !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;right:10px !important;top:10px !important;width:44px !important;height:40px !important;background:${svg(BOAT())} center/contain no-repeat,#ECE8FF !important;border:2px dashed #C8B2FF !important;border-radius:4px !important;transform:rotate(5deg) !important}
[data-wk="offlogtitle"]{display:inline-block !important;position:absolute !important;top:-13px !important;left:16px !important;margin:0 !important;padding:4px 16px !important;background:linear-gradient(135deg,#7FB0FF,#B79CFF) !important;color:#fff !important;border-radius:999px !important;letter-spacing:.12em !important;box-shadow:0 2px 0 #7E6CD0 !important}
[data-wk="offlogtitle"] *{color:#fff !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#7E6CD0 !important}
[data-wk="offlogtranscript"]{border-top:1.5px dashed #C8B2FF !important;color:#7E78A8 !important}
[data-wk="offlogtext"]{padding-right:46px !important}

/* 加号面板：一颗颗挂着水珠的玻璃泡泡 */
[data-wk="chatpanel"] *{color:#fff !important}
[data-wk="chattoolicon"]{background:radial-gradient(circle at 32% 28%,#fff,rgba(200,220,255,.9) 55%,rgba(183,156,255,.9)) !important;border:2px solid #fff !important;border-radius:50% !important;box-shadow:0 4px 10px rgba(0,0,0,.3) !important;position:relative !important}
[data-wk="chattoolicon"]::before{content:"" !important;position:absolute !important;right:-2px !important;bottom:-4px !important;width:9px !important;height:12px !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:#E6E2FF !important}

/* 引用三处：待发送那条＝一块磨砂玻璃条；气泡上方＝一朵小白云条；气泡里＝左边一道蓝紫水痕 */
[data-wk="quotedraft"]{background:rgba(255,255,255,.92) !important;border:1.5px solid #C8B2FF !important;border-radius:16px !important;position:relative !important;padding-left:30px !important}
[data-wk="quotedraft"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:12px !important;height:15px !important;margin-top:-8px !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="quotedraft"] *{background:transparent !important;color:${C.ink} !important;border:none !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:#7E6CD0 !important}
[data-wk="quote"]{background:rgba(255,255,255,.85) !important;color:${C.ink} !important;border:1px solid #C8B2FF !important;border-radius:999px !important;padding:3px 12px !important;opacity:1 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:3px solid transparent !important;border-image:linear-gradient(#8FC2FF,#B79CFF) 1 !important;padding-left:8px !important;opacity:.9 !important}
/* ───── 雨天窗边 · 第三批：状态卡＝一扇拱顶小窗，顶上撑一顶粉白条纹小雨棚；好感是五颗雨滴 ───── */
[data-wk="statecard"]{background:linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important;border:6px solid #fff !important;border-radius:120px 120px 24px 24px / 70px 70px 24px 24px !important;box-shadow:0 0 0 2px #C8B2FF,0 10px 0 #E9D3C2,0 10px 0 2px #C8B2FF,0 18px 34px rgba(20,28,68,.45) !important;overflow:visible !important;position:relative !important;padding-top:44px !important;--sc-heart-ink:${C.drop} !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;left:12% !important;right:12% !important;top:-6px !important;height:50px !important;background:${svg(CURTAIN)} center top/100% 100% no-repeat !important;z-index:3 !important;pointer-events:none !important}
[data-wk="statecard"]::after{content:"" !important;position:absolute !important;inset:0 !important;border-radius:inherit !important;background:${svg(RAIN)} 0 0/120px 160px repeat !important;pointer-events:none !important;z-index:0 !important;animation:rwFallBg 1.6s linear infinite !important}
@keyframes rwFallBg{from{background-position:0 0}to{background-position:-40px 160px}}
[data-wk="statecard"] > *{position:relative !important;z-index:1 !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:1.5px dashed rgba(200,178,255,.5) !important;position:relative !important;z-index:4 !important}
[data-wk="statehead"] *{color:#fff !important}
[data-wk="statehead"] [data-wk="avatar"]{box-shadow:0 0 0 2.5px #fff,0 0 10px rgba(183,156,255,.8) !important}
[data-wk="statehead"] [data-wk="avatar"]::after{content:none !important}
[data-wk="statehead"] button{border:1.5px solid rgba(255,255,255,.7) !important;background:rgba(255,255,255,.15) !important}
[data-wk="statemood"]{display:inline-block !important;background:linear-gradient(135deg,#7FB0FF,#B79CFF) !important;border:1.5px solid #fff !important;color:#fff !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:rgba(255,255,255,.15) !important;border:1.5px solid rgba(255,255,255,.6) !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:#fff !important;color:${C.ink} !important;box-shadow:0 2px 0 #C8B2FF !important}
/* 看得见的、心里想的：两块起雾的玻璃，写在雾上；角上一颗水珠 */
[data-wk="stateseen"],[data-wk="statevoice"]{position:relative !important;background:linear-gradient(160deg,rgba(255,255,255,.35),rgba(255,255,255,.12)) !important;backdrop-filter:blur(4px) !important;-webkit-backdrop-filter:blur(4px) !important;border:1.5px solid rgba(255,255,255,.6) !important;border-radius:16px !important;margin:12px 16px !important;color:#fff !important;box-shadow:none !important;overflow:visible !important}
[data-wk="statevoice"]{background:linear-gradient(160deg,rgba(255,184,214,.4),rgba(183,156,255,.2)) !important;font-style:italic !important}
[data-wk="stateseen"]::after,[data-wk="statevoice"]::after{content:"" !important;position:absolute !important;right:12px !important;bottom:-7px !important;width:10px !important;height:13px !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:#fff !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:rgba(255,255,255,.18) !important;border:1.5px solid rgba(255,255,255,.6) !important;border-radius:999px !important}
[data-wk="statewear"] > span{background:rgba(255,255,255,.2) !important;border-radius:999px !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.fog} !important}
[data-wk="statevoice"] + div > button{background:#fff !important;color:${C.ink} !important;border:1.5px solid #C8B2FF !important;border-radius:999px !important}
/* 好感：窗台上一只玻璃杯，好感多少就接了多少雨水 */
[data-wk="stateaff"]{background:#F6E6D8 !important;border-top:3px solid #E9D3C2 !important;border-radius:0 0 18px 18px !important;position:relative !important;display:block !important;padding:16px 20px 88px !important;overflow:hidden !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:absolute !important;width:54px !important;height:66px !important;left:calc(50% - 27px) !important;bottom:12px !important;transform:none !important;--sc-heart-mask:${svg(CUPMASK)} !important;filter:drop-shadow(1.6px 0 0 #B79CFF) drop-shadow(-1.6px 0 0 #B79CFF) drop-shadow(0 1.6px 0 #B79CFF) drop-shadow(0 -1.6px 0 #B79CFF) drop-shadow(0 3px 5px rgba(126,108,208,.45)) !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:transparent !important;opacity:0 !important}
[data-wk="stateheartbase"]{background:linear-gradient(100deg,rgba(255,255,255,.9) 0 18%,rgba(236,232,255,.85) 18% 26%,rgba(255,255,255,.75) 26%) !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{background:linear-gradient(100deg,rgba(255,255,255,.35) 0 14%,transparent 14%),linear-gradient(180deg,#9EC8FF,#7FA0F0 60%,#B79CFF) !important;opacity:1 !important;border-top:2px solid #DDEBFF !important}
[data-wk="stateheartnum"],[data-wk="stateheartknob"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:20px !important;top:12px !important;font-size:26px !important;font-weight:700 !important;color:#7E6CD0 !important}
/* 翻旧的：一张张用粉胶带贴在玻璃上的小纸条，歪着交错 */
[data-wk="statehistbtn"]{background:#fff !important;color:${C.ink} !important;border:1.5px solid #C8B2FF !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:#fff !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1.5px solid #C8B2FF !important;border-radius:999px !important;color:${C.ink} !important;background:#fff !important}
[data-wk="statehistitem"]{position:relative !important;background:${C.cream} !important;border:none !important;border-radius:6px !important;padding:18px 20px 16px !important;margin:22px 4px 14px !important;box-shadow:0 6px 14px rgba(20,28,68,.35) !important;overflow:visible !important;transform:rotate(-1.2deg) !important}
[data-wk="statehistitem"]:nth-child(even){transform:rotate(1.2deg) !important;background:#F1ECFF !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;left:50% !important;top:-11px !important;width:60px !important;height:20px !important;margin-left:-30px !important;background:${svg(TAPE)} center/contain no-repeat !important}
[data-wk="statehistitem"] *{color:${C.ink} !important}
[data-wk="statehistmood"]{background:linear-gradient(135deg,#7FB0FF,#B79CFF) !important;border:none !important;color:#fff !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:#9A92C4 !important}
[data-wk="statehistmeta"]{background:rgba(200,178,255,.2) !important;border-radius:10px !important}
[data-wk="statehistend"]{color:${C.fog} !important}
/* Ta 眼里：雨夜底，卡片是奶白便条，贴条换成一颗雨滴 */
[data-wk="gazepage"]{background:${svg(RAIN)} 0 0/120px 160px,linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important}
[data-wk="gazetitle"]{color:#fff !important}
[data-wk="gazetab"]{background:rgba(255,255,255,.15) !important;color:${C.fog} !important;border:1.5px solid rgba(255,255,255,.6) !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:#fff !important;color:${C.ink} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{background:${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:18px !important;box-shadow:0 4px 0 rgba(183,156,255,.55) !important}
[data-wk="gazetape"]{background:${svg(DROP())} center/14px 18px no-repeat !important;box-shadow:none !important;border:none !important;transform:none !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:#7E78A8 !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:20px !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:rgba(255,255,255,.15) !important;border:1.5px dashed rgba(255,255,255,.6) !important;border-radius:18px !important;color:#fff !important}
[data-wk="gazeempty"] > div:first-child{color:#fff !important}
[data-wk="gazeempty"] button{background:#fff !important;color:${C.ink} !important;border:1.5px solid #C8B2FF !important;border-radius:999px !important}
/* ───── 雨天窗边 · 第四批：线下＝屋里，墙上一扇拉开粉窗帘的大窗，窗外在下雨；卡片是贴在墙上的便条 ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(OFFWIN)} center bottom 80px/100% auto no-repeat,${svg(BEADS)} 0 0/200px 260px,linear-gradient(180deg,#2B2A55 0%,#5B4C8C 25%,#B07AA8 55%,#F2A99B 80%,#FFD9B8 100%) !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"]{background:linear-gradient(180deg,rgba(236,232,255,.82),rgba(236,232,255,.9)) !important}
[data-wk="offline"] [data-wk="chathead"]::before,[data-wk="offline"] [data-wk="chathead"]::after{display:none !important}
/* 线下顶栏没有淌水的下沿，文风那一行不用往下让 */
[data-wk="offline"] [data-wk="chathead"] + *{margin-top:0 !important;padding-top:6px !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:${C.ink} !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:30px !important;height:30px !important;background:${svg(I_PLUS)} center/28px no-repeat !important;border:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:#fff !important;color:${C.ink} !important;border:1.5px solid #C8B2FF !important;border-radius:999px !important;font-size:12px !important;padding:3px 12px !important}
[data-wk="offcomposer"]{background:#F1ECFF !important;border-top:3px solid #E9D3C2 !important}
[data-wk="offcomposer"] textarea{background:#fff !important;border:1.5px solid #C8B2FF !important;border-radius:16px !important;color:${C.ink} !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:32px !important;height:32px !important;min-width:32px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(I_PLUS)} center/30px no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/32px no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{position:relative !important;overflow:visible !important;width:56px !important;min-width:56px !important;height:32px !important;border:none !important;border-radius:999px !important;background:linear-gradient(135deg,#7FB0FF,#B79CFF) !important;box-shadow:0 3px 0 #7E6CD0 !important;font-size:0 !important;color:transparent !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]::before{content:"演绎" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;font-size:12.5px !important;letter-spacing:.12em !important;color:#fff !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]::after{content:"" !important;position:absolute !important;right:-6px !important;top:-8px !important;width:14px !important;height:18px !important;background:${svg(DROP())} center/contain no-repeat !important}
/* 卡片：他的那张从笑脸云底下吊着，你的那张是蓝紫玻璃 */
[data-wk="offcard"]{position:relative !important;background:${C.cream} !important;border:2px solid #C8B2FF !important;border-radius:20px !important;box-shadow:0 4px 0 rgba(183,156,255,.55),0 8px 18px rgba(20,28,68,.35) !important;overflow:visible !important;margin-top:24px !important}
[data-wk="offcard"][data-me="1"]{background:linear-gradient(160deg,rgba(255,255,255,.7),rgba(255,255,255,0) 40%),linear-gradient(135deg,${C.glass},${C.glass2}) !important;border-color:#fff !important}
[data-wk="offcard"][data-me="0"]::before{content:"" !important;position:absolute !important;left:-8px !important;top:-18px !important;width:44px !important;height:29px !important;background:${svg(CLOUDTAG)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="offcard"][data-me="1"]::after{content:"" !important;position:absolute !important;right:12px !important;top:-10px !important;width:30px !important;height:23px !important;background:${svg(DROPS)} center/contain no-repeat !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 2px #fff,0 0 0 3.5px #C8B2FF !important}
[data-wk="offhead"] [data-wk="avatar"]::after{content:none !important}
[data-wk="offname"],[data-wk="offtext"]{color:${C.ink} !important}
[data-wk="offname"]{font-weight:700 !important}
[data-wk="offsay"]{background:linear-gradient(transparent 58%,rgba(158,200,255,.65) 58%) !important;color:${C.ink} !important;font-weight:700 !important;box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important}
[data-wk="offthought"]{background:rgba(200,178,255,.18) !important;border:1.5px dashed #C8B2FF !important;border-left:3px solid ${C.drop} !important;border-radius:6px 14px 14px 6px !important;color:#5A5390 !important;font-style:italic !important;box-shadow:none !important}
[data-wk="offcardacts"] svg{stroke:#7E6CD0 !important;color:#7E6CD0 !important}
[data-wk="offreplyopt"]{background:#fff !important;border:1.5px solid #C8B2FF !important;border-radius:999px !important;color:${C.ink} !important}

/* ───── 雨天窗边 · 通话：气泡同线上，大头像外一圈雨滴光环 ───── */
[data-wk="callbubble"]{background:${C.cream} !important;color:${C.ink} !important;border:2px solid #C8B2FF !important;border-radius:8px 20px 20px 20px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:linear-gradient(135deg,${C.glass},${C.glass2}) !important;border-color:#fff !important;border-radius:20px 8px 20px 20px !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callbubble"][data-kind="typing"] [data-wk="typingdot"]{width:8px !important;height:11px !important;border-radius:0 !important;background:${svg(DROP())} center/contain no-repeat !important}
[data-wk="callact"]{color:#E6E2FF !important;font-style:italic !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 4px #fff,0 0 0 8px rgba(158,200,255,.55),0 0 0 13px rgba(183,156,255,.3),0 0 30px rgba(255,158,200,.5) !important}
/* 名字露全：名字那块吃满剩下的宽，右边两颗键收小，名字旁小箭头藏掉 */
[data-wk="chathead"]{gap:6px !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="sameroom"]{width:30px !important;min-width:30px !important;height:30px !important;background-size:28px !important;margin-left:0 !important}
[data-wk="chatmore"]{width:40px !important;min-width:40px !important;background-size:38px auto !important}
/* 好感数字放进图形正中 */
[data-wk="stateaffval"]{display:block !important;position:absolute !important;left:50% !important;right:auto !important;top:auto !important;bottom:34px !important;transform:translateX(-50%) !important;z-index:3 !important;font-size:17px !important;line-height:1 !important;font-weight:700 !important;color:#fff !important;text-shadow:0 0 2px #5B4C8C,0 0 2px #5B4C8C,0 1px 3px #5B4C8C !important;pointer-events:none !important}
`;

const pack = { kind: "chat-look", v: 1, name: "雨天窗边", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "雨天窗边-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
