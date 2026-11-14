// 左岸来信：一张象牙白的信纸，墨黑细线，法语小字。他的话＝白卡描一根发丝线；我的话＝浅灰纸；
// 头像外两圈细线像一枚邮戳；时间两侧细线带菱形；已读写「lu」、已送达写「envoyé」；动描用 « » 括起来。
// 用法：node themes/paris-blanc/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { paper: "#FAF8F4", card: "#FFFFFF", grey: "#F5F3EF", line: "#D8D4CD", ink: "#1E1D1B", sub: "#8A857D", fog: "#B5B0A8" };
const SERIF = `"Didot","Bodoni 72","Playfair Display","Songti SC","Noto Serif SC",Georgia,serif`;
const IT = `italic 400 12px/1 Georgia,"Times New Roman",serif`;

const DIA = (f) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M5 .8 L9.2 5 L5 9.2 L.8 5Z' fill='${f}'/></svg>`;
const DOT = (fill) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='3.2' fill='${fill ? C.ink : "none"}' stroke='${C.ink}' stroke-width='1.1'/></svg>`;
const L = inner => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>${inner}</svg>`;
// 按键：主页＝一扇巴黎窗（拱顶、十字窗棂）；更多＝一支细羽毛；加号＝细十字；发送＝钢笔尖；最右「让他回复」＝黑圆里一个细线对话框
const I_HOUSE = L(`<path d='M13 30 V17 Q13 10 20 10 Q27 10 27 17 V30Z' fill='none' stroke='${C.ink}' stroke-width='1.3'/><path d='M20 10.5 V30 M13 21 H27' stroke='${C.ink}' stroke-width='1'/><path d='M11 30 H29' stroke='${C.ink}' stroke-width='1.3'/>`);
const I_MORE = L(`<path d='M27 9 Q16 13 13 30' fill='none' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/><path d='M27 9 Q30 18 22 24 Q17 27 14 28 Q17 20 20 16 Q23 11 27 9Z' fill='none' stroke='${C.ink}' stroke-width='1' stroke-linejoin='round'/>`);
const I_PLUS = L(`<path d='M20 12 V28 M12 20 H28' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/>`);
const I_SEND = L(`<path d='M20 8 L27 19 L23 30 H17 L13 19Z' fill='none' stroke='${C.ink}' stroke-width='1.2' stroke-linejoin='round'/><path d='M20 8 V21' stroke='${C.ink}' stroke-width='1'/><circle cx='20' cy='22' r='1.6' fill='none' stroke='${C.ink}' stroke-width='1'/><path d='M16 34 H24' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/>`);
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><circle cx='22' cy='22' r='20' fill='${C.ink}'/><path d='M13 16 H31 Q32.5 16 32.5 17.5 V25 Q32.5 26.5 31 26.5 H21 L16 30 V26.5 H13 Q11.5 26.5 11.5 25 V17.5 Q11.5 16 13 16Z' fill='none' stroke='#fff' stroke-width='1.3' stroke-linejoin='round'/></svg>`;

// ── 第二批用的图 ──
// 一只牛皮纸小信封，封口一枚蜡封；open＝信封打开、信纸露出来
const ENV = st => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 44'><rect x='3' y='8' width='54' height='33' rx='2' fill='#fff' stroke='${C.ink}' stroke-width='1.1'/>${st === "open" ? `<path d='M3 8 L30 -8 L57 8' fill='none' stroke='${C.ink}' stroke-width='1.1' stroke-linejoin='round'/><rect x='11' y='0' width='38' height='22' fill='${C.paper}' stroke='${C.ink}' stroke-width='.9'/><path d='M16 7 H44 M16 12 H40 M16 17 H36' stroke='${C.fog}' stroke-width='.9'/>` : `<path d='M3 8 L30 28 L57 8' fill='none' stroke='${C.ink}' stroke-width='1.1' stroke-linejoin='round'/><circle cx='30' cy='26' r='5' fill='${st === "back" ? C.fog : "#8C2A2A"}'/><path d='M27.5 26 Q30 23 32.5 26 Q30 29 27.5 26Z' fill='none' stroke='#fff' stroke-width='.8' opacity='.8'/>`}<path d='M3 41 L24 22 M57 41 L36 22' stroke='${C.line}' stroke-width='.9'/></svg>`;
// 一只小咖啡杯（红包）；done＝喝完了，杯里空了
const CUP = done => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 50'>${done ? `` : `<path d='M22 10 Q20 5 23 2 M30 10 Q28 5 31 2 M38 10 Q36 5 39 2' fill='none' stroke='${C.fog}' stroke-width='1.1' stroke-linecap='round'/>`}<path d='M12 14 H48 V30 Q48 42 36 42 H24 Q12 42 12 30Z' fill='#fff' stroke='${C.ink}' stroke-width='1.2'/><path d='M48 18 Q56 18 56 25 Q56 32 48 32' fill='none' stroke='${C.ink}' stroke-width='1.2'/>${done ? `<path d='M15 17 H45' stroke='#C9B8A4' stroke-width='1.6' opacity='.6'/>` : `<ellipse cx='30' cy='17' rx='16' ry='3' fill='#6B4A33'/><path d='M26 17 Q30 14 34 17 Q30 20 26 17Z' fill='#E8D5BE'/>`}<path d='M6 46 H54' stroke='${C.ink}' stroke-width='1.2' stroke-linecap='round'/></svg>`;
const STAMP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 46'><path d='M3 3 H37 V43 H3Z' fill='#fff' stroke='${C.ink}' stroke-width='1' stroke-dasharray='2 2'/><rect x='7' y='7' width='26' height='28' fill='${C.grey}'/><path d='M14 31 V16 Q14 11 20 11 Q26 11 26 16 V31Z' fill='none' stroke='${C.ink}' stroke-width='1'/><path d='M20 11.5 V31 M14 22 H26' stroke='${C.ink}' stroke-width='.8'/><text x='20' y='41' text-anchor='middle' font-size='4.5' font-style='italic' font-family='Georgia,serif' fill='${C.ink}'>PARIS</text></svg>`;
const PIN = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 30'><path d='M10 1 C5 1 2 5 2 9 C2 15 10 28 10 28 C10 28 18 15 18 9 C18 5 15 1 10 1Z' fill='${C.ink}'/><circle cx='10' cy='9' r='3' fill='${C.paper}'/></svg>`;
const CARD = `background:#fff !important;border:none !important;border-radius:4px !important;box-shadow:0 0 0 .8px ${C.line},0 4px 14px rgba(30,29,27,.06) !important;color:${C.ink} !important`;

