// 午夜舞会（灰姑娘·夜版）：紫色夜空、一道魔法光带横过顶部，光带中间一面发光的钟；
// 他的话＝珍珠白，我的话＝紫色薄玻璃描金；头像一圈珍珠光环；悬浮的金边胶囊顶栏底栏。用法：node themes/cinderella-night/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { v1: "#3E3C8E", v2: "#5A55B0", v3: "#8C7CC8", v4: "#B79AD6", gold: "#F2D9A0", goldD: "#D9B46A", pearl: "#FFFDF6", pearl2: "#FBF2DC", ink: "#3F3A6A", lilac: "#D8D2F2" };
const SERIF = `"Songti SC","Noto Serif SC","STSong",serif`;

const STAR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -8 12 16'><path d='M0 -7 Q.6 -.6 5 0 Q.6 .6 0 7 Q-.6 .6 -5 0 Q-.6 -.6 0 -7Z' fill='#FFF6DA'/></svg>`;
const SKY = `<svg xmlns='http://www.w3.org/2000/svg' width='390' height='520'>${[[60,90,1],[340,70,.9],[200,260,.8],[40,380,1],[300,440,.9],[150,480,.7],[360,300,.7]].map(([x,y,o])=>`<path transform='translate(${x} ${y})' d='M0 -7 Q.6 -.6 5 0 Q.6 .6 0 7 Q-.6 .6 -5 0 Q-.6 -.6 0 -7Z' fill='#FFF6DA' opacity='${o}'/>`).join('')}${[[110,40],[250,120],[90,200],[330,190],[180,340],[60,300],[270,380],[120,430],[350,500],[220,30]].map(([x,y])=>`<circle cx='${x}' cy='${y}' r='1.3' fill='#fff' opacity='.7'/>`).join('')}</svg>`;
// 顶上：一道魔法光带从左下扫到右上，中间一面发光的钟（指针停在快十二点）
const RIBBON = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 230'><defs><linearGradient id='r' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.25' stop-color='#E7E2FF' stop-opacity='.45'/><stop offset='.6' stop-color='#F4F0FF' stop-opacity='.55'/><stop offset='1' stop-color='#fff' stop-opacity='.1'/></linearGradient><radialGradient id='halo'><stop offset='0' stop-color='#FFF6DA' stop-opacity='.9'/><stop offset='.5' stop-color='#FFE9B0' stop-opacity='.35'/><stop offset='1' stop-color='#FFE9B0' stop-opacity='0'/></radialGradient><radialGradient id='face' cx='.4' cy='.35'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#F3ECFF'/></radialGradient></defs><g transform='translate(0 -32)'><path d='M-10 190 C80 150 140 160 200 130 C260 100 300 30 400 70 L400 110 C310 70 270 140 210 168 C150 196 80 188 -10 225Z' fill='url(#r)'/><path d='M-10 200 C80 160 140 170 200 140 C260 110 300 40 400 80' fill='none' stroke='#fff' stroke-width='1.6' opacity='.6'/></g><circle cx='195' cy='118' r='64' fill='url(#halo)'/><circle cx='195' cy='118' r='38' fill='url(#face)' stroke='${C.goldD}' stroke-width='3'/><circle cx='195' cy='118' r='34' fill='none' stroke='${C.gold}' stroke-width='1'/>${Array.from({length:12},(_,i)=>{if(!i)return '';const a=i*30*Math.PI/180,r1=i%3?27:25,r2=31;return `<path d='M${(195+r1*Math.sin(a)).toFixed(1)} ${(118-r1*Math.cos(a)).toFixed(1)} L${(195+r2*Math.sin(a)).toFixed(1)} ${(118-r2*Math.cos(a)).toFixed(1)}' stroke='${C.ink}' stroke-width='${i%3?1:1.8}'/>`}).join('')}<text x='195' y='95' text-anchor='middle' font-size='8.5' font-family='Georgia,serif' fill='${C.ink}'>XII</text><path d='M195 118 L194 103 L195 100 L196 103Z' fill='${C.ink}'/><path transform='rotate(-48 195 118)' d='M195 118 L194 101 L195 98 L196 101Z' fill='${C.ink}'/><circle cx='195' cy='118' r='2.4' fill='${C.goldD}'/></svg>`;
const CLK = fill => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='8' fill='${fill ? C.gold : "none"}' stroke='${fill ? C.gold : C.lilac}' stroke-width='1.5'/><path d='M10 5 V10.5' fill='none' stroke='${fill ? C.ink : C.lilac}' stroke-width='1.8' stroke-linecap='round'/></svg>`;
const CI = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='17' fill='rgba(255,255,255,.08)' stroke='${C.lilac}' stroke-width='1.3'/>${inner}</svg>`;
const I_HOUSE = CI(`<path d='M12.5 21 L20 14.5 L27.5 21 V27 H12.5Z' fill='none' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/>`);
const I_MORE = CI(`<g fill='#fff'><circle cx='13' cy='20' r='1.8'/><circle cx='20' cy='20' r='1.8'/><circle cx='27' cy='20' r='1.8'/></g>`);
const I_PLUS = CI(`<path d='M13 20 H27 M20 13 V27' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/>`);
const I_SEND = CI(`<path d='M13 20 H27 M21.5 14.5 L27 20 L21.5 25.5' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/>`);
// 最右「让他回复」：一颗发光的珍珠钮，里面一个对话框
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><defs><radialGradient id='p' cx='.38' cy='.32'><stop offset='0' stop-color='#fff'/><stop offset='.7' stop-color='${C.pearl2}'/><stop offset='1' stop-color='#EAD9B0'/></radialGradient></defs><circle cx='25' cy='25' r='21' fill='url(#p)' stroke='${C.goldD}' stroke-width='1.4'/><path d='M16 18 H34 Q36 18 36 20 V28 Q36 30 34 30 H24 L19 34 V30 H16 Q14 30 14 28 V20 Q14 18 16 18Z' fill='none' stroke='${C.ink}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;

