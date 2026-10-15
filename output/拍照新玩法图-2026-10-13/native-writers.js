window.__nativePhotos = function(env){
const {profile,characters,statesRef,stateHistRef,carryRef,myClosetRef,studioRef,setStudio,setGen,saveJSON,toast,apiFor,ctxFor,photoDiaryBusy,setPhotoDiaryBusy,setDiaries,scheduleTextFor,schedDayKey,pChat,setActiveChar,setScreen,emotePacksRef,commitEmotePacks}=env;
const STUDIO_CAP = 100000;
const STUDIO_THEMES = {
    school:   { zh: "校服", line: "【题材·校服】你们俩穿着同一所学校的校服，在教室、走廊或操场，像高中时的一张合照。" },
    ancient:  { zh: "古装", line: "【题材·古装】你们俩换上古装（衣冠发式照同一个朝代），在庭院、街市或灯下，像古装剧里的一张定妆照。" },
    wedding:  { zh: "婚纱照", line: "【题材·婚纱照】他穿西装礼服，你穿婚纱，像婚纱摄影棚或外景里拍的一张婚纱照。" },
    marriage: { zh: "结婚登记照", line: "【题材·结婚登记照】标准的结婚登记照：纯红色背景，两人并肩正面坐着、肩挨着肩，穿白衬衫，表情自然微笑，构图端正，像民政局拍的那张。" },
    grad:     { zh: "毕业照", line: "【题材·毕业照】你们俩穿学士服、戴学士帽，在校园里，像毕业那天的合照。" },
    band:     { zh: "乐队", line: "【题材·乐队】你们俩是同一支乐队的成员，在舞台灯光下或排练室里，拿着乐器，像乐队宣传照。" },
    magazine: { zh: "杂志封面", line: "【题材·杂志封面】时尚杂志封面的人像大片构图，打光讲究；是摄影棚里摄影师拍的时尚大片，两人摆杂志感的姿势、看镜头或看彼此，不是手机自拍；画面里不要出现任何文字、字母、logo。", overlay: "magazine" },
    movie:    { zh: "电影海报", line: "【题材·电影海报】电影海报构图：两人是主演，戏剧化的光影和场景；画面里不要出现任何文字、字母、logo。", overlay: "movie" }
  };
const customThemes = () => { const a = loadJSON("x_studioThemes", []); return Array.isArray(a) ? a.filter(x => x && x.k && x.zh) : []; };
const studioThemeOf = k => STUDIO_THEMES[k] || (() => { const c = customThemes().find(x => x.k === k); return c ? { zh: c.zh, line: "【题材·" + c.zh + "】" + (c.line || "你们俩在「" + c.zh + "」这个设定里") + "。" } : null; })();
const comicCompose = async (blob, panels, names) => {
    try { return window.PosterLayout ? await window.PosterLayout.comic(blob, panels, names || []) : blob; }
    catch (e) { return blob; }
  };
const polaroidCompose = async (blob, caption) => {
    try {
      const u = URL.createObjectURL(blob);
      const im = await new Promise((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = u; });
      URL.revokeObjectURL(u);
      const W = 1000, side = 60, top = 60, ph = 920, bottom = 240, H = top + ph + bottom;
      const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
      x.fillStyle = "#fbfaf6"; x.fillRect(0, 0, W, H);
      const pw = W - side * 2, sr = Math.min(im.naturalWidth / pw, im.naturalHeight / ph), sw = pw * sr, sh = ph * sr;
      const flaw = Math.random() < 0.25 ? ["leak", "blur", "expired"][Math.floor(Math.random() * 3)] : "";
      x.save(); x.beginPath(); x.rect(side, top, pw, ph); x.clip();
      if (flaw === "blur") x.filter = "blur(3px)";
      if (flaw === "expired") x.filter = "sepia(.45) saturate(.7) hue-rotate(-12deg) contrast(.92)";
      x.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, side, top, pw, ph);
      x.filter = "none";
      if (flaw === "leak") { const g = x.createRadialGradient(side + pw * 0.92, top + ph * 0.1, 10, side + pw * 0.92, top + ph * 0.1, pw * 0.7); g.addColorStop(0, "rgba(255,140,60,.75)"); g.addColorStop(0.5, "rgba(255,90,60,.25)"); g.addColorStop(1, "rgba(255,90,60,0)"); x.fillStyle = g; x.fillRect(side, top, pw, ph); }
      // 拍立得本身那层淡淡的颗粒和暗角
      const vg = x.createRadialGradient(W / 2, top + ph / 2, ph * 0.35, W / 2, top + ph / 2, ph * 0.8); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.18)"); x.fillStyle = vg; x.fillRect(side, top, pw, ph);
      x.restore();
      const cap = String(caption || "").trim().slice(0, 24);
      if (cap) {
        let z = 52; const F = "'Ma Shan Zheng','Long Cang','ZCOOL KuaiLe','Kaiti SC','STKaiti',cursive";
        x.font = z + "px " + F; while (z > 26 && x.measureText(cap).width > pw) { z -= 2; x.font = z + "px " + F; }
        x.fillStyle = "#2d2a26"; x.textAlign = "center"; x.textBaseline = "middle"; x.save(); x.translate(W / 2, top + ph + bottom / 2); x.rotate(-0.02); x.fillText(cap, 0, 0); x.restore();
      }
      return { blob: await new Promise(ok => c.toBlob(b => ok(b || blob), "image/jpeg", 0.92)), flaw };
    } catch (e) { return { blob, flaw: "" }; }
  };
