// 列车收拾（她 2026-09-25：「列车现在整体页面乱乱的」「拼图直接全屏，角色头像和气泡在右上角点开可以开个聊天框」
//   「普通聊天现在点开也没有地方折叠」）
const fs = require("fs"), assert = require("assert");
const root = __dirname + "/../apps/train/";
const html = fs.readFileSync(root + "index.html", "utf8");
const view = fs.readFileSync(root + "puzzle-view.mjs", "utf8");
const css = fs.readFileSync(root + "style.css", "utf8");
const host = fs.readFileSync(__dirname + "/../js/fairy-garden.js", "utf8");

// 1. 「聊聊」是一件事，不是一个视角：在底栏，不在视角那排
const vc = html.slice(html.indexOf('<div id="view-controls"'), html.indexOf("</div>", html.indexOf('<div id="view-controls"')));
assert.ok(vc.length > 0, "抠不出视角那排");
assert.ok(!/open-chat/.test(vc), "聊聊又回到视角那排了");
const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
assert.match(nav, /id="open-chat"/);
// 视角那排画成一条路线（施工规则/tabs-not-plain-pills.md），选中那站不只是换个底色
assert.match(css, /#view-controls::before\{/);
assert.match(css, /#view-controls button\[aria-pressed=true\]::before\{[^}]*width:16px/);

// 2. 拼图全屏：车厢小窗在拼图时收起，照片／片数／玩法折成一条
// 车厢只在旅途聊天时搬进桌面；拼图时留在原地（搬进来藏起来，回车厢会卡住整页几十秒）
assert.match(view, /\$\('#travel-window'\)\.hidden=activity!=='travel';if\(stage\)\{if\(activity==='travel'\)/);
assert.match(view, /<details id="desk-setup">/);
assert.match(view, /\$\('#desk-setup'\)\.open=false/, "开好一桌后没把设置收起来");
// 原图在桌上随手就能开，不藏进设置里
assert.match(view, /<div class="zoom-controls"><button id="desk-reference"/);

// 3. 一个聊天坞，两边共用：拼图默认收、聊天默认开，都能收能开
assert.match(view, /<button id="desk-peer"/);
assert.match(view, /<div id="desk-dock">[\s\S]*id="desk-chat"[\s\S]*id="desk-form"/);
assert.match(view, /setDock\(activity==='travel'\)/);
assert.match(view, /\$\('#dock-close'\)\.onclick=\(\)=>setDock\(false\)/);
assert.match(view, /\$\('#desk-peer'\)\.onclick=\(\)=>setDock\(true\)/);
assert.match(css, /#puzzle-desk\[data-dock=open\] #desk-dock\{display:flex\}/);
// 坞收着的时候 TA 说话要看得见：最后一句挂在头像边上，没看就亮个点
assert.match(view, /\$\('#desk-peer-say'\)\.textContent=text/);
assert.match(view, /classList\.add\('unread'\)/);
// 错误提示不许跟着坞一起藏（「确认重开」那一句）
const dock = view.slice(view.indexOf('<div id="desk-dock">'), view.indexOf("`;", view.indexOf('<div id="desk-dock">')));
assert.ok(!/desk-error/.test(dock), "错误提示又进了坞里，收着就看不见");
// 头像：宿主把角色头像递进来（iv_ 键先换成能用的地址）
assert.match(host, /avatar:c\.avatarImage\?\(typeof resolveImg==="function"\?resolveImg\(c\.avatarImage\):c\.avatarImage\):""/);
// 矮屏不顶出去
assert.match(css, /@media\(max-height:500px\)\{#desk-dock\{max-height:82%\}\}/);
// 拼图桌盖住车厢时不画车厢（留在原地、被挡着，画了也看不见，只烧电）
const game = fs.readFileSync(root + "game.mjs", "utf8");
assert.match(game, /&&!\(desk\?\.isOpen&&desk\.activity!=='travel'\)\)view\.render\(\)/);
console.log("ok train-tidy");
