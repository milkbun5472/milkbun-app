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

// 按键
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='${C.holly}'/><path d='M20 12 V28 M12 20 H28' stroke='#fff' stroke-width='3' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><circle cx='22' cy='22' r='20' fill='${C.red}'/><g transform='translate(6 5) scale(.8)'>${X(GIFT("#fff", C.red))}</g></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 46'><path d='M8 14 H42 Q46 14 46 18 V34 Q46 38 42 38 H22 L12 44 L14 38 H8 Q4 38 4 34 V18 Q4 14 8 14Z' fill='#fff' stroke='${C.pine}' stroke-width='2.4' stroke-linejoin='round'/><circle cx='17' cy='26' r='2.2' fill='${C.pine}'/><circle cx='25' cy='26' r='2.2' fill='${C.pine}'/><circle cx='33' cy='26' r='2.2' fill='${C.pine}'/><path d='M28 15 C30 4 40 2 46 8 L40 14Z' fill='${C.red}'/><path d='M26 15 H44' stroke='#fff' stroke-width='4' stroke-linecap='round'/><circle cx='46' cy='8' r='3' fill='#fff'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g stroke='#fff' stroke-width='2.4' stroke-linejoin='round' fill='none'><path d='M5 20 L20 7 L35 20'/><path d='M9 17 V34 H31 V17'/><path d='M17 34 V25 H23 V34'/></g><path d='M4 20 L20 6 L36 20 L33 21 L20 10 L7 21Z' fill='#fff'/></svg>`;
const I_FLAKES = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 66 22'><g transform='translate(0 2)'>${X(FLAKE(1))}</g><g transform='translate(22 1) scale(1.05)'>${X(FLAKE(1))}</g><g transform='translate(45 2)'>${X(FLAKE(1))}</g></svg>`;
const HAT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 40'><path d='M8 30 C14 10 34 2 50 10 C46 14 44 22 46 30Z' fill='#D9474A' stroke='#fff' stroke-width='2.4' stroke-linejoin='round'/><rect x='4' y='28' width='46' height='10' rx='5' fill='#fff'/><circle cx='52' cy='10' r='6' fill='#fff'/></svg>`;

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
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:34px !important;height:23px !important;left:6px !important;top:calc(50% - 30px) !important;background:${svg(HAT)} center/contain no-repeat !important;transform:rotate(-14deg) !important;z-index:3 !important;pointer-events:none !important}

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
`;

const pack = { kind: "chat-look", v: 1, name: "圣诞", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "圣诞-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
