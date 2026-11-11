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

const bubble = { myBg: C.blueL, myText: C.ink, myBorder: "none", charBg: C.pinkL, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };

// 果冻亮面：上半一道白高光
const JELLY = (top, bot) => `linear-gradient(180deg,rgba(255,255,255,.75) 0,rgba(255,255,255,.15) 45%,rgba(255,255,255,0) 46%),linear-gradient(180deg,${top},${bot})`;

const css = `
/* ───── Y2K · 照参考图一比一 ───── */
[data-wk="chat"]{background:${svg(TILE)} 0 0/160px 160px,radial-gradient(ellipse at 85% 75%,rgba(214,60,150,.45),transparent 60%),radial-gradient(ellipse at 20% 80%,rgba(40,70,140,.35),transparent 55%),linear-gradient(180deg,#2A1A5E,#3B1F63 55%,#4A2066) !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一条厚果冻胶囊，淡紫亮面，白厚边＋淡紫外描 */
[data-wk="chathead"]{background:transparent !important;border-bottom:none !important;box-shadow:none !important;position:relative !important;z-index:5 !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:6px !important;right:6px !important;top:calc(var(--app-safe-top, 0px) + 2px) !important;bottom:2px !important;border-radius:999px !important;background:linear-gradient(180deg,rgba(255,255,255,.95) 0,rgba(255,255,255,.4) 48%,rgba(255,255,255,0) 50%),linear-gradient(180deg,#F4EEFF,#DCD0FA 60%,#CBBDF2) !important;border:3px solid #fff !important;box-shadow:0 0 0 2px #C3B4EE,inset 0 -4px 8px rgba(150,120,220,.35),0 8px 20px rgba(60,30,120,.5) !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="headink"],[data-wk="headink"] *{color:#F0479E !important;font-weight:900 !important}
[data-wk="headdim"]{color:#6B5A98 !important;font-weight:700 !important}
[data-wk="chatback"] svg{stroke:#2A1F4A !important;stroke-width:2.6 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:38px !important;min-width:38px !important;height:38px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-left:6px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
/* 顶栏头像：圆角方块，粗粉框 */
[data-wk="chathead"] [data-wk="avatar"]{border-radius:12px !important;box-shadow:0 0 0 3px #fff,0 0 0 7px #F05AAE,0 0 0 8.5px #fff !important}
[data-wk="chathead"] [data-wk="avatar"] *{border-radius:10px !important}
[data-wk="chathead"] [data-wk="avatar"]::before,[data-wk="chathead"] [data-wk="avatar"]::after{content:none !important}

/* 聊天头像：圆角方块，白厚边＋淡蓝外描＋投影，右上金星、左下小粉心 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:14px !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:11px !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 4px #fff,0 0 0 6px #BFD8F2,0 6px 12px rgba(30,20,80,.45) !important}
button[data-wk="avatar"]::before,span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;right:-12px !important;top:-12px !important;width:20px !important;height:20px !important;background:${svg(STAR())} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;left:-11px !important;bottom:-9px !important;width:15px !important;height:14px !important;background:${svg(HEART())} center/contain no-repeat !important;z-index:2 !important;pointer-events:none !important}

/* 气泡：厚果冻药丸。我＝蓝，左上两颗闪光；他＝粉，右上一颗心＋闪光 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:26px !important;border:3px solid #fff !important;font-weight:800 !important;color:#2A1F4A !important;padding:12px 20px !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(255,255,255,.85) 0,rgba(255,255,255,.25) 46%,rgba(255,255,255,0) 48%),linear-gradient(180deg,#CDEBFF,#8FD0FF 70%,#7CC4F8) !important;box-shadow:0 0 0 2px #A9C8EE,inset 0 -4px 8px rgba(70,140,220,.35),0 6px 14px rgba(20,20,70,.45) !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(180deg,rgba(255,255,255,.85) 0,rgba(255,255,255,.25) 46%,rgba(255,255,255,0) 48%),linear-gradient(180deg,#FFD9EF,#FFA8D8 70%,#FF94CC) !important;box-shadow:0 0 0 2px #E7B2D8,inset 0 -4px 8px rgba(230,80,160,.3),0 6px 14px rgba(20,20,70,.45) !important}
[data-wk="bubble"][data-kind="text"]::before{content:"" !important;position:absolute !important;border:none !important;transform:none !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::before{left:-18px !important;right:auto !important;top:-18px !important;width:36px !important;height:30px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 30'><g transform='translate(0 8) scale(1.1)'>${SPARK("#E8EEFF").replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(22 0) scale(.6)'>${SPARK("#E8EEFF").replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]::before{right:-14px !important;left:auto !important;top:-16px !important;width:44px !important;height:30px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 30'><g transform='translate(0 6) scale(.55)'>${SPARK("#E8EEFF").replace(/<\/?svg[^>]*>/g, "")}</g><g transform='translate(14 2) scale(1.2)'>${HEART().replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-first="0"] [data-wk="bubble"][data-kind="text"]::before{content:none !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}

/* 时间：TODAY.exe 小窗——淡紫标题栏（右边两颗小圆点）＋白底「★ 今天 22:10 ★」 */
[data-wk="time"] > span{display:inline-block !important;background:linear-gradient(180deg,#B9A6F0 0,#9D88E6 15px,#fff 15px) !important;border:3px solid #fff !important;box-shadow:0 0 0 2px #C3B4EE,0 6px 14px rgba(20,20,70,.45) !important;border-radius:10px !important;padding:18px 22px 4px !important;color:#2A1F4A !important;font-weight:800 !important;position:relative !important}
[data-wk="time"] > span::before{content:"TODAY.exe" !important;position:absolute !important;left:9px !important;top:0 !important;font:800 9px/15px sans-serif !important;color:#fff !important;letter-spacing:.06em !important}
[data-wk="time"] > span::after{content:"" !important;position:absolute !important;right:8px !important;top:3px !important;width:22px !important;height:9px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 9'><circle cx='5' cy='4.5' r='3.4' fill='#FF8FB8'/><circle cx='17' cy='4.5' r='3.4' fill='#7CC8FF'/></svg>`)} center/contain no-repeat !important}
[data-wk="time"] > span > *{display:none !important}