const studioOverlay = async (blob, plan, copy, names) => {
    try { return window.PosterLayout ? await window.PosterLayout.compose(blob, plan, copy, names) : blob; }
    catch (e) { return blob; }
  };
const coverCopy = async (char, kind, title) => {
    // 字＋方向一起要（她 2026-10-13）：类型、气质、字的性格、片名怎么断——只给方向，不给坐标；
    //   位置由本地 PosterLayout 照这几样定，再写进生图那句留白里。
    // 怎么拍也由他照这部片定（她 2026-10-13：原来提示词里列着几个姿势当例子，模型老抄第一个——海报全是背靠背）
    const shotAsk = "shot＝这一张怎么拍：两个人的站位、动作、谁看谁，镜头从哪个高度、多远拍（一句话，照这部片的戏和你们的关系来想，每次都可以不一样）；";
    const persona = "persona＝封面上字的性格，从 elegant（优雅）/heavy（厚重）/sharp（锐利）/retro（复古）/playful（俏皮）/cold（冷峻）/hand（手写）里挑一个最贴的；density＝信息量，min/std/rich 挑一个；";
    try {
      const d = await runProbe(apiFor(char.id), ctxFor(char), {
        instruction: kind === "magazine"
          ? "你们俩要上一本杂志的封面。照你们真实发生过的事（最近的聊天、记得的事），写这期封面上的字：mtype＝这是本什么杂志，从 时尚/八卦/文艺/潮流/生活 里挑一个（八卦字最多、文艺最少）；mast＝杂志刊名（2~4 字）；" + (title ? "" : "title＝主专题大标题（10 字以内）；") + "story＝主专题的引子 {kicker:4~8 字的栏目名，比如「本期封面」「独家专访」}；coverLines＝0~3 组封面栏目，每组 {kicker:4~6 字小引题, line:14 字以内的一句}——【每一组都必须是你们之间真发生过的一件具体的事】，要有人名、动作或原话，比如 {kicker:\"本刊独家\",line:\"某某拒绝洗碗事件始末\"}、{kicker:\"当事人回应\",line:\"『我只是想再坐五分钟。』\"}；不许写「独家揭秘」「甜蜜瞬间」「爱的告白」这种放进谁家都行的空话，想不出真事就少写几组、宁可空着；no＝期号（数字，可以挑一个对你们有意义的数）；en＝一小行英文（可以留空）；genre＝杂志风格一个词；mood＝这期封面的气质（两三个词）；" + shotAsk + persona
          : "你们俩要上一部电影的海报。照你们真实发生过的事，定这部电影是什么样的，再写海报上的字：" + (title ? "片名用「" + title + "」；" : "title＝片名（2~8 字）；") + "titleLines＝片名分成几行排（数组，拼起来要等于片名，按意思断，不拆开一个词；短片名就一行）；genre＝类型（照你们的事来定，不一定是爱情片，一两个词）；mood＝这部片的气质（两三个词）；tagline＝一句宣传语（16 字以内，要像电影海报，跟你们的事有关）；date＝上映日期（写成「X 月 X 日」，可以挑一个对你们有意义的日子）；en＝英文片名（可以留空）；" + shotAsk + persona,
        schemaHint: kind === "magazine" ? "{\"mtype\":\"\",\"mast\":\"\",\"title\":\"\",\"story\":{\"kicker\":\"\"},\"coverLines\":[{\"kicker\":\"\",\"line\":\"\"}],\"no\":\"\",\"en\":\"\",\"genre\":\"\",\"mood\":\"\",\"shot\":\"\",\"persona\":\"\",\"density\":\"\"}" : "{\"title\":\"\",\"titleLines\":[\"\"],\"genre\":\"\",\"mood\":\"\",\"tagline\":\"\",\"date\":\"\",\"en\":\"\",\"shot\":\"\",\"persona\":\"\",\"density\":\"\"}",
        maxTokens: 8000
      });
      if (d && title) d.title = title;
      return d || (title ? { title } : null);
    } catch (e) { return title ? { title } : null; }
  };
