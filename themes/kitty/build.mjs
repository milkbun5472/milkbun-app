// 猫猫聊天美化：生成 chat-look 包。用法：node themes/kitty/build.mjs
// 配色：奶白 #FBFAF7 / 雾蓝 #DCE6F2 / 蓝灰描边 #8C9BB8 / 深字 #4B5470 / 樱花粉 #F2B8C4 / 铃铛金 #E8B85A
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { milk: "#FBFAF7", mist: "#DCE6F2", mist2: "#EEF3F9", line: "#8C9BB8", ink: "#4B5470", pink: "#F2B8C4", pinkD: "#E58FA2", gold: "#E8B85A" };
const X = s => s.replace(/<\/?svg[^>]*>/g, "");

const PAW = (f = C.line, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g fill='${f}' opacity='${o}'><ellipse cx='20' cy='26' rx='9' ry='7.5'/><ellipse cx='9.5' cy='16' rx='3.6' ry='4.6'/><ellipse cx='16' cy='9.5' rx='3.6' ry='4.8'/><ellipse cx='24' cy='9.5' rx='3.6' ry='4.8'/><ellipse cx='30.5' cy='16' rx='3.6' ry='4.6'/></g></svg>`;
const FISH = (f = C.line, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 20'><g fill='${f}' opacity='${o}'><path d='M4 10 C10 2 24 2 30 10 C24 18 10 18 4 10Z'/><path d='M30 10 L38 3 L36 10 L38 17Z'/></g><circle cx='10' cy='9' r='1.5' fill='#fff'/></svg>`;
const BONE = (f = C.line, o = 1) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 20'><g stroke='${f}' stroke-width='2' stroke-linecap='round' fill='none' opacity='${o}'><path d='M6 10 H34'/><path d='M12 4 V16 M18 3 V17 M24 3 V17 M30 4 V16'/><path d='M34 10 L41 4 M34 10 L41 16'/></g><circle cx='5' cy='10' r='3.5' fill='${f}' opacity='${o}'/></svg>`;
const YARN = (f = C.pink, k = f === C.pink ? C.pinkD : C.line) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='16' fill='${f}' stroke='${k}' stroke-width='1.6'/><g fill='none' stroke='${k}' stroke-width='1.3' opacity='.8'><path d='M6 15 C14 20 26 20 34 15'/><path d='M5 23 C14 28 26 28 35 23'/><path d='M14 5 C18 14 18 26 14 35'/><path d='M24 5 C28 14 28 26 24 35'/></g></svg>`;
const BELL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8' fill='${C.gold}' stroke='#B88A33' stroke-width='1.2'/><path d='M3 9 H17' stroke='#B88A33' stroke-width='1.1'/><circle cx='10' cy='13' r='1.6' fill='#7A5A20'/><path d='M10 14 V17' stroke='#7A5A20' stroke-width='1.2'/></svg>`;

// 猫耳头像框（耳朵＋项圈＋铃铛），flip 给我那颗
const EARS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g stroke='${C.line}' stroke-width='3' stroke-linejoin='round' fill='#F4F7FB'><path d='M16 40 C10 24 12 10 18 4 C26 6 38 14 44 24 C34 26 24 32 16 40Z'/><path d='M84 40 C90 24 88 10 82 4 C74 6 62 14 56 24 C66 26 76 32 84 40Z'/></g><path d='M20 32 C17 22 18 14 21 10 C27 13 34 18 37 23 C30 25 25 28 20 32Z M80 32 C83 22 82 14 79 10 C73 13 66 18 63 23 C70 25 75 28 80 32Z' fill='${C.pink}'/><path d='M24 26 l4 -3 M27 29 l5 -2 M76 26 l-4 -3 M73 29 l-5 -2' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/><circle cx='50' cy='52' r='38' fill='none' stroke='${C.line}' stroke-width='2.6'/><path d='M22 80 Q50 95 78 80' fill='none' stroke='${C.pink}' stroke-width='5.5' stroke-linecap='round'/><g transform='translate(41 82)'><circle cx='9' cy='9' r='8' fill='${C.gold}' stroke='#B88A33' stroke-width='1.2'/><path d='M2 8 H16' stroke='#B88A33' stroke-width='1.1'/><circle cx='9' cy='12' r='1.6' fill='#7A5A20'/></g></svg>`;


// 背景：雾蓝底，散着淡淡的小鱼、鱼骨、爪印
const TILE = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><g opacity='.16'><g transform='translate(18 22) scale(.8)'>${X(FISH())}</g><g transform='translate(120 40) rotate(-12) scale(.7)'>${X(BONE())}</g><g transform='translate(150 120) scale(.55)'>${X(PAW())}</g><g transform='translate(40 140) rotate(15) scale(.7)'>${X(BONE())}</g><g transform='translate(80 90) scale(.45)'>${X(PAW())}</g><g transform='translate(140 175) rotate(-8) scale(.7)'>${X(FISH())}</g></g></svg>`;
// 一根毛线从顶上弯弯绕绕穿过整页，底下滚着毛线团
const YARNLINE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 760' preserveAspectRatio='none'><path d='M300 0 C300 120 70 140 90 260 C110 380 330 340 310 480 C290 620 300 680 300 760' fill='none' stroke='${C.pink}' stroke-width='2.4' stroke-linecap='round' opacity='.75'/></svg>`;
// 顶栏下沿：一圈波浪布边，挂着毛线球、鱼干、铃铛、小鱼
const HEM = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 64' preserveAspectRatio='xMidYMin slice'><path d='M0 0 H390 V8 Q382 16 374 8 T358 8 T342 8 T326 8 T310 8 T294 8 T278 8 T262 8 T246 8 T230 8 T214 8 T198 8 T182 8 T166 8 T150 8 T134 8 T118 8 T102 8 T86 8 T70 8 T54 8 T38 8 T22 8 T6 8 T-10 8Z' fill='${C.milk}'/><path d='M390 8 Q382 16 374 8 T358 8 T342 8 T326 8 T310 8 T294 8 T278 8 T262 8 T246 8 T230 8 T214 8 T198 8 T182 8 T166 8 T150 8 T134 8 T118 8 T102 8 T86 8 T70 8 T54 8 T38 8 T22 8 T6 8 T-10 8' fill='none' stroke='${C.line}' stroke-width='2'/><g stroke='${C.line}' stroke-width='1.2'><path d='M70 12 V30'/><path d='M150 12 V24'/><path d='M230 12 V34'/><path d='M300 12 V26'/></g><g transform='translate(59 28) scale(.55)'>${X(YARN(C.mist))}</g><g transform='translate(143 22) rotate(90 0 0) scale(.45)'>${X(BONE())}</g><g transform='translate(221 32) scale(.9)'>${X(BELL)}</g><g transform='translate(293 24) rotate(90) scale(.5)'>${X(FISH(C.pinkD))}</g></svg>`;
const TAIL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 120'><path d='M14 0 C10 40 46 50 38 82 C32 108 6 104 12 86 C16 74 30 84 24 92' fill='none' stroke='${C.line}' stroke-width='16' stroke-linecap='round'/><path d='M14 0 C10 40 46 50 38 82 C32 108 6 104 12 86 C16 74 30 84 24 92' fill='none' stroke='#A9B6CE' stroke-width='11' stroke-linecap='round'/></svg>`;

// 按键
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${X(YARN(C.mist))}<path d='M20 12 V28 M12 20 H28' stroke='${C.ink}' stroke-width='2.6' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><circle cx='22' cy='22' r='20' fill='${C.line}'/><g transform='translate(5 12) scale(.85)'><path d='M4 10 C10 2 24 2 30 10 C24 18 10 18 4 10Z' fill='#fff'/><path d='M30 10 L38 3 L36 10 L38 17Z' fill='#fff'/><circle cx='10' cy='9' r='1.5' fill='${C.line}'/></g></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 46'><g stroke='${C.line}' stroke-width='2.4' stroke-linejoin='round'><path d='M8 18 L6 2 L20 12Z' fill='#fff'/><path d='M42 18 L44 2 L30 12Z' fill='#fff'/><path d='M10 12 h30 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 h-18 l-8 7 l1 -7 h-5 a6 6 0 0 1 -6 -6 v-14 a6 6 0 0 1 6 -6z' fill='#fff'/></g><path d='M9 13 L8 6 L15 11Z M41 13 L42 6 L35 11Z' fill='${C.pink}'/><circle cx='18' cy='25' r='2' fill='${C.line}'/><circle cx='25' cy='25' r='2' fill='${C.line}'/><circle cx='32' cy='25' r='2' fill='${C.line}'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g stroke='${C.line}' stroke-width='2.2' stroke-linejoin='round' fill='#fff'><path d='M6 18 L20 6 L34 18 V34 H6Z'/><path d='M15 34 V24 a5 5 0 0 1 10 0 V34'/></g><path d='M12 10 L11 3 L17 7Z M28 10 L29 3 L23 7Z' fill='${C.pink}' stroke='${C.line}' stroke-width='1.5'/></svg>`;
const I_PAWS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 22'><g transform='translate(0 3) scale(.4)'>${X(PAW())}</g><g transform='translate(20 0) scale(.5)'>${X(PAW())}</g><g transform='translate(42 3) scale(.4)'>${X(PAW())}</g></svg>`;

const bubble = { myBg: "#CFDAEA", myText: C.ink, myBorder: "2px solid " + C.line, charBg: "#fff", charText: C.ink, charBorder: "2px solid " + C.line, radius: 22, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 猫猫 · 第一批 ───── */
[data-wk="chat"]{background:${svg(TILE)} 0 0/200px 200px,linear-gradient(180deg,${C.mist2},${C.mist}) !important;position:relative !important}
[data-wk="chat"]::before{content:"" !important;position:absolute !important;left:24px !important;bottom:96px !important;width:54px !important;height:54px !important;background:${svg(YARN())} center/contain no-repeat !important;pointer-events:none !important;z-index:0 !important;animation:ktRoll 6s ease-in-out infinite !important}
@keyframes ktRoll{0%,100%{transform:translateX(0) rotate(0)}50%{transform:translateX(14px) rotate(60deg)}}
[data-wk="body"]{background:${svg(YARNLINE)} center top/100% 760px repeat-y local !important;position:relative !important;z-index:1 !important;padding-top:44px !important}
/* 顶栏：奶白，下沿波浪布边挂小东西，右边垂一条会摆的尾巴 */
[data-wk="chathead"]{background:${C.milk} !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important;overflow:visible !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:calc(100% - 1px) !important;height:52px !important;background:${svg(HEM)} center top/100% auto no-repeat !important;pointer-events:none !important}
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
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;inset:-26% !important;top:-36% !important;background:${svg(EARS)} center/contain no-repeat !important;pointer-events:none !important;z-index:2 !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::before{content:"" !important;position:absolute !important;width:52px !important;height:52px !important;left:-8px !important;top:calc(50% - 30px) !important;background:${svg(EARS)} center/contain no-repeat !important;pointer-events:none !important;z-index:2 !important}

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
`;