// 玻璃鞋：侧面的一只高跟鞋——尖头在左，低开口，鞋跟细高在右，玻璃里带几道高光
const SLIPPER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 38'><defs><linearGradient id='gl' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.9'/><stop offset='.55' stop-color='#D6E4FF' stop-opacity='.5'/><stop offset='1' stop-color='#F1E8FF' stop-opacity='.75'/></linearGradient></defs><path d='M4 29 Q4 24 12 22.5 Q17 21.5 20 21 Q30 19 40 13 Q45 10 49 10 L50.5 10.5 L50.5 18 L47.8 35 L45.2 35 L44.6 23.5 Q38 24.5 32 28 Q26 31.5 14 31.5 Q4 32 4 29Z' fill='url(#gl)' stroke='#fff' stroke-width='1.3' stroke-linejoin='round'/><path d='M20 21 Q28 23 36 18.5 Q43 14.5 49.5 11.5' fill='none' stroke='#B9C8EE' stroke-width='1.2'/><path d='M9 27 Q14 25.5 19 25.5' fill='none' stroke='#fff' stroke-width='1.6' stroke-linecap='round'/><path d='M47 14 V19' stroke='#fff' stroke-width='1.2' stroke-linecap='round' opacity='.8'/><path transform='translate(55 6)' d='M0 -4.5 Q.4 -.4 3.2 0 Q.4 .4 0 4.5 Q-.4 .4 -3.2 0 Q-.4 -.4 0 -4.5Z' fill='#FFF6DA'/></svg>`;
const bubble = { myBg: C.v2, myText: "#fff", myBorder: "none", charBg: C.pearl, charText: C.ink, charBorder: "none", radius: 16, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: false, gap: "normal", time: "show" };
const PANEL = `background:linear-gradient(180deg,rgba(120,110,200,.55),rgba(90,85,176,.45)) !important;backdrop-filter:blur(10px) !important;-webkit-backdrop-filter:blur(10px) !important;border-radius:20px !important;box-shadow:inset 0 0 0 1.4px rgba(242,217,160,.75),0 8px 20px rgba(40,30,100,.3) !important`;

const css = `
/* ───── 午夜舞会 · 第一批 ───── */
[data-wk="chat"]{background:${svg(SKY)} 0 0/390px 520px repeat,radial-gradient(ellipse at 20% 85%,rgba(200,150,220,.45),transparent 55%),radial-gradient(ellipse at 85% 60%,rgba(140,170,240,.35),transparent 50%),linear-gradient(180deg,${C.v1} 0%,${C.v2} 45%,${C.v3} 80%,${C.v4} 100%) !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
/* 聊天顶上那道光带和发光的钟：跟着内容滚，只在最上面 */
[data-wk="body"]{background:${svg(RIBBON)} center top/100% auto no-repeat !important;background-attachment:local !important;padding-top:170px !important}

/* 顶栏底栏：悬浮的半透明紫胶囊，一圈淡金边 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:transparent !important;border-bottom:none !important;box-shadow:none !important;gap:6px !important;z-index:5 !important}
[data-wk="chathead"]::before{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;top:calc(var(--app-safe-top, 0px) + 2px) !important;bottom:4px !important;${PANEL};z-index:-1 !important;pointer-events:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:700 !important;letter-spacing:.12em !important}
[data-wk="headdim"]{color:${C.lilac} !important;white-space:nowrap !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:#fff !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:#fff !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:34px !important;min-width:34px !important;height:34px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important;margin-right:8px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]),[data-wk="chathead"] + *:not([data-wk="body"]) *{color:#fff !important}

/* 头像：一圈珍珠光环，右上一颗小星 */
button[data-wk="avatar"],span[data-wk="avatar"]{position:relative !important;overflow:visible !important;border-radius:50% !important;box-shadow:0 0 0 3px ${C.pearl2},0 0 0 4px ${C.goldD},0 0 16px 4px rgba(255,240,200,.45) !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:"" !important;position:absolute !important;right:-4px !important;top:-6px !important;width:10px !important;height:13px !important;background:${svg(STAR)} center/contain no-repeat !important;pointer-events:none !important}

/* 他的话：珍珠白，淡淡的光；你的话：紫色薄玻璃，描一圈淡金 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:16px !important;letter-spacing:.08em !important;padding:11px 20px !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(120deg,#fff,${C.pearl} 50%,${C.pearl2}) !important;color:${C.ink} !important;border:1.2px solid rgba(242,217,160,.8) !important;box-shadow:0 0 14px rgba(255,245,220,.55) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(110,100,200,.75),rgba(80,72,170,.75)) !important;color:#fff !important;border:1.4px solid rgba(242,217,160,.85) !important;box-shadow:0 0 12px rgba(242,217,160,.25),inset 0 1px 0 rgba(255,255,255,.25) !important}

/* 时间：一行淡紫小字 */
[data-wk="time"] > span{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.lilac} !important;letter-spacing:.3em !important;font-size:11.5px !important}
/* 已读＝金色小钟；已送达＝淡紫空心小钟 */
[data-wk="meta"]{color:${C.lilac} !important;font-size:10.5px !important;letter-spacing:.12em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::after{content:"" !important;width:12px !important;height:12px !important;flex:none !important;background:${svg(CLK(false))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(CLK(true))} center/contain no-repeat !important;filter:drop-shadow(0 0 3px rgba(242,217,160,.8)) !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.pearl} !important;border:1.2px solid rgba(242,217,160,.8) !important;border-radius:16px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.goldD} !important}
[data-wk="name"]{color:${C.lilac} !important}

