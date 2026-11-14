// 棉花可可：奶油色底；他的气泡是一杯奶泡、顶上淌一圈可可；我的是一杯可可、顶上一圈奶泡和小棉花糖；头像是俯视的马克杯——杯沿一圈可可棕、侧面一只杯把。用法：node themes/cocoa/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const X = s => `<svg xmlns='http://www.w3.org/2000/svg' ${s}</svg>`;
const C = { bg: "#F7F1EA", foam: "#FFFCF7", cocoa: "#7A4E36", cocoa2: "#5E3826", milk: "#EADBCB", ink: "#4A3328", fog: "#A8968A", pink: "#F6D3D6", cream: "#FFF6EC" };
const DOTS = X(`width='80' height='80' viewBox='0 0 80 80'><g fill='rgba(122,78,54,.08)'><rect x='10' y='14' width='6' height='5' rx='1.6' transform='rotate(12 13 16)'/><rect x='52' y='40' width='6' height='5' rx='1.6' transform='rotate(-18 55 42)'/></g><g fill='rgba(246,211,214,.5)'><rect x='30' y='62' width='6' height='5' rx='1.6' transform='rotate(30 33 64)'/><rect x='66' y='8' width='5' height='4' rx='1.4'/></g>`);
// 淌下来的那一圈：可可（他）/ 奶泡（我）
// 照参考：薄薄一层，底边是一串连续的圆拱（拱是奶泡往上顶的弧），拱和拱之间挂一颗小圆滴
// 滴放在每一小段的正中间，拼缝落在拱顶（拱顶是平的切线，拼起来看不出缝；滴要是落在拼缝上就会裂成两半）
const DRIP = c => X(`width='24' height='17' viewBox='0 0 24 17' preserveAspectRatio='none'><path d='M0 0 H24 V9.2 C19.4 9.2 17.6 12.6 16 14.8 C14.6 16.6 13.4 16.9 12 16.9 C10.6 16.9 9.4 16.6 8 14.8 C6.4 12.6 4.6 9.2 0 9.2Z' fill='${c}'/>`);
// 奶泡的绵密小气孔
const FOAM = X(`width='34' height='26' viewBox='0 0 34 26'><g fill='none' stroke='rgba(200,175,150,.28)' stroke-width='.8'><circle cx='5' cy='6' r='2.2'/><circle cx='11' cy='4' r='1.3'/><circle cx='20' cy='9' r='2.6'/><circle cx='28' cy='5' r='1.5'/><circle cx='8' cy='16' r='1.6'/><circle cx='15' cy='20' r='2.4'/><circle cx='25' cy='18' r='1.4'/><circle cx='31' cy='22' r='2'/><circle cx='2' cy='23' r='1.2'/></g>`);
const FOAMD = X(`width='34' height='26' viewBox='0 0 34 26'><g fill='none' stroke='rgba(255,236,220,.13)' stroke-width='.8'><circle cx='5' cy='6' r='2.2'/><circle cx='20' cy='9' r='2.6'/><circle cx='15' cy='20' r='2.4'/><circle cx='31' cy='22' r='2'/><circle cx='26' cy='15' r='1.3'/></g>`);
const MALLOW = X(`viewBox='0 0 40 12'><g fill='#fff' stroke='#EADBCB' stroke-width='.8'><rect x='6' y='2' width='7' height='6' rx='2' transform='rotate(-12 9 5)'/><rect x='22' y='3' width='6' height='5' rx='1.8' fill='${C.pink}' transform='rotate(18 25 5)'/></g>`);
// 按键
const I_MALLOW = X(`viewBox='0 0 30 30'><rect x='5' y='8' width='18' height='16' rx='5' fill='#fff' stroke='${C.cocoa}' stroke-width='1.8' transform='rotate(-8 14 16)'/><path d='M8 12 q6 -3 13 -1' stroke='${C.pink}' stroke-width='2' fill='none' stroke-linecap='round' transform='rotate(-8 14 16)'/><rect x='17' y='4' width='9' height='8' rx='2.6' fill='${C.pink}' stroke='${C.cocoa}' stroke-width='1.4' transform='rotate(14 21 8)'/>`);
const I_MUG = X(`viewBox='0 0 36 36'><circle cx='16' cy='18' r='13' fill='${C.cocoa}' stroke='#fff' stroke-width='2.4'/><circle cx='16' cy='18' r='9.5' fill='${C.cocoa2}'/><path d='M29 14 a5 5 0 0 1 0 9' stroke='${C.cocoa}' stroke-width='3' fill='none'/><g fill='#fff'><rect x='10' y='12' width='5' height='4.5' rx='1.4' transform='rotate(-15 12 14)'/><rect x='17' y='19' width='5' height='4.5' rx='1.4' transform='rotate(20 19 21)'/></g><rect x='13' y='20' width='4' height='3.6' rx='1.2' fill='${C.pink}'/>`);
const I_SPOON = X(`viewBox='0 0 40 34'><path d='M5 5 H35 Q38 5 38 8 V22 Q38 25 35 25 H17 L10 30 L11.5 25 H5 Q2 25 2 22 V8 Q2 5 5 5Z' fill='#fff' stroke='${C.cocoa}' stroke-width='1.8'/><path d='M10 21 L25 11' stroke='#B88A5E' stroke-width='2.2' stroke-linecap='round'/><ellipse cx='28' cy='9.5' rx='4' ry='2.8' fill='#B88A5E' transform='rotate(-33 28 9.5)'/><path d='M15 12 q2 -2 0 -4 M20 11 q2 -2 0 -4' stroke='${C.fog}' stroke-width='1.2' fill='none' stroke-linecap='round'/>`);
const I_TIN = X(`viewBox='0 0 30 30'><rect x='6' y='7' width='18' height='20' rx='3' fill='${C.cocoa}'/><rect x='5' y='4' width='20' height='5' rx='2' fill='${C.cocoa2}'/><rect x='9' y='12' width='12' height='9' rx='2' fill='${C.cream}'/><path d='M12 18 q3 -5 6 0' stroke='${C.cocoa}' stroke-width='1.4' fill='none'/><circle cx='15' cy='15' r='1.3' fill='${C.pink}'/>`);
const I_CINN = X(`viewBox='0 0 30 30' fill='none' stroke-linecap='round'><path d='M8 25 L18 4' stroke='#9A5B34' stroke-width='4'/><path d='M8 25 L18 4' stroke='#C68A57' stroke-width='1.4'/><path d='M14 27 L23 7' stroke='#9A5B34' stroke-width='4'/><path d='M14 27 L23 7' stroke='#C68A57' stroke-width='1.4'/><path d='M9 12 q4 -2 6 2' stroke='${C.pink}' stroke-width='2'/>`);
const STEAM = X(`viewBox='0 0 20 14' fill='none' stroke='${C.fog}' stroke-width='1.3' stroke-linecap='round'><path d='M5 13 q-3 -3 0 -6 q3 -3 0 -6'/><path d='M12 13 q-3 -3 0 -6 q3 -3 0 -6'/>`);
// 糖霜：彩色小糖针，撒在顶栏的可可上
const SPRINK = X(`width='70' height='18' viewBox='0 0 70 18'><g stroke-linecap='round' stroke-width='2.2'><path d='M6 6 l4 2' stroke='#F6D3D6'/><path d='M22 13 l2 -4' stroke='#FFF6EC'/><path d='M38 5 l4 -1' stroke='#F2C46B'/><path d='M54 12 l3 3' stroke='#BFE0D2'/><path d='M64 4 l-2 3' stroke='#BFD3F2'/><path d='M30 15 l4 1' stroke='#F6D3D6'/></g>`);
const HEART = X(`viewBox='0 0 20 20'><path d='M10 17 C3 12 2 9 2 7 C2 4 4 2.5 6.5 2.5 C8 2.5 9.3 3.4 10 4.6 C10.7 3.4 12 2.5 13.5 2.5 C16 2.5 18 4 18 7 C18 9 17 12 10 17Z' fill='${C.pink}' stroke='#fff' stroke-width='1.4'/>`);
const bubble = { myBg: C.cocoa, myText: "#fff", myBorder: "none", charBg: C.foam, charText: C.ink, charBorder: "none", radius: 16, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };
// 马克杯头像：一圈奶白、杯沿可可棕；杯把是往旁边挪出去的一个小环（负扩散的阴影）
const MUG_HIS = `0 0 0 4px ${C.foam},0 0 0 7px ${C.cocoa},-27px 4px 0 -16.5px ${C.bg},-27px 4px 0 -13px ${C.cocoa},0 6px 12px rgba(94,56,38,.18)`;
const MUG_ME = `0 0 0 4px ${C.foam},0 0 0 7px ${C.cocoa},27px 4px 0 -16.5px ${C.bg},27px 4px 0 -13px ${C.cocoa},0 6px 12px rgba(94,56,38,.18)`;
const HIDE = `font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;border-radius:0 !important`;
const css = `
/* ───── 棉花可可 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DOTS)} 0 0/80px 80px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：一层可可，底边往下淌一圈 */
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:${svg(SPRINK)} 0 100%/70px 18px repeat-x,linear-gradient(180deg,${C.cocoa},${C.cocoa2}) !important;border-bottom:none !important;box-shadow:none !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:-13px !important;height:14px !important;background:${svg(DRIP(C.cocoa2))} 0 -11px/36px 25px repeat-x !important;pointer-events:none !important;z-index:2 !important}
[data-wk="headink"],[data-wk="headink"] *{color:#fff !important;font-weight:600 !important}
[data-wk="headdim"],[data-wk="headname"] > div:last-child{color:#E3CDB9 !important}
[data-wk="chatback"] svg{stroke:#fff !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;height:26px !important;flex-shrink:0 !important;${HIDE};background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_TIN)} center/contain no-repeat !important;margin-left:auto !important;filter:drop-shadow(0 0 0 #fff) drop-shadow(0 1px 0 rgba(255,255,255,.5)) !important}
[data-wk="chatmore"]{background:${svg(I_CINN)} center/contain no-repeat !important;margin-left:4px !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-8px !important;flex-shrink:0 !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img,[data-wk="chathead"] [data-wk="avatar"]{width:32px !important;height:32px !important;min-width:32px !important;flex-shrink:0 !important;aspect-ratio:1 !important;border-radius:50% !important;box-shadow:0 0 0 3px ${C.foam},0 0 0 5px ${C.milk} !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-9px !important;bottom:-4px !important;width:13px !important;height:12px !important;z-index:3 !important;background:${svg(X(`viewBox='0 0 14 12'><rect x='1' y='1' width='12' height='10' rx='3' fill='${C.pink}' stroke='#fff' stroke-width='1.4'/>`))} center/contain no-repeat !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"]{flex:1 1 auto !important;min-width:84px !important}
[data-wk="chathead"] [data-wk="headname"] > div:last-child{white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}

/* 头像：俯视的马克杯——奶白一圈、杯沿可可棕，他的杯把在左、我的在右（朝外） */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *,[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:50% !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]),[data-wk="msg"] [data-wk="avatar"],[data-wk="cardrow"] [data-wk="avatar"],[data-wk="rpsingle"] > :first-child[data-wk="avatar"]{box-shadow:${MUG_HIS} !important}
[data-wk="msg"][data-me="1"] [data-wk="avatar"],[data-wk="cardrow"][data-me="1"] [data-wk="avatar"],[data-wk="rpsingle"] > [data-wk="rpcard"] + [data-wk="avatar"]{box-shadow:${MUG_ME} !important}

/* 气泡：他是一杯奶泡、顶上淌一圈可可；我是一杯可可、顶上一圈奶泡，泡上两颗小棉花糖 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border-radius:16px !important;line-height:1.6 !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${svg(DRIP(C.cocoa))} 0 0/36px 25px repeat-x,${C.foam} !important;color:${C.ink} !important;padding:30px 18px 12px !important;box-shadow:0 3px 0 ${C.milk},0 6px 12px rgba(94,56,38,.1) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${svg(DRIP(C.foam))} 0 0/36px 25px repeat-x,linear-gradient(180deg,${C.cocoa},${C.cocoa2}) !important;color:#fff !important;padding:30px 18px 12px !important;box-shadow:0 3px 0 #48291B,0 6px 12px rgba(94,56,38,.2) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;right:12px !important;top:-6px !important;width:48px !important;height:15px !important;background:${svg(MALLOW)} center/contain no-repeat !important;pointer-events:none !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"][data-me="0"]::after{content:none !important}

/* 时间：两缕热气夹着 */
[data-wk="time"] > span{background:none !important;border:none !important;box-shadow:none !important;color:${C.fog} !important;font-size:11.5px !important;letter-spacing:.15em !important;display:inline-flex !important;align-items:center !important;gap:8px !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;width:14px !important;height:11px !important;background:${svg(STEAM)} center/contain no-repeat !important}
/* 已读：一颗巧克力豆；没读：一颗白棉花糖 */
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important;letter-spacing:.1em !important;display:inline-flex !important;align-items:center !important;gap:6px !important}
[data-wk="meta"]::before{content:"" !important;width:7px !important;height:7px !important;border-radius:50% 50% 50% 0 !important;background:${C.cocoa2} !important;transform:rotate(-45deg) !important}
[data-wk="meta"][data-read="0"]::before{width:8px !important;height:7px !important;border-radius:2.5px !important;background:#fff !important;box-shadow:0 0 0 1px ${C.milk} !important;transform:none !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{flex-direction:row-reverse !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-run][data-last="1"] + [data-wk="cardmeta"]{display:block !important;font-size:10.5px !important;color:${C.fog} !important;padding:2px 0 0 62px !important}
[data-run][data-last="1"] + [data-wk="cardmeta"][data-me="1"]{text-align:right !important;padding:2px 62px 0 0 !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.foam} !important;border:none !important;border-radius:16px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.cocoa} !important}

/* 动描：一张牛皮纸小标签（不是杯子），前面一缕热气；我写的动作是粉色棉花糖标签，靠右 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:inline-block !important;position:relative !important;background:#EFE2CF !important;border:none !important;border-radius:6px !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;color:#8A6A55 !important;opacity:1 !important;font-style:italic !important;font-size:12.5px !important;line-height:1.75 !important;padding:5px 14px 5px 28px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"" !important;position:absolute !important;left:9px !important;top:8px !important;width:13px !important;height:11px !important;background:${svg(STEAM)} center/contain no-repeat !important}
[data-wk="myactink"]{background:#FBE4E6 !important;color:#A86A70 !important;padding:5px 28px 5px 14px !important}
[data-wk="myactink"]::before{left:auto !important;right:9px !important}
/* 系统提示：一行小字，两头一颗棉花糖 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{background:transparent !important;border:none !important;color:${C.fog} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.08em !important}
[data-wk="sysnotetext"]::before{content:"▫ " !important;color:${C.cocoa} !important}
[data-wk="sysnotetext"]::after{content:" ▫" !important;color:${C.cocoa} !important}
[data-wk="narrbar"]{background:${C.cream} !important;border-top:1px solid ${C.milk} !important}
[data-wk="narrkind"]{border:1px solid ${C.milk} !important;border-radius:999px !important;background:transparent !important;color:${C.fog} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.cocoa} !important;border-color:${C.cocoa} !important;color:#fff !important}

/* 底栏：一只奶白托盘；左棉花糖加号、奶色输入框、右可可杯发送、小勺回复 */
[data-wk="composer"]{background:${C.foam} !important;border-top:none !important;box-shadow:0 -3px 12px rgba(94,56,38,.1) !important;align-items:center !important;gap:8px !important;border-radius:20px 20px 0 0 !important}
[data-wk="chatinput"]{background:#F3EBE2 !important;border:none !important;border-radius:16px !important;color:${C.ink} !important}
[data-wk="chatinput"]::placeholder{color:#C2B2A5 !important}
[data-wk="chatplus"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_MALLOW)} center/contain no-repeat !important}
[data-wk="send"]{width:36px !important;min-width:36px !important;height:36px !important;${HIDE};background:${svg(I_MUG)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:40px !important;min-width:40px !important;height:34px !important;${HIDE};background:${svg(I_SPOON)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"] svg{display:none !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}

/* 打电话那一屏（语音）：一杯热可可的颜色，顶上一团奶泡色的光；按键是棉花糖块，挂断是一杯可可 */
[data-wk="call"][data-video="0"]{background:radial-gradient(ellipse at 50% 20%,rgba(255,246,236,.28),transparent 55%),linear-gradient(180deg,${C.cocoa},${C.cocoa2} 60%,#3E2418) !important}
[data-wk="calltitle"]{color:#fff !important;font-weight:600 !important}
[data-wk="call"][data-video="0"] > button:first-child{background:rgba(255,255,255,.14) !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 6px ${C.foam},0 0 0 11px ${C.cocoa2},0 0 0 12px rgba(255,255,255,.3),0 14px 30px rgba(0,0,0,.35) !important}
[data-wk="callbtns"] button > span:first-child{background:#fff !important;border-radius:30% !important;box-shadow:0 0 0 1px ${C.milk},0 5px 0 1px ${C.pink},0 10px 18px rgba(0,0,0,.3) !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:${C.cocoa} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:radial-gradient(circle at 50% 50%,${C.cocoa2} 0 55%,${C.cocoa} 56% 68%,#fff 69%) !important;border-radius:50% !important;box-shadow:0 5px 0 #3E2418,0 10px 18px rgba(0,0,0,.35) !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:#fff !important}
[data-wk="callbubble"]{background:${C.foam} !important;color:${C.ink} !important;border:none !important;border-radius:16px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.cream} !important;color:${C.cocoa2} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}

/* ───── 棉花可可 · 第二批：卡片（形状不动；都是一张奶白卡，顶上淌一层可可，跟他的气泡同一个做法） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"],[data-wk="wxcard"]{position:relative !important;overflow:hidden !important;background:${svg(DRIP(C.cocoa))} 0 0/36px 25px repeat-x,${C.foam} !important;padding-top:22px !important;border:none !important;border-radius:16px !important;box-shadow:0 3px 0 ${C.milk},0 6px 14px rgba(94,56,38,.12) !important;color:${C.ink} !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *,[data-wk="photocard"] *,[data-wk="wxcard"] *{color:${C.ink} !important;border-color:${C.milk} !important}
/* 转账：金额可可棕，收下盖一颗粉心糖章 */
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.cocoa} !important}
[data-wk="transferrule"]{border:none !important;height:1px !important;background:${C.milk} !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${C.cream} !important;border-top:1px solid ${C.milk} !important}
[data-wk="transferbtn"]{border-radius:999px !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.cocoa} !important;color:#fff !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;border:1px solid ${C.milk} !important}
[data-wk="transferseal"]{background:${svg(HEART)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;width:38px !important;height:38px !important;font-size:0 !important;color:transparent !important}
[data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{transform:rotate(-10deg) !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.55 !important}
/* 红包：不是信封——一杯可可色的卡，顶上淌奶泡，左边一杯冒热气的可可；领完变淡 */
[data-wk="rpcard"]{position:relative !important;overflow:hidden !important;background:${svg(DRIP(C.foam))} 0 0/36px 25px repeat-x,linear-gradient(180deg,${C.cocoa},${C.cocoa2}) !important;border:none !important;border-radius:16px !important;box-shadow:0 3px 0 #48291B,0 6px 14px rgba(94,56,38,.25) !important;padding-left:58px !important;padding-top:20px !important}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:calc(50% - 14px) !important;width:38px !important;height:38px !important;background:${svg(I_MUG)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="rpcard"] *{color:#fff !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"][data-status="done"]{opacity:.7 !important}
[data-wk="rpenvelope"]{background:${svg(DRIP(C.foam))} 0 0/48px 33px repeat-x,radial-gradient(circle at 50% 30%,rgba(255,246,236,.25),transparent 60%),linear-gradient(180deg,${C.cocoa},${C.cocoa2}) !important;border:none !important;border-radius:22px !important;box-shadow:0 12px 30px rgba(0,0,0,.3) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:transparent !important;border:none !important}
[data-wk="rpenvelope"] *{color:#fff !important}
[data-wk="rpopenbtn"]{background:${svg(I_MALLOW)} center/contain no-repeat !important;border:none !important;box-shadow:none !important;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25)) !important}
[data-wk="rpopenbtn"] *{opacity:0 !important}
[data-wk="rpamount"]{color:#fff !important}
[data-wk="rpavatar"]{box-shadow:0 0 0 3px ${C.foam},0 0 0 5px ${C.cocoa} !important}
/* 照片：奶白框里一块浅奶茶色小屏；语音跟气泡一样 */
[data-wk="photocard"]{padding:24px 8px 10px !important}
[data-wk="photoface"]{border-radius:10px !important;background:#F1E6DA !important;border:none !important;box-shadow:none !important;outline:none !important}
[data-wk="photoface"] *,[data-wk="photohint"]{color:#8A7466 !important}
[data-wk="photoface"] svg{stroke:${C.cocoa} !important}
[data-wk="voice"][data-me]{background:${svg(DRIP(C.cocoa))} 0 0/36px 25px repeat-x,${C.foam} !important;border:none !important;border-radius:16px !important;padding-top:18px !important;box-shadow:0 3px 0 ${C.milk} !important}
[data-wk="voice"][data-me="1"]{background:${svg(DRIP(C.foam))} 0 0/36px 25px repeat-x,linear-gradient(180deg,${C.cocoa},${C.cocoa2}) !important;box-shadow:0 3px 0 #48291B !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.ink} !important}
[data-wk="voice"][data-me="1"] > *{color:#fff !important}
[data-wk="voicewave"] span{background:${C.cocoa} !important}
[data-wk="voice"][data-me="1"] [data-wk="voicewave"] span{background:#fff !important}
/* 天气：太阳是一颗暖黄的焦糖；下面那句话垫奶茶色 */
[data-wk="wxcardsky"]{background:transparent !important}
[data-wk="wxcardsky"] > div:first-child{background:radial-gradient(circle,#F2C46B 0 11px,rgba(242,196,107,.3) 13px,transparent 60%) !important}
[data-wk="wxcardsky"] svg{stroke:${C.cocoa} !important}
[data-wk="wxcardsky"] span[style*="999"],[data-wk="wxcardrain"]{background:${C.cream} !important;border:none !important}
[data-wk="wxcardsay"]{background:${C.cream} !important;border-top:1px solid ${C.milk} !important}
[data-wk="wxcardsay"],[data-wk="wxcardsay"] *{color:${C.ink} !important}
[data-wk="geopin"]{background:${C.pink} !important;box-shadow:0 0 0 2px ${C.cocoa} !important}
[data-wk="geopinstem"]{background:${C.cocoa} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 3px ${C.foam},0 0 0 5px ${C.cocoa} !important}
/* 卡片下的已读也是一颗巧克力豆 */
[data-run][data-last="1"] + [data-wk="cardmeta"]::before{content:"" !important;display:inline-block !important;vertical-align:middle !important;width:7px !important;height:7px !important;border-radius:50% 50% 50% 0 !important;background:${C.cocoa2} !important;transform:rotate(-45deg) !important;margin:0 6px !important}
/* 拍一拍、通话结束、电话小结 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;border:none !important;background:${C.foam} !important;border-radius:999px !important;padding:3px 14px !important;color:${C.fog} !important;box-shadow:0 2px 0 ${C.milk} !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.fog} !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;background:${svg(DRIP(C.cocoa))} 0 0/36px 25px repeat-x,${C.foam} !important;border:none !important;border-radius:14px !important;padding:22px 14px 9px !important;color:#8A7466 !important;font-size:12px !important;line-height:1.65 !important;text-align:left !important;box-shadow:0 2px 0 ${C.milk} !important}
[data-wk="noteink"]{color:${C.fog} !important}
[data-wk="callact"]{color:${C.cocoa} !important}
/* 线下小结 */
[data-wk="offlogtitle"]{letter-spacing:.15em !important;color:${C.cocoa} !important;font-weight:600 !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#C77F86 !important}
[data-wk="offlogtranscript"]{border-top:1px solid ${C.milk} !important}
/* 加号面板：一块块棉花糖，白粉交替 */
[data-wk="chatpanel"]{background:${C.foam} !important;border-top:1px solid ${C.milk} !important}
[data-wk="chattoolicon"]{background:#fff !important;border:none !important;border-radius:30% !important;box-shadow:0 0 0 1px ${C.milk},0 4px 0 1px ${C.milk} !important}
[data-wk="chattool"]:nth-child(odd) [data-wk="chattoolicon"]{background:#FDECEE !important;box-shadow:0 0 0 1px #F2C9CD,0 4px 0 1px #F2C9CD !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.cocoa} !important;color:${C.cocoa} !important}
[data-wk="chattoollabel"]{color:${C.fog} !important}
/* 引用：左边一条可可 */
[data-wk="quotedraft"]{background:${C.foam} !important;border-top:1px solid ${C.milk} !important}
[data-wk="quote"]{background:#F3EBE2 !important;color:#8A7466 !important;border:none !important;border-left:4px solid ${C.cocoa} !important;border-radius:6px !important;opacity:1 !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.cocoa} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}
/* 线下：提示键是一罐可可粉，照片键是一杯可可 */
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:26px !important;min-width:26px !important;height:26px !important;background:${svg(I_TIN)} center/contain no-repeat !important;${HIDE}}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;min-width:30px !important;height:30px !important;${HIDE};background:${svg(I_MUG)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
`;
const pack = { kind: "chat-look", v: 1, name: "棉花可可", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "棉花可可-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
