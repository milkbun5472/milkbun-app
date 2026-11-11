// 青瓷×焦茶：照参考图第三个配色。点点米底、焦茶描边、我的青瓷气泡角上一颗星、他的米白气泡带「」角标和一只探头小猫。
// 用法：node themes/celadon/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#F3EBDA", dot: "#D9CDB4", brown: "#4A3A30", cel: "#A9D3C3", celD: "#8FC0AE", cream: "#FFF5DE", fog: "#A79E92" };

const STAR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2.5 L14.6 8.6 L21.2 9.2 L16.2 13.6 L17.7 20.1 L12 16.7 L6.3 20.1 L7.8 13.6 L2.8 9.2 L9.4 8.6Z' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const CAT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 30' fill='none' stroke='${C.brown}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M56 26 C62 27 67 23 66 16 C65.6 13.5 67.5 12 69 13'/><path d='M5 30 C5 22 8 16 13 13 L12.5 4.5 L21 9.5 C26 8 38 8 43 9.5 L50 3.5 L51.5 13 C56 16 59 22 59 30' fill='${C.cream}'/><ellipse cx='20' cy='23.5' rx='3.4' ry='1.7' fill='#F2B8B0' stroke='none'/><ellipse cx='44' cy='23.5' rx='3.4' ry='1.7' fill='#F2B8B0' stroke='none'/><path d='M25.5 19.6 L26.5 19.6 M37.5 19.6 L38.5 19.6' stroke-width='2.4'/><path d='M29 23 C29.6 24.6 31.4 24.6 32 23 C32.6 24.6 34.4 24.6 35 23' stroke-width='1.3'/></svg>`;
const CORNER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40' preserveAspectRatio='none'><path d='M4 14 V5 H12' fill='none' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke'/><path d='M96 26 V35 H88' fill='none' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke'/></svg>`;
const CTL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M1 11 V1 H11' fill='none' stroke='${C.brown}' stroke-width='1.6'/></svg>`;
const CBR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M11 1 V11 H1' fill='none' stroke='${C.brown}' stroke-width='1.6'/></svg>`;
const I_SENDP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M3 11 L25 3 L18 21 L13.5 14 Z' fill='${C.cel}' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/><path d='M13.5 14 L25 3' stroke='${C.brown}' stroke-width='1.4' stroke-linecap='round'/></svg>`;
const DOTS = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><circle cx='3' cy='3' r='1.3' fill='${C.dot}'/><circle cx='14' cy='14' r='1.3' fill='${C.dot}'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6'/><path d='M12 7 V17 M7 12 H17' stroke='${C.brown}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M5 3 H23 Q26 3 26 6 V15 Q26 18 23 18 H12 L6 22 L7 18 H5 Q2 18 2 15 V6 Q2 3 5 3Z' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='9' cy='10.5' r='1.3' fill='${C.brown}'/><circle cx='14' cy='10.5' r='1.3' fill='${C.brown}'/><circle cx='19' cy='10.5' r='1.3' fill='${C.brown}'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.6' fill='${C.brown}'/><circle cx='12' cy='12' r='1.6' fill='${C.brown}'/><circle cx='19' cy='12' r='1.6' fill='${C.brown}'/></svg>`;

const bubble = { myBg: C.cel, myText: C.brown, myBorder: "1.6px solid " + C.brown, charBg: C.cream, charText: C.brown, charBorder: "1.6px solid " + C.brown, radius: 12, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "all", name: true, gap: "tight", time: "show" };
const LINE = `1.6px solid ${C.brown}`;

const css = `
/* ───── 青瓷×焦茶 · 第一批 ───── */
[data-wk="chat"]{background:${svg(DOTS)} 0 0/22px 22px,${C.bg} !important}
[data-wk="body"]{background:transparent !important}

/* 顶栏：米白底，下面一道焦茶线 */
[data-wk="chathead"]{background:${C.cream} !important;border-bottom:${LINE} !important;box-shadow:none !important}
[data-wk="headink"],[data-wk="headink"] *{color:${C.brown} !important}
[data-wk="headdim"]{color:${C.fog} !important}
[data-wk="chatback"] svg{stroke:${C.brown} !important}
[data-wk="chathead"] [data-wk="avatar"],[data-wk="chathead"] img{border-radius:10px !important;box-shadow:0 0 0 1.6px ${C.brown} !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:30px !important;min-width:30px !important;height:30px !important;font-size:0 !important;color:transparent !important;padding:0 !important;border:none !important;box-shadow:none !important;background-color:transparent !important}
[data-wk="sameroom"]{background:${svg(I_HOUSE)} center/22px no-repeat !important;margin-left:auto !important}
[data-wk="chatmore"]{background:${svg(I_MORE)} center/22px no-repeat !important}
[data-wk="chatmore"] *,[data-wk="sameroom"] *{opacity:0 !important}