/* 动描：没有框，淡金斜体，上下各一颗小星 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"]{position:relative !important;display:block !important;background:transparent !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:#FFF0CC !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.1em !important;text-align:center !important;text-shadow:0 0 8px rgba(255,230,170,.5) !important;padding:14px 26px !important}
[data-wk="narrink"]::before,[data-wk="narrink"]::after{content:"" !important;position:absolute !important;left:50% !important;width:8px !important;height:11px !important;margin-left:-4px !important;background:${svg(STAR)} center/contain no-repeat !important}
[data-wk="narrink"]::before{top:0 !important}
[data-wk="narrink"]::after{bottom:0 !important}
/* 系统提示 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{border:none !important;color:${C.lilac} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.1em !important;padding-left:16px !important;background:${svg(STAR)} left center/8px 11px no-repeat !important}
[data-wk="sysnoteclose"]{color:${C.lilac} !important}

/* 底栏：同一种悬浮胶囊；输入框淡紫玻璃；发送细线箭头；最右「让他回复」是发光珍珠钮 */
[data-wk="composer"]{position:relative !important;overflow:visible !important;background:transparent !important;border-top:none !important;box-shadow:none !important;align-items:center !important;gap:10px !important;padding-left:24px !important;padding-right:24px !important}
[data-wk="composer"]::before{content:"" !important;position:absolute !important;left:12px !important;right:12px !important;top:6px !important;bottom:6px !important;${PANEL};z-index:-1 !important;pointer-events:none !important}
[data-wk="chatinput"]{background:rgba(255,255,255,.12) !important;border:1px solid rgba(216,210,242,.55) !important;border-radius:14px !important;color:#fff !important;letter-spacing:.08em !important}
[data-wk="chatinput"]::placeholder{color:${C.lilac} !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:34px !important;min-width:34px !important;height:34px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:48px !important;min-width:48px !important;height:48px !important;border-radius:50% !important;background:${svg(I_REPLY)} center/contain no-repeat !important;filter:drop-shadow(0 0 10px rgba(255,236,190,.8)) !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.9) !important}
[data-wk="chatpanel"]{background:rgba(70,64,150,.95) !important;border-top:1px solid rgba(242,217,160,.6) !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
/* ───── 王宫台阶：连发一级级错开（他往右、你往左），贴紧，每级底下一道淡金立面；最新那段最后一级落一只玻璃鞋 ───── */
[data-wk="msg"][data-first="0"]{margin-top:-6px !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{border-radius:6px !important;box-shadow:0 5px 0 rgba(217,180,106,.75),0 0 14px rgba(255,245,220,.5) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{border-radius:6px !important;box-shadow:0 5px 0 rgba(60,52,140,.85),inset 0 1px 0 rgba(255,255,255,.25),0 0 12px rgba(242,217,160,.2) !important}
[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"],[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="meta"]{margin-left:20px !important}
[data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{max-width:calc(100% - 20px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{margin-right:20px !important;max-width:calc(100% - 20px) !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"],[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="meta"]{margin-left:40px !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{max-width:calc(100% - 40px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] + [data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{margin-right:40px !important;max-width:calc(100% - 40px) !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"],[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="meta"]{margin-left:60px !important}
[data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] + [data-wk="msg"][data-me="0"][data-first="0"] [data-wk="bubble"]{max-width:calc(100% - 60px) !important}
[data-wk="msg"][data-me="1"][data-first="0"] + [data-wk="msg"][data-me="1"][data-first="0"] + [data-wk="msg"][data-me="1"][data-first="0"] [data-wk="bubble"]{margin-right:60px !important;max-width:calc(100% - 60px) !important}
[data-wk="meta"]{margin-top:9px !important}
[data-wk="msg"][data-me="0"][data-last="1"]:not(:has(~ [data-wk="msg"][data-me="0"])) [data-wk="bubble"][data-kind="text"]::after{content:"" !important;position:absolute !important;right:-52px !important;bottom:-6px !important;width:44px !important;height:28px !important;background:${svg(SLIPPER)} center/contain no-repeat !important;filter:drop-shadow(0 0 6px rgba(220,235,255,.9)) !important}
/* ───── 梦幻感放进气泡（她 2026-11-13 的五条） ───── */
/* 4. 星星：去掉满屏平铺的星和光点，只在两侧空白处留六颗；头像上的小星也拿掉 */
[data-wk="chat"]{background:${svg(STAR)} left 10px top 18%/10px 14px no-repeat,${svg(STAR)} right 12px top 34%/8px 11px no-repeat,${svg(STAR)} left 14px top 52%/8px 11px no-repeat,${svg(STAR)} right 10px top 66%/10px 14px no-repeat,${svg(STAR)} left 8px top 80%/7px 10px no-repeat,${svg(STAR)} right 16px top 88%/7px 10px no-repeat,radial-gradient(ellipse at 20% 85%,rgba(200,150,220,.45),transparent 55%),radial-gradient(ellipse at 85% 60%,rgba(140,170,240,.35),transparent 50%),linear-gradient(180deg,${C.v1} 0%,${C.v2} 45%,${C.v3} 80%,${C.v4} 100%) !important}
button[data-wk="avatar"]::after,span[data-wk="avatar"]:not([data-halo])::after{content:none !important}
/* 1. 他的台阶：顶面是很淡的珠光渐变（白里带一点粉和蓝），底下垫一圈暖光 */
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:linear-gradient(135deg,#FFFFFF 0%,#FCEFF5 35%,#EEF1FF 70%,#FFF7E8 100%) !important;box-shadow:inset 0 1px 0 #fff,0 5px 0 rgba(217,180,106,.8),0 6px 22px rgba(255,210,160,.5) !important}
/* 2. 我的台阶：半透明亮一档的紫，磨砂，顶边一道细金线 */
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:linear-gradient(180deg,rgba(170,160,240,.55),rgba(135,125,225,.45)) !important;backdrop-filter:blur(6px) !important;-webkit-backdrop-filter:blur(6px) !important;border:1px solid rgba(242,217,160,.55) !important;box-shadow:inset 0 1.6px 0 rgba(255,236,190,.95),0 5px 0 rgba(70,60,160,.75),0 6px 18px rgba(200,190,255,.3) !important}
/* 3. 台阶贴紧：组内零间距，上一级的立面直接压着下一级 */
[data-wk="msg"][data-first="0"]{margin-top:-12px !important}
[data-wk="msg"][data-first="0"] [data-wk="row"]{padding-top:0 !important;margin-top:0 !important}
/* 5. 状态字：近白，大一号 */
[data-wk="meta"]{color:#E6E2FA !important;font-size:11.5px !important}
`;

const pack = { kind: "chat-look", v: 1, name: "午夜舞会", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "午夜舞会-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