const studioShoot = async (char, opt) => {
    const theme = opt && opt.theme ? studioThemeOf(opt.theme) : null;
    const scene = String((opt && opt.scene) || "").trim() || (theme ? theme.zh : "") || (opt && opt.restyle ? "换个画风" : "") || (opt && opt.polaroid ? "随手用拍立得拍的一张合照，就在此刻你们在的地方" : "") || (opt && opt.grid ? "在大头贴机里拍的一组四宫格" : "");
    if (!char || !scene) { toast("先写一句这张要拍什么"); return false; }
    if (!(typeof imgApiReady === "function" && imgApiReady())) { toast("先去 设置·图像API 配一下"); return false; }
    if (!(char.refPhoto && profile && profile.refPhoto)) { toast("合照要你俩都设了参考照才锁得住脸——去人格档案馆和「我」那边各传一张"); return false; }
    setGen(g => ({ ...g, studio: true }));
    try {
      const st = statesRef.current[char.id] || {};
      // 照相馆是她自己挑的衣服（下面 dressLine 已经写进场景里），所以【不塞衣柜】——
      // 塞了会跟她刚挑的那身打架。固定服装锁照给。
      const me = { ...photoMe("我"), closet: "" };
      // 两身衣服显式写进画面描述里：写进去才画得出来，光挂在衣柜里图像端读不到
      // ⚠️社区反馈（她 2026-09-14 转来）：「情侣空间拍合照的时候好像提示词有上限，
      //   塞不下那么多衣柜的描述（自动生成的比较长）」。查下来是两件事一起犯：
      //   ① 她在这儿【挑好了两身】，可挑中的只有【名字】进得去（"月下同游·青竹衫"），
      //      真正写了款式颜色料子的那一段（note）一个字都没跟过来；
      //   ② 与此同时，整柜的清单还是照发不误——合照要装两个人的信息，本来就挤，
      //      于是那份清单被 600 字的闸切了，挑中那一身的描述常常正好在被切掉的那半。
      //   改法：挑中哪一身，就把那一身的【原话】带上；挑了的那一边就不再发整柜清单。
      const setNote = (groups, name) => {
        const want = String(name || "").trim();
        let hit = "";
        // 递进来的是衣柜那个盒子（{ closet:[…] }），不是数组——原来一律当成空，照相馆那一行只剩名字没有款式
        (Array.isArray(groups) ? groups : (groups && Array.isArray(groups.closet) ? groups.closet : [])).forEach(g => (g && Array.isArray(g.sets) ? g.sets : []).forEach(x => {
          if (!hit && x && String(x.name || "").trim() === want) hit = String(x.note || "").trim();
        }));
        return hit;
      };
      // ⚠️多选不是「挑了好几套」，是【把一整套拼出来】（她 2026-09-14 纠正我：
      //   「模型有时候外套、内衫、裤子、鞋子、帽子都单独写，所以想多选能配出一整套」）。
      //   所以这几件是【同一身】：用「＋」串成一句，不是用「；」并列成几套。
      // ⚠️每件那一段 note 写的是「是什么衣服 + 为什么挑它」——【为什么】那半截对出图
      //   一点用都没有，还正是把提示词撑爆的那半。所以每件只取前 48 个字（款式颜色料子
      //   都在前头）；她选中的每件都保留。
      const PIECE_NOTE = 48;
      const dressLine = (who, picked, groups) => {
        const names = String(picked || "").split("、").map(x => x.trim()).filter(Boolean);
        if (!names.length) return "";
        // ⚠️「你送的」不许进出图提示词（她 2026-09-18 让我确认礼物挂进衣柜能不能用在合照时查到的）：
        //   closetGiftToChar 挂礼物时写的 note 就是这三个字——它在衣柜界面上是有用的，
        //   可这一行是【画面描述】，出图那头读到「你送的」多半会给这件衣服配个礼盒或缎带。
        //   note 这一栏本来装的就是款式颜色料子，不是来路。
        const parts = names.map(n => {
          const raw = String(setNote(groups, n) || "").trim();
          const note = raw === "你送的" ? "" : Array.from(raw).slice(0, PIECE_NOTE).join("");
          return note ? n + "（" + note + "）" : n;
        });
        // 一身里的几件用＋串起来，图像那头才知道这是一套，不是让它在几套里挑
        return who + "穿（这是一整套，几件都要穿上）：" + parts.join("＋");
      };
      const hisGroups = ((carryRef.current || {})[char.id] || {}).outfit;
      const myGroups = myClosetRef.current;
      const fits = [dressLine(char.name, opt && opt.theirs, hisGroups && hisGroups.closet ? hisGroups.closet : hisGroups),
                    dressLine(me.name, opt && opt.mine, myGroups && myGroups.closet ? myGroups.closet : myGroups)].filter(Boolean).join("；");
      // 四宫格（她 2026-10-12）：一次出一整张大头贴，不是拍四次——四格在同一张图里画，脸和衣服天然一致
      const GRID_LINE = "【版式·四宫格大头贴】整张图是一张 2×2 四格大头贴，四格大小一样、格子之间留一道粗白边；四格都是你们俩、同一个地方、同一身衣服，每格一个不同的表情或动作（比如对镜头笑、一起比手势、他偷看你、两个人做鬼脸），像在大头贴机里连拍的四张。";
      // 换画风（她 2026-10-12）：照第一张参考图（就是那张合照）的构图人物重画，长相照后两张参考照
      const RESTYLE_LINE = opt && opt.restyle ? "【换画风】照第一张参考图的构图、人物位置、动作和表情，整张重画成「" + opt.restyle.style + "」的画风；两个人的长相照后两张参考照，别换人。" : "";
      // 聊天画成漫画（她 2026-10-12）：四格一张图里画，字不让图像端写（它写中文会乱码），台词由 app 自己排在每格下面
      const COMIC_LINE = opt && opt.comic ? "【版式·四格漫画】整张图是一张 2×2 四格漫画，四格大小一样、格子之间留白边，" + (opt.comicStyle === "photo" ? "四格都是写实的真人照片质感（照片漫画），" : "漫画画风：清晰的黑色勾线、平涂或网点上色，是画出来的漫画，不是照片，" ) + "每一格里" + char.name + "都在画面左边、" + (me.name || "我") + "都在右边，人别顶满格子、上方留一点空给对话气泡；四格都是你们俩，按顺序依次是：" + opt.comic.map((c, i) => "第" + (i + 1) + "格（左上、右上、左下、右下依次）" + c.scene).join("；") + "。画面里不要任何文字、不要对话气泡、不要拟声字。" : "";
      // 挑了衣服就照挑的穿，题材也一样（她 2026-10-13：选了杂志封面，挑好的衣服没穿上）
      const picked = !!(String((opt && opt.mine) || "").trim() || String((opt && opt.theirs) || "").trim());
      const sceneFull = COMIC_LINE + (opt && opt.grid ? GRID_LINE : "") + (theme ? theme.line : "") + RESTYLE_LINE + scene + (fits && !(opt && opt.restyle) && (!theme || picked) ? "。" + (theme ? "衣服照下面挑好的穿，不用题材默认的那身：" : "") + fits : "");
      // 他那身已经挑定了，整柜清单就是多余的——那正是把提示词撑爆的那一段
      const hisPicked = !!String((opt && opt.theirs) || "").trim();
      // 换画风只发原图＋一句「原样转画风」（她 2026-10-13：重画成了另一张照片）：
      //   穿着、衣柜、场景一概不发——发了图像端就照文字重新拍一张，原图只剩个参考
      const STYLE_BODY = { "Q版": "这张是平面的 Q 版二次元插画（不是立体手办、不是 3D）：两个人都缩成二到三头身，头占身高一半左右，手脚短短圆圆；干净利落的黑色或深色勾线，赛璐璐平涂上色，大大的亮晶晶眼睛，脸颊淡淡的腮红，像贴纸或周边立绘那样可爱；背景照原图但画得简单柔和。", "手办": "整张变成一个精致的 PVC 手办／盲盒小人实拍：两个人是二到三头身的立体小公仔，大头短手短脚，表面是光滑的树脂质感，站在照原图那个场景缩小后的桌面上，像拍手办的照片。", "黏土": "整个画面像黏土定格动画，人物圆润有指纹质感。", "毛毡": "整个画面像羊毛毡手作，人物和背景都是毛茸茸的毡质。", "像素": "整张是像素画，人物和背景都由清晰的方块像素组成。", "油画": "像精心完成的古典油画肖像：笔触柔和、色彩干净通透、皮肤光滑有光泽，不要粗糙的刮刀肌理、不要满屏的颗粒和裂纹，脸上不要脏污感。", "水彩": "水彩要清透、留白多、颜色淡雅，不要发灰发脏。",
        // 只写三个字的画风，生图端只抓到一层皮（她 2026-10-13：浮世绘拍出来是旧纸上的动漫插画）
        "浮世绘": "这是日本江户时代的木版画（像葛饰北斋、歌川广重）：粗而匀的黑色轮廓线，像刻出来的；平涂色块、没有渐变和立体阴影，颜色只用靛蓝、朱红、赭黄、米白、墨绿这几种；人物是浮世绘的画法——细长眼、小嘴、脸平、衣服褶皱是流畅的线条，不是现代动漫脸；浪花画成一卷一卷的爪状图案，云画成一条条的平带，远山是层叠的色块；纸面是淡淡的木版纹理。不要现代插画的阴影、高光和写实细节。",
        "剪纸": "整张是中国红纸剪纸／多层剪纸：人物和背景都是剪出来的平面镂空纸片，边缘是剪刀的硬边，有细小的镂空花纹，层与层之间有一点投影；颜色以红为主，最多加一两种纸色，没有任何渐变和写实阴影。",
        "蒸汽波": "整张是蒸汽波（vaporwave）美学：粉紫、青蓝的霓虹渐变天空，大夕阳上有横条纹，地面是发光的网格线，点缀希腊雕像、棕榈树、老电脑窗口这类元素；画面有一点 VHS 的色偏和扫描线，人物照常可认，但被这种霓虹光染上颜色。",
        "水墨": "整张是中国水墨画：宣纸底，墨色分浓淡干湿，大块留白，笔触是毛笔的飞白和晕染，只点一点淡彩；人物用简练的笔线勾出来，不要写实阴影，不要厚涂。",
        "美式漫画": "美式超级英雄漫画的画法：粗黑描边、强烈的明暗块面（大块纯黑阴影）、网点和排线、饱和的原色，人物比例结实、动态夸张，像漫画书里的一格。",
        "复古港风": "九十年代香港电影海报／胶片质感：暖黄偏绿的胶片色调、颗粒感、霓虹招牌的红绿光晕、轻微柔焦和光晕，人物像王家卫电影里的定格画面。" };
      const RESTYLE_ONLY = opt && opt.restyle ? "把第一张参考图原样转成「" + opt.restyle.style + "」的画风。构图、镜头角度、人物位置、动作、表情、衣服、发型、背景都照第一张。但「画法」是整张一起换的，不是只换脸：人物的身体比例、轮廓线条、上色方式、背景的画法都要换成这种画风该有的样子（比如 Q 版就是二到三头身、大头小身子短胳膊短腿，黏土、毛毡就是整个人和背景都像捏出来的手工质感），别出现真人身体顶着一张画风脸。" + (STYLE_BODY[opt.restyle.style] || "") + "后两张参考照只用来锁住两个人的长相。画面里不要加任何文字。" : "";
      // 封面先定字：TA写字＋定方向 → 本地挑整张的文字构图 → 留白写进生图那句（图照字的位置画）
      let cover = null, coverPlan = null;
      if (theme && theme.overlay && !RESTYLE_ONLY && window.PosterLayout) {
        cover = await coverCopy(char, theme.overlay, String((opt && opt.scene) || "").trim());
        coverPlan = window.PosterLayout.plan(theme.overlay, cover || {});
      }
      // 拍之前就挑好画风（她 2026-10-13：「重画的画风要不要拍之前就可以选，这样省钱不用拍两张」）：一次直接出那种画法
      const PAINT = !RESTYLE_ONLY && opt && opt.paint ? String(opt.paint).slice(0, 40) : "";
      const PAINT_LINE = PAINT ? "【画风】这一张不是照片，整张直接画成「" + PAINT + "」的画风：人物比例、轮廓线条、上色方式、背景的画法都按这种画风来，别出现真人身体顶着一张画风脸；两个人的长相照参考照，认得出是谁。" + (STYLE_BODY[PAINT] || "") + "画面里不要加任何文字。" : "";
      const prompt = RESTYLE_ONLY || (PAINT_LINE ? PAINT_LINE + "\n" : "") + buildPhotoPrompt(char, sceneFull, st, { kind: "duo", me: me, closet: hisPicked ? "" : closetTextFor(char.id, 320), ...(theme && theme.overlay ? { editorial: theme.overlay, editorialSpace: coverPlan ? window.PosterLayout.spaceLine(coverPlan) : "" } : {}) });
      // 拍清楚某一格：那一格当第一张参考，照它的姿势表情重拍成单张
      const firstRef = (opt && opt.cellRef) || (opt && opt.restyle && opt.restyle.ref) || null;
      const refs = firstRef ? [firstRef, char.refPhoto, profile.refPhoto] : [char.refPhoto, profile.refPhoto];
      const out = await generateSelfieImage(prompt, refs, { minimalPrompt: RESTYLE_ONLY || (PAINT_LINE ? PAINT_LINE + "\n" : "") + buildMinimalPhotoPrompt(char, { kind: "duo" }), ...(opt && (opt.grid || opt.comic || (opt.restyle && opt.restyle.comic)) ? { size: "1024x1024" } : {}) });
      if (out && out.degraded && out.degraded !== "site-no-ref") toast("这张有点将就：" + out.degraded, 7000);
      let imgKey = null, imgUrl = null, pol = null, ovl = null;
      if (out && out.blob) {
        imgKey = "img_studio_" + char.id + "_" + Date.now();

        if (opt && opt.polaroid) {
          let cap = "";
          try { const d = await runProbe(apiFor(char.id), ctxFor(char), { instruction: "你们刚用拍立得拍了一张合照：" + scene + "。你拿笔在相纸底下白边上写一行字（14 字以内，就是你此刻想写在这张照片上的话，像你自己的口气）。", schemaHint: "{\"line\":\"\"}", maxTokens: 8000 }); cap = String((d && d.line) || "").trim(); } catch (e) {}
          pol = await polaroidCompose(out.blob, cap); pol.cap = cap;
        }
        // 杂志封面／电影海报：构图和字记下来、不带字的那张也留一份——换画风时拿没字的去重画，画完照同一个构图再印一次（她 2026-10-13）
        // 四格漫画同理（她 2026-10-13：「漫画也没带字重画」）：没排台词的那张 2×2 留一份，四格台词记在行上
        if (opt && opt.comic) await idbImgPut(imgKey + "_raw", out.blob);
        if (coverPlan) {
          ovl = { plan: coverPlan, copy: cover || {}, names: [char.remark || char.name, me.name || "我"] };
          await idbImgPut(imgKey + "_raw", out.blob);
        } else if (opt && opt.restyle && opt.restyle.overlay && opt.restyle.overlay.plan) ovl = opt.restyle.overlay;
        const reComic = opt && opt.restyle && Array.isArray(opt.restyle.comic) && opt.restyle.comic.length ? opt.restyle.comic : null;
        const finalBlob = pol ? pol.blob : opt && opt.comic ? await comicCompose(out.blob, opt.comic, [char.remark || char.name, me.name || "我"]) : reComic ? await comicCompose(out.blob, reComic, [char.remark || char.name, me.name || "我"]) : coverPlan ? await studioOverlay(out.blob, coverPlan, cover || {}, [char.remark || char.name, me.name || "我"]) : ovl ? await studioOverlay(out.blob, ovl.plan, ovl.copy, ovl.names) : out.blob;
        await idbImgPut(imgKey, finalBlob);
      } else if (out && out.url) imgUrl = out.url;
      else throw new Error("没拿到图");
      const row = { id: "sh_" + Date.now(), charId: char.id, imgKey, imgUrl, ts: Date.now(),
        // 从如果馆拍的那张，墙上要看得出是哪条「如果」里的（不然跟日常合照混在一起）
        scene: (opt && opt.ifTitle ? "《" + opt.ifTitle + "》里的我们 · " : "") + scene,
        mine: String((opt && opt.mine) || ""), theirs: String((opt && opt.theirs) || ""), desc: sceneFull, ...(opt && opt.grid ? { grid: "2x2" } : {}), ...(opt && opt.comic ? { comic: true, comicPanels: opt.comic, rawKey: imgKey + "_raw" } : {}), ...(pol ? { polaroid: true, developAt: Date.now() + 2 * 3600000, polCap: pol.cap || "", ...(pol.flaw ? { flaw: pol.flaw } : {}) } : {}),
        ...(theme ? { theme: opt.theme } : {}), ...(ovl ? { overlay: ovl, ...(coverPlan ? { rawKey: imgKey + "_raw" } : {}) } : {}), ...(PAINT ? { paint: PAINT } : {}), ...(opt && opt.restyle ? { style: opt.restyle.style, ...(opt.restyle.parent ? { parentId: opt.restyle.parent } : {}) } : {}) };
      const n = [row, ...studioRef.current].slice(0, STUDIO_CAP);
      studioRef.current = n; setStudio(n); saveJSON("x_studio", n);
      return row;
    } catch (e) {
      toast("这张没拍成：" + (e.message || "重试"), 9000);
      return false;
    } finally { setGen(g => ({ ...g, studio: false })); }
  };
