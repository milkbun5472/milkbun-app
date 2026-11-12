// 红帽夜访：墨绿丝绒窗帘夜林；我的是红斗篷布气泡（白色缝线），他的是外婆篮子上的麻布（左边红格子布边）；已读是黑里一双狼眼。用法：node themes/redhood/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#13241E", red: "#C2412F", red2: "#9E2E22", linen: "#F1E6D2", ink: "#3A2A20", cream: "#FBF3E4", gold: "#F2B640", fog: "#A8B5A8", wood: "#2A1C15" };
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
// 布纹：麻布细点
const LINEN = X(`width='6' height='6' viewBox='0 0 6 6'><path d='M0 1.5H6M0 4.5H6' stroke='rgba(120,90,60,.07)'/><path d='M1.5 0V6M4.5 0V6' stroke='rgba(120,90,60,.05)'/>`);
// 红格子
const GING = X(`width='8' height='8' viewBox='0 0 8 8'><rect width='8' height='8' fill='#F6E8D8'/><rect width='4' height='8' fill='rgba(194,65,47,.55)'/><rect width='8' height='4' fill='rgba(194,65,47,.55)'/>`);
// 窗帘褶子
const CURTAIN = `repeating-linear-gradient(90deg,rgba(0,0,0,.42) 0,rgba(0,0,0,.08) 22px,rgba(120,170,140,.10) 40px,rgba(0,0,0,.05) 56px,rgba(0,0,0,.42) 78px)`;
// 狼眼（已读）
const EYES = X(`viewBox='0 0 40 14'><g fill='${C.gold}'><path d='M3 7 Q9 2 15 7 Q9 11 3 7Z'/><path d='M25 7 Q31 2 37 7 Q31 11 25 7Z'/></g><g fill='#2A1406'><ellipse cx='9' cy='7' rx='1' ry='2.6'/><ellipse cx='31' cy='7' rx='1' ry='2.6'/></g>`);
// 狼耳朵（他的头像顶上）
const EARS = X(`viewBox='0 0 60 24'><g fill='#4A4040' stroke='#2B2424' stroke-width='1'><path d='M6 24 L11 1 L24 18Z'/><path d='M54 24 L49 1 L36 18Z'/></g><g fill='#9A7C78'><path d='M10 20 L12 7 L19 17Z'/><path d='M50 20 L48 7 L41 17Z'/></g>`);
// 小红帽兜尖 + 白蝴蝶结（我的头像）
const HOOD = X(`viewBox='0 0 30 30'><path d='M2 28 Q6 8 28 2 Q24 14 26 28Z' fill='${C.red}' stroke='${C.red2}'/>`);
const BOW = X(`viewBox='0 0 30 22'><g fill='${C.cream}' stroke='#B9A58C' stroke-width='1'><path d='M15 8 C9 1 2 3 4 8 C5 12 11 11 15 8Z'/><path d='M15 8 C21 1 28 3 26 8 C25 12 19 11 15 8Z'/><path d='M14 9 L9 21 L12 19 L14 21Z'/><path d='M16 9 L21 21 L18 19 L16 21Z'/><circle cx='15' cy='8.5' r='2.4'/></g>`);
// 按键：配套画的图
const I_LANTERN = X(`viewBox='0 0 30 30' fill='none' stroke='${C.cream}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M12 4 Q15 1 18 4'/><path d='M10 7 H20 L19 9 H11Z'/><path d='M11 9 Q8 16 11 24 H19 Q22 16 19 9'/><path d='M10 24 H20 V26 H10Z'/><path d='M15 13 Q13 16 15 19 Q17 16 15 13Z' fill='${C.gold}' stroke='${C.gold}'/>`);
const I_PAW = X(`viewBox='0 0 30 30' fill='${C.cream}'><ellipse cx='15' cy='20' rx='6.5' ry='5.5'/><ellipse cx='7' cy='13' rx='2.6' ry='3.4' transform='rotate(-20 7 13)'/><ellipse cx='12' cy='8' rx='2.6' ry='3.6'/><ellipse cx='18' cy='8' rx='2.6' ry='3.6'/><ellipse cx='23' cy='13' rx='2.6' ry='3.4' transform='rotate(20 23 13)'/>`);
const I_MUSH = X(`viewBox='0 0 30 30'><path d='M3 15 Q4 4 15 4 Q26 4 27 15 Z' fill='${C.red}' stroke='${C.cream}' stroke-width='1.4'/><g fill='${C.cream}'><circle cx='10' cy='10' r='1.8'/><circle cx='17' cy='8' r='1.4'/><circle cx='21' cy='12' r='1.6'/></g><path d='M11 15 Q10 24 12 26 H18 Q20 24 19 15Z' fill='${C.cream}'/>`);
const I_BASKET = X(`viewBox='0 0 40 36'><path d='M9 16 Q20 -1 31 16' fill='none' stroke='#E3C79A' stroke-width='2.4'/><circle cx='17' cy='13' r='5' fill='${C.red}'/><path d='M17 8 q1 -3 3 -3' stroke='#4C6B3A' stroke-width='1.5' fill='none'/><path d='M5 15 H35 L31 33 H9Z' fill='#B98A55' stroke='${C.wood}' stroke-width='1.3'/><path d='M7 20 H33 M8 25 H32 M9 30 H31' stroke='${C.wood}' stroke-width='1' opacity='.55'/><path d='M5 15 H35 V18 H5Z' fill='rgba(194,65,47,.9)'/><path d='M8 15 V18 M12 15 V18 M16 15 V18 M20 15 V18 M24 15 V18 M28 15 V18 M32 15 V18' stroke='${C.cream}' stroke-width='1.2'/>`);
const I_LETTER = X(`viewBox='0 0 46 34'><path d='M5 6 H41 V28 H5Z' fill='${C.cream}' stroke='#B9A58C' stroke-width='1.3'/><path d='M5 6 L23 19 L41 6' fill='none' stroke='#B9A58C' stroke-width='1.3'/><circle cx='23' cy='19' r='4.6' fill='${C.red}'/><path d='M23 21.5 C20 19.5 20 18 21.4 17.4 C22.3 17 23 17.8 23 18.3 C23 17.8 23.7 17 24.6 17.4 C26 18 26 19.5 23 21.5Z' fill='${C.cream}'/>`);
const APPLE = X(`viewBox='0 0 20 20'><path d='M10 6 C6 3 2 5 2.5 10 C3 15 7 19 10 17 C13 19 17 15 17.5 10 C18 5 14 3 10 6Z' fill='${C.red}' stroke='${C.cream}' stroke-width='1.2'/><path d='M10 6 Q10 3 12 1.5' stroke='${C.cream}' stroke-width='1.2' fill='none'/><path d='M11 4 Q14 2 15.5 4 Q13 5.5 11 4Z' fill='#6E9A4E'/>`);
const FERN = X(`viewBox='0 0 60 12' fill='none' stroke='rgba(168,181,168,.7)' stroke-width='1' stroke-linecap='round'><path d='M2 6 H58'/><path d='M8 6 L5 2 M8 6 L5 10 M16 6 L13 2 M16 6 L13 10 M24 6 L21 2 M24 6 L21 10 M36 6 L39 2 M36 6 L39 10 M44 6 L47 2 M44 6 L47 10 M52 6 L55 2 M52 6 L55 10'/>`);

