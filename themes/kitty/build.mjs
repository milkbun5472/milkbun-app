// 猫猫聊天美化：生成 chat-look 包。用法：node themes/kitty/build.mjs
// 配色：奶白 #FBFAF7 / 雾蓝 #DCE6F2 / 蓝灰描边 #8C9BB8 / 深字 #4B5470 / 樱花粉 #F2B8C4 / 铃铛金 #E8B85A
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { milk: "#FBFAF7", mist: "#DCE6F2", mist2: "#EEF3F9", line: "#8C9BB8", ink: "#4B5470", pink: "#F2B8C4", pinkD: "#E58FA2", gold: "#E8B85A" };
const X = s => s.replace(/<\/?svg[^>]*>/g, "");

const MITT = 'M8 22 C4 14 9 6 16 7 C18 2 26 2 28 7 C35 6 40 14 36 22 C35 32 28 37 22 37 C16 37 9 32 8 22Z';
const BEANS = "<ellipse cx='12.5' cy='17' rx='2.6' ry='3'/><ellipse cx='22' cy='12.5' rx='2.8' ry='3.2'/><ellipse cx='31.5' cy='17' rx='2.6' ry='3'/><path d='M22 21 C27 21 30 25 29.5 28.5 C29 31.5 25.5 31 22 30.5 C18.5 31 15 31.5 14.5 28.5 C14 25 17 21 22 21Z'/>";
// 小猫爪剪影（整只圆爪子，肉球镂空成浅色）——到处的小爪印都用这个，别再是狗爪那五个点
const PAW = (f = C.line, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 40'><g opacity='${o}'><path d='${MITT}' fill='${f}'/><g fill='#fff' opacity='.6'>${BEANS}</g></g></svg>`;
const FISH = (f = C.line, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 20'><g fill='${f}' opacity='${o}'><path d='M4 10 C10 2 24 2 30 10 C24 18 10 18 4 10Z'/><path d='M30 10 L38 3 L36 10 L38 17Z'/></g><circle cx='10' cy='9' r='1.5' fill='#fff'/></svg>`;
const BONE = (f = C.line, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 20'><g stroke='${f}' stroke-width='2' stroke-linecap='round' fill='none' opacity='${o}'><path d='M6 10 H34'/><path d='M12 4 V16 M18 3 V17 M24 3 V17 M30 4 V16'/><path d='M34 10 L41 4 M34 10 L41 16'/></g><circle cx='5' cy='10' r='3.5' fill='${f}' opacity='${o}'/></svg>`;
const YARN = (f = C.pink, k = f === C.pink ? C.pinkD : C.line) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='16' fill='${f}' stroke='${k}' stroke-width='1.6'/><g fill='none' stroke='${k}' stroke-width='1.3' opacity='.8'><path d='M6 15 C14 20 26 20 34 15'/><path d='M5 23 C14 28 26 28 35 23'/><path d='M14 5 C18 14 18 26 14 35'/><path d='M24 5 C28 14 28 26 24 35'/></g></svg>`;
// 猫爪（气泡尾巴）：一只圆滚滚的白爪子，粉色肉球——跟狗爪那种五个黑点分开
const CATPAW = (fill = "#fff") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 40'><path d='M8 22 C4 14 9 6 16 7 C18 2 26 2 28 7 C35 6 40 14 36 22 C35 32 28 37 22 37 C16 37 9 32 8 22Z' fill='${fill}' stroke='${C.line}' stroke-width='2.4' stroke-linejoin='round'/><path d='M15.5 8 Q16 14 18 16 M28.5 8 Q28 14 26 16' fill='none' stroke='${C.line}' stroke-width='1.6' stroke-linecap='round'/><g fill='${C.pink}'><ellipse cx='12.5' cy='17' rx='2.6' ry='3'/><ellipse cx='22' cy='12.5' rx='2.8' ry='3.2'/><ellipse cx='31.5' cy='17' rx='2.6' ry='3'/><path d='M22 21 C27 21 30 25 29.5 28.5 C29 31.5 25.5 31 22 30.5 C18.5 31 15 31.5 14.5 28.5 C14 25 17 21 22 21Z'/></g></svg>`;
const BELL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8' fill='${C.gold}' stroke='#B88A33' stroke-width='1.2'/><path d='M3 9 H17' stroke='#B88A33' stroke-width='1.1'/><circle cx='10' cy='13' r='1.6' fill='#7A5A20'/><path d='M10 14 V17' stroke='#7A5A20' stroke-width='1.2'/></svg>`;

// 猫耳头像框（耳朵＋项圈＋铃铛），flip 给我那颗
const EARS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 106'><path fill-rule='evenodd' d='M14.5 40 C12 28 12 14 18 6 C26 8 34 13 39 19 C42.5 18.2 46.2 17.8 50 17.8 C53.8 17.8 57.5 18.2 61 19 C66 13 74 8 82 6 C88 14 88 28 85.5 40 C88.3 45 90 51 90 57.8 C90 79.9 72.1 97.8 50 97.8 C27.9 97.8 10 79.9 10 57.8 C10 51 11.7 45 14.5 40Z M50 24.8 A33 33 0 1 0 50.01 24.8Z' fill='#E6EDF6' stroke='${C.line}' stroke-width='2.4' stroke-linejoin='round'/><path d='M19 30 C18 22 19 15 22 11 C27 13 32 16 35 20 C29 22 23 25 19 30Z M81 30 C82 22 81 15 78 11 C73 13 68 16 65 20 C71 22 77 25 81 30Z' fill='${C.pink}'/><path d='M23 22 l4 -2 M25 26 l5 -1 M77 22 l-4 -2 M75 26 l-5 -1' stroke='#fff' stroke-width='1.5' stroke-linecap='round'/><path d='M17 76 Q50 100 83 76' fill='none' stroke='${C.pink}' stroke-width='6' stroke-linecap='round'/><path d='M17 76 Q50 100 83 76' fill='none' stroke='#fff' stroke-width='1.2' stroke-dasharray='1 5' stroke-linecap='round' opacity='.8'/><g transform='translate(41 86)'><circle cx='9' cy='9' r='8.5' fill='${C.gold}' stroke='#B88A33' stroke-width='1.3'/><path d='M1.5 8 H16.5' stroke='#B88A33' stroke-width='1.2'/><circle cx='9' cy='12' r='1.7' fill='#7A5A20'/><path d='M9 13 V16.5' stroke='#7A5A20' stroke-width='1.2'/><circle cx='6' cy='5' r='1.6' fill='#fff' opacity='.7'/></g></svg>`;


// 背景：雾蓝底，散着淡淡的小鱼、鱼骨、爪印
const TILE = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><g opacity='.16'><g transform='translate(18 22) scale(.8)'>${X(FISH())}</g><g transform='translate(120 40) rotate(-12) scale(.7)'>${X(BONE())}</g><g transform='translate(150 120) scale(.55)'>${X(PAW())}</g><g transform='translate(40 140) rotate(15) scale(.7)'>${X(BONE())}</g><g transform='translate(80 90) scale(.45)'>${X(PAW())}</g><g transform='translate(140 175) rotate(-8) scale(.7)'>${X(FISH())}</g></g></svg>`;
// 一根毛线从顶上弯弯绕绕穿过整页，底下滚着毛线团
const YARNLINE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 760' preserveAspectRatio='none'><path d='M300 0 C300 120 70 140 90 260 C110 380 330 340 310 480 C290 620 300 680 300 760' fill='none' stroke='${C.pink}' stroke-width='2.4' stroke-linecap='round' opacity='.75'/></svg>`;
// 顶栏下沿：一圈波浪布边，挂着毛线球、鱼干、铃铛、小鱼
const HEM = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 64' preserveAspectRatio='xMidYMin slice'><path d='M0 0 H390 V8 Q382 16 374 8 T358 8 T342 8 T326 8 T310 8 T294 8 T278 8 T262 8 T246 8 T230 8 T214 8 T198 8 T182 8 T166 8 T150 8 T134 8 T118 8 T102 8 T86 8 T70 8 T54 8 T38 8 T22 8 T6 8 T-10 8Z' fill='${C.milk}'/><path d='M390 8 Q382 16 374 8 T358 8 T342 8 T326 8 T310 8 T294 8 T278 8 T262 8 T246 8 T230 8 T214 8 T198 8 T182 8 T166 8 T150 8 T134 8 T118 8 T102 8 T86 8 T70 8 T54 8 T38 8 T22 8 T6 8 T-10 8' fill='none' stroke='${C.line}' stroke-width='2'/><g stroke='${C.line}' stroke-width='1.2'><path d='M70 12 V30'/><path d='M150 12 V24'/><path d='M230 12 V34'/><path d='M300 12 V26'/></g><g transform='translate(59 28) scale(.55)'>${X(YARN(C.mist))}</g><g transform='translate(150 34) rotate(90) scale(.45) translate(-22 -10)'>${X(BONE())}</g><g transform='translate(221 33) scale(.9)'>${X(BELL)}</g><g transform='translate(300 35) rotate(-90) scale(.5) translate(-20 -10)'>${X(FISH(C.pinkD))}</g></svg>`;
const TAIL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 120'><path d='M14 0 C10 40 46 50 38 82 C32 108 6 104 12 86 C16 74 30 84 24 92' fill='none' stroke='${C.line}' stroke-width='16' stroke-linecap='round'/><path d='M14 0 C10 40 46 50 38 82 C32 108 6 104 12 86 C16 74 30 84 24 92' fill='none' stroke='#A9B6CE' stroke-width='11' stroke-linecap='round'/></svg>`;

// 按键
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${X(YARN(C.mist))}</svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><circle cx='22' cy='22' r='20' fill='${C.line}'/><g transform='translate(5 12) scale(.85)'><path d='M4 10 C10 2 24 2 30 10 C24 18 10 18 4 10Z' fill='#fff'/><path d='M30 10 L38 3 L36 10 L38 17Z' fill='#fff'/><circle cx='10' cy='9' r='1.5' fill='${C.line}'/></g></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 46'><g stroke='${C.line}' stroke-width='2.4' stroke-linejoin='round'><path d='M8 18 L6 2 L20 12Z' fill='#fff'/><path d='M42 18 L44 2 L30 12Z' fill='#fff'/><path d='M10 12 h30 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 h-18 l-8 7 l1 -7 h-5 a6 6 0 0 1 -6 -6 v-14 a6 6 0 0 1 6 -6z' fill='#fff'/></g><path d='M9 13 L8 6 L15 11Z M41 13 L42 6 L35 11Z' fill='${C.pink}'/><circle cx='18' cy='25' r='2' fill='${C.line}'/><circle cx='25' cy='25' r='2' fill='${C.line}'/><circle cx='32' cy='25' r='2' fill='${C.line}'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g stroke='${C.line}' stroke-width='2.2' stroke-linejoin='round' fill='#fff'><path d='M6 18 L20 6 L34 18 V34 H6Z'/><path d='M15 34 V24 a5 5 0 0 1 10 0 V34'/></g><path d='M12 10 L11 3 L17 7Z M28 10 L29 3 L23 7Z' fill='${C.pink}' stroke='${C.line}' stroke-width='1.5'/></svg>`;
const I_PAWS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 22'><g transform='translate(0 3) scale(.4)'>${X(PAW())}</g><g transform='translate(20 0) scale(.5)'>${X(PAW())}</g><g transform='translate(42 3) scale(.4)'>${X(PAW())}</g></svg>`;


// ── 第二批用的图 ──
// 小鱼罐头（红包）：圆角罐身、拉环、贴纸上一条鱼
const CAN = (body = "#DCE6F2", label = "#fff") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 70'><rect x='6' y='14' width='68' height='50' rx='12' fill='${body}' stroke='${C.line}' stroke-width='2.4'/><ellipse cx='40' cy='16' rx='34' ry='8' fill='#fff' stroke='${C.line}' stroke-width='2.4'/><ellipse cx='40' cy='16' rx='26' ry='5' fill='none' stroke='${C.line}' stroke-width='1.4' opacity='.6'/><path d='M52 12 q10 -10 16 -2 q-6 4 -12 4' fill='none' stroke='${C.line}' stroke-width='2.2' stroke-linecap='round'/><rect x='14' y='30' width='52' height='24' rx='8' fill='${label}' stroke='${C.line}' stroke-width='1.6'/><g transform='translate(24 34) scale(.8)'>${X(FISH(C.pinkD))}</g></svg>`;
// 大肉垫印（已收 / 退回）
const PADSTAMP = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 40'><path d='${MITT}' fill='${f}'/><g fill='#fff' opacity='.45'>${BEANS}</g></svg>`;
// 小鱼图钉（位置）
const FISHPIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g transform='rotate(-90 20 20) translate(2 10)'>${X(FISH(C.pinkD))}</g></svg>`;

// 趴在状态卡顶上的一整只猫：圆脑袋、尖耳朵、粉腮红、两只前爪搭在卡边、尾巴卷起来
const LOAFCAT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 82'><g stroke='${C.line}' stroke-width='2.4' stroke-linejoin='round' stroke-linecap='round'>
<path d='M124 78 C150 78 156 56 146 46 C140 40 132 44 136 52' fill='none' stroke-width='5' stroke='${C.line}'/><path d='M124 78 C150 78 156 56 146 46 C140 40 132 44 136 52' fill='none' stroke-width='2' stroke='#fff'/>
<path d='M44 82 C40 58 62 44 92 44 C122 44 134 60 130 82Z' fill='#fff'/>
<path d='M100 50 q6 -2 10 2 M106 46 q6 0 8 4' fill='none' stroke='${C.mist}' stroke-width='3'/>
<path d='M42 30 C38 18 40 8 44 4 C50 8 58 14 62 20 M98 20 C102 14 110 8 116 4 C120 8 122 18 118 30' fill='#fff'/>
<ellipse cx='80' cy='42' rx='40' ry='31' fill='#fff'/>
<path d='M47 22 C46 15 46 11 48 9 C52 12 56 16 58 19Z M102 19 C104 16 108 12 112 9 C114 11 114 15 113 22Z' fill='${C.pink}' stroke='none'/>
<path d='M72 16 v6 M80 14 v7 M88 16 v6' stroke='${C.mist}' stroke-width='2.6'/>
<path d='M58 42 q6 6 12 0 M90 42 q6 6 12 0' fill='none' stroke-width='2.6'/>
<path d='M77 48 h6 l-3 3Z' fill='${C.pinkD}' stroke='none'/>
<path d='M80 51 v2 q-3 4 -7 1 M80 53 q3 4 7 1' fill='none' stroke-width='1.8'/>
<path d='M44 48 l-16 -3 M44 53 l-16 3 M116 48 l16 -3 M116 53 l16 3' stroke-width='1.4' opacity='.7'/>
<path d='M52 82 C50 70 68 70 68 82 M92 82 C92 70 110 70 108 82' fill='#fff'/>
<path d='M57 78 v4 M62 78 v4 M97 78 v4 M102 78 v4' stroke-width='1.4'/>
</g><ellipse cx='56' cy='52' rx='6' ry='3.6' fill='${C.pink}' opacity='.75'/><ellipse cx='104' cy='52' rx='6' ry='3.6' fill='${C.pink}' opacity='.75'/></svg>`;

// 软猫耳：圆弧耳朵，填色跟所在的块一样，底边不描线、盖住那段边框——像块自己长出来的（线下卡、线上气泡共用）
const SOFTEARS = (fill) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 22'><g fill='${fill}' stroke='${C.line}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'><path d='M2 22 C6 16 8 6 12 3 C15 1 18 3 22 9 C25 14 28 18 30 22'/><path d='M34 22 C36 18 39 14 42 9 C46 3 49 1 52 3 C56 6 58 16 62 22'/></g><rect x='0' y='19.6' width='64' height='3' fill='${fill}'/><g fill='${C.pink}' opacity='.75'><path d='M10 18 C11 12 13 7 15 7 C17 7 19 12 21 18Z'/><path d='M43 18 C45 12 47 7 49 7 C51 7 53 12 54 18Z'/></g></svg>`;
const bubble = { myBg: "#CFDAEA", myText: C.ink, myBorder: "2px solid " + C.line, charBg: "#fff", charText: C.ink, charBorder: "2px solid " + C.line, radius: 22, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };


// 毛线团沿线走：不用 offset-path（有的 iOS 不认），直接按线上的点写 translate
const KT_SEGS=[[[300,0],[300,120],[70,140],[90,260]],[[90,260],[110,380],[330,340],[310,480]],[[310,480],[290,620],[300,680],[300,760]]];
const ktAt=u=>{const g=Math.min(2,Math.floor(u*3)),t=u*3-g,[a,b,c,d]=KT_SEGS[g],m=1-t,f=i=>m*m*m*a[i]+3*m*m*t*b[i]+3*m*t*t*c[i]+t*t*t*d[i];return Math.round(f(0))+"px "+Math.round(f(1))+"px";};
const KT_REST=ktAt(0.3);
const ktAlong=()=>{let k="";for(let i=0;i<=24;i++){const u=0.92-(0.92-0.2)*i/24;k+=(i/24*100).toFixed(2)+"%{translate:"+ktAt(u)+"}";}return "@keyframes ktAlong{"+k+"}";};
const css = `
/* ───── 猫猫 · 第一批 ───── */
[data-wk="chat"]{background:${svg(TILE)} 0 0/200px 200px,linear-gradient(180deg,${C.mist2},${C.mist}) !important;position:relative !important}
[data-wk="chat"]::before{content:"" !important;position:absolute !important;left:24px !important;bottom:96px !important;width:54px !important;height:54px !important;background:${svg(YARN())} center/contain no-repeat !important;pointer-events:none !important;z-index:0 !important;animation:ktRoll 6s ease-in-out infinite !important}
@keyframes ktRoll{0%,100%{transform:translateX(0) rotate(0)}50%{transform:translateX(14px) rotate(60deg)}}
[data-wk="body"]{background:${svg(YARNLINE)} center top/100% 760px repeat-y local !important;position:relative !important;z-index:1 !important;padding-top:30px !important}
/* 顶栏：奶白，下沿波浪布边挂小东西，右边垂一条会摆的尾巴 */
[data-wk="chathead"]{background:${C.milk} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% - 10px) !important;height:52px !important;background:${svg(HEM)} center top/100% auto no-repeat !important;pointer-events:none !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;right:14px !important;top:calc(100% + 2px) !important;width:34px !important;height:82px !important;background:${svg(TAIL)} center top/contain no-repeat !important;transform-origin:50% 0 !important;animation:ktTail 3.6s ease-in-out infinite !important;pointer-events:none !important;z-index:6 !important}
@keyframes ktTail{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(8deg)}}
[data-wk="headink"]{color:${C.ink} !important}
[data-wk="headdim"]{color:${C.line} !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="chatmore"]{font-size:0 !important;color:transparent !important;width:44px !important;min-width:44px !important;height:30px !important;background:${svg(I_PAWS)} center/40px auto no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="sameroom"]{width:38px !important;min-width:38px !important;height:38px !important;font-size:0 !important;padding:0 !important;overflow:visible !important;background:${svg(I_HOUSE)} center/32px 32px no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：猫耳＋粉项圈＋小金铃 */
[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important}
[data-wk="avatar"] *{border-radius:50% !important}
img[data-wk="avatar"],[data-wk="avatar"] img{clip-path:circle(50%) !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-26% !important;top:-40% !important;bottom:-33% !important;background:${svg(EARS)} center top/contain no-repeat !important;pointer-events:none !important;z-index:2 !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:52px !important;height:55px !important;left:-8px !important;top:calc(50% - 30px) !important;background:${svg(EARS)} center top/contain no-repeat !important;pointer-events:none !important;z-index:2 !important}

/* 气泡：肉垫形，尾巴是一颗小肉球 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:24px 24px 24px 24px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{border-bottom-right-radius:8px !important;box-shadow:0 3px 0 rgba(140,155,184,.25) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{border-bottom-left-radius:8px !important;box-shadow:0 3px 0 rgba(140,155,184,.22) !important}
[data-wk="bubble"][data-kind="text"]::before{content:none !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;bottom:-6px !important;width:14px !important;height:14px !important;border-radius:50% !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{right:-5px !important;background:#CFDAEA !important;border:2px solid ${C.line} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{left:-5px !important;background:#fff !important;border:2px solid ${C.line} !important}

/* 已读：前面一条小鱼 */
[data-wk="meta"]{color:${C.line} !important}
[data-wk="meta"]::before{content:"" !important;display:inline-block !important;width:16px !important;height:8px !important;margin-right:4px !important;background:${svg(FISH())} center/contain no-repeat !important}
/* 时间：两头各一颗肉垫的小胶囊 */
[data-wk="time"] > span{background:#fff ${svg(PAW())} 10px center/12px 12px no-repeat !important;border:1.5px solid ${C.line} !important;border-radius:999px !important;padding:2px 14px 2px 28px !important;color:${C.ink} !important}

/* 底栏 */
[data-wk="composer"]{background:${C.milk} !important;border-top:2px solid ${C.line} !important}
[data-wk="chatinput"]{background:#fff !important;border:2px solid ${C.line} !important;border-radius:999px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#A6B1C7 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;width:38px !important;height:38px !important;min-width:38px !important;align-self:center !important;transition:transform .12s !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}

/* 正在输入：一只小爪子从边上伸出来扒拉 */
[data-wk="bubble"][data-kind="typing"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{width:16px !important;height:16px !important;border-radius:0 !important;background:${svg(PAW(C.line))} center/contain no-repeat !important}

/* 系统提示、拍一拍、动描：一行小字，前面一条小鱼 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important;text-align:center !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{color:${C.line} !important;font-style:normal !important}
[data-wk="note"][data-part="pat"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:999px !important;color:${C.ink} !important;padding:2px 12px !important}
[data-wk="narrink"]{background:rgba(255,255,255,.7) !important;border:1.5px solid ${C.line} !important;border-radius:16px !important;color:${C.ink} !important}

/* 整个猫耳框垫在头像底下，位置不动，只是头像图压在上面 */
button[data-wk="avatar"],span[data-wk="avatar"]{isolation:isolate !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{position:relative !important;z-index:1 !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{z-index:0 !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){isolation:isolate !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]) > [data-wk="avatar"]{position:relative !important;z-index:1 !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{z-index:0 !important}

/* 气泡返工：圆滚滚的软糖，顶角探一对小猫耳，侧边三根胡须，尾巴是一个小肉垫 */
[data-wk="bubble"][data-kind="text"]{border-radius:26px !important;margin-top:10px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,#DCE6F3,#C9D6E8) !important;border-bottom-right-radius:26px !important;box-shadow:inset 0 2px 0 rgba(255,255,255,.7),0 4px 0 rgba(140,155,184,.28) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(180deg,#fff,#F6F8FC) !important;border-bottom-left-radius:26px !important;box-shadow:inset 0 2px 0 #fff,0 4px 0 rgba(140,155,184,.22) !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;top:-11px !important;width:34px !important;height:14px !important;border:none !important;pointer-events:none !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 14'><g stroke='${C.line}' stroke-width='2' stroke-linejoin='round'><path d='M2 14 L5 2 L13 11Z' fill='#fff'/><path d='M32 14 L29 2 L21 11Z' fill='#fff'/></g><path d='M5.5 11 L6.5 5 L10 9.5Z M28.5 11 L27.5 5 L24 9.5Z' fill='${C.pink}'/></svg>`)} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{right:22px !important;left:auto !important;transform:rotate(4deg) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{left:22px !important;right:auto !important;transform:rotate(-4deg) !important}
[data-wk="bubble"][data-kind="text"]::after{bottom:-10px !important;width:24px !important;height:22px !important;border:none !important;border-radius:0 !important;background:${svg(PAW(C.line))} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{right:-4px !important;transform:rotate(25deg) !important;background:${svg(CATPAW("#DCE6F3"))} center/contain no-repeat !important;border:none !important;border-radius:0 !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{left:-4px !important;transform:rotate(-25deg) !important;background:${svg(CATPAW())} center/contain no-repeat !important;border:none !important;border-radius:0 !important}

/* 毛线固定在屏幕上，毛线团沿着这根线来回滚（offset-path 用同一条线，按屏幕比例换算） */
[data-wk="body"]{background:transparent !important}
[data-wk="chat"]{background:${svg(TILE)} 0 0/200px 200px,linear-gradient(180deg,${C.mist2},${C.mist}) !important}
[data-wk="chat"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:0 !important;bottom:0 !important;background:${svg(YARNLINE)} 0 0/390px 760px no-repeat !important;pointer-events:none !important;z-index:0 !important}
[data-wk="chat"]::before{left:0 !important;top:0 !important;bottom:auto !important;width:40px !important;height:40px !important;margin:-20px 0 0 -20px !important;transform:none !important;translate:${KT_REST} !important;animation:none !important}
/* 手机支持「跟着滑动走」时：往上滑一点，毛线团就顺着线往前滚一点，滑到底它就滚到线尾；不支持就乖乖停在线上 */
[data-wk="chat"]{timeline-scope:--ktscroll !important}
[data-wk="body"]{scroll-timeline:--ktscroll y !important}
[data-wk="chat"]::before{animation:ktAlong linear both,ktSpin linear both !important;animation-timeline:--ktscroll,--ktscroll !important}
${ktAlong()}
@keyframes ktSpin{from{rotate:0deg}to{rotate:-1440deg}}

/* ───── 猫猫 · 第二批：卡片 ───── */
/* 卡片统一：奶白软糖块、蓝灰描边、底下一层厚边，像气泡一家 */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:#fff !important;border:2px solid ${C.line} !important;border-radius:22px !important;box-shadow:0 4px 0 #C3CEE0 !important;color:${C.ink} !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:#C3CEE0 !important}

/* 转账：猫爪印收据——顶上一排小鱼齿孔，收了盖一个粉肉垫 */
[data-wk="transfercard"]{position:relative !important;overflow:visible !important;padding-top:26px !important;background:radial-gradient(circle at 0 64%,${C.mist} 8px,transparent 9px),radial-gradient(circle at 100% 64%,${C.mist} 8px,transparent 9px),#fff !important}
[data-wk="transfercard"]::before{content:"喵 · 小鱼干收据" !important;position:absolute !important;left:16px !important;top:8px !important;font-size:10px !important;letter-spacing:.16em !important;color:${C.line} !important;padding-left:18px !important;background:${svg(PAW(C.line))} 0 center/12px 12px no-repeat !important}
[data-wk="transferlabel"]{color:${C.line} !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.ink} !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:6px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 6'><circle cx='3' cy='3' r='1.6' fill='${C.line}' opacity='.5'/></svg>`)} 0 0/12px 6px repeat-x !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${C.mist2} !important;border-radius:0 0 20px 20px !important}
[data-wk="transfernote"]::before{content:"附言：" !important;color:${C.line} !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.line} !important;color:#fff !important;border:none !important;box-shadow:0 3px 0 #6F7D99 !important}
[data-wk="transferbtn"][data-part="back"]{background:#fff !important;color:${C.line} !important;border:1.5px solid ${C.line} !important}
[data-wk="transferseal"]{border:2px solid ${C.line} !important;box-shadow:none !important;color:${C.line} !important;background:${C.mist2} !important;border-radius:50% !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"],[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{width:68px !important;height:68px !important;flex-shrink:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important;opacity:1 !important;padding:34px 0 0 !important;transform:rotate(-12deg) !important;background:${svg(PADSTAMP(C.pink))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"]{background:${svg(PADSTAMP("#B9C3D6"))} center/contain no-repeat !important;transform:rotate(10deg) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{color:#fff !important;font-size:12px !important;letter-spacing:0 !important;white-space:nowrap !important;font-weight:700 !important}
[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] > div:nth-child(2),[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] > div:nth-child(2){display:none !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.8 !important}

/* 红包：一罐小鱼罐头 */
[data-wk="rpcard"]{background:linear-gradient(180deg,#fff,${C.mist2}) !important;border:2px solid ${C.line} !important;border-radius:22px !important;box-shadow:0 4px 0 #C3CEE0 !important;padding-left:96px !important;min-height:92px !important;position:relative !important;overflow:visible !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:74px !important;height:64px !important;margin-top:-34px !important;background:${svg(CAN())} center/contain no-repeat !important;animation:ktWob 2.4s ease-in-out infinite !important;transform-origin:50% 100% !important}
@keyframes ktWob{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
[data-wk="rpcard"]::after{content:"小鱼罐头" !important;position:absolute !important;left:24px !important;bottom:5px !important;font-size:10px !important;letter-spacing:.2em !important;color:${C.line} !important}
[data-wk="rpflap"],[data-wk="rpseal"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{background:${C.mist2} !important;box-shadow:none !important;filter:none !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(CAN("#EEF3F9","#F5F7FB"))} center/contain no-repeat !important;opacity:.6 !important;animation:none !important}
[data-wk="rpcard"][data-status="done"]::after{content:"吃光啦" !important}
/* 拆开前：一大罐，按钮是拉环 */
[data-wk="rpenvelope"][data-stage="closed"]{background:${svg(TILE)} 0 0/200px 200px,linear-gradient(180deg,#fff,${C.mist}) !important;border:2.5px solid ${C.line} !important;border-radius:30px !important;box-shadow:0 6px 0 #C3CEE0 !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rparc"]{background:${C.milk} !important;border-top:2.5px solid ${C.line} !important}
[data-wk="rpenvelope"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:#fff ${svg(FISH(C.pinkD))} center/62% auto no-repeat !important;border:2.5px solid ${C.line} !important;box-shadow:0 4px 0 #C3CEE0 !important;animation:ktWob 1.6s ease-in-out infinite !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
/* 拆开后 */
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(TILE)} 0 0/200px 200px,${C.mist2} !important;border:2.5px solid ${C.line} !important;border-radius:30px !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"][data-part="top"]{background:${C.mist} !important;border-bottom:2.5px solid ${C.line} !important;box-shadow:none !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"][data-part="top"]::after{content:none !important}
[data-wk="rpavatar"]{box-shadow:0 0 0 3px #fff,0 0 0 5px ${C.line} !important;border-radius:50% !important}
[data-wk="rpamount"]{color:${C.ink} !important;background:none !important}
[data-wk="rpstatus"],[data-wk="rpwish"]{color:${C.line} !important}
[data-wk="rpclose"]{background:#fff !important;border:2px solid ${C.line} !important;color:${C.line} !important}

/* 照片：拍立得，顶上探一对猫耳 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;padding:8px 8px 22px !important;margin-top:10px !important}
[data-wk="photocard"]::before{content:"" !important;position:absolute !important;top:-11px !important;left:20px !important;width:34px !important;height:14px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 14'><path d='M2 14 L7 1 L14 14Z M20 14 L27 1 L32 14Z' fill='#fff' stroke='${C.line}' stroke-width='2' stroke-linejoin='round'/><path d='M6 12 L7.5 6 L10 12Z M24 12 L26.5 6 L28 12Z' fill='${C.pink}'/></svg>`)} center/contain no-repeat !important}
[data-wk="photoface"]{background:${svg(TILE)} 0 0/120px 120px,${C.mist} !important;border-radius:14px !important;border:none !important}
[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.ink} !important}

/* 语音：毛线团在前，声波是一截截毛线 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"]{padding-left:40px !important;position:relative !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:24px !important;height:24px !important;margin-top:-12px !important;background:${svg(YARN())} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voicewave"] span{background:${C.line} !important;border-radius:3px !important}
/* 天气 */
[data-wk="wxcardsky"]{background:linear-gradient(170deg,${C.mist2},${C.mist}) !important;color:${C.ink} !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.line} !important}
[data-wk="wxcardsay"]{background:#fff !important;color:${C.ink} !important;border-top:2px solid ${C.mist} !important}
/* 位置：钉一条小鱼 */
[data-wk="geopin"]{background:${svg(FISHPIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:26px !important;height:26px !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.line} !important}
/* 名片 */
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px #fff,0 0 0 4px ${C.line} !important}

/* 拍一拍：小肉垫胶囊；通话结束胶囊同款 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:#fff ${svg(PAW(C.pinkD))} 10px center/13px 13px no-repeat !important;border:1.5px solid ${C.line} !important;border-radius:999px !important;padding:3px 14px 3px 28px !important;color:${C.ink} !important}
[data-wk="note"][data-part="call"]{background-image:none !important;padding-left:14px !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.line} !important}
[data-wk="sysnotetext"]::before{content:"" !important;display:inline-block !important;width:16px !important;height:9px !important;margin-right:6px !important;vertical-align:middle !important;background:${svg(FISH(C.line))} center/contain no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.line} !important}

/* 线下小结卡：卡头一枚鱼形标签 */
[data-part="offlog"]{position:relative !important;overflow:visible !important;padding-top:22px !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin-top:-34px !important;margin-bottom:8px !important;padding:4px 22px 4px 30px !important;color:#fff !important;background:${C.line} ${svg(PAW("#fff"))} 10px center/12px 12px no-repeat !important;border-radius:999px 14px 14px 999px !important;letter-spacing:.08em !important}
[data-wk="offlogtitle"] *{color:#fff !important}
[data-wk="offlogtext"]{color:${C.ink} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.line} !important}
[data-wk="offlogtranscript"]{border-top:2px solid ${C.mist} !important;color:${C.line} !important}

/* 加号面板：一颗颗雾蓝毛线团 */
[data-wk="chatpanel"]{background:${C.milk} !important;border-top:2px solid ${C.mist} !important}
[data-wk="chattoolicon"]{background:#fff !important;border:2px solid ${C.line} !important;border-radius:50% !important;box-shadow:0 3px 0 #C3CEE0 !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.line} !important;color:${C.line} !important}
[data-wk="chattoollabel"]{color:${C.ink} !important}

/* 引用三处：待发送那条＝一张挂着的小鱼标签；气泡上方＝蓝灰小纸条；气泡里＝左边一条毛线 */
[data-wk="quotedraft"]{background:#fff !important;border:2px solid ${C.line} !important;border-radius:18px !important;position:relative !important;padding-left:40px !important;overflow:visible !important}
[data-wk="quotedraft"]::before{content:"" !important;position:absolute !important;left:10px !important;top:50% !important;width:22px !important;height:12px !important;margin-top:-6px !important;background:${svg(FISH(C.pinkD))} center/contain no-repeat !important}
[data-wk="quotedraft"] *{background:transparent !important;color:${C.ink} !important;border:none !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.line} !important}
[data-wk="quote"]{background:${C.mist2} !important;color:${C.ink} !important;border:1.5px solid ${C.line} !important;border-radius:14px !important;padding:3px 10px 3px 26px !important;opacity:1 !important;background-image:${svg(PAW(C.line))} !important;background-repeat:no-repeat !important;background-position:8px center !important;background-size:11px 11px !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:3px solid ${C.pink} !important;border-radius:2px !important;padding-left:8px !important;color:${C.line} !important}
/* 猫爪尾巴比狗爪大一圈，已读往下让一点别压着 */
[data-wk="meta"]{margin-top:8px !important}

/* 转账章：只留猫爪，不要字 */
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *,[data-wk="transfercard"][data-status="returned"] [data-wk="transferseal"] *{display:none !important}

/* ───── 猫猫 · 第三批：状态卡、翻旧、Ta 眼里、线下、通话 ───── */
/* 状态卡＝一只趴着的猫窝：奶白软垫，顶上一对大猫耳 */
[data-wk="statecard"]{background:${C.milk} !important;border:2.5px solid ${C.line} !important;border-radius:34px 34px 28px 28px !important;box-shadow:0 6px 0 #C3CEE0,0 18px 40px rgba(75,84,112,.22) !important;overflow:visible !important;position:relative !important;--sc-heart-ink:linear-gradient(to top,${C.pink},${C.pinkD}) !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;top:-26px !important;left:50% !important;width:150px !important;height:40px !important;margin-left:-75px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 14'><path d='M2 14 L7 1 L14 14Z M20 14 L27 1 L32 14Z' fill='#fff' stroke='${C.line}' stroke-width='2' stroke-linejoin='round'/><path d='M6 12 L7.5 6 L10 12Z M24 12 L26.5 6 L28 12Z' fill='${C.pink}'/></svg>`)} center/contain no-repeat !important;z-index:-1 !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:none !important;color:${C.ink} !important}
[data-wk="statehead"] button{border:2px solid ${C.line} !important;color:${C.line} !important;background:#fff !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.mist2} !important;border:none !important;border-radius:999px !important;margin:2px 16px 8px !important;padding:4px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.line} !important;border:2px solid transparent !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:#fff !important;color:${C.ink} !important;border-color:${C.line} !important;font-weight:700 !important}
[data-wk="statemood"]{display:inline-block !important;border:1.5px solid ${C.pinkD} !important;background:#FDEEF1 !important;color:${C.pinkD} !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important}
/* 看得见的：一扇小窗，窗格十字 */
[data-wk="stateseen"]{background:linear-gradient(${C.line},${C.line}) center/2px 100% no-repeat,linear-gradient(${C.line},${C.line}) center/100% 2px no-repeat,${C.mist2} !important;background-blend-mode:normal !important;margin:14px 16px 12px !important;border-radius:22px 22px 8px 8px !important;border:2.5px solid ${C.line} !important;color:${C.ink} !important;position:relative !important}
[data-wk="stateseen"]{background:${C.mist2} !important}
[data-wk="stateseen"]::before{content:"" !important;position:absolute !important;left:-6px !important;right:-6px !important;bottom:-8px !important;height:8px !important;border-radius:4px !important;background:${C.line} !important}
[data-wk="stateseen"] > span[aria-hidden]{display:none !important}
[data-wk="stateseen"] *{color:${C.ink} !important}
[data-wk="statewear"]{background:#fff !important;border:2px solid ${C.line} !important;border-radius:999px !important;color:${C.ink} !important}
[data-wk="statewear"] > span{background:${C.mist2} !important;border-radius:999px !important;color:${C.line} !important}
/* 心里想的：一朵思考泡泡，下面拖两颗小泡泡 */
[data-wk="statevoice"]{background:#fff !important;border:2.5px solid ${C.line} !important;border-radius:40px !important;position:relative !important;overflow:visible !important;color:${C.ink} !important;margin:16px 16px 34px !important;box-shadow:0 4px 0 #C3CEE0 !important}
[data-wk="statevoice"]::before,[data-wk="statevoice"]::after{content:"" !important;position:absolute !important;border-radius:50% !important;background:#fff !important;border:2.5px solid ${C.line} !important}
[data-wk="statevoice"]::before{width:18px !important;height:18px !important;left:30px !important;bottom:-22px !important}
[data-wk="statevoice"]::after{width:10px !important;height:10px !important;left:20px !important;bottom:-34px !important}
[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statevoice"] *{color:${C.ink} !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.line} !important}
/* 好感：一条小鱼干，肚子里装粉色，旋钮是一只猫爪 */
[data-wk="stateaff"]{background:transparent !important;border-top:2px solid ${C.mist} !important;position:relative !important;display:block !important;padding:16px 20px 74px !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:absolute !important;width:40px !important;height:230px !important;left:calc(50% - 20px) !important;bottom:-76px !important;transform:rotate(90deg) !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 230' preserveAspectRatio='none'><g fill='#000'><path d='M20 0 C34 10 40 40 40 115 C40 180 32 198 20 204 C8 198 0 180 0 115 C0 40 6 10 20 0Z'/><path d='M20 196 L38 230 L20 220 L2 230Z'/></g></svg>`)} !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:${C.line} !important;opacity:1 !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:3px !important}
[data-wk="stateheartbase"]{background:#fff !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{opacity:1 !important;border-top:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:22px !important;top:12px !important;font-size:26px !important;font-weight:700 !important;color:${C.ink} !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateheartknob"]{display:block !important;width:30px !important;height:30px !important;margin:0 0 -15px -15px !important;border-radius:50% !important;background:#fff ${svg(PAW(C.pinkD))} center/18px 18px no-repeat !important;border:2.5px solid ${C.line} !important;transform:rotate(-90deg) !important;z-index:2 !important}

/* 翻旧的：一串猫爪脚印往下走 */
[data-wk="statehistbtn"]{border:2px solid ${C.line} !important;border-radius:999px !important;color:${C.line} !important;background:#fff !important}
[data-wk="statehisthead"] > :first-child{color:${C.ink} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:1.5px solid ${C.pinkD} !important;border-radius:999px !important;color:${C.pinkD} !important;background:#fff !important}
[data-wk="statehistlist"]{position:relative !important;padding-left:40px !important;margin-top:14px !important}
[data-wk="statehistlist"]::before{content:"" !important;position:absolute !important;left:8px !important;top:10px !important;bottom:30px !important;width:20px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 44'><g transform='translate(0 2) scale(.3)'>${X(PAW(C.line,.45))}</g><g transform='translate(7 24) scale(.3)'>${X(PAW(C.line,.45))}</g></svg>`)} center top/20px 44px repeat-y !important}
[data-wk="statehistitem"]{position:relative !important;background:#fff !important;border:2px solid ${C.line} !important;border-radius:22px !important;margin-bottom:16px !important;box-shadow:0 4px 0 #C3CEE0 !important;overflow:visible !important;margin-top:12px !important}
[data-wk="statehistitem"]::before{content:"" !important;position:absolute !important;top:-11px !important;left:20px !important;width:34px !important;height:14px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 14'><path d='M2 14 L7 1 L14 14Z M20 14 L27 1 L32 14Z' fill='#fff' stroke='${C.line}' stroke-width='2' stroke-linejoin='round'/><path d='M6 12 L7.5 6 L10 12Z M24 12 L26.5 6 L28 12Z' fill='${C.pink}'/></svg>`)} center/contain no-repeat !important}
[data-wk="statehistmood"]{border:1.5px solid ${C.pinkD} !important;background:#FDEEF1 !important;color:${C.pinkD} !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:${C.line} !important}
[data-wk="statehisttext"]{color:${C.ink} !important}
[data-wk="statehistmeta"]{background:${C.mist2} !important;border-radius:16px !important}
[data-wk="statehistact"],[data-wk="statehistwear"]{color:${C.ink} !important}
[data-wk="statehistend"]{color:${C.line} !important}
[data-wk="statehistend"]::before{content:"" !important;display:inline-block !important;width:26px !important;height:13px !important;margin-right:8px !important;background:${svg(FISH(C.line))} center/contain no-repeat !important}

/* Ta 眼里：每张卡顶一对猫耳 */
[data-wk="gazepage"]{background:transparent !important}
[data-wk="gazetab"]{background:${C.mist2} !important;color:${C.line} !important;border-radius:999px !important;border:none !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.line} !important;color:#fff !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.line} !important}
[data-wk="gazecard"]{background:#fff !important;border:2px solid ${C.line} !important;border-radius:22px !important;box-shadow:0 4px 0 #C3CEE0 !important;position:relative !important;overflow:visible !important;margin-top:14px !important}
[data-wk="gazecard"]::before{content:"" !important;position:absolute !important;top:-11px !important;left:20px !important;width:34px !important;height:14px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 14'><path d='M2 14 L7 1 L14 14Z M20 14 L27 1 L32 14Z' fill='#fff' stroke='${C.line}' stroke-width='2' stroke-linejoin='round'/><path d='M6 12 L7.5 6 L10 12Z M24 12 L26.5 6 L28 12Z' fill='${C.pink}'/></svg>`)} center/contain no-repeat !important}
[data-wk="gazecardname"]{color:${C.ink} !important;font-weight:700 !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.line} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.milk} !important;border:2px solid ${C.line} !important;border-radius:24px !important}
[data-wk="gazeempty"]{border:2px solid ${C.line} !important;border-radius:22px !important;background:#fff ${svg(YARN())} center 22px/56px 56px no-repeat !important;padding:92px 12px 22px !important}
[data-wk="gazeempty"] > div:first-child{color:${C.ink} !important}
[data-wk="gazeempty"] button{background:${C.line} !important;color:#fff !important;border-radius:999px !important;box-shadow:0 3px 0 #6F7D99 !important}

/* ───── 线下（只在 offline 里） ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(TILE)} 0 0/200px 200px,linear-gradient(180deg,${C.mist2},${C.mist}) !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"]::after,[data-wk="offline"] [data-wk="chathead"]::before{display:none !important}
[data-wk="offline"] [data-wk="chathead"]{border-bottom:2px solid ${C.mist} !important}
[data-wk="offline"] [data-wk="offtitle"]{color:${C.ink} !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:#fff !important;border:1.5px solid ${C.line} !important;color:${C.line} !important;border-radius:999px !important}
[data-wk="offcomposer"]{background:${C.milk} !important;border-top:2px solid ${C.mist} !important}
[data-wk="offcomposer"] textarea{background:#fff !important;border:2px solid ${C.line} !important;border-radius:22px !important;color:${C.ink} !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:36px !important;height:36px !important;border:none !important;background:${svg(I_PLUS)} center/contain no-repeat !important;font-size:0 !important;color:transparent !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/contain no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcard"]{background:#fff !important;border:2px solid ${C.line} !important;border-left-width:2px !important;border-radius:24px !important;box-shadow:0 4px 0 #C3CEE0 !important;position:relative !important;overflow:visible !important;margin-top:14px !important}
[data-wk="offcard"][data-me="1"]{background:#E6EDF6 !important}
[data-wk="offcard"]::before{content:"" !important;position:absolute !important;top:-11px !important;left:24px !important;width:34px !important;height:14px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 14'><path d='M2 14 L7 1 L14 14Z M20 14 L27 1 L32 14Z' fill='#fff' stroke='${C.line}' stroke-width='2' stroke-linejoin='round'/><path d='M6 12 L7.5 6 L10 12Z M24 12 L26.5 6 L28 12Z' fill='${C.pink}'/></svg>`)} center/contain no-repeat !important}
[data-wk="offcard"][data-me="1"]::before{left:auto !important;right:24px !important}
[data-wk="offcard"]::after{content:"" !important;position:absolute !important;right:14px !important;bottom:10px !important;width:18px !important;height:17px !important;background:${svg(PAW(C.line,.5))} center/contain no-repeat !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 2px #fff,0 0 0 3.5px ${C.line} !important}
[data-wk="offname"]{color:${C.ink} !important;font-weight:700 !important}
[data-wk="offtext"]{color:${C.ink} !important}
[data-wk="offsay"]{background:linear-gradient(transparent 58%,#F9D9E0 58%) !important;color:${C.ink} !important;font-weight:700 !important;box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important}
[data-wk="offthought"]{background:${C.mist2} !important;border:none !important;border-radius:22px !important;padding:10px 14px 10px 34px !important;position:relative !important;color:${C.line} !important}
[data-wk="offthought"]::before{content:"" !important;position:absolute !important;left:10px !important;top:12px !important;width:18px !important;height:16px !important;background:${svg(PAW(C.pinkD))} center/contain no-repeat !important}
[data-wk="offcardacts"] svg{stroke:${C.line} !important;color:${C.line} !important}
[data-wk="offreplyopt"]{background:#fff !important;border:1.5px solid ${C.line} !important;border-radius:999px !important;color:${C.ink} !important}

/* ───── 通话 ───── */
[data-wk="callbubble"]{background:#fff !important;color:${C.ink} !important;border:2px solid ${C.line} !important;border-radius:24px !important;position:relative !important;overflow:visible !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:#DCE6F3 !important}
[data-wk="callbubble"]::after{content:"" !important;position:absolute !important;bottom:-9px !important;left:-6px !important;width:20px !important;height:18px !important;background:${svg(CATPAW())} center/contain no-repeat !important;transform:rotate(-20deg) !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]::after{left:auto !important;right:-6px !important;transform:rotate(20deg) !important;background:${svg(CATPAW("#DCE6F3"))} center/contain no-repeat !important}
[data-wk="callact"]{color:#E3EAF5 !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 5px #fff,0 0 0 8px ${C.line} !important}
[data-wk="note"][data-part="callsum"]{color:${C.line} !important}
[data-wk="statehistitem"]{padding:14px 16px !important}
[data-wk="statehistmeta"]{padding:8px 12px !important}
[data-wk="gazetitle"]{color:${C.line} !important}

/* ── 第三批返工 ── */
/* 状态卡顶上趴一整只猫，两只前爪搭在卡边 */
[data-wk="statecard"]::before{top:-60px !important;width:150px !important;height:78px !important;margin-left:-75px !important;background:${svg(LOAFCAT)} center bottom/contain no-repeat !important;z-index:3 !important}
[data-wk="statehead"]{padding-top:22px !important}
/* 小鱼干好感条换蓝色系 */
[data-wk="statecard"]{--sc-heart-ink:linear-gradient(to top,#B9CBE4,#6F86AD) !important}
[data-wk="stateheartknob"]{background:#fff ${svg(PAW(C.line))} center/18px 16px no-repeat !important}
/* 翻旧的：不再是一排卡片——一朵朵思考泡泡左右交替往下冒，泡泡尾巴指向那一侧，底下一只睡觉的猫 */
[data-wk="statehistlist"]{padding-left:0 !important}
[data-wk="statehistlist"]::before{display:none !important}
[data-wk="statehistitem"]{width:84% !important;border-radius:40px !important;margin:0 0 30px !important;padding:16px 20px !important;box-shadow:0 4px 0 #C3CEE0 !important}
[data-wk="statehistitem"]:nth-child(even){margin-left:auto !important;background:#E6EDF6 !important}
[data-wk="statehistitem"]::before{top:auto !important;bottom:-20px !important;left:34px !important;width:16px !important;height:16px !important;border-radius:50% !important;background:inherit !important;border:2px solid ${C.line} !important}
[data-wk="statehistitem"]::after{content:"" !important;position:absolute !important;bottom:-30px !important;left:26px !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#fff !important;border:2px solid ${C.line} !important}
[data-wk="statehistitem"]:nth-child(even)::before{left:auto !important;right:34px !important}
[data-wk="statehistitem"]:nth-child(even)::after{left:auto !important;right:26px !important}
[data-wk="statehistmeta"]{background:transparent !important;border-top:2px solid ${C.mist} !important;border-radius:0 !important;padding:8px 2px 0 !important}
[data-wk="statehisttime"]{float:right !important}
[data-wk="statehistend"]{flex-direction:column !important;padding-top:70px !important;position:relative !important}
[data-wk="statehistend"]::before{position:absolute !important;top:0 !important;left:50% !important;margin:0 0 0 -50px !important;width:100px !important;height:60px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><g stroke='${C.line}' stroke-width='2.4' stroke-linejoin='round' stroke-linecap='round'><path d='M14 52 C6 36 22 22 50 22 C80 22 94 36 86 52Z M86 50 C98 46 98 30 88 34' fill='#fff'/><path d='M26 30 L24 16 L36 24Z M50 22 L58 12 L60 26Z' fill='#fff'/><path d='M30 38 q4 3 8 0 M46 38 q4 3 8 0' fill='none'/></g><text x='70' y='16' font-size='12' fill='${C.line}' font-family='sans-serif'>z</text><text x='80' y='8' font-size='9' fill='${C.line}' font-family='sans-serif'>z</text></svg>`)} center/contain no-repeat !important}

/* 线下小结：卡顶右角蜷着一只睡猫，标题是一颗圆胶囊挂在卡边上 */
[data-part="offlog"]{margin-top:30px !important;padding-top:26px !important}
[data-part="offlog"]::before{content:"" !important;position:absolute !important;right:18px !important;top:-40px !important;width:84px !important;height:50px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><g stroke='${C.line}' stroke-width='2.4' stroke-linejoin='round' stroke-linecap='round'><path d='M14 58 C6 36 22 22 50 22 C80 22 94 36 86 58Z M86 54 C98 50 98 34 88 38' fill='#fff'/><path d='M26 30 L24 16 L36 24Z M50 22 L58 12 L60 26Z' fill='#fff'/><path d='M30 38 q4 3 8 0 M46 38 q4 3 8 0' fill='none'/></g><ellipse cx='30' cy='45' rx='4' ry='2.4' fill='${C.pink}' opacity='.7'/><ellipse cx='56' cy='45' rx='4' ry='2.4' fill='${C.pink}' opacity='.7'/><text x='70' y='16' font-size='12' fill='${C.line}' font-family='sans-serif'>z</text><text x='80' y='8' font-size='9' fill='${C.line}' font-family='sans-serif'>z</text></svg>`)} center bottom/contain no-repeat !important}
[data-wk="offlogtitle"]{position:absolute !important;top:-14px !important;left:18px !important;margin:0 !important;border-radius:999px !important;padding:4px 16px 4px 30px !important;box-shadow:0 3px 0 #6F7D99 !important}

/* 线下卡的猫耳从卡边长出来：耳朵填卡片同色、底边不描线，盖住那段边框，像卡片自己冒出来的 */
[data-wk="offcard"]::before{top:-19px !important;left:28px !important;width:64px !important;height:22px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 22'><g fill='#fff' stroke='${C.line}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'><path d='M2 22 C6 16 8 6 12 3 C15 1 18 3 22 9 C25 14 28 18 30 22'/><path d='M34 22 C36 18 39 14 42 9 C46 3 49 1 52 3 C56 6 58 16 62 22'/></g><g fill='#fff'><rect x='0' y='19.6' width='64' height='3'/></g><g fill='${C.pink}' opacity='.75'><path d='M10 18 C11 12 13 7 15 7 C17 7 19 12 21 18Z'/><path d='M43 18 C45 12 47 7 49 7 C51 7 53 12 54 18Z'/></g></svg>`)} center bottom/100% 100% no-repeat !important}
[data-wk="offcard"][data-me="1"]::before{left:auto !important;right:28px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 22'><g fill='#E6EDF6' stroke='${C.line}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'><path d='M2 22 C6 16 8 6 12 3 C15 1 18 3 22 9 C25 14 28 18 30 22'/><path d='M34 22 C36 18 39 14 42 9 C46 3 49 1 52 3 C56 6 58 16 62 22'/></g><g fill='#E6EDF6'><rect x='0' y='19.6' width='64' height='3'/></g><g fill='${C.pink}' opacity='.75'><path d='M10 18 C11 12 13 7 15 7 C17 7 19 12 21 18Z'/><path d='M43 18 C45 12 47 7 49 7 C51 7 53 12 54 18Z'/></g></svg>`)} center bottom/100% 100% no-repeat !important}

/* 线下：底栏那颗「给 Ta 看真实照片」藏起来；顶栏「给 Ta 一个提示」换成毛线团 */
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{display:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:30px !important;height:30px !important;background:${svg(I_PLUS)} center/contain no-repeat !important;border:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}

/* 线上气泡也换软猫耳 */
[data-wk="bubble"][data-kind="text"]::before{top:-14px !important;width:46px !important;height:17px !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{right:24px !important;background:${svg(SOFTEARS("#DCE6F3"))} center bottom/100% 100% no-repeat !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{left:24px !important;background:${svg(SOFTEARS("#fff"))} center bottom/100% 100% no-repeat !important}

/* 短气泡耳朵自动缩：宽度跟着气泡走（最多 46px、最少 28px），底边始终压住边框 3px */
[data-wk="bubble"][data-kind="text"]::before{width:clamp(28px,40%,46px) !important;height:auto !important;aspect-ratio:64/22 !important;top:auto !important;bottom:calc(100% - 3px) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{right:clamp(12px,14%,24px) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{left:clamp(12px,14%,24px) !important}

/* 名字＝项圈上挂的小名牌：蓝灰描边的圆角牌子，左边一颗金铃铛 */
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]{display:inline-flex !important;max-width:100% !important;background:#fff ${svg(BELL)} 7px center/14px 14px no-repeat !important;border:1.5px solid ${C.line} !important;border-radius:11px !important;padding:0 8px 0 24px !important;line-height:1.35 !important;box-shadow:0 2px 0 #C3CEE0 !important;font-size:15px !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headdim"]{font-size:9px !important;opacity:.75 !important;margin:1px 0 0 6px !important;line-height:1.2 !important}

/* 名牌给名字让地方：铃铛挪到牌子左上角挂着，牌子里只剩名字；名字那一块尽量撑满；右边小房子和三颗爪收小 */
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:0 !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]{background:#fff !important;padding:0 9px !important;font-size:14px !important;position:relative !important;overflow:visible !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]::before{content:"" !important;position:absolute !important;left:-6px !important;top:-7px !important;width:13px !important;height:13px !important;background:${svg(BELL)} center/contain no-repeat !important}
[data-wk="sameroom"]{width:30px !important;min-width:30px !important;height:30px !important;background-size:26px !important}
[data-wk="chatmore"]{width:34px !important;min-width:34px !important;background-size:32px auto !important}

/* 顶栏头像的铃铛：框里那颗被头像图压住了，另画一颗一模一样的叠在最上面（好日子光圈那天让给光圈） */
[data-wk="chathead"] button:has(> [data-wk="avatar"]):not(:has(> [data-halo]))::after{content:"" !important;position:absolute !important;left:12.5px !important;top:calc(50% + 10px) !important;width:11px !important;height:11px !important;background:${svg(BELL)} center/contain no-repeat !important;z-index:3 !important;pointer-events:none !important}
/* 头像项圈上已经有铃铛了，名牌角上那颗去掉 */
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]::before{content:none !important}
`;

const pack = { kind: "chat-look", v: 1, name: "猫猫", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "猫猫-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