const myClosetText = () => (typeof carryClosetText === "function") ? carryClosetText(myClosetRef.current) : "";
const photoMe = (fallbackName) => ({
    name: (profile && profile.name) || fallbackName || "我",
    appearance: profile && profile.appearance,
    refPhoto: profile && profile.refPhoto,
    outfit: (profile && profile.photoOutfit) || "",
    closet: myClosetText()
  });
const closetTextFor = (charId, cap) => (typeof carryClosetText === "function")
    ? carryClosetText((carryRef.current || {})[charId], cap) : "";
const wearsOnDay = (charId, ts) => {
    const d0 = new Date(ts); d0.setHours(0, 0, 0, 0); const a = d0.getTime(), z = a + 86400000;
    const cur = statesRef.current[charId];
    const rows = [...(stateHistRef.current[charId] || []), ...(cur ? [cur] : [])]
      .map(x => ({ ts: x && (x.wearingUpdatedAt || x.ts), w: String((x && x.wearing) || "").trim() }))
      .filter(x => x.w && x.ts >= a && x.ts < z).sort((p, q) => p.ts - q.ts);
    const out = [];
    rows.forEach(x => { if (!out.length || out[out.length - 1].w !== x.w) out.push({ t: new Date(x.ts).toTimeString().slice(0, 5), w: x.w.slice(0, 80) }); });
    return out.slice(0, 6);
  };