/* 头像：圆角方块，焦茶细边 */
button[data-wk="avatar"],span[data-wk="avatar"],button[data-wk="avatar"] *,span[data-wk="avatar"] *{border-radius:10px !important}
button[data-wk="avatar"],span[data-wk="avatar"]:not([data-halo]){box-shadow:0 0 0 1.6px ${C.brown} !important}

/* 名字：只给我那边一个「Me」 */
[data-wk="name"][data-me="0"]{display:none !important}
[data-wk="name"][data-me="1"]{font-size:0 !important;margin:0 4px 6px !important}
[data-wk="name"][data-me="1"]::after{content:"Me" !important;font-size:12px !important;color:${C.brown} !important;letter-spacing:.06em !important}

/* 气泡：焦茶描边；我的青瓷、角上一颗星；他的米白、里面「」两个角标、顶上探出一只小猫 */
[data-wk="bubble"][data-kind="text"]{position:relative !important;overflow:visible !important;border:${LINE} !important;border-radius:12px !important;color:${C.brown} !important;padding:11px 22px !important;box-shadow:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]{background:${C.cel} !important}
[data-wk="bubble"][data-kind="text"][data-me="0"]{background:${svg(CTL)} 8px 7px/11px 11px no-repeat,${svg(CBR)} right 8px bottom 7px/11px 11px no-repeat,${C.cream} !important}
[data-wk="bubble"][data-kind="text"]::before,[data-wk="bubble"][data-kind="text"]::after{content:none !important}
[data-wk="bubble"][data-kind="text"][data-me="1"]::after{content:"" !important;position:absolute !important;right:-10px !important;bottom:-10px !important;left:auto !important;top:auto !important;width:22px !important;height:22px !important;background:${svg(STAR)} center/contain no-repeat !important;border:none !important;transform:none !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]{margin-top:22px !important}
[data-wk="msg"][data-first="1"] [data-wk="bubble"][data-kind="text"][data-me="0"]::before{content:"" !important;position:absolute !important;right:14px !important;left:auto !important;top:-20.5px !important;width:52px !important;height:21.7px !important;background:${svg(CAT)} center bottom/contain no-repeat !important;border:none !important;transform:none !important}

/* 时间、已读：浅灰小字 */
[data-wk="time"] > span{background:${C.cream} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:999px !important;padding:2px 12px !important;font-size:11px !important}
[data-wk="meta"]{color:${C.fog} !important;font-size:10.5px !important}
[data-wk="bubble"][data-kind="typing"]{background:${C.cream} !important;border:${LINE} !important;border-radius:12px !important}
[data-wk="bubble"][data-kind="typing"]::before,[data-wk="bubble"][data-kind="typing"]::after{content:none !important}
[data-wk="typingdot"]{background:${C.brown} !important}
[data-wk="narrink"]{background:${C.cream} !important;border:${LINE} !important;border-radius:10px !important;color:${C.brown} !important;padding:3px 10px !important}
[data-wk="sysnotetext"]{color:${C.fog} !important}