// 好感：一封信上的一枚蜡封——底下是浅灰的空蜡印轮廓，上面那枚暗红蜡封按好感从小长到满
const SEALBASE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 60'><rect x='4' y='8' width='72' height='46' rx='2' fill='#fff' stroke='${C.ink}' stroke-width='1'/><path d='M4 8 L40 34 L76 8' fill='none' stroke='${C.ink}' stroke-width='1'/><circle cx='40' cy='34' r='13' fill='none' stroke='${C.line}' stroke-width='1' stroke-dasharray='2 2'/></svg>`;
const SEAL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 60'><path d='M40 21 Q46 20 49 24 Q54 25 54 30 Q57 34 54 38 Q54 43 49 44 Q46 48 40 47 Q34 48 31 44 Q26 43 26 38 Q23 34 26 30 Q26 25 31 24 Q34 20 40 21Z' fill='#8C2A2A'/><circle cx='40' cy='34' r='8.5' fill='none' stroke='#B85050' stroke-width='1'/><text x='40' y='38.5' text-anchor='middle' font-size='11' font-style='italic' font-family='Georgia,serif' fill='#E8BDBD'>M</text></svg>`;
// 线下：街角咖啡馆的线稿——一面条纹遮阳篷、拱窗、一张小圆桌两把椅子、桌上两杯咖啡，远处一点铁塔
const CAFE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 390 300' fill='none' stroke='${C.ink}' stroke-width='1.1' stroke-linecap='round' stroke-linejoin='round'><path d='M330 40 L338 130 M346 40 L338 130 M332 70 H344 M330 100 H346 M338 30 V40' stroke='${C.fog}'/><path d='M60 150 H330 V270 H60Z'/><path d='M50 120 H340 L330 150 H60Z'/>${Array.from({length:10},(_,i)=>`<path d='M${60+i*27} 150 L${50+i*29} 120' />`).join('')}<path d='M60 150 Q66 160 72 150 Q78 160 84 150 Q90 160 96 150 Q102 160 108 150 Q114 160 120 150 Q126 160 132 150 Q138 160 144 150 Q150 160 156 150 Q162 160 168 150 Q174 160 180 150 Q186 160 192 150 Q198 160 204 150 Q210 160 216 150 Q222 160 228 150 Q234 160 240 150 Q246 160 252 150 Q258 160 264 150 Q270 160 276 150 Q282 160 288 150 Q294 160 300 150 Q306 160 312 150 Q318 160 324 150 Q330 160 330 150'/><path d='M90 255 V195 Q90 175 115 175 Q140 175 140 195 V255Z M115 175 V255 M90 215 H140'/><path d='M250 255 V195 Q250 175 275 175 Q300 175 300 195 V255Z M275 175 V255 M250 215 H300'/><text x='195' y='140' text-anchor='middle' font-family='Georgia,serif' font-style='italic' font-size='13' fill='${C.ink}' stroke='none'>Café · Le Matin</text><ellipse cx='195' cy='262' rx='34' ry='6'/><path d='M195 262 V292 M182 292 H208'/><path d='M180 252 H190 V258 Q190 262 185 262 Q180 262 180 258Z M200 252 H210 V258 Q210 262 205 262 Q200 262 200 258Z'/><path d='M184 246 Q182 242 185 238 M205 246 Q203 242 206 238' stroke='${C.fog}'/><path d='M150 292 V268 Q150 262 158 262 H164 M240 292 V268 Q240 262 232 262 H226'/><path d='M0 294 H390' stroke='${C.line}'/></svg>`;
const bubble = { myBg: C.grey, myText: C.ink, myBorder: "none", charBg: C.card, charText: C.ink, charBorder: "none", radius: 4, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: false, gap: "normal", time: "show" };