const genPhotoDiary = async (charId, entry) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !entry || photoDiaryBusy) return;
    if (!(typeof imgApiReady === "function" && imgApiReady())) { toast("先去 设置·图像API 配一下"); return; }
    setPhotoDiaryBusy(entry.id);
    try {
      const body = (entry.paras || []).filter(p => p && !p.secret).map(p => p.text).join("\n").slice(0, 900);
      // 他【此刻】身上那身只属于今天（她 2026-10-13：「为啥生成以前的都是同一套衣服」——旧日记一律套上了今天的卫衣）：
      //   日记不是今天的、或者那天的穿着已经查到了，就把此刻穿着拿掉，让衣柜／那天记下的那几身说了算
      const dayWears = Array.isArray(entry.wears) && entry.wears.length ? entry.wears : wearsOnDay(charId, entry.ts);
      const isToday = new Date(entry.ts).toDateString() === new Date().toDateString();
      const st0 = statesRef.current[charId] || {};
      const st = (!isToday || dayWears.length) ? { ...st0, wearing: "", wearingUpdatedAt: 0 } : st0;
      const scene = "【版式·胶片条】整张图是一条竖着的三格胶片，三格一样大、格子之间留一道粗白边，像一卷胶片冲出来的三张；"
        + "三格按下面这篇日记里这一天的三个时刻，从早到晚排；地方跟着日记走。三格机位要各不一样（每格具体怎么拍见下面「每一格的机位」）；不要三格都从高处往下拍，也不要三格都抬头看镜头。脸：至少两格要看得清正脸或者四分之三侧的脸（不一定看镜头），纯侧脸、背影最多一格。第三格是晚上，但晚上不等于睡觉：挑日记和日程里晚上真在做的事（吃饭、洗完澡、看书、打游戏、回消息、出门……）；只有日记里写明了在睡、躺下了，才画睡着或躺在床上。挑日记里真写到的画面，别编日记里没有的地方和人。"
        // 穿什么：先看写日记时记下的、再查状态历史；这天换过几身，每格穿那个时刻的那身
        + (() => { const w = dayWears;
            if (!w.length) return isToday ? "三格里他穿的是同一身衣服。" : "那天穿什么没记下来：从他衣柜里挑一身合这天天气、这天在做的事的，三格都是这一身；别照搬参考照里的衣服。";
            if (w.length === 1) return "这一天他穿：" + w[0].w + "；三格都是这一身。";
            return "这一天他换过几身（按时间）：" + w.map(x => x.t + " " + x.w).join("；") + "。每一格穿那个时刻对应的那一身，别混搭。"; })()
        + (entry.location ? "这一天在：" + entry.location + "。" : "") + (entry.weather ? "天气：" + entry.weather + "。" : "")
        + "\n这篇日记：\n" + body
        // 那一天的日程也递上（她 2026-10-12：「这三个时刻会参考日程吧」）：日记就是照它写的，三格优先从日程和日记都对得上的时刻里挑
        + (() => { let sc = ""; try { sc = String(scheduleTextFor(char, schedDayKey(new Date(entry.ts))) || "").trim(); } catch (e) {} return sc ? "\n那一天的日程（三格优先挑日程和日记都对得上的时刻）：\n" + sc.slice(0, 600) : ""; })();
      const prompt = buildPhotoPrompt(char, scene, st, { kind: "other", closet: closetTextFor(charId, 240), panels: 3 });
      // 给看得见这一页的人（半窗里的他）一句话：这三张拍的是什么
      const stripDesc = "他这篇日记那天的照片日记，竖着三格，从早到晚：照日记里写的「" + body.replace(/\s+/g, " ").slice(0, 80) + "…」那一天拍的"
        + (dayWears.length ? "；穿着：" + dayWears.map(x => x.t + " " + x.w).join("、") : "") + (entry.location ? "；在" + entry.location : "") + (entry.weather ? "；" + entry.weather : "");
      const out = await generateSelfieImage(prompt, char.refPhoto ? [char.refPhoto] : null, { size: "1024x1536" });
      let imgKey = null, imgUrl = null;
      if (out && out.blob) { imgKey = "img_pdiary_" + charId + "_" + entry.id; await idbImgPut(imgKey, out.blob); }
      else if (out && out.url) imgUrl = out.url;
      else throw new Error("没拿到图");
      setDiaries(p => {
        const n = { ...p, [charId]: (p[charId] || []).map(e => e.id === entry.id ? { ...e, photoStrip: { imgKey, imgUrl, ts: Date.now(), desc: stripDesc } } : e) };
        saveJSON("x_diaries", n); return n;
      });
    } catch (e) { toast("照片日记没拍成：" + (e.message || "重试"), 9000); }
    finally { setPhotoDiaryBusy(""); }
  };
