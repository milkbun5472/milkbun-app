// 怪诞玩偶：薄荷绿竖条墙纸；他的气泡是裂了纹的白瓷、底边一圈白蕾丝、右边一团腮红；我的是旧粉缎子、四圈缝线、底边黑蕾丝；头像是一圈蕾丝领、头顶插一把发条钥匙；已读是钥匙、送达是锁孔。用法：node themes/doll/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { wall: "#9DB5AC", wall2: "#8EA89E", por: "#F6F1EA", ink: "#4A3F3D", fog: "#6E7F79", satin: "#B87A86", satin2: "#9C5F6C", lace: "#F3EDE4", black: "#2B2426", brass: "#C9A04A", blush: "#F2A9B2" };
const STRIPE = `repeating-linear-gradient(90deg,${C.wall} 0 14px,${C.wall2} 14px 16px,${C.wall} 16px 30px,rgba(255,255,255,.12) 30px 32px)`;
const DOTS = X(`width='32' height='60' viewBox='0 0 32 60'><g fill='rgba(255,255,255,.22)'><circle cx='7' cy='10' r='1.6'/><circle cx='23' cy='40' r='1.6'/></g>`);
// 蕾丝边：一排小半圆，下面一排小孔
const LACE = c => X(`width='16' height='10' viewBox='0 0 16 10'><path d='M0 0 H16 V3 A4 4 0 0 1 8 3 A4 4 0 0 1 0 3Z' fill='${c}'/><path d='M0 3 A4 4 0 0 0 8 3 A4 4 0 0 0 16 3 V5 A4 4 0 0 1 8 9 A4 4 0 0 1 0 5Z' fill='${c}'/><circle cx='4' cy='5.5' r='1' fill='rgba(0,0,0,.18)'/><circle cx='12' cy='5.5' r='1' fill='rgba(0,0,0,.18)'/>`);
// 裂纹
const CRACK = X(`width='120' height='50' viewBox='0 0 120 50' preserveAspectRatio='none'><path d='M8 0 L14 9 L10 16 L19 26 M14 9 L24 12' fill='none' stroke='#7A6A62' stroke-width='.9' stroke-linecap='round'/><path d='M120 50 L111 42 L114 36 L104 30' fill='none' stroke='#7A6A62' stroke-width='.8' stroke-linecap='round' opacity='.7'/>`);
// 发条钥匙
const KEY = X(`viewBox='0 0 24 30'><g fill='${C.brass}' stroke='#8C6A24' stroke-width='1'><path d='M12 14 C5 14 3 9 5 6 C7 3 10 5 12 8 C14 5 17 3 19 6 C21 9 19 14 12 14Z'/><rect x='10.5' y='13' width='3' height='15'/></g><circle cx='12' cy='9' r='1.6' fill='#8C6A24'/>`);
const KEYHOLE = X(`viewBox='0 0 16 20'><circle cx='8' cy='7' r='4' fill='${C.black}'/><path d='M6 9 L4.5 18 H11.5 L10 9Z' fill='${C.black}'/>`);
// 按键
const I_SPOOL = X(`viewBox='0 0 30 30'><rect x='7' y='4' width='16' height='3' rx='1' fill='#C49A72'/><rect x='7' y='23' width='16' height='3' rx='1' fill='#C49A72'/><rect x='9' y='7' width='12' height='16' fill='${C.satin}'/><path d='M9 10 H21 M9 13 H21 M9 16 H21 M9 19 H21' stroke='${C.satin2}' stroke-width='1'/><path d='M21 12 Q27 14 24 22' stroke='${C.satin}' stroke-width='1.2' fill='none'/><path d='M23 21 L26 27' stroke='#9A9AA0' stroke-width='1.4'/>`);
const I_KEY = X(`viewBox='0 0 36 36'><circle cx='18' cy='18' r='16' fill='${C.por}' stroke='${C.lace}' stroke-width='2'/><g transform='translate(6 4) scale(1)'>${KEY.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>`);
const I_REPLY = X(`viewBox='0 0 40 34'><rect x='4' y='4' width='32' height='20' rx='6' fill='${C.por}' stroke='#CFC6BB' stroke-width='1.4'/><path d='M12 24 L10 31 L18 24' fill='${C.por}' stroke='#CFC6BB' stroke-width='1.4'/><path d='M12 9 L15 13 L13 17' stroke='#7A6A62' stroke-width='1' fill='none'/><ellipse cx='27' cy='16' rx='4' ry='2.6' fill='${C.blush}' opacity='.8'/>`);
const I_MUSIC = X(`viewBox='0 0 30 30'><rect x='4' y='10' width='22' height='14' rx='2' fill='${C.satin}' stroke='${C.satin2}' stroke-width='1.2'/><path d='M4 10 L8 5 H22 L26 10' fill='${C.lace}' stroke='${C.satin2}' stroke-width='1.2'/><g transform='translate(9 4)'><rect x='5' y='-1' width='2' height='7' fill='${C.brass}'/><circle cx='6' cy='-2' r='2.2' fill='${C.brass}'/></g><circle cx='15' cy='17' r='2' fill='${C.lace}'/>`);
const I_SCISSOR = X(`viewBox='0 0 30 30' fill='none' stroke='${C.black}' stroke-width='1.6' stroke-linecap='round'><circle cx='8' cy='22' r='4'/><circle cx='22' cy='22' r='4'/><path d='M11 19 L22 4 M19 19 L8 4'/>`);
const DOILY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='#F3ECDF' stroke='#D9CDBD' stroke-width='.8'><circle cx='96.0' cy='50.0' r='5.2'/><circle cx='94.1' cy='63.0' r='5.2'/><circle cx='88.7' cy='74.9' r='5.2'/><circle cx='80.1' cy='84.8' r='5.2'/><circle cx='69.1' cy='91.8' r='5.2'/><circle cx='56.5' cy='95.5' r='5.2'/><circle cx='43.5' cy='95.5' r='5.2'/><circle cx='30.9' cy='91.8' r='5.2'/><circle cx='19.9' cy='84.8' r='5.2'/><circle cx='11.3' cy='74.9' r='5.2'/><circle cx='5.9' cy='63.0' r='5.2'/><circle cx='4.0' cy='50.0' r='5.2'/><circle cx='5.9' cy='37.0' r='5.2'/><circle cx='11.3' cy='25.1' r='5.2'/><circle cx='19.9' cy='15.2' r='5.2'/><circle cx='30.9' cy='8.2' r='5.2'/><circle cx='43.5' cy='4.5' r='5.2'/><circle cx='56.5' cy='4.5' r='5.2'/><circle cx='69.1' cy='8.2' r='5.2'/><circle cx='80.1' cy='15.2' r='5.2'/><circle cx='88.7' cy='25.1' r='5.2'/><circle cx='94.1' cy='37.0' r='5.2'/><circle cx='50' cy='50' r='45'/></g><circle cx='50' cy='50' r='45' fill='#F3ECDF'/><g fill='#D2C4B2'><circle cx='90.6' cy='55.8' r='1.3'/><circle cx='87.3' cy='67.0' r='1.3'/><circle cx='81.0' cy='76.8' r='1.3'/><circle cx='72.2' cy='84.5' r='1.3'/><circle cx='61.6' cy='89.3' r='1.3'/><circle cx='50.0' cy='91.0' r='1.3'/><circle cx='38.4' cy='89.3' r='1.3'/><circle cx='27.8' cy='84.5' r='1.3'/><circle cx='19.0' cy='76.8' r='1.3'/><circle cx='12.7' cy='67.0' r='1.3'/><circle cx='9.4' cy='55.8' r='1.3'/><circle cx='9.4' cy='44.2' r='1.3'/><circle cx='12.7' cy='33.0' r='1.3'/><circle cx='19.0' cy='23.2' r='1.3'/><circle cx='27.8' cy='15.5' r='1.3'/><circle cx='38.4' cy='10.7' r='1.3'/><circle cx='50.0' cy='9.0' r='1.3'/><circle cx='61.6' cy='10.7' r='1.3'/><circle cx='72.2' cy='15.5' r='1.3'/><circle cx='81.0' cy='23.2' r='1.3'/><circle cx='87.3' cy='33.0' r='1.3'/><circle cx='90.6' cy='44.2' r='1.3'/></g><circle cx='50' cy='50' r='36' fill='#FFFDF8' stroke='#E3D8CA' stroke-width='1'/></svg>`;
const OVER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><radialGradient id='b'><stop offset='0' stop-color='#F2A0AC' stop-opacity='.85'/><stop offset='1' stop-color='#F2A0AC' stop-opacity='0'/></radialGradient></defs><ellipse cx='68' cy='68' rx='14' ry='10' fill='url(#b)'/><path d='M22 38 L30 42 L27 50 L34 56' fill='none' stroke='#5E514C' stroke-width='1.2' stroke-linecap='round'/><path d='M62 78 L68 74' fill='none' stroke='#5E514C' stroke-width='1' stroke-linecap='round'/></svg>`;
const KEY2 = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 24'><g fill='#D9A93A' stroke='#9C7424' stroke-width='.8'><path d='M10 9 C6 9 4 6 6 4 C7 2.6 9 3.4 10 5 C11 3.4 13 2.6 14 4 C16 6 14 9 10 9Z'/><circle cx='10' cy='3' r='2'/><rect x='8.6' y='8.5' width='2.8' height='14' rx='1'/></g></svg>`;
const LACEW = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='11' viewBox='0 0 14 11'><path d='M0 0 H14 V3 A7 7 0 0 1 0 3Z' fill='#EFE6D8'/><circle cx='7' cy='5' r='5.5' fill='#EFE6D8'/><circle cx='7' cy='5.6' r='1.6' fill='#B8AC9C'/></svg>`;
const LACEB = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='11' viewBox='0 0 14 11'><path d='M0 0 H14 V3 A7 7 0 0 1 0 3Z' fill='#2E2628'/><circle cx='7' cy='5' r='5.5' fill='#2E2628'/><circle cx='7' cy='5.6' r='1.6' fill='#B87A86'/></svg>`;
const WALL = `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='64' viewBox='0 0 72 64'><rect width='72' height='64' fill='#A9C1B6'/><rect x='36' width='36' height='64' fill='#B9CFC4'/><g fill='#97B1A6'><path d='M18 6 L21 14 L18 22 L15 14Z'/><path d='M18 38 L21 46 L18 54 L15 46Z'/></g><g fill='#A6BEB3'><circle cx='54' cy='16' r='1.4'/><circle cx='54' cy='48' r='1.4'/></g></svg>`;
const bubble = { myBg: C.satin, myText: "#fff", myBorder: "none", charBg: C.por, charText: C.ink, charBorder: "none", radius: 14, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
const HIDE = `font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important`;
// 蕾丝领头像：白瓷照片外一圈奶白，再一圈虚点（蕾丝孔），最外一圈花边
const COLLAR = `0 0 0 3px ${C.por},0 0 0 4px #D8CFC4,0 0 0 9px ${C.lace},0 0 0 10px #D8CFC4,0 3px 8px 10px rgba(60,50,45,.18)`;
const css = `
/* ───── 怪诞玩偶 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DOTS)} 0 0/32px 60px,${STRIPE} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一条旧粉缎子，缝线一圈，底边垂黑蕾丝 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,#C48C97,${C.satin}) !important;border-bottom:none !important;box-shadow:inset 0 -6px 0 -4px rgba(255,255,255,.0) !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:6px !important;right:6px !important;bottom:5px !important;border-bottom:1.5px dashed rgba(255,240,240,.7) !important;pointer-events:none !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:100% !important;height:10px !important;background:${svg(LACE(C.black))} 0 0/16px 10px repeat-x !important;pointer-events:none !important;z-index:3 !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important;letter-spacing:.12em !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:#F6DCE1 !important;font-style:italic !important}
[data-wk="chatback"] svg{stroke:#fff !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;height:26px !important;flex-shrink:0 !important;${HIDE};background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_MUSIC)} center/contain no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_SCISSOR)} center/contain no-repeat !important;margin-left:4px !important;filter:invert(1) !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chat"] [data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;margin-left:-6px !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:32px !important;height:32px !important;min-width:32px !important;aspect-ratio:1 !important;border-radius:50% !important;box-shadow:0 0 0 2px ${C.por},0 0 0 5px ${C.lace},0 0 0 6px #D8CFC4 !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important;margin-left:8px !important}
[data-wk="chat"] [data-wk="time"]{margin-top:12px !important}

/* 头像：蕾丝领一圈，头顶插一把发条钥匙 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:50% !important}
[data-wk="body"] button[data-wk="avatar"],[data-wk="body"] span[data-wk="avatar"]:not([data-halo]){position:relative !important;overflow:visible !important;box-shadow:${COLLAR} !important;margin:14px 10px 6px !important}
[data-wk="body"] button[data-wk="avatar"]::before,[data-wk="body"] span[data-wk="avatar"]:not([data-halo])::before{content:"" !important;position:absolute !important;left:calc(50% - 9px) !important;top:-28px !important;width:18px !important;height:22px !important;background:${svg(KEY)} center/contain no-repeat !important;pointer-events:none !important;z-index:2 !important}

/* 气泡：他是裂了纹的白瓷——右边一团腮红、底边一圈白蕾丝；我是旧粉缎子——一圈缝线、底边黑蕾丝 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:14px !important;line-height:1.6 !important;letter-spacing:.05em !important;margin-bottom:10px !important;padding:11px 18px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:radial-gradient(ellipse 22px 16px at calc(100% - 22px) 50%,rgba(242,169,178,.85),rgba(242,169,178,0)),${svg(CRACK)} 0 0/100% 100% no-repeat,linear-gradient(180deg,#FFFDF9,${C.por}) !important;color:${C.ink} !important;box-shadow:inset 0 1px 0 #fff,0 3px 6px rgba(60,50,45,.18) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,#C48C97,${C.satin2}) !important;color:#fff !important;outline:1.5px dashed rgba(255,240,240,.75) !important;outline-offset:-5px !important;box-shadow:0 3px 6px rgba(60,50,45,.25) !important}
[data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;left:8px !important;right:8px !important;bottom:-12px !important;height:14px !important;background:${svg(LACE(C.lace))} 0 0/22px 14px repeat-x !important;pointer-events:none !important;z-index:-1 !important;filter:drop-shadow(0 1px 1px rgba(60,50,45,.2)) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{background:${svg(LACE(C.black))} 0 0/22px 14px repeat-x !important}
[data-wk="bubble"][data-kind="text"]{isolation:isolate !important}
[data-wk="bubble"][data-kind="text"]::before{content:none !important}

/* 时间：两边一小截缝线 */
[data-wk="time"] > span{background:${C.por} !important;border:none !important;border-radius:999px !important;box-shadow:inset 0 0 0 1px #D8CFC4 !important;color:${C.fog} !important;font-size:11px !important;letter-spacing:.15em !important;padding:2px 14px !important}
/* 已读：一把发条钥匙；送达：一个锁孔 */
[data-wk="meta"]{color:#F6F1EA !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important;text-shadow:0 1px 1px rgba(0,0,0,.25) !important}
[data-wk="meta"]::before{content:"" !important;width:16px !important;height:18px !important;background:${svg(KEY)} center/contain no-repeat !important;transform:rotate(-90deg) !important}
[data-wk="meta"][data-read="0"]::before{width:10px !important;height:13px !important;background:${svg(KEYHOLE)} center/contain no-repeat !important;transform:none !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:#F6F1EA !important;padding:2px 0 0 66px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 66px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.por} !important;border:none !important;border-radius:14px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.satin} !important}

/* 动描：一张贴在墙纸上的小布标，四角一针，不像气泡 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;background:rgba(246,241,234,.88) !important;border:none !important;border-radius:2px !important;box-shadow:0 2px 4px rgba(60,50,45,.15) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;outline:1px dashed #C8BDB0 !important;outline-offset:-4px !important;color:#7A6E6A !important;opacity:1 !important;font-style:italic !important;font-size:12.5px !important;line-height:1.75 !important;padding:6px 14px !important;transform:rotate(-.6deg) !important}
[data-wk="myactink"]{background:rgba(184,122,134,.85) !important;color:#fff !important;outline-color:rgba(255,240,240,.7) !important;transform:rotate(.6deg) !important}
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:#F6F1EA !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important;text-shadow:0 1px 1px rgba(0,0,0,.25) !important}
[data-wk="sysnotetext"]::before{content:"✂ " !important}
[data-wk="narrbar"]{background:${C.por} !important;border-top:1px dashed #C8BDB0 !important}
[data-wk="narrkind"]{border:1px solid #D8CFC4 !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.satin} !important;border-color:${C.satin} !important;color:#fff !important}

/* 底栏：一块白瓷托盘，顶上垂白蕾丝；左线轴加号、瓷白输入框、右发条钥匙发送、带腮红的瓷片回复 */
[data-wk="composer"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,#FFFDF9,${C.por}) !important;border-top:none !important;box-shadow:0 -2px 8px rgba(60,50,45,.12) !important;align-items:center !important;gap:8px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;top:-9px !important;height:10px !important;background:${svg(LACE(C.lace))} 0 0/16px 10px repeat-x !important;transform:scaleY(-1) !important;pointer-events:none !important}
[data-wk="chatinput"]{background:#fff !important;border:1px solid #E3DAD0 !important;border-radius:14px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#B5ABA2 !important}
[data-wk="chatplus"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_SPOOL)} center/contain no-repeat !important}
[data-wk="chatplus"] svg{display:none !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;${HIDE};background:${svg(I_KEY)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:40px !important;min-width:40px !important;height:34px !important;${HIDE};background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}

/* 打电话那一屏：墙纸底；按键是白瓷扣子，挂断是旧粉缎子 */
[data-wk="call"][data-video="0"]{background:${svg(DOTS)} 0 0/32px 60px,${STRIPE} !important}
[data-wk="calltitle"]{color:#fff !important;letter-spacing:.15em !important;text-shadow:0 1px 2px rgba(0,0,0,.25) !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 5px ${C.por},0 0 0 6px #D8CFC4,0 0 0 16px ${C.lace},0 0 0 17px #D8CFC4,0 10px 24px 16px rgba(60,50,45,.25) !important}
[data-wk="callbtns"] button > span:first-child{background:${C.por} !important;border-radius:50% !important;box-shadow:0 0 0 3px ${C.lace},0 0 0 4px #D8CFC4,0 4px 10px rgba(60,50,45,.25) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:${C.ink} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:${C.satin} !important;box-shadow:inset 0 0 0 3px ${C.satin},inset 0 0 0 4.5px rgba(255,240,240,.7),0 4px 10px rgba(60,50,45,.25) !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:#fff !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:#fff !important}
[data-wk="callbubble"]{background:${C.por} !important;color:${C.ink} !important;border:none !important;border-radius:14px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.satin} !important;color:#fff !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;background:rgba(246,241,234,.92) !important;border:none !important;border-radius:2px !important;outline:1px dashed #C8BDB0 !important;outline-offset:-4px !important;padding:8px 14px !important;color:#7A6E6A !important;font-size:12px !important;font-style:italic !important;text-align:left !important}
[data-wk="noteink"]{color:#F6F1EA !important}
[data-wk="callact"]{color:${C.satin2} !important}

/* ───── 照参考重做：墙纸、头像蕾丝圆垫、气泡蕾丝 ───── */
[data-wk="chat"]{background:radial-gradient(ellipse at 50% 40%,transparent 50%,rgba(70,90,82,.25)),${svg(WALL)} 0 0/72px 64px !important}
[data-wk="call"][data-video="0"]{background:radial-gradient(ellipse at 50% 40%,transparent 50%,rgba(70,90,82,.25)),${svg(WALL)} 0 0/72px 64px !important}
/* 头像：整个头像坐在一张圆形蕾丝垫上（花边一圈小圆、一圈小孔、里面一圈奶白），照片上一道裂纹、右下一团腮红，头顶一把小发条钥匙 */
[data-wk="body"] button[data-wk="avatar"],[data-wk="body"] span[data-wk="avatar"]:not([data-halo]){position:relative !important;overflow:visible !important;padding:12px !important;background:${svg(DOILY)} center/100% 100% no-repeat !important;box-shadow:none !important;filter:drop-shadow(0 3px 4px rgba(60,70,65,.25)) !important;margin:12px 4px 4px !important}
[data-wk="body"] [data-wk="avatar"] > img[data-wk="avatar"]{box-shadow:none !important;border:none !important}
[data-wk="body"] button[data-wk="avatar"]::after,[data-wk="body"] span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;inset:12px !important;background:${svg(OVER)} center/100% 100% no-repeat !important;border-radius:50% !important;pointer-events:none !important;z-index:2 !important}
[data-wk="body"] button[data-wk="avatar"]::before,[data-wk="body"] span[data-wk="avatar"]:not([data-halo])::before{left:calc(50% - 8px) !important;top:-14px !important;width:16px !important;height:20px !important;background:${svg(KEY2)} center/contain no-repeat !important}
/* 气泡：圆角收小；底下一排带孔的半圆蕾丝，左右缩进一点、整排露在气泡下面 */
[data-wk="bubble"][data-kind="text"]{border-radius:10px !important;margin-bottom:12px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:radial-gradient(circle 16px at calc(100% - 26px) 50%,rgba(242,160,172,.8),rgba(242,160,172,0)),${svg(CRACK)} 0 0/100% 100% no-repeat,linear-gradient(180deg,#FFFEFB,#F1EBE1) !important;box-shadow:inset 0 1px 0 #fff,inset 0 -2px 0 rgba(0,0,0,.04),0 3px 5px rgba(60,70,65,.22) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,#D49AA6 0%,#B97A88 45%,#A9697A 100%) !important;outline:1.5px dashed rgba(60,30,40,.55) !important;outline-offset:-5px !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 3px 5px rgba(60,40,45,.3) !important}
[data-wk="bubble"][data-kind="text"]::after{left:12px !important;right:12px !important;bottom:-10px !important;height:11px !important;background:${svg(LACEW)} 0 0/14px 11px repeat-x !important;filter:drop-shadow(0 1px 1px rgba(60,70,65,.25)) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{background:${svg(LACEB)} 0 0/14px 11px repeat-x !important}
/* 已读：横着的发条钥匙；送达：锁孔 */
[data-wk="meta"]{color:#5E6E68 !important;text-shadow:none !important}
[data-wk="meta"]::before{width:20px !important;height:16px !important;background:${svg(KEY2)} center/contain no-repeat !important;transform:rotate(90deg) !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{color:#5E6E68 !important}
[data-wk="sysnotetext"]{color:#5E6E68 !important;text-shadow:none !important}
`;
const pack = { kind: "chat-look", v: 1, name: "怪诞玩偶", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "怪诞玩偶-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
