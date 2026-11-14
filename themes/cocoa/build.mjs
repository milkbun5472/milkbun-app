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
const DRIP = c => X(`width='60' height='30' viewBox='0 0 60 30'><path d='M0 0 H60 V15 C58 15 57.5 23 55 23 C52.5 23 52.5 16 50 16 C48 16 48 19.5 46 19.5 C44 19.5 44 15 41.5 15 C39 15 39.5 28 36 28 C32.5 28 33 16 30.5 16 C28.5 16 28.5 20 26 20 C23.5 20 24 15 21.5 15 C19 15 19.5 25 16.5 25 C13.5 25 14 16 11.5 16 C9.5 16 9.5 19 7.5 19 C5 19 5.5 14.5 3 14.5 C1.5 14.5 0 15.5 0 15Z' fill='${c}'/><g fill='rgba(255,255,255,.35)'><circle cx='36' cy='24.5' r='1.3'/><circle cx='16.5' cy='22' r='1.1'/><circle cx='55' cy='20' r='1'/><circle cx='8' cy='6' r='1.6'/><circle cx='27' cy='9' r='1.2'/><circle cx='47' cy='5' r='1.5'/></g>`);
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
[data-wk="chathead"]{position:relative !important;overflow:visible !important;background:linear-gradient(180deg,${C.cocoa},${C.cocoa2}) !important;border-bottom:none !important;box-shadow:none !important}
[data-wk="chathead"]::after{content:"" !important;position:absolute !important;left:0 !important;right:0 !important;bottom:-29px !important;height:30px !important;background:${svg(DRIP(C.cocoa2))} 0 0/60px 30px repeat-x !important;pointer-events:none !important;z-index:2 !important}
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
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${svg(DRIP(C.cocoa))} 0 0/60px 30px repeat-x,${svg(FOAM)} 0 0/34px 26px,radial-gradient(ellipse at 30% 40%,#fff,${C.foam} 70%) !important;color:${C.ink} !important;padding:36px 16px 12px !important;box-shadow:0 3px 0 ${C.milk},0 6px 12px rgba(94,56,38,.1) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${svg(DRIP(C.foam))} 0 0/60px 30px repeat-x,${svg(FOAMD)} 0 0/34px 26px,linear-gradient(180deg,${C.cocoa},${C.cocoa2}) !important;color:#fff !important;padding:36px 16px 12px !important;box-shadow:0 3px 0 #48291B,0 6px 12px rgba(94,56,38,.2) !important}
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
`;
const pack = { kind: "chat-look", v: 1, name: "棉花可可", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "棉花可可-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