const shareShotToChat = async (char, shot) => {
    if (!char || !shot) return false;
    try {
      // 照相馆存在 idbImg 那个仓（img_ 键），聊天的照片走 iv_ 图库——两个仓，得搬一趟
      let ref = shot.imgUrl || "";
      if (!ref && shot.imgKey) {
        const blob = await idbImgGet(shot.imgKey);
        if (!blob) throw new Error("这张图在本机图库里找不到了");
        ref = await imgToVault(await blobToDataUrl(blob));
      }
      if (!ref) throw new Error("这张没有图");
      const desc = String(shot.desc || shot.scene || "").trim();
      pChat(char.id, p => [...p, {
        role: "user", kind: "photo", imageRef: ref, photoMode: "real",
        desc: desc, content: desc ? "[照片] " + desc : "[照片]",
        ts: Date.now(), read: true
      }]);
      setActiveChar(char); setScreen("thread");
      toast(characterText(char, "发过去了——点「让 TA 回复」听他说"));
      return true;
    } catch (e) { toast("没发出去：" + (e.message || "重试")); return false; }
  };
const cleanDrawSvg = raw => {
    let s = String(raw || "").trim();
    const a = s.indexOf("<svg"), b = s.lastIndexOf("</svg>");
    if (a < 0 || b < a) return "";
    s = s.slice(a, b + 6);
    if (s.length > 40000) return "";
    s = s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/(href|xlink:href)\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
    if (!/xmlns=/.test(s)) s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    return s;
  };
