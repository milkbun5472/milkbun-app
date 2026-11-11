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


// ── 规格版：镀铬外壳、水晶球按键 ──
const CHROME = "linear-gradient(180deg,#FFFFFF 0%,#D5DDF0 35%,#9AA7C7 50%,#EEF3FF 62%,#B4BFDB 100%)";
const SHELL_SHADOW = "0 0 0 1px #6F7BA6,inset 0 2px 2px rgba(255,255,255,.9),inset 0 -5px 6px rgba(106,63,200,.35),0 7px 14px rgba(122,69,214,.38)";
const ORB = (a, b, glyph) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><defs><linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#FFFFFF'/><stop offset='.35' stop-color='#D5DDF0'/><stop offset='.5' stop-color='#9AA7C7'/><stop offset='.62' stop-color='#EEF3FF'/><stop offset='1' stop-color='#B4BFDB'/></linearGradient><linearGradient id='b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient><linearGradient id='h' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.85'/><stop offset='1' stop-color='#fff' stop-opacity='.05'/></linearGradient></defs><g><circle cx='24' cy='23' r='20.5' fill='url(#c)' stroke='#6F7BA6' stroke-width='1'/><circle cx='24' cy='23' r='17.5' fill='url(#b)' stroke='#fff' stroke-width='1.2'/><path d='M10 28 A17 17 0 0 0 38 28' fill='none' stroke='#6A3FC8' stroke-opacity='.25' stroke-width='3'/><ellipse cx='24' cy='13.5' rx='10.8' ry='5.6' fill='url(#h)'/>${glyph}</g></svg>`;
const ORB_PLUS = ORB("#FFF6B0", "#FFD84D", "<path d='M24 16 V30 M17 23 H31' stroke='#3A2A55' stroke-width='2.8' stroke-linecap='round'/>");
const ORB_REPLY = ORB("#E2F6FF", "#93D6FF", "<path d='M15 17 H33 Q35 17 35 19 V27 Q35 29 33 29 H22 L17 33 L18 29 H15 Q13 29 13 27 V19 Q13 17 15 17Z' fill='#fff' stroke='#3A2A55' stroke-width='1.8' stroke-linejoin='round'/><circle cx='19' cy='23' r='1.4' fill='#3A2A55'/><circle cx='24' cy='23' r='1.4' fill='#3A2A55'/><circle cx='29' cy='23' r='1.4' fill='#3A2A55'/>");
const ORB_HOME = ORB("#FFE3F4", "#FF9FD6", "<path d='M16 24 L24 17 L32 24 V31 H16Z' fill='none' stroke='#FF3FA4' stroke-width='2.4' stroke-linejoin='round'/>");
const ORB_MORE = ORB("#E2F6FF", "#93D6FF", `<g transform='translate(13 18) scale(.5)'>${SPARK("#2F7FD0").replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(19 16) scale(.6)'>${SPARK("#2F7FD0").replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(26 18) scale(.5)'>${SPARK("#2F7FD0").replace(/<\/?svg[^>]*>/g, "")}</g>`);
const HEART_SEND = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 52 48'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#FFC2E6'/><stop offset='1' stop-color='#FF3FA4'/></linearGradient><linearGradient id='h' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.85'/><stop offset='1' stop-color='#fff' stop-opacity='.05'/></linearGradient></defs><g><path d='M26 43 C11 33 3 25 3 15 C3 8 8.5 3 15 3 C19.5 3 23.5 5.5 26 9 C28.5 5.5 32.5 3 37 3 C43.5 3 49 8 49 15 C49 25 41 33 26 43Z' fill='url(#g)' stroke='#fff' stroke-width='1.6'/><path d='M8 22 C12 30 18 35 26 40 C34 35 40 30 44 22' fill='none' stroke='#6A3FC8' stroke-opacity='.25' stroke-width='3'/><ellipse cx='16' cy='11' rx='7' ry='4' fill='url(#h)' transform='rotate(-20 16 11)'/><path d='M17 22 H34 M28 16 L34 22 L28 28' fill='none' stroke='#fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></g></svg>`;
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