const SEAL = X(`viewBox='0 0 40 40'><path d='M20 3 C25 3 27 6 31 7 C35 9 36 13 37 17 C38 22 35 25 34 29 C32 34 27 36 22 37 C17 38 13 36 9 33 C5 30 3 26 3 21 C3 15 5 11 9 7 C12 4 16 3 20 3Z' fill='${C.red}'/><circle cx='20' cy='20' r='11' fill='none' stroke='#E07B66' stroke-width='1.4'/><path d='M20 27 C12 21 12 18 13.5 16 C15 14 18 14.5 20 17 C22 14.5 25 14 26.5 16 C28 18 28 21 20 27Z' fill='#8E281E'/>`);
const HOODBIG = X(`viewBox='0 0 40 40'><path d='M20 3 C31 3 36 13 35 25 L38 37 H2 L5 25 C4 13 9 3 20 3Z' fill='${C.red}' stroke='${C.red2}' stroke-width='1.2'/><ellipse cx='20' cy='22' rx='9' ry='10' fill='#F3D2B8'/><path d='M11 18 Q20 8 29 18 Q26 13 20 13 Q14 13 11 18Z' fill='#6B3A24'/><path d='M14 33 L20 30 L26 33 L20 35Z' fill='${C.cream}'/>`);
const WINDOW = X(`viewBox='0 0 30 30'><rect x='3' y='3' width='24' height='24' rx='3' fill='#1E3A30' stroke='${C.cream}' stroke-width='1.6'/><circle cx='20' cy='10' r='3' fill='${C.gold}'/><path d='M3 23 L9 13 L13 19 L17 12 L27 24 V27 H3Z' fill='#0E1E18'/><path d='M15 3 V27 M3 15 H27' stroke='${C.cream}' stroke-width='1' opacity='.6'/>`);
const bubble = { myBg: C.red, myText: C.cream, myBorder: "none", charBg: C.linen, charText: C.ink, charBorder: "none", radius: 10, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
const STITCH = "rgba(251,243,228,.85)";
const css = `
/* ───── 红帽夜访 · 第一批 ───── */
[data-wk="chat"]{background:radial-gradient(ellipse at 50% 35%,rgba(90,140,110,.22),transparent 65%),${CURTAIN},linear-gradient(180deg,#1A3229,${C.bg} 70%,#0C1814) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：深木色横梁，底下垂一条红格子布边；顶上一道缝线 */
[data-wk="chathead"]{position:relative !important;background:linear-gradient(180deg,#3A2820,${C.wood}) !important;border-bottom:none !important;box-shadow:0 6px 14px rgba(0,0,0,.45) !important;overflow:visible !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:-7px !important;height:7px !important;background:${svg(GING)} 0 0/8px 8px !important;border-bottom:1px solid ${C.red2} !important;pointer-events:none !important;z-index:2 !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:8px !important;right:8px !important;bottom:5px !important;border-bottom:1.5px dashed rgba(242,182,64,.45) !important;pointer-events:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.cream} !important;font-family:"Songti SC","Noto Serif SC",serif !important;letter-spacing:.06em !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:#C9B48F !important;font-style:italic !important}
[data-wk="chatback"] svg{stroke:${C.cream} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;height:26px !important;flex-shrink:0 !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_LANTERN)} center/contain no-repeat !important;margin-left:auto !important;filter:drop-shadow(0 0 4px rgba(242,182,64,.6)) !important}
[data-wk="chatmore"]{background:${svg(I_PAW)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
/* 顶栏双头像：小红帽和狼外婆挨着，中间一颗小苹果 */
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-12px !important;flex-shrink:0 !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:32px !important;height:32px !important;min-width:32px !important;flex-shrink:0 !important;aspect-ratio:1 !important;border-radius:50% !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img{box-shadow:0 0 0 2.5px ${C.red},0 0 0 4px ${C.cream} !important}
[data-wk="chathead"] [data-wk="avatar"]{box-shadow:0 0 0 2.5px ${C.cream},0 0 0 4px #6F5A50 !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-9px !important;bottom:-4px !important;width:14px !important;height:14px !important;z-index:3 !important;background:${svg(APPLE)} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important}
[data-wk="chathead"] [data-wk="headname"] > div:last-child{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}

/* 头像：他是一圈奶白蕾丝、顶上两只狼耳朵；我是红斗篷一圈、右上兜尖、下面系白蝴蝶结 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){position:relative !important;overflow:visible !important;box-shadow:0 0 0 3px ${C.cream},0 0 0 4px #D9C8AE,0 0 0 6px rgba(251,243,228,.55),0 3px 8px rgba(0,0,0,.4) !important}
[data-wk="msg"] button[data-wk="avatar"]::before,[data-wk="cardrow"] [data-wk="avatar"]::before{content:"" !important;position:absolute !important;left:-4px !important;right:-4px !important;top:-12px !important;height:14px !important;background:${svg(EARS)} center/100% 100% no-repeat !important;z-index:-1 !important;pointer-events:none !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"],[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]{box-shadow:0 0 0 4px ${C.red},0 0 0 5px ${C.red2},0 3px 8px rgba(0,0,0,.45) !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"]::before,[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]::before{left:auto !important;right:-10px !important;top:-12px !important;width:20px !important;height:20px !important;background:${svg(HOOD)} center/contain no-repeat !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"]::after,[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]::after{content:"" !important;position:absolute !important;left:calc(50% - 11px) !important;bottom:-12px !important;width:22px !important;height:16px !important;background:${svg(BOW)} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}

/* 气泡：我是红斗篷布——里面一圈白缝线；他是麻布——左边一条红格子布边 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:10px !important;font-family:"Songti SC","Noto Serif SC",serif !important;letter-spacing:.04em !important;line-height:1.6 !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${svg(LINEN)} 0 0/6px 6px,linear-gradient(180deg,#CF4D3A,${C.red2}) !important;color:${C.cream} !important;outline:1.5px dashed ${STITCH} !important;outline-offset:-5px !important;box-shadow:0 3px 0 ${C.red2},0 6px 12px rgba(0,0,0,.4) !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${svg(GING)} left top/8px 8px repeat-y,${svg(LINEN)} 0 0/6px 6px,${C.linen} !important;background-clip:border-box !important;color:${C.ink} !important;border-left:none !important;padding:11px 18px 11px 30px !important;box-shadow:inset 18px 0 0 -0px transparent,0 3px 0 #CDBB9E,0 6px 12px rgba(0,0,0,.35) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;left:0 !important;top:0 !important;bottom:0 !important;width:16px !important;background:${svg(GING)} 0 0/8px 8px !important;border-radius:10px 0 0 10px !important;border-right:1.5px solid rgba(158,46,34,.5) !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}

/* 时间：两边一根蕨叶 */
[data-wk="time"] > span{background:none !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;font-family:"Songti SC",serif !important;letter-spacing:.2em !important;font-size:11.5px !important;display:inline-flex !important;align-items:center !important;gap:10px !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;width:52px !important;height:10px !important;background:${svg(FERN)} center/contain no-repeat !important}
[data-wk="time"] > span::after{transform:scaleX(-1) !important}
/* 已读：黑里一双发亮的狼眼 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:34px !important;height:12px !important;background:${svg(EYES)} center/contain no-repeat !important;filter:drop-shadow(0 0 3px rgba(242,182,64,.8)) !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.linen} !important;border:none !important;border-radius:10px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.red} !important}

/* 动描：像童话书里的一页——旧纸色斜体，左边一道红墨竖线，没有缝线和格子 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{display:block !important;background:linear-gradient(90deg,rgba(242,226,196,.13),rgba(242,226,196,.04)) !important;border:none !important;border-left:2px solid rgba(194,65,47,.75) !important;border-radius:0 !important;box-shadow:none !important;color:#E7D8BC !important;opacity:1 !important;font-family:"Songti SC","Noto Serif SC",serif !important;font-style:italic !important;font-size:13px !important;line-height:1.85 !important;padding:6px 14px !important}
/* 系统提示：一行小字，两头一朵小花饰 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important}
[data-wk="sysnotetext"]::before{content:"❦ " !important;color:${C.gold} !important}
[data-wk="sysnotetext"]::after{content:" ❦" !important;color:${C.gold} !important}

/* 底栏：深木色篮子边，顶上垂一条红格子布、一道金缝线；左蘑菇加号、中间麻布输入框、右边是送花篮和封蜡信 */
[data-wk="composer"]{position:relative !important;background:linear-gradient(180deg,${C.wood},#1E140F) !important;border-top:none !important;box-shadow:0 -6px 14px rgba(0,0,0,.45) !important;align-items:center !important;gap:8px !important;overflow:visible !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:-7px !important;height:7px !important;background:${svg(GING)} 0 0/8px 8px !important;border-top:1px solid ${C.red2} !important;pointer-events:none !important}
[data-wk="composer"]::after{content:"" !important;position:absolute !important;left:8px !important;right:8px !important;top:5px !important;border-top:1.5px dashed rgba(242,182,64,.45) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:${svg(LINEN)} 0 0/6px 6px,${C.linen} !important;border:none !important;border-left:10px solid transparent !important;border-image:${svg(GING)} 0 0 0 8 / 0 0 0 10px round !important;border-radius:8px !important;color:${C.ink} !important;font-family:"Songti SC","Noto Serif SC",serif !important;box-shadow:inset 0 1px 3px rgba(0,0,0,.25) !important}
[data-wk="chatinput"]::placeholder{color:#A08A72 !important}
[data-wk="chatplus"]{width:32px !important;min-width:32px !important;height:32px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_MUSH)} center/contain no-repeat !important}
[data-wk="send"]{width:40px !important;min-width:40px !important;height:36px !important;border:none !important;border-radius:0 !important;background:${svg(I_BASKET)} center/contain no-repeat !important;box-shadow:none !important;opacity:1 !important}
[data-wk="chatreply"]{width:44px !important;min-width:44px !important;height:34px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background:${svg(I_LETTER)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}

/* ───── 红帽夜访 · 第二批：卡片（形状不动；都是外婆篮子里的麻布，顶上一条红格子布边、里面一圈缝线） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{position:relative !important;overflow:visible !important;background:${svg(LINEN)} 0 0/6px 6px,${C.linen} !important;border:none !important;border-top:8px solid transparent !important;border-image:${svg(GING)} 8 0 0 0 / 8px 0 0 0 round !important;border-radius:10px !important;outline:1.2px dashed rgba(158,46,34,.4) !important;outline-offset:-6px !important;box-shadow:0 3px 0 #CDBB9E,0 8px 16px rgba(0,0,0,.4) !important;color:${C.ink} !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *,[data-wk="photocard"] *{color:${C.ink} !important;border-color:rgba(90,60,40,.18) !important}
/* 转账：外婆的信笺——金额红色宋体；收下盖一枚红心封蜡 */
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.red} !important;font-family:"Songti SC","Noto Serif SC",serif !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:rgba(158,46,34,.35) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:rgba(194,65,47,.06) !important;border-top:1px solid rgba(90,60,40,.15) !important}
[data-wk="transferbtn"]{border-radius:8px !important;font-family:"Songti SC",serif !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.red} !important;color:${C.cream} !important;border:none !important;outline:1px dashed ${STITCH} !important;outline-offset:-4px !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;border:1px solid rgba(90,60,40,.3) !important}
[data-wk="transferseal"]{background:${svg(SEAL)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;width:44px !important;height:44px !important;font-size:0 !important;color:transparent !important}
[data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{transform:rotate(-12deg) !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.55 !important}
/* 红包：不是信封——一块红斗篷布，左边探出一顶小红帽；领完布褪色 */
[data-wk="rpcard"]{position:relative !important;overflow:visible !important;background:${svg(LINEN)} 0 0/6px 6px,linear-gradient(180deg,#CF4D3A,${C.red2}) !important;border:none !important;border-radius:10px !important;outline:1.5px dashed ${STITCH} !important;outline-offset:-5px !important;box-shadow:0 3px 0 #7A2219,0 8px 16px rgba(0,0,0,.4) !important;padding-left:56px !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:10px !important;top:calc(50% - 21px) !important;width:40px !important;height:42px !important;background:${svg(HOODBIG)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="rpcard"] *{color:${C.cream} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{opacity:.6 !important;filter:saturate(.5) !important}
[data-wk="rpenvelope"]{background:radial-gradient(ellipse at 50% 20%,rgba(242,182,64,.25),transparent 60%),${svg(LINEN)} 0 0/6px 6px,linear-gradient(180deg,#CF4D3A,#7A2219) !important;border:none !important;outline:2px dashed ${STITCH} !important;outline-offset:-8px !important;border-radius:16px !important;box-shadow:0 12px 30px rgba(0,0,0,.5) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:transparent !important;border:none !important}
[data-wk="rpenvelope"] *{color:${C.cream} !important}
[data-wk="rpopenbtn"]{background:${svg(SEAL)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4)) !important}
[data-wk="rpopenbtn"] *{opacity:0 !important}
[data-wk="rpamount"]{color:${C.cream} !important;font-family:"Songti SC",serif !important}
/* 照片：麻布框里一块夜林小窗；语音：跟气泡一样，我红布他麻布 */
[data-wk="photocard"]{padding:8px 8px 10px !important}
[data-wk="photoface"]{border-radius:6px !important;background:linear-gradient(180deg,#1E3A30,#0E1E18) !important;border:none !important}
[data-wk="photoface"] *{color:${C.cream} !important}
[data-wk="photocard"] [data-wk="photohint"]{color:#A08A72 !important}
[data-wk="photoface"] svg{stroke:${C.gold} !important}
[data-wk="voice"][data-me]{background:${svg(GING)} left top/8px 8px repeat-y,${svg(LINEN)} 0 0/6px 6px,${C.linen} !important;border:none !important;border-radius:10px !important;padding-left:14px !important;box-shadow:0 3px 0 #CDBB9E !important}
[data-wk="voice"][data-me="1"]{background:${svg(LINEN)} 0 0/6px 6px,linear-gradient(180deg,#CF4D3A,${C.red2}) !important;outline:1.5px dashed ${STITCH} !important;outline-offset:-4px !important;box-shadow:0 3px 0 ${C.red2} !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voice"][data-me="1"] > *{color:${C.cream} !important}
[data-wk="voicewave"] span{background:${C.red} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:${C.cream} !important}
/* 天气：一扇木窗框里的夜林，金月亮；下面那句话是麻布 */
[data-wk="wxcard"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,#1E3A30,#0E1E18) !important;border:5px solid #5A3B2A !important;border-radius:10px !important;box-shadow:inset 0 0 0 1px #8A6345,0 8px 16px rgba(0,0,0,.45) !important}
[data-wk="wxcard"] *{color:${C.cream} !important}
[data-wk="wxcardsky"]{background:transparent !important}
[data-wk="wxcardsky"] > div:first-child{background:radial-gradient(circle,${C.gold} 0 11px,rgba(242,182,64,.3) 13px,transparent 60%) !important}
[data-wk="wxcardsky"] svg{stroke:${C.gold} !important}
[data-wk="wxcardsky"] span[style*="999"],[data-wk="wxcardrain"]{background:rgba(251,243,228,.08) !important;border:1px solid rgba(251,243,228,.3) !important}
[data-wk="wxcardtemp"]{font-family:"Songti SC",serif !important}
[data-wk="wxcardsay"]{background:${svg(LINEN)} 0 0/6px 6px,${C.linen} !important;border-top:6px solid transparent !important;border-image:${svg(GING)} 8 0 0 0 / 6px 0 0 0 round !important;border-radius:0 0 6px 6px !important}
[data-wk="wxcardsay"],[data-wk="wxcardsay"] *{color:${C.ink} !important}
[data-wk="geopin"]{background:${C.red} !important;box-shadow:0 0 0 2px ${C.cream} !important}
[data-wk="geopinstem"]{background:${C.red2} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2.5px ${C.cream},0 0 0 4px ${C.red} !important}
/* 卡片下面那行已读也是狼眼 */
[data-run][data-last="1"] + [data-wk="cardmeta"]::before{content:"" !important;display:inline-block !important;vertical-align:middle !important;width:34px !important;height:12px !important;margin:0 6px !important;background:${svg(EYES)} center/contain no-repeat !important;filter:drop-shadow(0 0 3px rgba(242,182,64,.8)) !important}
/* 拍一拍、通话结束：一行小字，两头小花饰 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;border:none !important;background:none !important;color:#E7D8BC !important;font-family:"Songti SC",serif !important;letter-spacing:.08em !important}
[data-wk="note"][data-part="pat"]::before,[data-wk="note"][data-part="call"]::before{content:"❦ " !important;color:${C.gold} !important}
[data-wk="note"][data-part="call"] svg{stroke:#E7D8BC !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
/* 线下小结 */
[data-wk="offlogtitle"]{font-family:"Songti SC",serif !important;letter-spacing:.15em !important;color:${C.red} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.red2} !important}
[data-wk="offlogtranscript"]{border-top:1px dashed rgba(158,46,34,.35) !important}
/* 加号面板：木色底，一颗颗麻布圆扣子，外圈红色缝线 */
[data-wk="chatpanel"]{background:linear-gradient(180deg,${C.wood},#1E140F) !important;border-top:none !important}
[data-wk="chattoolicon"]{background:${svg(LINEN)} 0 0/6px 6px,${C.linen} !important;border:none !important;border-radius:50% !important;outline:1.2px dashed rgba(194,65,47,.7) !important;outline-offset:-5px !important;box-shadow:0 3px 0 #9C8668,0 5px 10px rgba(0,0,0,.4) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.red2} !important;color:${C.red2} !important}
[data-wk="chattoollabel"]{color:#E7D8BC !important}
/* 引用：左边一条红格子 */
[data-wk="quotedraft"]{background:${C.wood} !important;border-top:none !important}
[data-wk="quote"]{background:rgba(42,28,21,.85) !important;color:#E7D8BC !important;border:none !important;border-left:4px solid transparent !important;border-image:${svg(GING)} 0 0 0 8 / 0 0 0 4px round !important;border-radius:4px !important;opacity:1 !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.gold} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}
/* 线下：提示键是小红帽，照片键是一扇夜林小窗 */
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:26px !important;min-width:26px !important;height:26px !important;background:${svg(HOODBIG)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;font-size:0 !important;color:transparent !important;padding:0 !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;font-size:0 !important;color:transparent !important;padding:0 !important;background:${svg(WINDOW)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}

/* 头像不是圆的：他是外婆墙上的方相框（圆角方、奶白框）；我是一滴兜帽形——右上收成一个尖，跟斗篷帽尖一个方向 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] img[data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] [data-wk="avatar"] *{border-radius:22% !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"],[data-wk="msg"][data-me="1"] [data-wk="avatar"] *,[data-wk="cardrow"][data-me="1"] [data-wk="avatar"],[data-wk="cardrow"][data-me="1"] [data-wk="avatar"] *,[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img{border-radius:50% 4px 50% 50% !important}
`;

const pack = { kind: "chat-look", v: 1, name: "红帽夜访", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "红帽夜访-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