/* 已读：白胶囊，已读实心粉心、已送达空心 */
[data-wk="meta"]{display:inline-block !important;background:#fff ${svg(HEART())} 10px center/14px 13px no-repeat !important;color:#2A1F4A !important;border-radius:999px !important;padding:2px 12px 2px 30px !important;font-weight:800 !important;box-shadow:0 2px 6px rgba(20,20,70,.35) !important}
[data-wk="meta"][data-read="0"]{background:#fff ${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'><path d='M12 20 C4.5 14.5 2 11 2 7 C2 4 4.4 2 7 2 C9.2 2 11 3.4 12 5.2 C13 3.4 14.8 2 17 2 C19.6 2 22 4 22 7 C22 11 19.5 14.5 12 20Z' fill='none' stroke='#F05AAE' stroke-width='2.6'/></svg>`)} 10px center/14px 13px no-repeat !important}
[data-wk="typingdot"]{width:12px !important;height:11px !important;border-radius:0 !important;background:${svg(HEART())} center/contain no-repeat !important}
[data-wk="bubble"][data-kind="typing"]{background:linear-gradient(180deg,#FFD9EF,#FFA8D8) !important;border:3px solid #fff !important;border-radius:26px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="narrink"]{background:rgba(255,255,255,.9) !important;border-radius:12px !important;color:#2A1F4A !important;padding:3px 10px !important}
[data-wk="sysnotetext"]{color:#E8DEFF !important}

/* 底栏：同款厚果冻胶囊；黄加号、粉虚线输入框、粉爱心发送、蓝回复 */
[data-wk="composer"]{background:transparent !important;border-top:none !important;position:relative !important;z-index:2 !important;align-items:center !important;padding-left:18px !important;padding-right:18px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:6px !important;right:6px !important;top:2px !important;bottom:calc(env(safe-area-inset-bottom) * .4 + var(--composer-lift, 0px) - 8px) !important;border-radius:999px !important;background:linear-gradient(180deg,rgba(255,255,255,.95) 0,rgba(255,255,255,.4) 48%,rgba(255,255,255,0) 50%),linear-gradient(180deg,#F4EEFF,#DCD0FA 60%,#CBBDF2) !important;border:3px solid #fff !important;box-shadow:0 0 0 2px #C3B4EE,inset 0 -4px 8px rgba(150,120,220,.35),0 -6px 20px rgba(60,30,120,.5) !important;pointer-events:none !important;z-index:-1 !important}
[data-wk="chatinput"]{background:#fff !important;border:2px dashed #FFB0D8 !important;border-radius:999px !important;color:#2A1F4A !important;box-shadow:0 0 0 2px #fff,0 0 0 3.5px #E6DBFA !important;font-weight:700 !important}
[data-wk="chatinput"]::placeholder{color:#9C8FC0 !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;width:40px !important;height:40px !important;min-width:40px !important;align-self:center !important;margin:0 2px !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important;width:46px !important;min-width:46px !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.86) !important}
`;

const pack = { kind: "chat-look", v: 1, name: "Y2K", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "Y2K-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