const drawBackOn = async (charId, chatKey, userMsg, svgRaw, turnId) => {
    try {
      let svg = cleanDrawSvg(svgRaw); if (!svg || !userMsg.imageRef) return;
      const base = await imgVaultFetchBlob(userMsg.imageRef); if (!base) return;
      const load = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
      const bu = URL.createObjectURL(base); const im = await load(bu); URL.revokeObjectURL(bu);
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      svg = svg.replace(/<svg\b([^>]*)>/, (m0, at) => "<svg" + at.replace(/\s(width|height|preserveAspectRatio)=("[^"]*"|'[^']*')/g, "") + ' width="' + c.width + '" height="' + c.height + '" preserveAspectRatio="none">');
      const ov = await load("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
      const x = c.getContext("2d"); x.drawImage(im, 0, 0); x.drawImage(ov, 0, 0, c.width, c.height);
      const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.9)); if (!blob) return;
      const sid = "db" + Date.now(), key = "img_" + charId + "_" + sid;
      await idbImgPut(key, blob);
      pChat(chatKey, p => [...p, { role: "assistant", kind: "selfie", sid, imgKey: key, desc: "在你画过的那张上接着画了几笔", photoKind: "drawback", ts: Date.now(), turnId, read: false }]);
    } catch (e) { console.warn("[drawBack]", e && e.message); }
  };
window.__studioThemes = () => [...Object.keys(STUDIO_THEMES).map(k => ({ k, zh: STUDIO_THEMES[k].zh })), ...customThemes().map(x => ({ k: x.k, zh: x.zh, line: x.line, custom: true }))];
window.__studioThemeSave = (zh, line, k) => {
    const name = String(zh || "").trim().slice(0, 12); if (!name) return null;
    const key = k || "c_" + Date.now();
    const rest = customThemes().filter(x => x.k !== key);
    saveJSON("x_studioThemes", [...rest, { k: key, zh: name, line: String(line || "").trim().slice(0, 300) }]);
    return key;
  };
window.__studioThemeDel = k => saveJSON("x_studioThemes", customThemes().filter(x => x.k !== k));
window.__developPolaroid = id => {
    const n = (studioRef.current || []).map(x => x.id === id ? { ...x, developAt: 0 } : x);
    studioRef.current = n; setStudio(n); saveJSON("x_studio", n);
  };
window.__addSelfSticker = async (dataUrl, charId, name, drawn, captioned) => {
    try {
      const url = await imgToVault(dataUrl);
      const c = characters.find(x => x.id === charId);
      const packName = (c ? (c.remark || c.name) : "TA") + " 的表情";
      const packs = emotePacksRef.current || [];
      let pk = packs.find(x => x && x.fromCharFace === (charId || "_"));
      const em = { id: "em_" + Date.now() + "_" + Math.floor(Math.random() * 100000), keyword: String(name || "").trim().slice(0, 20) || ((c ? c.name : "TA") + "表情" + (((pk && pk.emotes) || []).length + 1)), url, ...(drawn ? { drawn: true } : {}), ...(captioned ? { captioned: true } : {}) };
      const next = pk ? packs.map(x => x === pk ? { ...x, emotes: [...(x.emotes || []), em] } : x)
        : [...packs, { id: "ep_face_" + Date.now(), name: packName, global: false, mine: true, charIds: charId ? [charId] : [], fromCharFace: charId || "_", emotes: [em] }];
      return commitEmotePacks(next);
    } catch (e) { return false; }
  };
return {STUDIO_CAP,STUDIO_THEMES,customThemes,studioThemeOf,comicCompose,polaroidCompose,studioOverlay,coverCopy,studioShoot,myClosetText,photoMe,closetTextFor,wearsOnDay,genPhotoDiary,shareShotToChat,cleanDrawSvg,drawBackOn};
};
