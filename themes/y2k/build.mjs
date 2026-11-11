// Y2K 聊天美化：生成 chat-look 包。用法：node themes/y2k/build.mjs
// 结构：每条消息是一个旧电脑系统的小弹窗（顶上标题栏＋三颗彩色小圆点），连发的几条叠成一摞窗口；
//       时间是 TODAY.exe 小窗；顶栏、底栏是两条果冻胶囊。底色按深紫夜调，换浅底也看得清。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { night: "#1E1640", night2: "#3A1E5C", pink: "#FF7EC8", pinkL: "#FFC2E6", blue: "#7CC8FF", blueL: "#CFEBFF", lilac: "#C9B8FF", lilacL: "#EFE8FF", ink: "#3B2A66", gold: "#FFD45C", line: "#9C8BD8" };

const STAR = (f = C.gold) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 1 L12.6 7 L19 7.6 L14 11.8 L15.6 18.4 L10 14.8 L4.4 18.4 L6 11.8 L1 7.6 L7.4 7Z' fill='${f}' stroke='#C99A1E' stroke-width='.9' stroke-linejoin='round'/><path d='M7 6 L9 5' stroke='#fff' stroke-width='1.2' stroke-linecap='round'/></svg>`;
const HEART = (f = C.pink) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'><path d='M12 21 C4 15 1 11 1 7 C1 3.5 3.8 1 7 1 C9.2 1 11 2.3 12 4 C13 2.3 14.8 1 17 1 C20.2 1 23 3.5 23 7 C23 11 20 15 12 21Z' fill='${f}' stroke='#D94FA0' stroke-width='1.2'/><ellipse cx='7' cy='6' rx='2.6' ry='1.6' fill='#fff' opacity='.7' transform='rotate(-30 7 6)'/></svg>`;
const SPARK = (f = "#fff") => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 0 Q11 9 20 10 Q11 11 10 20 Q9 11 0 10 Q9 9 10 0Z' fill='${f}'/></svg>`;
const DOTS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 10'><circle cx='5' cy='5' r='3.6' fill='#FF8FB8' stroke='#fff' stroke-width='1'/><circle cx='17' cy='5' r='3.6' fill='#FFD45C' stroke='#fff' stroke-width='1'/><circle cx='29' cy='5' r='3.6' fill='#7CE0C8' stroke='#fff' stroke-width='1'/></svg>`;
// 背景：深紫夜，散一层像素小星和闪光
const TILE = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><g fill='#fff'><rect x='20' y='30' width='3' height='3' opacity='.6'/><rect x='110' y='16' width='2' height='2' opacity='.5'/><rect x='70' y='90' width='3' height='3' opacity='.5'/><rect x='140' y='120' width='2' height='2' opacity='.6'/><rect x='34' y='136' width='2' height='2' opacity='.4'/></g><g transform='translate(120 64) scale(.6)' opacity='.55'>${SPARK(C.pinkL).replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(40 70) scale(.45)' opacity='.45'>${SPARK(C.blueL).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;
// 按键
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><defs><radialGradient id='g' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#FFF6C8'/><stop offset='.6' stop-color='#FFD45C'/><stop offset='1' stop-color='#E8A81E'/></radialGradient></defs><circle cx='20' cy='20' r='17' fill='url(#g)' stroke='#fff' stroke-width='2'/><path d='M20 12 V28 M12 20 H28' stroke='${C.ink}' stroke-width='3' stroke-linecap='round'/></svg>`;
const I_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 44'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#FFC2E6'/><stop offset='1' stop-color='#FF5DB4'/></linearGradient></defs><path d='M24 42 C10 32 2 24 2 14 C2 7 7 2 13.5 2 C18 2 22 4.5 24 8 C26 4.5 30 2 34.5 2 C41 2 46 7 46 14 C46 24 38 32 24 42Z' fill='url(#g)' stroke='#fff' stroke-width='2'/><ellipse cx='13' cy='11' rx='5' ry='3' fill='#fff' opacity='.7' transform='rotate(-30 13 11)'/><path d='M15 22 H32 M26 16 L32 22 L26 28' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><defs><radialGradient id='g' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='${C.blueL}'/></radialGradient></defs><circle cx='22' cy='22' r='19' fill='url(#g)' stroke='${C.blue}' stroke-width='2'/><path d='M11 14 H33 Q35 14 35 16 V27 Q35 29 33 29 H20 L14 34 L15 29 H11 Q9 29 9 27 V16 Q9 14 11 14Z' fill='#fff' stroke='#4AA8F0' stroke-width='2' stroke-linejoin='round'/><circle cx='16' cy='21.5' r='1.8' fill='#4AA8F0'/><circle cx='22' cy='21.5' r='1.8' fill='#4AA8F0'/><circle cx='28' cy='21.5' r='1.8' fill='#4AA8F0'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='#FFE3F2' stroke='#fff' stroke-width='2'/><path d='M11 20 L20 12 L29 20 V29 H11Z' fill='none' stroke='#FF5DB4' stroke-width='2.4' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='${C.blueL}' stroke='#fff' stroke-width='2'/><g transform='translate(7 14) scale(.6)'>${SPARK("#4AA8F0").replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(15 13) scale(.7)'>${SPARK("#4AA8F0").replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(24 14) scale(.6)'>${SPARK("#4AA8F0").replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;

const bubble = { myBg: C.pinkL, myText: C.ink, myBorder: "none", charBg: C.blueL, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

// 果冻亮面：上半一道白高光
const JELLY = (top, bot) => `linear-gradient(180deg,rgba(255,255,255,.75) 0,rgba(255,255,255,.15) 45%,rgba(255,255,255,0) 46%),linear-gradient(180deg,${top},${bot})`;

const css = `
/* ───── Y2K · 第一批 ───── */
[data-wk="chat"]{background:${svg(TILE)} 0 0/160px 160px,radial-gradient(ellipse at 80% 70%,rgba(255,94,180,.35),transparent 55%),radial-gradient(ellipse at 10% 20%,rgba(124,200,255,.25),transparent 50%),linear-gradient(180deg,${C.night},${C.night2}) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一条浮着的果冻胶囊 */
[data-wk="chathead"]{background:transparent !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:8px !important;right:8px !important;top:calc(var(--app-safe-top, 0px) + 4px) !important;bottom:4px !important;border-radius:999px !important;background:${JELLY("#F6F0FF", "#D9CCFF")} !important;border:2px solid #fff !important;box-shadow:0 0 0 1.5px ${C.lilac},0 6px 18px rgba(124,90,220,.45) !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="headink"],[data-wk="headink"] *{color:#FF4FA8 !important;font-weight:800 !important}
[data-wk="headdim"]{color:#8A7BB8 !important}
[data-wk="chatback"] svg{stroke:${C.ink} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-left:6px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：方角果冻框，右上一颗星、左下一颗心 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:14px !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:12px !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 3px #fff,0 0 0 5px ${C.pink},0 4px 12px rgba(255,94,180,.5) !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;right:-10px !important;top:-10px !important;width:18px !important;height:18px !important;background:${svg(STAR())} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;left:-8px !important;bottom:-6px !important;width:15px !important;height:14px !important;background:${svg(HEART())} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}

/* 每条消息＝一个小弹窗：顶上一条标题栏（他的是粉色、我的是蓝色），右上三颗小圆点 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:12px !important;padding-top:30px !important;border:2px solid #fff !important;margin-top:4px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,${C.pink} 0,${C.pink} 20px,transparent 20px),${JELLY("#FFE3F2", C.pinkL)} !important;box-shadow:0 0 0 1.5px ${C.pink},0 6px 16px rgba(255,94,180,.4) !important;color:${C.ink} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(180deg,#4AA8F0 0,#4AA8F0 20px,transparent 20px),${JELLY("#E6F5FF", C.blueL)} !important;box-shadow:0 0 0 1.5px #4AA8F0,0 6px 16px rgba(74,168,240,.4) !important;color:${C.ink} !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;right:8px !important;left:auto !important;top:5px !important;width:34px !important;height:10px !important;background:${svg(DOTS)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="bubble"][data-kind="text"]::after{content:"me.txt" !important;position:absolute !important;left:10px !important;right:auto !important;top:3px !important;bottom:auto !important;width:auto !important;height:auto !important;background:none !important;border:none !important;font:700 10px/14px monospace !important;letter-spacing:.06em !important;color:#fff !important;transform:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:"message.txt" !important}
/* 连发：后面几条叠在上一扇窗口后面，往右错一点、只露出窗口本体，不再带标题栏 */
[data-first="0"] [data-wk="bubble"][data-kind="text"]{padding-top:10px !important;margin-top:-6px !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="1"]{background:${JELLY("#FFE3F2", C.pinkL)} !important;transform:translateX(-10px) !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]{background:${JELLY("#E6F5FF", C.blueL)} !important;transform:translateX(10px) !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"]::before,[data-first="0"] [data-wk="bubble"][data-kind="text"]::after{content:none !important}

/* 时间：TODAY.exe 小窗 */
[data-wk="time"] > span{display:inline-block !important;background:linear-gradient(180deg,${C.lilac} 0,${C.lilac} 14px,#fff 14px) !important;border:2px solid #fff !important;box-shadow:0 0 0 1.5px ${C.lilac},0 4px 10px rgba(0,0,0,.3) !important;border-radius:8px !important;padding:16px 18px 3px !important;color:${C.ink} !important;font-weight:700 !important;position:relative !important}
[data-wk="time"] > span::before{content:"TODAY.exe" !important;position:absolute !important;left:8px !important;top:0 !important;font:700 8px/14px monospace !important;color:#fff !important;letter-spacing:.08em !important}
[data-wk="time"] > span::after{content:"" !important;position:absolute !important;right:6px !important;top:3px !important;width:24px !important;height:8px !important;background:${svg(DOTS)} center/contain no-repeat !important}
/* 已读：白色小胶囊，前面一颗心 */
[data-wk="meta"]{display:inline-block !important;background:rgba(255,255,255,.9) !important;color:${C.ink} !important;border-radius:999px !important;padding:1px 10px 1px 24px !important;font-weight:700 !important;background-image:${svg(HEART())} !important;background-repeat:no-repeat !important;background-position:8px center !important;background-size:12px 11px !important}
[data-wk="typingdot"]{width:12px !important;height:11px !important;border-radius:0 !important;background:${svg(HEART())} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="typing"]{background:${JELLY("#FFE3F2", C.pinkL)} !important;border:2px solid #fff !important;box-shadow:0 0 0 1.5px ${C.pink} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="narrink"]{background:rgba(255,255,255,.88) !important;border-radius:10px !important;color:${C.ink} !important;padding:3px 10px !important}
[data-wk="sysnotetext"]{color:#E8DEFF !important}

/* 底栏：一条果冻胶囊把加号、输入、爱心发送、回复都包进去；输入框实线描边 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important;align-items:center !important;padding-left:16px !important;padding-right:16px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:6px !important;right:6px !important;top:2px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 8px) !important;border-radius:999px !important;background:${JELLY("#F6F0FF", "#D9CCFF")} !important;border:2px solid #fff !important;box-shadow:0 0 0 1.5px ${C.lilac},0 -4px 18px rgba(124,90,220,.45) !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="chatinput"]{background:#fff !important;border:2px solid ${C.pinkL} !important;border-radius:999px !important;color:${C.ink} !important;box-shadow:inset 0 2px 4px rgba(124,90,220,.15) !important}
[data-wk="chatinput"]::placeholder{color:#B5A8D8 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;width:36px !important;height:36px !important;min-width:36px !important;align-self:center !important;margin:0 2px !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important;width:40px !important;min-width:40px !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}
/* 标题栏放得下：窗口最窄 120px */
[data-first="1"] [data-wk="bubble"][data-kind="text"],[data-wk="msg"]:not([data-first]) [data-wk="bubble"][data-kind="text"]{min-width:124px !important}
/* 一摞窗口里，已读只留在最后一扇底下，后面几扇真的叠上来 */
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="msg"][data-first="0"]{margin-top:-10px !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"]{box-shadow:0 0 0 1.5px currentColor,0 -6px 10px rgba(0,0,0,.18),0 6px 16px rgba(0,0,0,.25) !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="1"]{color:${C.ink} !important;box-shadow:0 0 0 1.5px ${C.pink},0 -4px 10px rgba(0,0,0,.2) !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"][data-me="0"]{box-shadow:0 0 0 1.5px #4AA8F0,0 -4px 10px rgba(0,0,0,.2) !important}

/* 已送达＝空心，已读＝实心 */
[data-wk="meta"][data-read="0"]{background-image:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'><path d='M12 20 C4.5 14.5 2 11 2 7 C2 4 4.4 2 7 2 C9.2 2 11 3.4 12 5.2 C13 3.4 14.8 2 17 2 C19.6 2 22 4 22 7 C22 11 19.5 14.5 12 20Z' fill='none' stroke='#FF5DB4' stroke-width='2.4'/></svg>`)} !important}

/* 头像框加粗成果冻边：白内圈＋粗彩边＋白外描＋一层投影；我的粉、他的蓝 */
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 3px #fff,0 0 0 9px #8FD0FF,0 0 0 10.5px #fff,0 0 0 12px #5AA8E8,0 6px 14px rgba(40,90,180,.45) !important;border-radius:14px !important}
[data-me="1"] button[data-wk="avatar"],[data-me="1"] span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 3px #fff,0 0 0 9px #FF9AD2,0 0 0 10.5px #fff,0 0 0 12px #F05AAE,0 6px 14px rgba(240,90,174,.45) !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{right:-15px !important;top:-15px !important;width:20px !important;height:20px !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{left:-14px !important;bottom:-12px !important;width:17px !important;height:16px !important}
[data-wk="chathead"] button[data-wk="avatar"],[data-wk="chathead"] span[data-wk="avatar"]{box-shadow:0 0 0 2px #fff,0 0 0 6px #8FD0FF,0 0 0 7.5px #fff,0 0 0 8.5px #5AA8E8 !important}

/* 头像框照参考图：圆角方块，白色厚边＋一圈细彩描边＋投影（我粉他蓝），右上金星、左下小粉心 */
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){border-radius:14px !important;box-shadow:inset 0 0 0 1px rgba(0,0,0,.05),0 0 0 5px #fff,0 0 0 7px #9CCBF2,0 7px 14px rgba(30,20,80,.45) !important}
[data-me="1"] button[data-wk="avatar"],[data-me="1"] span[data-wk="avatar"]:not([data-halo]){box-shadow:inset 0 0 0 1px rgba(0,0,0,.05),0 0 0 5px #fff,0 0 0 7px #F2A2CF,0 7px 14px rgba(30,20,80,.45) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:10px !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{right:-13px !important;top:-13px !important;width:20px !important;height:20px !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{left:-12px !important;bottom:-10px !important;width:15px !important;height:14px !important}

/* 头像框再加粗：白边 8px＋彩描 3px；顶栏那颗也套上 */
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 8px #fff,0 0 0 11px #9CCBF2,0 8px 16px rgba(30,20,60,.4) !important}
[data-me="1"] button[data-wk="avatar"],[data-me="1"] span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 8px #fff,0 0 0 11px #F2A2CF,0 8px 16px rgba(30,20,60,.4) !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{right:-18px !important;top:-18px !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{left:-17px !important;bottom:-15px !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{border-radius:12px !important;box-shadow:0 0 0 5px #fff,0 0 0 7px #9CCBF2 !important}
/* 标题栏放得下 */
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"]{min-width:156px !important}
/* 背景压暗压灰：灰紫底＋一层淡淡的 Y2K 网格，不走星空那种深蓝夜 */
[data-wk="chat"]{background:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px) 0 0/28px 28px,${svg(TILE)} 0 0/160px 160px,linear-gradient(180deg,#4E4766,#5E4C6C 55%,#6B5068) !important}

[data-wk="msg"] button[data-wk="avatar"],[data-wk="cardrow"] button[data-wk="avatar"]{margin:6px 10px 0 !important}

/* 头像框照参考图的立体果冻边：外面一圈有厚度的淡紫白斜面（上亮下暗），最外细紫描，里面贴着图一道彩边（我粉他蓝） */
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="chathead"] [data-wk="avatar"]{padding:6px !important;margin:-6px !important;background:linear-gradient(180deg,#FFFFFF 0,#F3EEFF 45%,#DCD2F6 80%,#C8BBEE) !important;border-radius:18px !important;box-shadow:0 0 0 1.5px #B7A6E8,inset 0 2px 1px #fff,inset 0 -3px 4px rgba(120,90,200,.35),0 6px 12px rgba(30,20,60,.4) !important;box-sizing:content-box !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"]:not([data-halo]) > *,[data-wk="chathead"] [data-wk="avatar"] > *{border-radius:11px !important;box-shadow:0 0 0 2.5px #7CC4F8 !important}
[data-me="1"] button[data-wk="avatar"] > *,[data-me="1"] span[data-wk="avatar"]:not([data-halo]) > *{box-shadow:0 0 0 2.5px #F05AAE !important}
[data-wk="chathead"] [data-wk="avatar"] > *{box-shadow:0 0 0 2.5px #F05AAE !important}
[data-wk="chathead"] img{box-shadow:none !important}
[data-wk="msg"] button[data-wk="avatar"],[data-wk="cardrow"] button[data-wk="avatar"]{margin:0 4px !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{right:-10px !important;top:-10px !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{left:-9px !important;bottom:-7px !important}

[data-me="1"] button[data-wk="avatar"],[data-me="1"] span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 1.5px #B7A6E8,inset 0 2px 1px #fff,inset 0 -3px 4px rgba(120,90,200,.35),0 6px 12px rgba(30,20,60,.4) !important}

/* 头像框照参考图：不占位置（不动排版）；白色厚边，底下一层淡紫厚度像果冻按钮，最外淡紫细描＋投影；不要彩色内圈 */
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="chathead"] [data-wk="avatar"],[data-me="1"] button[data-wk="avatar"],[data-me="1"] span[data-wk="avatar"]:not([data-halo]){padding:0 !important;margin:0 !important;background:transparent !important;box-sizing:border-box !important;border-radius:12px !important;box-shadow:0 0 0 5px #fff,0 2.5px 0 5px #D8CCF4,0 2.5px 0 6.5px #B9A8EA,0 8px 14px 4px rgba(30,20,60,.35) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"]:not([data-halo]) > *,[data-wk="chathead"] [data-wk="avatar"] > *,[data-me="1"] button[data-wk="avatar"] > *,[data-me="1"] span[data-wk="avatar"]:not([data-halo]) > *{box-shadow:none !important;border-radius:10px !important}
[data-wk="msg"] button[data-wk="avatar"],[data-wk="cardrow"] button[data-wk="avatar"]{margin:0 !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{right:-13px !important;top:-13px !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{left:-12px !important;bottom:-11px !important}

`;

const pack = { kind: "chat-look", v: 1, name: "Y2K", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "Y2K-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