const css = `
/* ───── 左岸来信 · 第一批 ───── */
[data-wk="chat"]{background:${C.paper} !important}
[data-wk="chat"] *{font-family:${SERIF} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：象牙白，名字是细衬线，底下一根发丝线 */
[data-wk="chathead"]{background:${C.paper} !important;border-bottom:none !important;box-shadow:0 1px 0 ${C.line} !important;gap:6px !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.ink} !important}
[data-wk="headname"] > [data-wk="headink"]{font-weight:400 !important;letter-spacing:.2em !important}
[data-wk="headdim"]{color:${C.fog} !important;white-space:nowrap !important;letter-spacing:.15em !important}
[data-wk="chatback"],[data-wk="chatback"] *{color:${C.ink} !important}
[data-wk="chatback"] svg,[data-wk="headdim"] svg{stroke:${C.ink} !important;stroke-width:1.2 !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="sameroom"],[data-wk="chatmore"]{flex:none !important;width:32px !important;min-width:32px !important;height:32px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/contain no-repeat !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/contain no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}
[data-wk="chathead"] + *:not([data-wk="body"]){margin-top:4px !important}

/* 头像：两圈细线，像信封上一枚圆邮戳 */
button[data-wk="avatar"],span[data-wk="avatar"],[data-wk="rpsingle"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 3px ${C.paper},0 0 0 4px ${C.ink},0 0 0 7px ${C.paper},0 0 0 7.6px ${C.line} !important}
button[data-wk="avatar"] > *,span[data-wk="avatar"] > *,img[data-wk="avatar"]{border-radius:50% !important;filter:grayscale(.15) !important}
[data-wk="chathead"] img[data-wk="avatar"]{box-shadow:0 0 0 2px ${C.paper},0 0 0 3px ${C.ink} !important}

/* 气泡：他的白卡描发丝线；我的浅灰纸；都不带尾巴，左下（他）/右下（我）一个小直角 */
[data-wk="bubble"][data-kind="text"]{border:none !important;letter-spacing:.1em !important;padding:12px 20px !important;color:${C.ink} !important;font-size:14.5px !important;line-height:1.75 !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${C.card} !important;border-radius:6px 6px 6px 1px !important;box-shadow:0 0 0 .8px ${C.line},0 3px 10px rgba(30,29,27,.05) !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.grey} !important;border-radius:6px 6px 1px 6px !important;box-shadow:0 0 0 .8px ${C.line} !important}

/* 时间：两侧一根细线，线头一颗菱形，中间斜体小字 */
[data-wk="time"]{display:flex !important;justify-content:center !important}
[data-wk="time"] > span{display:inline-flex !important;align-items:center !important;gap:10px !important;background:transparent !important;border:none !important;box-shadow:none !important;color:${C.sub} !important;font:${IT} !important;letter-spacing:.12em !important;padding:0 !important}
[data-wk="time"] > span::before,[data-wk="time"] > span::after{content:"" !important;width:74px !important;height:8px !important;background:${svg(DIA(C.ink))} right center/7px 7px no-repeat,linear-gradient(${C.ink},${C.ink}) left center/calc(100% - 9px) .8px no-repeat !important}
[data-wk="time"] > span::after{transform:scaleX(-1) !important}

/* 已读＝斜体「lu」配实心小点；已送达＝「envoyé」配空心小点 */
[data-wk="meta"]{display:inline-flex !important;align-items:center !important;gap:8px !important;font-size:0 !important;color:${C.sub} !important}
[data-wk="meta"] *{display:none !important}
[data-wk="meta"]::before{content:"envoyé" !important;font:${IT} !important;letter-spacing:.06em !important;color:${C.sub} !important}
[data-wk="meta"][data-read="1"]::before{content:"lu" !important}
[data-wk="meta"]::after{content:"" !important;width:8px !important;height:8px !important;flex:none !important;background:${svg(DOT(false))} center/contain no-repeat !important}
[data-wk="meta"][data-read="1"]::after{background:${svg(DOT(true))} center/contain no-repeat !important}
[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.card} !important;border:none !important;border-radius:6px 6px 6px 1px !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.ink} !important;width:4px !important;height:4px !important}
[data-wk="name"]{color:${C.sub} !important;font-style:italic !important}

/* 动描：用 « » 括起来的一句斜体，居中，不进框 */
[data-wk="narr"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="narrink"],[data-wk="myactink"]{display:block !important;background:transparent !important;border:none !important;border-radius:0 !important;box-shadow:none !important;color:${C.sub} !important;font-style:italic !important;font-size:13px !important;line-height:1.9 !important;letter-spacing:.08em !important;text-align:center !important;padding:4px 18px !important}
[data-wk="narrink"]::before,[data-wk="myactink"]::before{content:"« " !important;color:${C.ink} !important;font-style:normal !important}
[data-wk="narrink"]::after,[data-wk="myactink"]::after{content:" »" !important;color:${C.ink} !important;font-style:normal !important}
[data-wk="myactink"]{text-align:right !important}
[data-wk="narrbar"]{background:${C.paper} !important;border-top:.8px solid ${C.line} !important}
[data-wk="narrkind"]{border:.8px solid ${C.line} !important;border-radius:2px !important;background:transparent !important;color:${C.sub} !important}
[data-wk="narrkind"][data-on="1"]{background:${C.ink} !important;border-color:${C.ink} !important;color:${C.paper} !important}
/* 系统提示：一行小号字，前后各一段细线 */
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{display:inline-block !important;background:linear-gradient(${C.line},${C.line}) left center/14px .8px no-repeat,linear-gradient(${C.line},${C.line}) right center/14px .8px no-repeat !important;border:none !important;color:${C.sub} !important;font-size:11px !important;font-style:normal !important;letter-spacing:.14em !important;padding:0 22px !important}
[data-wk="sysnoteclose"]{color:${C.fog} !important}

/* 底栏：象牙白，上沿一根细线；输入框只是一道下划线；最右「让他回复」是黑色圆钮 */
[data-wk="composer"]{background:${C.paper} !important;border-top:none !important;box-shadow:0 -1px 0 ${C.line} !important;align-items:center !important;gap:10px !important}
[data-wk="chatinput"]{background:transparent !important;border:none !important;border-bottom:1px solid ${C.ink} !important;border-radius:0 !important;color:${C.ink} !important;letter-spacing:.08em !important;padding-left:2px !important;padding-right:2px !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important;font-style:italic !important}
[data-wk="chatplus"],[data-wk="send"],[data-wk="chatreply"]{border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{width:30px !important;min-width:30px !important;height:30px !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="send"]{width:32px !important;min-width:32px !important;height:32px !important;background:${svg(I_SEND)} center/contain no-repeat !important;opacity:1 !important}
[data-wk="chatreply"]{width:42px !important;min-width:42px !important;height:42px !important;border-radius:50% !important;background:${svg(I_REPLY)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
[data-wk="chatpanel"]{background:${C.paper} !important;border-top:.8px solid ${C.line} !important}
[data-wk="quotedraft"]{position:relative !important;z-index:3 !important}
/* 每个人每一串的第一句上面，一行小小的法语 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"]{margin-top:20px !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"]::before{content:"Mon petit bonheur" !important;position:absolute !important;bottom:100% !important;margin-bottom:4px !important;white-space:nowrap !important;font:italic 400 11px/1 Georgia,"Times New Roman",serif !important;letter-spacing:.1em !important;color:${C.sub} !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::before{left:2px !important;content:"Je pense à toi" !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="1"]::before{right:2px !important}
/* ───── 左岸来信 · 第二批：卡片 ───── */
[data-wk="voice"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{${CARD}}
[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.ink} !important;border-color:${C.line} !important}

/* 转账＝一封信：白信封、暗红蜡封，金额像信上写的数；收下了信封打开露出信纸，退回了蜡封变灰 */
[data-wk="transfercard"]{position:relative !important;${CARD};padding-left:76px !important}
[data-wk="transfercard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:54px !important;height:40px !important;margin-top:-24px !important;background:${svg(ENV("full"))} center/contain no-repeat !important}
[data-wk="transfercard"] *{color:${C.ink} !important;border-color:${C.line} !important}
[data-wk="transferlabel"]{color:${C.sub} !important;font-style:italic !important;letter-spacing:.15em !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.ink} !important;font-weight:400 !important;letter-spacing:.04em !important}
[data-wk="transferrule"]{border:none !important;height:8px !important;background:${svg(DIA(C.ink))} center/6px 6px no-repeat,linear-gradient(90deg,transparent,${C.ink} 30%,${C.ink} calc(50% - 8px),transparent calc(50% - 8px),transparent calc(50% + 8px),${C.ink} calc(50% + 8px),${C.ink} 70%,transparent) center/100% .8px no-repeat !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${C.paper} !important}
[data-wk="transferbtn"]{border-radius:2px !important;letter-spacing:.15em !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.ink} !important;color:${C.paper} !important;border:none !important}
[data-wk="transferbtn"][data-part="back"]{background:transparent !important;color:${C.ink} !important;border:.8px solid ${C.ink} !important}
[data-wk="transferseal"]{background:transparent !important;border:.8px solid ${C.ink} !important;color:${C.ink} !important;border-radius:50% !important;box-shadow:none !important;font-style:italic !important}
[data-wk="transfercard"][data-status="accepted"]::before{background:${svg(ENV("open"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"]::before{background:${svg(ENV("back"))} center/contain no-repeat !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.65 !important}

/* 红包＝一杯冒着热气的拿铁；领完了杯子空了 */
[data-wk="rpcard"]{position:relative !important;width:220px !important;min-height:80px !important;padding:16px 16px 16px 82px !important;${CARD}}
[data-wk="rpcard"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:58px !important;height:48px !important;margin-top:-26px !important;background:${svg(CUP(false))} center/contain no-repeat !important}
[data-wk="rpcard"]::after{content:"un café" !important;position:absolute !important;right:12px !important;bottom:6px !important;font:italic 400 10.5px/1 Georgia,serif !important;letter-spacing:.12em !important;color:${C.sub} !important}
[data-wk="rpcard"] *{color:${C.ink} !important}
[data-wk="rpflap"],[data-wk="rpseal"],[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding:0 !important;background:transparent !important}
[data-wk="rpmsg"]{-webkit-line-clamp:2 !important}
[data-wk="rpcard"][data-status="done"]::before{background:${svg(CUP(true))} center/contain no-repeat !important}
[data-wk="rpcard"][data-status="done"]::after{content:"merci" !important}
/* 拆红包：关着是一封合上的信，「开」是那枚暗红蜡封；拆开后是一张摊开的信纸，金额写在信上，底下一行签名 */
[data-wk="rpenvelope"]{position:relative !important;overflow:visible !important}
[data-wk="rpenvelope"][data-stage="closed"]{background:linear-gradient(155deg,transparent 49.6%,${C.ink} 49.8%,${C.ink} 50.2%,transparent 50.4%) left top/50% 46% no-repeat,linear-gradient(205deg,transparent 49.6%,${C.ink} 49.8%,${C.ink} 50.2%,transparent 50.4%) right top/50% 46% no-repeat,#fff !important;border:none !important;border-radius:3px !important;box-shadow:0 0 0 .8px ${C.line},0 18px 40px rgba(30,29,27,.18) !important}
[data-wk="rpenvelope"][data-stage="closed"] [data-wk="rparc"]{display:none !important}
[data-wk="rpenvelope"][data-stage="closed"] *{color:${C.ink} !important}
[data-wk="rpopenbtn"]{background:radial-gradient(circle at 42% 38%,#A83A3A,#8C2A2A 60%,#6E1E1E) !important;border:none !important;border-radius:50% !important;box-shadow:0 0 0 3px rgba(140,42,42,.25),0 3px 6px rgba(0,0,0,.25) !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpenvelope"][data-stage="open"]{background:repeating-linear-gradient(180deg,transparent 0 27px,#F1EEE9 27px 28px) 0 80px/100% calc(100% - 120px) no-repeat,${C.paper} !important;border:none !important;border-radius:2px !important;box-shadow:0 0 0 .8px ${C.line},0 18px 40px rgba(30,29,27,.18) !important}
[data-wk="rpenvelope"][data-stage="open"]::after{content:"— avec amour" !important;position:absolute !important;right:22px !important;bottom:18px !important;font:italic 400 13px/1 Georgia,serif !important;letter-spacing:.1em !important;color:${C.sub} !important}
[data-wk="rpenvelope"][data-stage="open"] [data-wk="rparc"]{display:none !important}
[data-wk="rpenvelope"][data-stage="open"] *{color:${C.ink} !important}
[data-wk="rpavatar"]{border-radius:50% !important;box-shadow:0 0 0 3px #fff,0 0 0 4px ${C.ink} !important}
[data-wk="rpamount"]{color:${C.ink} !important;background:none !important;font-weight:400 !important}
[data-wk="rpclose"]{background:#fff !important;border:.8px solid ${C.ink} !important;color:${C.ink} !important}

/* 照片：一张白边相片，右下角贴一枚巴黎窗邮票 */
[data-wk="photocard"]{position:relative !important;overflow:visible !important;background:#fff !important;border:none !important;border-radius:2px !important;padding:8px 8px 26px !important;box-shadow:0 0 0 .8px ${C.line},0 6px 16px rgba(30,29,27,.08) !important}
[data-wk="photocard"]::after{content:"" !important;position:absolute !important;right:-10px !important;bottom:-14px !important;width:30px !important;height:35px !important;background:${svg(STAMP)} center/contain no-repeat !important;transform:rotate(6deg) !important}
[data-wk="photoface"]{background:${C.grey} !important;border:none !important;border-radius:1px !important}
[data-wk="photoface"] *,[data-wk="phototext"]{color:${C.ink} !important}
[data-wk="photocap"],[data-wk="photohint"]{color:${C.sub} !important;font-style:italic !important}

/* 语音：白卡，前面一颗细圈播放三角，波纹是墨线 */
[data-wk="voice"] > *{background:transparent !important;box-shadow:none !important;border:none !important;color:${C.ink} !important}
[data-wk="voice"][data-me]{padding:0 14px 0 34px !important;position:relative !important;border-radius:4px !important}
[data-wk="voice"]::before{content:"" !important;position:absolute !important;left:12px !important;top:50% !important;width:14px !important;height:14px !important;margin-top:-7px !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'><circle cx='7' cy='7' r='6' fill='none' stroke='${C.ink}' stroke-width='.9'/><path d='M5.6 4.4 L9.6 7 L5.6 9.6Z' fill='${C.ink}'/></svg>`)} center/contain no-repeat !important;z-index:2 !important}
[data-wk="voice"][data-me="1"]{background:${C.grey} !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="voicewave"] span{background:${C.ink} !important}