/* 顶栏、底栏照参考图的立体胶囊：外面一圈白亮的厚边框，里面一道往下凹的槽，底下一层厚度＋投影 */
[data-wk="chathead"]::before{background:linear-gradient(180deg,rgba(255,255,255,.55) 0,rgba(255,255,255,0) 40%),linear-gradient(180deg,#E7E1F8,#D3C8F0) !important;border:none !important;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 8px #EEEAF8,inset 0 -2px 0 8px #CEC5EA,inset 0 3px 6px 8px rgba(110,90,180,.3),0 0 0 1.5px #B4A8DA,0 5px 0 0.5px #A79BD0,0 12px 22px rgba(20,10,50,.45) !important}
[data-wk="composer"]::before{background:linear-gradient(180deg,rgba(255,255,255,.55) 0,rgba(255,255,255,0) 40%),linear-gradient(180deg,#E7E1F8,#D3C8F0) !important;border:none !important;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 8px #EEEAF8,inset 0 -2px 0 8px #CEC5EA,inset 0 3px 6px 8px rgba(110,90,180,.3),0 0 0 1.5px #B4A8DA,0 5px 0 0.5px #A79BD0,0 -2px 18px rgba(20,10,50,.45) !important}


/* ───── 顶栏、底栏：按规格重做（镀铬悬浮胶囊） ───── */
[data-wk="chathead"]{min-height:calc(var(--app-safe-top, 0px) + 82px) !important;align-items:center !important;padding-left:26px !important;padding-right:24px !important}
[data-wk="chathead"]::before{left:12px !important;right:12px !important;top:calc(var(--app-safe-top, 0px) + 8px) !important;bottom:auto !important;height:66px !important;border-radius:33px !important;border:none !important;background:${CHROME} !important;box-shadow:${SHELL_SHADOW} !important}
/* 嵌进去的面板＋玻璃高光 */
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:18px !important;right:18px !important;top:calc(var(--app-safe-top, 0px) + 14px) !important;height:54px !important;border-radius:27px !important;background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,.05)) 12px 3px/calc(100% - 24px) 14px no-repeat,linear-gradient(180deg,#FFFFFF,#E7DCFF) !important;border:1.4px solid #fff !important;box-shadow:inset 0 3px 5px rgba(90,63,176,.35) !important;pointer-events:none !important;z-index:-1 !important;box-sizing:border-box !important}
[data-wk="chatback"] svg{stroke:#3A2A55 !important;stroke-width:2.4 !important}
[data-wk="chathead"] [data-wk="avatar"]{width:44px !important;height:44px !important;padding:5px !important;box-sizing:border-box !important;border-radius:12px !important;background:linear-gradient(180deg,#FF8CCB,#FF3FA4) !important;box-shadow:inset 0 2px 2px rgba(255,255,255,.7),0 3px 6px rgba(122,69,214,.38) !important}
[data-wk="chathead"] [data-wk="avatar"] > *,[data-wk="chathead"] [data-wk="avatar"] img{width:34px !important;height:34px !important;border-radius:8px !important;box-shadow:none !important}
[data-wk="chathead"] [data-wk="headink"],[data-wk="chathead"] [data-wk="headink"] *{font-size:21px !important;font-weight:900 !important;color:#FF3FA4 !important;-webkit-text-stroke:0 !important;text-shadow:2.5px 0 #fff,-2.5px 0 #fff,0 2.5px #fff,0 -2.5px #fff,1.8px 1.8px #fff,-1.8px 1.8px #fff,1.8px -1.8px #fff,-1.8px -1.8px #fff !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headdim"]{font-size:10.5px !important;font-weight:800 !important;color:#6A5A8C !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:42px !important;min-width:42px !important;height:42px !important;background-size:contain !important}
[data-wk="sameroom"]{background-image:${svg(ORB_HOME)} !important}
[data-wk="chatmore"]{background-image:${svg(ORB_MORE)} !important}

/* 底栏：镀铬外壳直接放按键，离底边留安全区＋8px */
[data-wk="composer"]{min-height:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) + 82px) !important;padding-left:24px !important;padding-right:22px !important;align-items:flex-start !important}
[data-wk="composer"]::before{left:12px !important;right:12px !important;top:auto !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) + 8px) !important;height:66px !important;border-radius:33px !important;border:none !important;background:${CHROME} !important;box-shadow:${SHELL_SHADOW} !important}
[data-wk="chatinput"]{min-height:42px !important;height:42px !important;background:#fff !important;border:1px solid #6F7BA6 !important;border-radius:21px !important;box-shadow:inset 0 3px 5px rgba(90,63,176,.35) !important;outline:1.4px dashed #FF9FD6 !important;outline-offset:-6px !important;font-size:14px !important;font-weight:800 !important;color:#3A2A55 !important;padding:10px 16px !important}
[data-wk="chatinput"]::placeholder{color:#9A8FB8 !important;font-weight:800 !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:44px !important;min-width:44px !important;height:44px !important;margin:0 !important;background-size:contain !important}
[data-wk="chatplus"]{background-image:${svg(ORB_PLUS)} !important}
[data-wk="chatreply"]{background-image:${svg(ORB_REPLY)} !important}
[data-wk="send"]{width:48px !important;min-width:48px !important;height:44px !important;background:${svg(HEART_SEND)} center/contain no-repeat !important;margin:0 2px !important}

/* 手机上修正：胶囊跟着顶栏、底栏本身的高度走，不再自己撑高；名字贴纸字只给名字，不给返回键的未读数 */
[data-wk="chathead"]{min-height:0 !important;padding-left:20px !important;padding-right:20px !important}
[data-wk="chathead"]::before{top:calc(var(--app-safe-top, 0px) + 2px) !important;bottom:2px !important;height:auto !important}
[data-wk="chathead"]::after{top:calc(var(--app-safe-top, 0px) + 8px) !important;bottom:8px !important;height:auto !important;left:18px !important;right:18px !important}
[data-wk="chathead"] [data-wk="headink"],[data-wk="chathead"] [data-wk="headink"] *{font-size:inherit !important;text-shadow:none !important;color:inherit !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"],[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"] *{font-size:19px !important;color:#FF3FA4 !important;text-shadow:2px 0 #fff,-2px 0 #fff,0 2px #fff,0 -2px #fff,1.4px 1.4px #fff,-1.4px 1.4px #fff,1.4px -1.4px #fff,-1.4px -1.4px #fff !important}
[data-wk="chathead"] [data-wk="headname"]{min-width:0 !important;flex:1 1 auto !important}
[data-wk="chathead"] [data-wk="avatar"]{width:40px !important;height:40px !important;padding:4px !important}
[data-wk="chathead"] [data-wk="avatar"] > *,[data-wk="chathead"] [data-wk="avatar"] img{width:32px !important;height:32px !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:38px !important;min-width:38px !important;height:38px !important}
[data-wk="composer"]{min-height:0 !important;align-items:center !important;padding-left:20px !important;padding-right:20px !important}
[data-wk="composer"]::before{top:2px !important;height:auto !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 8px) !important}
[data-wk="chatinput"]{height:40px !important;min-height:40px !important;font-size:14px !important;white-space:nowrap !important;overflow:hidden !important;padding:9px 14px !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:38px !important;min-width:38px !important;height:38px !important}
[data-wk="send"]{width:42px !important;min-width:42px !important;height:40px !important}

/* 顶栏减重：副标题不折行、名字有地方放，按键缩到和底栏一样大，胶囊跟底栏一样薄 */
[data-wk="chathead"]{padding-left:16px !important;padding-right:16px !important;gap:6px !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headdim"]{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"],[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"] *{font-size:17px !important}
[data-wk="chathead"] [data-wk="avatar"]{width:36px !important;height:36px !important;padding:3px !important}
[data-wk="chathead"] [data-wk="avatar"] > *,[data-wk="chathead"] [data-wk="avatar"] img{width:30px !important;height:30px !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important}
[data-wk="chatmore"]{margin-left:2px !important}
[data-wk="chathead"]::before{top:calc(var(--app-safe-top, 0px) + 4px) !important;bottom:4px !important}
[data-wk="chathead"]::after{top:calc(var(--app-safe-top, 0px) + 9px) !important;bottom:9px !important}

/* 按键投影改由 CSS 画（SVG 里带滤镜在 iPhone 上会被按低分辨率糊成一团） */
[data-wk="chatplus"],[data-wk="chatreply"],[data-wk="send"],[data-wk="sameroom"],[data-wk="chatmore"]{filter:drop-shadow(0 3px 3px rgba(122,69,214,.38)) !important}


/* 顶栏头像框跟聊天里一样：白厚边＋淡紫厚度，不再用亮粉 */
[data-wk="chathead"] [data-wk="avatar"]{padding:0 !important;background:transparent !important;box-shadow:0 0 0 4px #fff,0 2px 0 4px #D8CCF4,0 2px 0 5.5px #B9A8EA,0 6px 10px 3px rgba(30,20,60,.3) !important;border-radius:10px !important}
[data-wk="chathead"] [data-wk="avatar"] > *,[data-wk="chathead"] [data-wk="avatar"] img{width:100% !important;height:100% !important;border-radius:9px !important}

/* ───── Y2K · 第二批：卡片。形状不动，只换主题色，每张顶上加一条小窗口标题栏（名字各不同）当小巧思 ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="rpcard"]{position:relative !important;border:2px solid #fff !important;border-radius:14px !important;box-shadow:0 0 0 1.5px #B9A8EA,0 6px 14px rgba(30,20,60,.35) !important;overflow:hidden !important}
[data-wk="transfercard"],[data-wk="namecard"],[data-part="offlog"],[data-wk="geocard"] > [data-wk="card"],[data-wk="callpill"] > [data-wk="block"]{background:#FBF8FF !important;padding-top:22px !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:#3A2A55 !important;border-color:#E3DAF7 !important}
[data-wk="transfercard"]::before,[data-wk="namecard"]::before,[data-part="offlog"]::before,[data-wk="geocard"] > [data-wk="card"]::before,[data-wk="rpcard"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:0 !important;height:18px !important;font:800 9px/18px monospace !important;letter-spacing:.06em !important;color:#fff !important;padding-left:10px !important;text-align:left !important;background:${svg(DOTS)} right 8px center/26px 8px no-repeat,linear-gradient(90deg,#B9A6F0,#9D88E6) !important;z-index:2 !important}
[data-wk="transfercard"]::before{content:"money.exe" !important;background:${svg(DOTS)} right 8px center/26px 8px no-repeat,linear-gradient(90deg,#FFB0D8,#FF6FBE) !important}
[data-wk="namecard"]::before{content:"contact.vcf" !important}
[data-part="offlog"]::before{content:"diary.log" !important}
[data-wk="geocard"] > [data-wk="card"]::before{content:"map.exe" !important;background:${svg(DOTS)} right 8px center/26px 8px no-repeat,linear-gradient(90deg,#9FD8FF,#5AAEF0) !important}
/* 转账 */
[data-wk="transferamount"],[data-wk="transfercur"]{color:#FF3FA4 !important;font-weight:900 !important}
[data-wk="transferrule"]{border:none !important;height:2px !important;background:linear-gradient(90deg,#FF9FD6,#93D6FF) !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:#F1ECFF !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:linear-gradient(180deg,#FFC2E6,#FF5DB4) !important;color:#fff !important;border:2px solid #fff !important;box-shadow:0 0 0 1px #E58FC0 !important}
[data-wk="transferbtn"][data-part="back"]{background:#fff !important;color:#6A5A8C !important;border:1.5px solid #C9BBEF !important}
[data-wk="transferseal"]{border:2px solid #FF9FD6 !important;color:#FF3FA4 !important;background:#fff !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{background:${svg(HEART())} center/70% no-repeat,#fff !important;border-color:#FF5DB4 !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.75 !important;filter:grayscale(.4) !important}
/* 红包：粉色果冻，左上一颗爱心，标题栏写 gift.exe */
[data-wk="rpcard"]{background:linear-gradient(180deg,rgba(255,255,255,.6) 0,rgba(255,255,255,0) 40%),linear-gradient(160deg,#FF8CCB,#FF3FA4) !important;padding-top:18px !important}
[data-wk="rpcard"]::after{content:"gift.exe" !important;background:${svg(DOTS)} right 8px center/26px 8px no-repeat,rgba(255,255,255,.28) !important}
[data-wk="rpflap"]{background:rgba(255,255,255,.18) !important;top:18px !important}
[data-wk="rpseal"]{border:none !important;background:${svg(HEART("#fff"))} center/contain no-repeat !important;top:30px !important}
[data-wk="rpseal"] *{display:none !important}
[data-wk="rpcard"][data-status="done"]{filter:grayscale(.35) brightness(1.05) !important}
[data-wk="rpenvelope"]{background:linear-gradient(180deg,#FF8CCB,#C93D8F) !important;border:3px solid #fff !important;box-shadow:0 0 0 2px #B9A8EA,0 10px 30px rgba(30,20,60,.5) !important;border-radius:26px !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:#7E5BD6 !important}
[data-wk="rpopenbtn"]{background:${svg(ORB_PLUS)} center/contain no-repeat !important;border:none !important;box-shadow:none !important}
[data-wk="rpopenbtn"] *{opacity:0 !important}
[data-wk="rpenvelope"] *{color:#fff !important}
[data-wk="rpamount"]{color:#FFE45C !important}
/* 照片：窗口边框，底下一条小进度条「loading 100%」 */
[data-wk="photocard"]{background:#FBF8FF !important;padding:8px 8px 22px !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;left:10px !important;right:10px !important;bottom:8px !important;height:6px !important;border-radius:3px !important;background:repeating-linear-gradient(90deg,#FF9FD6 0 8px,#93D6FF 8px 16px) !important;box-shadow:0 0 0 1px #fff,0 0 0 2px #C9BBEF !important}
[data-wk="photoface"]{border-radius:10px !important;background:linear-gradient(160deg,#E7DCFF,#C8D8FF) !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:#3A2A55 !important}
/* 语音：蓝果冻胶囊，声波是像素格 */
[data-wk="voice"]{background:linear-gradient(180deg,rgba(255,255,255,.7) 0,rgba(255,255,255,0) 45%),linear-gradient(180deg,#CDEBFF,#8FD0FF) !important;border-radius:999px !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:#2A3A66 !important}
[data-wk="voicewave"] span{background:#2F7FD0 !important;border-radius:0 !important}
/* 天气 */
[data-wk="wxcardsky"]{background:linear-gradient(170deg,#C8D8FF,#E7DCFF) !important}
[data-wk="wxcardsky"] *{color:#3A2A55 !important}
[data-wk="wxcardsky"] svg{stroke:#7E5BD6 !important}
[data-wk="wxcardsay"]{background:#FBF8FF !important;color:#3A2A55 !important;border-top:2px solid #E3DAF7 !important}
[data-wk="geopin"]{background:${svg(HEART())} center/contain no-repeat !important;border:none !important;box-shadow:none !important;width:22px !important;height:20px !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:#FF5DB4 !important}
[data-wk="namecard"] img{border-radius:10px !important;box-shadow:0 0 0 3px #fff,0 0 0 4.5px #B9A8EA !important}
/* 拍一拍、通话结束：白胶囊，前面一颗星 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:#fff ${svg(STAR())} 9px center/13px 13px no-repeat !important;border-radius:999px !important;padding:2px 12px 2px 28px !important;color:#3A2A55 !important;font-weight:700 !important;box-shadow:0 2px 6px rgba(20,20,70,.3) !important}
[data-wk="note"][data-part="call"] svg{stroke:#7E5BD6 !important}
[data-wk="note"][data-part="callsum"]{color:#E8DEFF !important}
/* 系统提示：一行「SYSTEM」小标签 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:inline-block !important;background:#7E5BD6 !important;color:#fff !important;border-radius:4px !important;font:800 9px/14px monospace !important;padding:0 6px !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]{color:#E8DEFF !important}
/* 线下小结 */
[data-wk="offlogtitle"]{color:#FF3FA4 !important;font-weight:900 !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#7E5BD6 !important}
[data-wk="offlogtranscript"]{border-top:2px solid #E3DAF7 !important}
/* 加号面板：一颗颗水晶球 */
[data-wk="chatpanel"]{background:#F4EEFF !important;border-top:2px solid #fff !important}
[data-wk="chattoolicon"]{background:linear-gradient(180deg,rgba(255,255,255,.9) 0,rgba(255,255,255,.1) 45%,transparent 46%),linear-gradient(180deg,#E2F6FF,#93D6FF) !important;border:2px solid #fff !important;border-radius:50% !important;box-shadow:0 0 0 1px #6F7BA6,0 4px 8px rgba(122,69,214,.35) !important}
[data-wk="chattoolicon"]:nth-of-type(3n+1),[data-wk="chattool"]:nth-child(3n+1) [data-wk="chattoolicon"]{background:linear-gradient(180deg,rgba(255,255,255,.9) 0,rgba(255,255,255,.1) 45%,transparent 46%),linear-gradient(180deg,#FFE3F4,#FF9FD6) !important}
[data-wk="chattool"]:nth-child(3n+2) [data-wk="chattoolicon"]{background:linear-gradient(180deg,rgba(255,255,255,.9) 0,rgba(255,255,255,.1) 45%,transparent 46%),linear-gradient(180deg,#FFF6B0,#FFD84D) !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:#3A2A55 !important;color:#3A2A55 !important}
[data-wk="chattoollabel"]{color:#3A2A55 !important;font-weight:700 !important}
/* 引用三处 */
[data-wk="quotedraft"]{background:transparent !important;border-top:none !important}
[data-wk="quote"]{background:rgba(255,255,255,.9) !important;color:#3A2A55 !important;border:none !important;border-left:3px solid #FF9FD6 !important;border-radius:8px !important;opacity:1 !important}
[data-wk="quote"][data-me="0"]{border-left-color:#93D6FF !important}
[data-wk="quote"][data-draft="1"]{border-left:3px solid #FF5DB4 !important;box-shadow:0 0 0 1px #C9BBEF !important}
[data-wk="quoteicon"]{color:#FF5DB4 !important}
[data-wk="quoteclear"]{color:#7E5BD6 !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:3px solid rgba(126,91,214,.5) !important;padding-left:8px !important;opacity:.85 !important}

`;

const pack = { kind: "chat-look", v: 1, name: "Y2K", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "Y2K-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
