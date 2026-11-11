// 青瓷×焦茶：照参考图第三个配色。点点米底、焦茶描边、我的青瓷气泡角上一颗星、他的米白气泡带「」角标和一只探头小猫。
// 用法：node themes/celadon/build.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = s => "url(\"data:image/svg+xml;base64," + Buffer.from(s.replace(/>\s+</g, "><")).toString("base64") + "\")";
const C = { bg: "#F3EBDA", dot: "#D9CDB4", brown: "#4A3A30", cel: "#A9D3C3", celD: "#8FC0AE", cream: "#FBF6EA", fog: "#A79E92" };

const STAR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 2.5 L14.6 8.6 L21.2 9.2 L16.2 13.6 L17.7 20.1 L12 16.7 L6.3 20.1 L7.8 13.6 L2.8 9.2 L9.4 8.6Z' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const CAT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 30' fill='none' stroke='${C.brown}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M56 26 C62 27 67 23 66 16 C65.6 13.5 67.5 12 69 13'/><path d='M5 30 C5 22 8 16 13 13 L12.5 4.5 L21 9.5 C26 8 38 8 43 9.5 L50 3.5 L51.5 13 C56 16 59 22 59 30' fill='${C.cream}'/><ellipse cx='20' cy='23.5' rx='3.4' ry='1.7' fill='#F2B8B0' stroke='none'/><ellipse cx='44' cy='23.5' rx='3.4' ry='1.7' fill='#F2B8B0' stroke='none'/><path d='M25.5 19.6 L26.5 19.6 M37.5 19.6 L38.5 19.6' stroke-width='2.4'/><path d='M29 23 C29.6 24.6 31.4 24.6 32 23 C32.6 24.6 34.4 24.6 35 23' stroke-width='1.3'/></svg>`;
const CORNER = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40' preserveAspectRatio='none'><path d='M4 14 V5 H12' fill='none' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke'/><path d='M96 26 V35 H88' fill='none' stroke='${C.brown}' stroke-width='1.6' vector-effect='non-scaling-stroke'/></svg>`;
const CTL = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M1 11 V1 H11' fill='none' stroke='${C.brown}' stroke-width='1.6'/></svg>`;
const CBR = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M11 1 V11 H1' fill='none' stroke='${C.brown}' stroke-width='1.6'/></svg>`;
const DOTS = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><circle cx='3' cy='3' r='1.3' fill='${C.dot}'/><circle cx='14' cy='14' r='1.3' fill='${C.dot}'/></svg>`;
const I_PLUS = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6'/><path d='M12 7 V17 M7 12 H17' stroke='${C.brown}' stroke-width='1.6' stroke-linecap='round'/></svg>`;
const I_REPLY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 24'><path d='M5 3 H23 Q26 3 26 6 V15 Q26 18 23 18 H12 L6 22 L7 18 H5 Q2 18 2 15 V6 Q2 3 5 3Z' fill='${C.cream}' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='9' cy='10.5' r='1.3' fill='${C.brown}'/><circle cx='14' cy='10.5' r='1.3' fill='${C.brown}'/><circle cx='19' cy='10.5' r='1.3' fill='${C.brown}'/></svg>`;
const I_HOUSE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 11 L12 4 L20 11 V20 H4Z' fill='none' stroke='${C.brown}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
const I_MORE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='5' cy='12' r='1.6' fill='${C.brown}'/><circle cx='12' cy='12' r='1.6' fill='${C.brown}'/><circle cx='19' cy='12' r='1.6' fill='${C.brown}'/></svg>`;

const bubble = { myBg: C.cel, myText: C.brown, myBorder: "1.6px solid " + C.brown, charBg: C.cream, charText: C.brown, charBorder: "1.6px solid " + C.brown, radius: 12, shadow: "none", myAlpha: 100, charAlpha: 100 };
const layout = { bubble: "bubble", avatar: "first", name: true, gap: "normal", time: "show" };
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
/* 红包：留红，只加焦茶描边、圆角 */
[data-wk="rpcard"]{border:${LINE} !important;border-radius:14px !important;box-shadow:none !important}
[data-wk="rpenvelope"]{border:${LINE} !important;border-radius:24px !important}
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

`;

const pack = { kind: "chat-look", v: 1, name: "青瓷焦茶", look: { bubble, layout, customCSS: css.trim() }, assets: {} };
writeFileSync(join(here, "青瓷焦茶-美化.json"), JSON.stringify(pack));
console.log("ok", css.length);