[data-wk="wxcardsky"]{background:${C.grey} !important}
[data-wk="wxcardsky"] *{color:${C.ink} !important}
[data-wk="wxcardsky"] svg{stroke:${C.ink} !important}
[data-wk="wxcardsay"]{background:#fff !important;color:${C.ink} !important;border-top:.8px solid ${C.line} !important;font-style:italic !important}
[data-wk="geopin"]{background:${svg(PIN)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:18px !important;height:27px !important;border-radius:0 !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.ink} !important}
[data-wk="namecard"] img{border-radius:50% !important;box-shadow:0 0 0 2px #fff,0 0 0 3px ${C.ink} !important}

/* 拍一拍、通话结束：一行小字，前后细线 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:linear-gradient(${C.line},${C.line}) left center/14px .8px no-repeat,linear-gradient(${C.line},${C.line}) right center/14px .8px no-repeat !important;border:none !important;border-radius:0 !important;padding:2px 22px !important;color:${C.sub} !important;box-shadow:none !important;font-style:italic !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.ink} !important}
[data-wk="note"][data-part="callsum"]{display:block !important;margin:6px auto 0 !important;max-width:86% !important;background:#fff !important;border:none !important;border-left:1.5px solid ${C.ink} !important;border-radius:0 4px 4px 0 !important;padding:8px 14px !important;color:${C.ink} !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="noteink"]{color:${C.sub} !important}

/* 线下小结：一张横格信纸，标题是斜体抬头，底下签名 */
[data-part="offlog"]{position:relative !important;background:repeating-linear-gradient(180deg,transparent 0 27px,#F4F2EE 27px 28px),#fff !important;padding-top:26px !important;padding-bottom:30px !important}
[data-part="offlog"]::after{content:"— à toi" !important;position:absolute !important;right:16px !important;bottom:10px !important;font:italic 400 12px/1 Georgia,serif !important;color:${C.sub} !important}
[data-wk="offlogtitle"]{display:inline-block !important;margin:0 0 8px !important;padding:0 !important;background:none !important;color:${C.ink} !important;font-style:italic !important;letter-spacing:.2em !important;border-bottom:.8px solid ${C.ink} !important}
[data-wk="offlogtitle"] *{color:${C.ink} !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:${C.sub} !important;font-style:italic !important}
[data-wk="offlogtranscript"]{border-top:.8px solid ${C.line} !important;color:${C.sub} !important}

/* 加号面板：一格格细线圆 */
[data-wk="chattoolicon"]{background:#fff !important;border:.8px solid ${C.ink} !important;border-radius:50% !important;box-shadow:none !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.ink} !important;color:${C.ink} !important}
[data-wk="chattoollabel"]{color:${C.sub} !important}

/* 引用 */
[data-wk="quotedraft"]{background:${C.paper} !important;border:none !important;border-top:.8px solid ${C.line} !important}
[data-wk="quotedraft"] *{color:${C.sub} !important;border-color:${C.ink} !important}
[data-wk="quoteicon"]{display:none !important}
[data-wk="quoteclear"]{color:${C.ink} !important}
[data-wk="quote"]{background:transparent !important;color:${C.sub} !important;border:none !important;border-left:1px solid ${C.ink} !important;border-radius:0 !important;padding:2px 10px !important;opacity:1 !important;font-style:italic !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:1px solid currentColor !important;padding-left:8px !important;opacity:.7 !important}

/* 打电话那一屏：象牙白的纸，三颗键是细线圆，中间挂断是一颗墨黑圆 */
[data-wk="call"][data-video="0"]{background:${C.paper} !important}
[data-wk="call"][data-video="0"] [data-wk="calltitle"]{color:${C.ink} !important;letter-spacing:.25em !important}
[data-wk="call"][data-video="0"] [data-wk="callhead"] > div:not([data-wk]){color:${C.sub} !important;font-style:italic !important}
[data-wk="call"][data-video="0"] > button:first-child{background:transparent !important;box-shadow:0 0 0 .8px ${C.ink} !important}
[data-wk="call"][data-video="0"] > button:first-child svg{stroke:${C.ink} !important}
[data-wk="callbtns"] button > span:first-child{background:transparent !important;border-radius:50% !important;box-shadow:0 0 0 .8px ${C.ink} !important}
[data-wk="callbtns"] button > span:first-child svg{stroke:${C.ink} !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child{background:${C.ink} !important;box-shadow:none !important}
[data-wk="callbtns"] button:nth-child(2) > span:first-child svg{stroke:${C.paper} !important}
[data-wk="call"][data-video="0"] [data-wk="callbtns"] button > span:last-child{color:${C.sub} !important}
[data-wk="callbubble"]{background:#fff !important;color:${C.ink} !important;border:none !important;border-radius:6px 6px 6px 1px !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.grey} !important;border-radius:6px 6px 1px 6px !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callbubble"][data-kind="typing"] [data-wk="typingdot"]{background:${C.ink} !important}
[data-wk="callact"]{color:${C.sub} !important;font-style:italic !important}
[data-wk="callavatar"]{border-radius:50% !important;box-shadow:0 0 0 5px ${C.paper},0 0 0 6px ${C.ink},0 0 0 12px ${C.paper},0 0 0 12.8px ${C.line} !important}
/* ───── 左岸来信 · 第三批：状态卡＝一张白信纸（横格、抬头日期线），好感是信上一枚蜡封 ───── */
[data-wk="statecard"]{background:repeating-linear-gradient(180deg,transparent 0 31px,#F4F2EE 31px 32px) 0 120px/100% calc(100% - 120px) no-repeat,#fff !important;border:none !important;border-radius:3px !important;box-shadow:0 0 0 .8px ${C.line},0 20px 50px rgba(30,29,27,.12) !important}
[data-wk="statecard"] *{font-family:${SERIF} !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:.8px solid ${C.ink} !important}
[data-wk="statehead"] *{color:${C.ink} !important}
[data-wk="statehead"] button{border:.8px solid ${C.ink} !important;background:transparent !important;border-radius:50% !important}
[data-wk="statemood"]{display:inline-block !important;background:transparent !important;color:${C.ink} !important;border:none !important;border-bottom:.8px solid ${C.ink} !important;border-radius:0 !important;padding:0 2px !important;margin-right:6px !important;font-style:italic !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:transparent !important;border:none !important;border-bottom:.8px solid ${C.line} !important;border-radius:0 !important;padding:0 !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:0 !important;font-style:italic !important;letter-spacing:.15em !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:transparent !important;color:${C.ink} !important;box-shadow:inset 0 -1.5px 0 ${C.ink} !important}
/* 看得见的＝一张浅灰便条；心里想的＝信纸上一段斜体，« » 括起来 */
[data-wk="stateseen"]{background:${C.grey} !important;border:none !important;border-radius:2px !important;margin:12px 16px !important;color:${C.ink} !important;box-shadow:none !important}
[data-wk="statevoice"]{background:transparent !important;border:none !important;border-left:1px solid ${C.ink} !important;border-radius:0 !important;margin:14px 20px !important;color:${C.ink} !important;box-shadow:none !important;font-style:italic !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.ink} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:transparent !important;border:.8px solid ${C.line} !important;border-radius:2px !important}
[data-wk="statewear"] > span{background:transparent !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.sub} !important;font-style:italic !important}
[data-wk="statevoice"] + div > button{background:transparent !important;color:${C.ink} !important;border:.8px solid ${C.ink} !important;border-radius:2px !important;font-style:italic !important}
/* 好感：一只信封，封口一枚暗红蜡封；好感多少蜡封就长多大（低分只是一圈虚线印子，满分整枚盖满） */
[data-wk="stateaff"]{background:transparent !important;border-top:.8px solid ${C.ink} !important;display:flex !important;align-items:center !important;gap:16px !important;padding:14px 20px 16px !important}
[data-wk="stateaff"] *{color:${C.ink} !important}
[data-wk="stateheart"]{position:relative !important;width:80px !important;height:60px !important;flex:none !important;background:${svg(SEALBASE)} center/contain no-repeat !important}
[data-wk="stateheart"] > div{display:none !important}
[data-wk="stateheartknob"]{display:block !important;position:absolute !important;inset:0 !important;left:0 !important;bottom:0 !important;width:auto !important;height:auto !important;margin:0 !important;background:${svg(SEAL)} center/contain no-repeat !important;transform-origin:50% 56.6% !important;transform:scale(calc(.15 + var(--sc-heart-lvl) * .85)) rotate(calc(var(--sc-heart-lvl) * -12deg)) !important;opacity:calc(.35 + var(--sc-heart-lvl) * .65) !important}
[data-wk="stateheartnum"]{display:none !important}
[data-wk="stateaffval"]{display:inline-block !important;margin:0 0 6px !important;padding:0 4px !important;background:transparent !important;border-bottom:.8px solid ${C.ink} !important;color:${C.ink} !important;font:italic 400 18px/1.2 Georgia,serif !important}
/* 翻旧的：一页页信纸，右下角签名 */
[data-wk="statehistbtn"]{background:transparent !important;color:${C.ink} !important;border:.8px solid ${C.ink} !important;border-radius:2px !important;font-style:italic !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.sub} !important;font-style:italic !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:.8px solid ${C.ink} !important;border-radius:2px !important;color:${C.ink} !important;background:transparent !important}
[data-wk="statehistitem"]{position:relative !important;background:repeating-linear-gradient(180deg,transparent 0 27px,#F4F2EE 27px 28px),${C.paper} !important;border:none !important;border-radius:2px !important;padding:16px 18px 26px !important;margin:0 0 14px !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="statehistitem"]::after{content:"— M." !important;position:absolute !important;right:14px !important;bottom:8px !important;font:italic 400 11px/1 Georgia,serif !important;color:${C.sub} !important}
[data-wk="statehistitem"] *{color:${C.ink} !important}
[data-wk="statehistmood"]{background:transparent !important;border:none !important;border-bottom:.8px solid ${C.ink} !important;color:${C.ink} !important;border-radius:0 !important;font-style:italic !important}
[data-wk="statehisttime"]{color:${C.sub} !important;font-style:italic !important}
[data-wk="statehistmeta"]{background:${C.grey} !important;border-radius:2px !important}
[data-wk="statehistend"]{color:${C.sub} !important}
/* Ta 眼里 */
[data-wk="gazepage"]{background:${C.paper} !important}
[data-wk="gazetitle"]{color:${C.ink} !important;font-style:italic !important;letter-spacing:.2em !important}
[data-wk="gazetab"]{background:transparent !important;color:${C.fog} !important;border:none !important;border-bottom:.8px solid ${C.line} !important;border-radius:0 !important;clip-path:none !important;font-style:italic !important}
[data-wk="gazetab"][data-on="1"]{color:${C.ink} !important;border-bottom:1.5px solid ${C.ink} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.sub} !important}
[data-wk="gazecard"]{background:#fff !important;border:none !important;border-radius:3px !important;box-shadow:0 0 0 .8px ${C.line},0 4px 12px rgba(30,29,27,.05) !important}
[data-wk="gazetape"]{background:${svg(STAMP)} center/16px 18px no-repeat !important;box-shadow:none !important;border:none !important;transform:rotate(6deg) !important;width:18px !important;height:20px !important}
[data-wk="gazecardname"]{color:${C.ink} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.sub} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:#fff !important;border:none !important;border-radius:3px !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="gazeletter"] *,[data-wk="gazehistory"] *{color:${C.ink} !important}
[data-wk="gazeempty"]{background:transparent !important;border:.8px dashed ${C.line} !important;border-radius:3px !important;color:${C.ink} !important}
[data-wk="gazeempty"] button{background:${C.ink} !important;color:${C.paper} !important;border:none !important;border-radius:2px !important}
/* ───── 左岸来信 · 第四批：线下＝一张街角咖啡馆的线稿（条纹遮阳篷、拱窗、小圆桌两杯咖啡、远处铁塔） ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(CAFE)} center bottom 96px/100% auto no-repeat,${C.paper} !important}
[data-wk="offline"] *{font-family:${SERIF} !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="offbody"] > div:not([data-wk]),[data-wk="offline"] [data-wk="offbody"] > div:not([data-wk]) > :not([data-wk]){color:${C.sub} !important;font-style:italic !important}
[data-wk="offline"] [data-wk="chathead"] + *{margin-top:0 !important;padding-top:10px !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:${C.ink} !important;letter-spacing:.2em !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:30px !important;height:30px !important;background:${svg(I_MORE)} center/contain no-repeat !important;border:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:transparent !important;color:${C.ink} !important;border:.8px solid ${C.ink} !important;border-radius:2px !important;font-size:12px !important;padding:3px 14px !important;font-style:italic !important}
[data-wk="offcomposer"]{background:${C.paper} !important;border-top:.8px solid ${C.line} !important}
[data-wk="offcomposer"] textarea{background:transparent !important;border:none !important;border-bottom:1px solid ${C.ink} !important;border-radius:0 !important;color:${C.ink} !important}
[data-wk="offcomposer"] textarea::placeholder{color:${C.fog} !important;font-style:italic !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;height:30px !important;min-width:30px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(I_PLUS)} center/contain no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SEND)} center/30px no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{position:relative !important;width:42px !important;min-width:42px !important;height:42px !important;border:none !important;border-radius:50% !important;background:${svg(CUP(false))} center/62% no-repeat,${C.ink} !important;font-size:0 !important;color:transparent !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{background:${svg(CUP(false).replace(/stroke='#1E1D1B'/g,"stroke='#FAF8F4'").replace("fill='#fff'","fill='none'"))} center/62% no-repeat,${C.ink} !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
/* 卡片：他的白卡发丝线、你的浅灰纸，跟线上一样 */
[data-wk="offcard"]{position:relative !important;background:#fff !important;border:none !important;border-radius:6px 6px 6px 1px !important;box-shadow:0 0 0 .8px ${C.line},0 4px 14px rgba(30,29,27,.06) !important;margin-top:16px !important;color:${C.ink} !important}
[data-wk="offcard"][data-me="1"]{background:${C.grey} !important;border-radius:6px 6px 1px 6px !important;box-shadow:0 0 0 .8px ${C.line} !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:50% !important;box-shadow:0 0 0 2px #fff,0 0 0 3px ${C.ink} !important}
[data-wk="offname"],[data-wk="offtext"]{color:${C.ink} !important}
[data-wk="offname"]{font-weight:400 !important;letter-spacing:.2em !important;font-style:italic !important}
[data-wk="offtext"]{line-height:1.9 !important;letter-spacing:.05em !important}
[data-wk="offsay"]{color:${C.ink} !important;background:none !important;font-weight:600 !important;border-bottom:.8px solid ${C.ink} !important}
[data-wk="offthought"]{background:transparent !important;border:none !important;border-left:1px solid ${C.ink} !important;border-radius:0 !important;color:${C.sub} !important;font-style:italic !important;box-shadow:none !important}
[data-wk="offcardacts"] svg{stroke:${C.sub} !important;color:${C.sub} !important}
[data-wk="offreplyopt"]{background:#fff !important;border:.8px solid ${C.ink} !important;border-radius:2px !important;color:${C.ink} !important;font-style:italic !important}
`;

const pack = { kind: "chat-look", v: 1, name: "左岸来信", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "左岸来信-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