/* 底栏：米白底一道焦茶线；输入框圆角描边；发送键是「发送」两个字的青瓷块，角上一颗星 */
[data-wk="composer"]{background:${C.cream} !important;border-top:${LINE} !important;align-items:center !important;gap:8px !important}
[data-wk="chatinput"]{background:#fff !important;border:${LINE} !important;border-radius:12px !important;color:${C.brown} !important}
[data-wk="chatinput"]::placeholder{color:${C.fog} !important}
[data-wk="chatplus"],[data-wk="chatreply"]{width:30px !important;min-width:30px !important;height:30px !important;border:none !important;box-shadow:none !important;border-radius:0 !important;background-color:transparent !important}
[data-wk="chatplus"]{background:${svg(I_PLUS)} center/26px no-repeat !important}
[data-wk="chatreply"]{background:${svg(I_REPLY)} center/26px no-repeat !important}
[data-wk="send"]{order:99 !important;position:relative !important;overflow:visible !important;width:64px !important;min-width:64px !important;height:36px !important;border:${LINE} !important;border-radius:10px !important;background:${C.cel} !important;box-shadow:none !important;opacity:1 !important;margin-right:6px !important}
[data-wk="send"]::before{content:"发送" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;font-size:14px !important;letter-spacing:.2em !important;color:${C.brown} !important}
[data-wk="send"]::after{content:"" !important;position:absolute !important;right:-9px !important;bottom:-9px !important;width:18px !important;height:18px !important;background:${svg(STAR)} center/contain no-repeat !important}
[data-wk="chatplus"] *,[data-wk="send"] *,[data-wk="chatreply"] *{opacity:0 !important}
[data-wk="chatplus"]:active,[data-wk="send"]:active,[data-wk="chatreply"]:active{transform:scale(.92) !important}
[data-wk="msg"][data-me="0"] [data-wk="name"]{display:none !important}
[data-wk="msg"][data-me="1"] [data-wk="meta"]{margin-right:14px !important}


/* ───── 青瓷焦茶 · 第二批：卡片（形状不动，米白底焦茶描边；小巧思：转账、名片、线下小结的卡角趴一只同款小猫，收下的印是一颗星） ───── */
[data-wk="transfercard"],[data-wk="photocard"],[data-wk="wxcard"],[data-wk="geocard"] > [data-wk="card"],[data-wk="namecard"],[data-part="offlog"],[data-wk="callpill"] > [data-wk="block"]{background:${C.cream} !important;border:${LINE} !important;border-radius:14px !important;box-shadow:none !important;color:${C.brown} !important;position:relative !important;overflow:visible !important}
[data-wk="transfercard"] *,[data-wk="namecard"] *,[data-part="offlog"] *,[data-wk="geocard"] *,[data-wk="callpill"] *{color:${C.brown} !important;border-color:rgba(74,58,48,.25) !important}
[data-wk="transfercard"],[data-wk="namecard"],[data-part="offlog"]{margin-top:20px !important}
[data-wk="transfercard"]::before,[data-wk="namecard"]::before,[data-part="offlog"]::before{content:"" !important;position:absolute !important;right:16px !important;top:-20.5px !important;width:52px !important;height:21.7px !important;background:${svg(CAT)} center bottom/contain no-repeat !important;z-index:2 !important}
[data-wk="transferamount"],[data-wk="transfercur"]{color:${C.brown} !important;font-weight:700 !important}
[data-wk="transferrule"]{border:none !important;height:1.6px !important;background:${C.brown} !important}
[data-wk="transfernotch"]{display:none !important}
[data-wk="transferfoot"]{background:${C.bg} !important;border-radius:0 0 12px 12px !important}
[data-wk="transferbtn"]{border-radius:10px !important;border:${LINE} !important}
[data-wk="transferbtn"][data-part="take"]{background:${C.cel} !important;color:${C.brown} !important}
[data-wk="transferbtn"][data-part="back"]{background:${C.cream} !important;color:${C.brown} !important}
[data-wk="transferseal"]{border:${LINE} !important;color:${C.brown} !important;background:${C.cream} !important;box-shadow:none !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"]{background:${svg(STAR)} center/contain no-repeat !important;border:none !important;width:52px !important;height:52px !important;border-radius:0 !important;transform:rotate(-10deg) !important}
[data-wk="transfercard"][data-status="accepted"] [data-wk="transferseal"] *{opacity:0 !important}
[data-wk="transfercard"][data-status="returned"]{opacity:.6 !important}
/* 红包：一个青瓷色小信封——焦茶描边、三角封口压一道折线、封口上贴一颗星；领完变米白、星变空 */
[data-wk="rpcard"]{background:linear-gradient(160deg,transparent 0 0),${C.cel} !important;border:${LINE} !important;border-radius:12px !important;box-shadow:none !important;overflow:hidden !important}
[data-wk="rpcard"] *{color:${C.brown} !important}
[data-wk="rpflap"]{height:48px !important;bottom:auto !important;background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60' preserveAspectRatio='none'><path d='M0 0 L50 58 L100 0' fill='${C.celD}' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke' stroke-linejoin='round'/></svg>`)} center/100% 100% no-repeat !important;border:none !important}
[data-wk="rpseal"]{border:none !important;background:${svg(STAR)} center/contain no-repeat !important;width:26px !important;height:26px !important;left:50% !important;margin-left:-13px !important;top:30px !important}
[data-wk="rpseal"] *{display:none !important}
[data-wk="rpcorner"]{display:none !important}
[data-wk="rpcard"] > div:not([data-wk]){padding-top:60px !important;padding-left:16px !important;padding-bottom:14px !important;text-align:center !important}
[data-wk="rpcard"][data-status="done"]{background:${C.cream} !important;filter:none !important;opacity:.85 !important}
[data-wk="rpcard"][data-status="done"] [data-wk="rpflap"]{background:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60' preserveAspectRatio='none'><path d='M0 0 L50 58 L100 0' fill='${C.bg}' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke'/></svg>`)} center/100% 100% no-repeat !important}
/* 拆开前后那一页 */
[data-wk="rpenvelope"]{background:${svg(DOTS)} 0 0/22px 22px,${C.cel} !important;border:${LINE} !important;border-radius:24px !important;box-shadow:0 10px 30px rgba(74,58,48,.25) !important}
[data-wk="rpenvelope"] [data-wk="rparc"]{background:${C.celD} !important;border-color:${C.brown} !important}
[data-wk="rpenvelope"] *{color:${C.brown} !important}
[data-wk="rpenvelope"][data-stage="open"]{background:${svg(DOTS)} 0 0/22px 22px,${C.cream} !important}
[data-wk="rpopenbtn"]{background:${C.cream} ${svg(STAR)} center/60% no-repeat !important;border:${LINE} !important;box-shadow:none !important}
[data-wk="rpopenbtn"],[data-wk="rpopenbtn"] *{color:transparent !important;font-size:0 !important}
[data-wk="rpamount"]{color:${C.brown} !important}
[data-wk="rpavatar"]{border-radius:10px !important;box-shadow:0 0 0 1.6px ${C.brown} !important}
[data-wk="rpclose"]{background:${C.cream} !important;border:${LINE} !important;color:${C.brown} !important}
/* 照片：米白边相框 */
[data-wk="photocard"]{padding:8px 8px 10px !important}
[data-wk="photoface"]{border-radius:10px !important;background:${C.bg} !important;border:1px solid rgba(74,58,48,.2) !important}
[data-wk="photoface"] *,[data-wk="phototext"],[data-wk="photocap"],[data-wk="photohint"]{color:${C.brown} !important}
/* 语音：跟气泡一样，我青瓷、他米白，焦茶描边 */
[data-wk="voice"][data-me]{background:${C.cream} !important;border:${LINE} !important;border-radius:12px !important;box-shadow:none !important}
[data-wk="voice"][data-me="1"]{background:${C.cel} !important}
[data-wk="voice"] > *{background:transparent !important;border:none !important;box-shadow:none !important;color:${C.brown} !important}
[data-wk="voicewave"] span{background:${C.brown} !important}
[data-wk="wxcardsky"]{background:${C.bg} !important}
[data-wk="wxcardsky"] *{color:${C.brown} !important}
[data-wk="wxcardsky"] svg{stroke:${C.brown} !important}
[data-wk="wxcardsay"]{background:${C.cream} !important;color:${C.brown} !important;border-top:${LINE} !important}
[data-wk="geopin"]{background:${svg(STAR)} center/contain no-repeat !important;box-shadow:none !important;border:none !important;width:22px !important;height:22px !important;border-radius:0 !important}
[data-wk="geopin"] *{opacity:0 !important}
[data-wk="geopinstem"]{background:${C.brown} !important}
[data-wk="namecard"] img{border-radius:10px !important;box-shadow:0 0 0 1.6px ${C.brown} !important}
/* 拍一拍、通话结束、系统提示：米白小胶囊焦茶边 */
[data-wk="note"][data-part="pat"],[data-wk="note"][data-part="call"]{display:inline-block !important;background:${C.cream} !important;border:${LINE} !important;border-radius:999px !important;color:${C.brown} !important;padding:2px 12px !important}
[data-wk="note"][data-part="call"] svg{stroke:${C.brown} !important}
[data-wk="note"][data-part="callsum"]{color:${C.fog} !important}
[data-wk="sysnote"]{background:transparent !important;border:none !important;box-shadow:none !important}
[data-wk="sysnotelabel"]{display:none !important}
[data-wk="sysnotetext"]{display:inline-block !important;background:${C.cream} !important;border:${LINE} !important;border-radius:999px !important;color:${C.brown} !important;padding:2px 12px !important;font-style:normal !important}
[data-wk="offlogtitle"]{color:${C.brown} !important;font-weight:700 !important}
[data-wk="offlogopen"],[data-wk="offlogredo"],[data-wk="offlogundo"],[data-wk="offlogrestore"]{color:#6F8F82 !important}
[data-wk="offlogtranscript"]{border-top:${LINE} !important}
/* 加号面板 */
[data-wk="chatpanel"]{background:${C.cream} !important;border-top:${LINE} !important}
[data-wk="chattoolicon"]{background:${C.cream} !important;border:${LINE} !important;border-radius:14px !important;box-shadow:none !important}
[data-wk="chattool"]:nth-child(odd) [data-wk="chattoolicon"]{background:${C.cel} !important}
[data-wk="chattoolglyph"],[data-wk="chattoolglyph"] svg{stroke:${C.brown} !important;color:${C.brown} !important}
[data-wk="chattoollabel"]{color:${C.brown} !important}
/* 引用三处 */
[data-wk="quotedraft"]{background:${C.cream} !important;border-top:${LINE} !important}
[data-wk="quote"]{background:${C.cream} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:10px !important;opacity:1 !important;padding-left:24px !important;background-image:${svg(CTL)} !important;background-repeat:no-repeat !important;background-position:8px 6px !important;background-size:9px 9px !important}
[data-wk="quote"][data-me="1"]{background-color:#DCEDE6 !important}
[data-wk="quoteicon"],[data-wk="quoteclear"]{color:${C.brown} !important}
[data-wk="bubble"] [data-wk="quotetext"]{display:block !important;border-left:2px solid ${C.brown} !important;padding-left:8px !important;opacity:.7 !important}


/* 按键回到 app 原来的顺序：左边是发送（纸飞机），最右是回复（青瓷「回复」字块，角上一颗星） */
[data-wk="send"]{order:0 !important;width:32px !important;min-width:32px !important;height:32px !important;border:none !important;border-radius:0 !important;background:${svg(I_SENDP)} center/26px no-repeat !important;margin-right:0 !important}
[data-wk="send"]::before,[data-wk="send"]::after{content:none !important}
[data-wk="chatreply"]{position:relative !important;overflow:visible !important;width:64px !important;min-width:64px !important;height:36px !important;border:${LINE} !important;border-radius:10px !important;background:${C.cel} !important;margin-right:6px !important}
[data-wk="chatreply"]::before{content:"回复" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;font-size:14px !important;letter-spacing:.2em !important;color:${C.brown} !important}
[data-wk="chatreply"]::after{content:"" !important;position:absolute !important;right:-9px !important;bottom:-9px !important;width:18px !important;height:18px !important;background:${svg(STAR)} center/contain no-repeat !important}
/* 顶栏：不再是一条平横栏——点点底延伸上来，下沿是焦茶描边的圆角，名字装进米白小胶囊，右下角趴一只小猫 */
[data-wk="chathead"]{background:${svg(DOTS)} 0 0/22px 22px,${C.bg} !important;border-bottom:none !important;border-radius:0 0 22px 22px !important;box-shadow:0 1.6px 0 ${C.brown} !important;position:relative !important;overflow:visible !important;z-index:5 !important}
[data-wk="chathead"]::after{content:none !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]{display:inline-flex !important;background:${C.cream} !important;border:${LINE} !important;border-radius:999px !important;padding:0 12px !important}


/* 顶栏两个人：他的头像和我的头像叠在一起，中间一颗小星；小猫趴在两颗头像顶上，尾巴垂到我这边 */
[data-wk="chathead"] [data-wk="headme"]{display:inline-flex !important;position:relative !important;overflow:visible !important;margin-left:-12px !important;z-index:1 !important}
[data-wk="chathead"] [data-wk="headme"] > *,[data-wk="chathead"] [data-wk="headme"] img{width:40px !important;height:40px !important;border-radius:10px !important;box-shadow:0 0 0 1.6px ${C.brown},0 0 0 3.5px ${C.bg} !important;transform:rotate(6deg) !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]) > [data-wk="avatar"],[data-wk="chathead"] button:has(> [data-wk="avatar"]) img{width:40px !important;height:40px !important;transform:rotate(-6deg) !important}
[data-wk="chathead"] [data-wk="headme"]::before{content:"" !important;position:absolute !important;left:-12px !important;bottom:-6px !important;width:18px !important;height:18px !important;background:${svg(STAR)} center/contain no-repeat !important;z-index:3 !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"]){position:relative !important;overflow:visible !important}
[data-wk="chathead"] button:has(> [data-wk="avatar"])::after{content:"" !important;position:absolute !important;left:24px !important;top:-10px !important;width:42px !important;height:17.5px !important;background:${svg(CAT)} center bottom/contain no-repeat !important;z-index:4 !important;pointer-events:none !important}


/* 名字露全：胶囊收窄、名字旁小箭头藏掉、右边图标缩小 */
[data-wk="chathead"]{gap:6px !important;padding-right:12px !important}
[data-wk="chathead"] [data-wk="headname"],[data-wk="chathead"] button:has(> [data-wk="headname"]){flex:1 1 auto !important;min-width:0 !important}
[data-wk="chathead"] [data-wk="headname"] > [data-wk="headink"]{padding:0 10px !important;font-size:16px !important;max-width:100% !important}
[data-wk="chathead"] [data-wk="headink"] > [data-wk="headdim"]{display:none !important}
[data-wk="sameroom"],[data-wk="chatmore"]{width:26px !important;min-width:26px !important;background-size:20px !important}
/* 纸飞机大一点，回复键小一点 */
[data-wk="send"]{width:38px !important;min-width:38px !important;height:38px !important;background-size:32px !important}
[data-wk="chatreply"]{width:52px !important;min-width:52px !important;height:30px !important;border-radius:9px !important}
[data-wk="chatreply"]::before{font-size:12.5px !important;letter-spacing:.12em !important}
[data-wk="chatreply"]::after{width:15px !important;height:15px !important;right:-7px !important;bottom:-7px !important}

/* ───── 青瓷焦茶 · 第三批：状态卡（形状不动；小巧思：每块像一张便签，角上「」角标，好感条是一排星星） ───── */
[data-wk="statecard"]{background:${svg(DOTS)} 0 0/22px 22px,${C.bg} !important;border:${LINE} !important;border-radius:22px !important;box-shadow:0 14px 34px rgba(74,58,48,.22) !important;overflow:visible !important;position:relative !important;--sc-heart-ink:${C.cel} !important}
[data-wk="statecard"]::before{content:"" !important;position:absolute !important;right:30px !important;top:-21px !important;width:52px !important;height:21.7px !important;background:${svg(CAT)} center bottom/contain no-repeat !important;z-index:3 !important}
[data-wk="statehead"]{background:transparent !important;border-bottom:${LINE} !important}
[data-wk="statehead"] *{color:${C.brown} !important}
[data-wk="statehead"] [data-wk="avatar"],[data-wk="statehead"] [data-wk="avatar"] *{border-radius:10px !important}
[data-wk="statehead"] button{border:${LINE} !important;background:${C.cream} !important}
[data-wk="statemood"]{display:inline-block !important;background:${C.cel} !important;border:${LINE} !important;color:${C.brown} !important;border-radius:999px !important;padding:0 10px !important;margin-right:4px !important}
[data-wk="statecard"] div:has(> button[aria-pressed]){background:${C.cream} !important;border:${LINE} !important;border-radius:999px !important;padding:3px !important;margin:10px 16px !important}
[data-wk="statecard"] button[aria-pressed]{color:${C.fog} !important;border:none !important;border-radius:999px !important}
[data-wk="statecard"] button[aria-pressed="true"]{background:${C.cel} !important;color:${C.brown} !important;box-shadow:inset 0 0 0 1.6px ${C.brown} !important}
[data-wk="stateseen"],[data-wk="statevoice"]{background:${svg(CTL)} 10px 10px/11px 11px no-repeat,${svg(CBR)} right 10px bottom 10px/11px 11px no-repeat,${C.cream} !important;border:${LINE} !important;border-radius:14px !important;margin:12px 16px !important;color:${C.brown} !important;box-shadow:none !important}
[data-wk="statevoice"]{background:${svg(CTL)} 10px 10px/11px 11px no-repeat,${svg(CBR)} right 10px bottom 10px/11px 11px no-repeat,#DCEDE6 !important}
[data-wk="stateseen"] *,[data-wk="statevoice"] *{color:${C.brown} !important}
[data-wk="stateseen"] > span[aria-hidden],[data-wk="statevoice"] > span[aria-hidden]{display:none !important}
[data-wk="statewear"]{background:#fff !important;border:${LINE} !important;border-radius:999px !important}
[data-wk="statewear"] > span{background:${C.bg} !important;border-radius:999px !important}
[data-wk="statevoicedel"],[data-wk="statevoiceclear"]{color:${C.fog} !important}
[data-wk="statevoice"] + div > button{background:${C.cream} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:999px !important}
/* 好感：一排五颗描边星，按好感填成青瓷色 */
[data-wk="stateaff"]{background:transparent !important;border-top:${LINE} !important;position:relative !important;display:block !important;padding:16px 20px 64px !important;overflow:hidden !important}
[data-wk="stateaff"] *{color:${C.brown} !important}
[data-wk="stateheart"]{position:absolute !important;width:36px !important;left:calc(50% - 18px) !important;height:180px !important;bottom:calc(32px - 90px) !important;transform:rotate(90deg) !important;--sc-heart-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 180'>${[0,1,2,3,4].map(i=>`<path transform='translate(0 ${i*36}) rotate(-90 18 18)' d='M18 2 L22.3 12 L33 12.9 L24.9 20 L27.4 30.6 L18 25 L8.6 30.6 L11.1 20 L3 12.9 L13.7 12Z'/>`).join("")}</svg>`)} !important}
[data-wk="stateheart"] > div{-webkit-mask-size:100% 100% !important;mask-size:100% 100% !important}
[data-wk="stateheartline"]{background:${C.brown} !important;opacity:1 !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:2px !important}
[data-wk="stateheartbase"]{background:${C.cream} !important;opacity:1 !important}
[data-wk="stateheartfill"] > div{background:${C.cel} !important;opacity:1 !important;border-top:none !important}
[data-wk="stateheartnum"],[data-wk="stateheartknob"]{display:none !important}
[data-wk="stateaffval"]{display:block !important;position:absolute !important;right:20px !important;top:12px !important;font-size:28px !important;font-weight:700 !important;color:${C.brown} !important}

/* 翻旧的：一张张米白便签，第一张顶上趴小猫 */
[data-wk="statehistbtn"]{background:${C.cream} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:999px !important}
[data-wk="statehistbtn"][data-part="back"]{display:inline-block !important;width:auto !important;padding:4px 16px !important}
[data-wk="statehisthead"] > :first-child{color:${C.brown} !important}
[data-wk="statehisthead"] [data-wk="statevoiceclear"]{border:${LINE} !important;border-radius:999px !important;color:${C.brown} !important;background:${C.cream} !important}
[data-wk="statehistitem"]{position:relative !important;background:${svg(CTL)} 10px 10px/11px 11px no-repeat,${svg(CBR)} right 10px bottom 10px/11px 11px no-repeat,${C.cream} !important;border:${LINE} !important;border-radius:14px !important;padding:16px 20px !important;margin:0 0 12px !important;box-shadow:none !important;overflow:visible !important}
[data-wk="statehistitem"]:first-child{margin-top:22px !important}
[data-wk="statehistitem"]:first-child::before{content:"" !important;position:absolute !important;right:16px !important;top:-21px !important;width:52px !important;height:21.7px !important;background:${svg(CAT)} center bottom/contain no-repeat !important}
[data-wk="statehistmood"]{background:${C.cel} !important;border:${LINE} !important;color:${C.brown} !important;border-radius:999px !important}
[data-wk="statehisttime"]{color:${C.fog} !important}
[data-wk="statehisttext"]{color:${C.brown} !important}
[data-wk="statehistmeta"]{background:${C.bg} !important;border-radius:10px !important}
[data-wk="statehistact"],[data-wk="statehistwear"]{color:${C.brown} !important}
[data-wk="statehistend"]{color:${C.fog} !important}

/* Ta 眼里：贴条换成一颗星 */
[data-wk="gazepage"]{background:${svg(DOTS)} 0 0/22px 22px,${C.bg} !important}
[data-wk="gazetitle"]{color:${C.brown} !important}
[data-wk="gazetab"]{background:${C.cream} !important;color:${C.fog} !important;border:${LINE} !important;border-radius:999px !important;clip-path:none !important}
[data-wk="gazetab"][data-on="1"]{background:${C.cel} !important;color:${C.brown} !important}
[data-wk="gazetab"] *{clip-path:none !important}
[data-wk="gazestatus"]{color:${C.fog} !important}
[data-wk="gazecard"]{background:${C.cream} !important;border:${LINE} !important;border-radius:14px !important;box-shadow:none !important}
[data-wk="gazetape"]{background:${svg(STAR)} center/20px 20px no-repeat !important;box-shadow:none !important;border:none !important;transform:none !important}
[data-wk="gazecardname"]{color:${C.brown} !important}
[data-wk="gazecardtext"],[data-wk="gazecardtime"]{color:${C.fog} !important}
[data-wk="gazeletter"],[data-wk="gazehistory"]{background:${C.cream} !important;border:${LINE} !important;border-radius:20px !important}
[data-wk="gazeempty"]{background:${C.cream} !important;border:${LINE} !important;border-radius:14px !important}
[data-wk="gazeempty"] button{background:${C.cel} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:999px !important}

/* ───── 线下 ───── */
[data-wk="offline"]:not([style*="url("]){background:${svg(DOTS)} 0 0/22px 22px,${C.bg} !important}
[data-wk="offline"] [data-wk="offbody"]{background:transparent !important}
[data-wk="offline"] [data-wk="chathead"] *{white-space:nowrap !important}
[data-wk="offline"] [data-wk="chathead"] [data-wk="headme"]{display:none !important}
[data-wk="offline"] [data-wk="offtitle"],[data-wk="offline"] [data-wk="offtitle"] *{color:${C.brown} !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]{width:28px !important;height:28px !important;background:${svg(I_PLUS)} center/24px no-repeat !important;border:none !important}
[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"] *{opacity:0 !important}
[data-wk="offline"] [data-wk="chathead"] button:last-child:not([data-wk]){background:${C.cel} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:10px !important;font-size:12px !important;padding:3px 12px !important}
[data-wk="offcomposer"]{background:${C.cream} !important;border-top:${LINE} !important}
[data-wk="offcomposer"] textarea{background:#fff !important;border:${LINE} !important;border-radius:12px !important;color:${C.brown} !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]{width:30px !important;height:30px !important;min-width:30px !important;border:none !important;box-shadow:none !important;font-size:0 !important;background:${svg(I_PLUS)} center/26px no-repeat !important}
[data-wk="offcomposer"] button[title="给 Ta 看真实照片"] *{opacity:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]){background:${svg(I_SENDP)} center/32px no-repeat !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
[data-wk="offcomposer"] button:not([title]):not([data-wk]) svg{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]{position:relative !important;overflow:visible !important;width:52px !important;min-width:52px !important;height:30px !important;border:${LINE} !important;border-radius:9px !important;background:${C.cel} !important;font-size:0 !important;color:transparent !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"] *{opacity:0 !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]::before{content:"演绎" !important;position:absolute !important;inset:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;font-size:12.5px !important;letter-spacing:.12em !important;color:${C.brown} !important}
[data-wk="offcomposer"] button[title="让 Ta 演绎"]::after{content:"" !important;position:absolute !important;right:-7px !important;bottom:-7px !important;width:15px !important;height:15px !important;background:${svg(STAR)} center/contain no-repeat !important}
[data-wk="offcard"]{position:relative !important;background:${svg(CTL)} 10px 10px/11px 11px no-repeat,${svg(CBR)} right 10px bottom 10px/11px 11px no-repeat,${C.cream} !important;border:${LINE} !important;border-left-width:1.6px !important;border-radius:16px !important;box-shadow:none !important;overflow:visible !important;margin-top:24px !important}
[data-wk="offcard"][data-me="1"]{background:${C.cel} !important}
[data-wk="offcard"][data-me="0"]::before{content:"" !important;position:absolute !important;right:22px !important;top:-21px !important;width:52px !important;height:21.7px !important;background:${svg(CAT)} center bottom/contain no-repeat !important}
[data-wk="offcard"][data-me="1"]::after{content:"" !important;position:absolute !important;right:-10px !important;bottom:-10px !important;width:22px !important;height:22px !important;background:${svg(STAR)} center/contain no-repeat !important}
[data-wk="offhead"] img,[data-wk="offhead"] [data-wk="avatar"]{border-radius:10px !important;box-shadow:0 0 0 1.6px ${C.brown} !important}
[data-wk="offname"],[data-wk="offtext"]{color:${C.brown} !important}
[data-wk="offname"]{font-weight:700 !important}
[data-wk="offsay"]{background:linear-gradient(transparent 60%,rgba(169,211,195,.7) 60%) !important;color:${C.brown} !important;font-weight:700 !important;box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important}
[data-wk="offthought"]{background:${C.bg} !important;border:1.2px dashed transparent !important;border-left:none !important;border-radius:12px !important;color:${C.brown} !important;box-shadow:inset 0 0 0 1.2px rgba(74,58,48,.35) !important}
[data-wk="offcardacts"] svg{stroke:${C.brown} !important;color:${C.brown} !important}
[data-wk="offreplyopt"]{background:${C.cream} !important;border:${LINE} !important;border-radius:999px !important;color:${C.brown} !important}

/* ───── 通话 ───── */
[data-wk="callbubble"]{background:${C.cream} !important;color:${C.brown} !important;border:${LINE} !important;border-radius:14px !important}
[data-wk="callmsg"][data-me="1"] [data-wk="callbubble"]{background:${C.cel} !important}
[data-wk="callbubble"]::before,[data-wk="callbubble"]::after{content:none !important}
[data-wk="callavatar"]{border-radius:22px !important;box-shadow:0 0 0 2px ${C.brown},0 0 0 7px ${C.cream},0 0 0 8.6px ${C.brown} !important}

[data-wk="stateheartline"]{background:transparent !important}
[data-wk="stateheart"] > div:not([data-wk="stateheartline"]){inset:0 !important}
[data-wk="stateheart"]{filter:drop-shadow(1.2px 0 0 ${C.brown}) drop-shadow(-1.2px 0 0 ${C.brown}) drop-shadow(0 1.2px 0 ${C.brown}) drop-shadow(0 -1.2px 0 ${C.brown}) !important}

/* 每条都带头像；小猫只在一串第一条，后面几条不留猫的空 */
[data-wk="msg"][data-first="0"] [data-wk="name"]{display:none !important}
[data-wk="msg"]{padding-top:2px !important;padding-bottom:2px !important}

`;

const pack = { kind: "chat-look", v: 1, name: "青瓷焦茶", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "青瓷焦茶-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
