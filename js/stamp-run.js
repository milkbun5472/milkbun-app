// 远信：邮票对局的肉鸽（她 2026-11-08 拍板：敌人混着来、信封血带着走、终点要回信、先不给印泥；「路途也可以聊天」）。
//   这一份只有规则：路线图、节点、敌人、岔路、邮局、驿站、信物、奖励。打仗照旧交给 js/stamp-duel.js。
//   一趟：给某个角色寄一封信，信要走一段邮路（六站）；终点就是 TA，打赢了信送到，TA 写回信。
//   不碰界面、不调模型；存档由界面那一层管（x_stampRun）。
(function (g) {
  "use strict";
  const D = () => g.StampDuel;
  const ROWS0 = 6, ROWS = ROWS0;                       // 一段路几站（最后一站是 TA）
  const START_HP = 60, START_PICK = 6;  // 起手卡组几张
  const NODE = {
    fight: { zh: "普通站", icon: "✉" }, elite: { zh: "难站", icon: "✦" }, event: { zh: "岔路", icon: "?" },
    shop: { zh: "邮局", icon: "邮" }, rest: { zh: "驿站", icon: "☕" }, boss: { zh: "终点", icon: "♥" }
  };
  // 路上的麻烦（普通站）：代码写好的敌人，跟角色无关；每种一套卡组的样子
  const TROUBLES = [
    { key: "rain", zh: "一场暴雨", say: "雨下得信纸都卷了边。", roles: ["邮戳", "邮戳", "投递", "火漆"], trait: "夜行" },
    { key: "strike", zh: "罢工的邮差", say: "邮差们堵在路口，谁也不让过。", roles: ["火漆", "火漆", "投递", "补票"], trait: "倔强" },
    { key: "censor", zh: "审查局", say: "每封信都要盖章才能过。", roles: ["邮戳", "火漆", "邮戳", "集邮"], trait: "冷静" },
    { key: "cats", zh: "抢信的野猫", say: "一群猫扑上来叼信。", roles: ["投递", "投递", "投递", "补票"], trait: "莽撞" },
    { key: "lost", zh: "迷路的信", say: "一叠寄错地址的信缠住了你。", roles: ["集邮", "投递", "火漆", "邮戳"], trait: "余温" },
    { key: "wind", zh: "一阵大风", say: "风把信往回吹。", roles: ["投递", "邮戳", "投递", "火漆"], trait: "锋利" },
    { key: "blizzard", theme: "雪国", zh: "暴风雪", say: "白茫茫一片，连路都看不见了。", roles: ["火漆", "邮戳", "火漆", "投递"], trait: "冷静" },
    { key: "wolf", theme: "雪国", zh: "雪地里的狼", say: "几双眼睛在林子边上亮着。", roles: ["投递", "投递", "邮戳", "投递"], trait: "莽撞" },
    { key: "tide", theme: "海边", zh: "涨上来的潮水", say: "潮水漫过了石阶，信差点被卷走。", roles: ["邮戳", "投递", "邮戳", "集邮"], trait: "余温" },
    { key: "gull", theme: "海边", zh: "叼信的海鸥", say: "一群海鸥盯上了你手里的信。", roles: ["投递", "投递", "补票", "投递"], trait: "锋利" },
    { key: "clerk", theme: "旧城", zh: "老邮局的规矩", say: "柜台后的老先生说，这种信封早就不收了。", roles: ["火漆", "邮戳", "集邮", "火漆"], trait: "倔强" },
    { key: "alley", theme: "旧城", zh: "绕不出去的巷子", say: "每条巷子都长得一样，门牌也对不上。", roles: ["集邮", "投递", "邮戳", "补票"], trait: "夜行" },
    { key: "conductor", theme: "夜车", zh: "查票的列车员", say: "「票呢？」列车员把手电照在你脸上。", roles: ["邮戳", "火漆", "邮戳", "投递"], trait: "冷静" },
    { key: "bees", theme: "花季", zh: "一窝蜂", say: "花丛里嗡地一声，蜂全冲出来了。", roles: ["投递", "投递", "邮戳", "投递"], trait: "莽撞" },
    { key: "pollen", theme: "花季", zh: "漫天花粉", say: "花粉糊了一脸，信封上全是黄的。", roles: ["邮戳", "邮戳", "集邮", "火漆"], trait: "余温" },
    { key: "dune", theme: "沙漠", zh: "流沙", say: "脚下的沙往下陷，越挣扎陷得越深。", roles: ["火漆", "火漆", "邮戳", "投递"], trait: "倔强" },
    { key: "sandstorm", theme: "沙漠", zh: "沙暴", say: "天一下子黄了，沙子往信封缝里钻。", roles: ["投递", "邮戳", "投递", "邮戳"], trait: "锋利" },
    { key: "flood", theme: "雨季", zh: "积水的路口", say: "路口的水没过了脚踝，信得举过头顶。", roles: ["火漆", "邮戳", "火漆", "补票"], trait: "冷静" },
    { key: "thunder", theme: "雨季", zh: "打雷", say: "一道雷劈在不远处，你下意识把信护在怀里。", roles: ["投递", "投递", "邮戳", "投递"], trait: "锋利" },
    { key: "rockfall", theme: "山路", zh: "落石", say: "山上滚下来几块石头，正好堵住了路。", roles: ["火漆", "火漆", "火漆", "投递"], trait: "倔强" },
    { key: "fog", theme: "山路", zh: "山雾", say: "雾大得看不见三步外。", roles: ["邮戳", "集邮", "邮戳", "投递"], trait: "夜行" },
    { key: "crowd", theme: "节日", zh: "挤满人的街", say: "人挤人，信差点被挤掉。", roles: ["投递", "补票", "投递", "火漆"], trait: "黏人" },
    { key: "firework", theme: "节日", zh: "炸响的烟花", say: "头顶的烟花一炸，吓得你手一抖。", roles: ["投递", "邮戳", "投递", "投递"], trait: "莽撞" },
    { key: "clock", theme: "梦里", zh: "倒着走的钟", say: "钟在倒着走，你走过的路又回来了。", roles: ["集邮", "邮戳", "集邮", "火漆"], trait: "余温" },
    { key: "shadow", theme: "梦里", zh: "没有脸的邮差", say: "一个没有脸的邮差伸手要你的信。", roles: ["邮戳", "投递", "火漆", "邮戳"], trait: "夜行" },
    { key: "traffic", theme: "TA 的城市", zh: "晚高峰", say: "车一辆挨一辆，喇叭响成一片。", roles: ["火漆", "投递", "火漆", "补票"], trait: "倔强" },
    { key: "wrongbldg", theme: "TA 的城市", zh: "长得一样的楼", say: "整片小区的楼长得一模一样，门牌也看不清。", roles: ["集邮", "邮戳", "投递", "邮戳"], trait: "冷静" },
    { key: "stopover", theme: "夜车", zh: "临时停车", say: "车停在荒郊，广播说要等很久。", roles: ["火漆", "火漆", "补票", "投递"], trait: "倔强" }
  ];
  const EVENTS = [
    { key: "wet", zh: "一张被雨打湿的票", say: "路边躺着一张泡了水的邮票，还认得出是谁。", opts: [{ zh: "花点力气修好它（信封 -6，随机一张票升阶）", fx: "wet" }, { zh: "不管它", fx: "none" }] },
    { key: "box", zh: "路边的旧邮筒", say: "一个掉漆的邮筒，投币口还亮着。", opts: [{ zh: "投 30 枚邮花（换一件信物）", fx: "box", cost: 30 }, { zh: "走开", fx: "none" }] },
    { key: "stranger", zh: "陌生人的信", say: "有封信掉在路上，寄信人写着你认识的名字。", opts: [{ zh: "替 TA 带上（多一张票）", fx: "card" }, { zh: "送回邮局（+30 邮花）", fx: "coins30" }] },
    { key: "pause", zh: "同行的人想歇一会儿", say: "TA 在路边坐下了，说就歇五分钟。", opts: [{ zh: "陪 TA 歇（信封 +12）", fx: "heal12" }, { zh: "拉着 TA 赶路（随机一张票升阶）", fx: "up" }] },
    { key: "bet", zh: "邮差的赌局", say: "一个邮差拦住你：「赌一把？赢了这个归你。」", opts: [{ zh: "赌（一半拿信物，一半信封 -10）", fx: "bet" }, { zh: "不赌", fx: "none" }] },
    { key: "trade", zh: "换票的人", say: "有人想拿两张旧票换你一张。", opts: [{ zh: "换（删一张最弱的，拿两张新的）", fx: "trade" }, { zh: "不换", fx: "none" }] },
    // 她 2026-11-08「随机事件能不能多出几种」
    { key: "eaves", zh: "漏雨的屋檐", say: "雨忽然大了，路边有个漏雨的屋檐。", opts: [{ zh: "躲一会儿（信封 +8）", fx: "heal8" }, { zh: "冒雨赶路，顺路捡了几枚邮花（+20 邮花）", fx: "coins20" }] },
    { key: "pocket", zh: "TA 的口袋", say: "同行的人在口袋里翻了半天，掏出一样东西塞给你。", opts: [{ zh: "收下（拿一件信物，为了找它多绕了路：信封 -8）", fx: "pocket" }, { zh: "让 TA 自己留着（信封 +6）", fx: "heal6" }] },
    { key: "lostfound", zh: "失物招领处", say: "邮局门口摆着一箱没人认领的邮票。", opts: [{ zh: "认领一张（多一张票）", fx: "card" }, { zh: "把最弱的一张捐出去（+25 邮花）", fx: "donate" }] },
    { key: "address", zh: "写错的地址", say: "你忽然发现信封上的地址写错了一个字。", opts: [{ zh: "花 15 邮花请人改好（信封上限 +5）", fx: "address", cost: 15 }, { zh: "将就着寄（信封 -5）", fx: "hurt5" }] },
    { key: "photo", zh: "夹在信里的旧照片", say: "信封里滑出一张旧照片，你停下来看了很久。", opts: [{ zh: "多看一会儿（TA 的一张票升阶）", fx: "upTA" }, { zh: "收好接着走（+15 邮花）", fx: "coins15" }] },
    { key: "lighthouse", zh: "夜里的灯塔", say: "天黑了。远处有座灯塔，也有一条没灯的近路。", opts: [{ zh: "往灯塔走（信封 +15，路上花了 20 邮花）", fx: "lighthouse" }, { zh: "抄近路（信封 -8，+40 邮花）", fx: "shortcut" }] },
    { key: "dealer", zh: "集邮商人", say: "一个集邮商人盯上了你卡组里的一张票。", opts: [{ zh: "卖给他（随机卖掉一张，+45 邮花）", fx: "sell" }, { zh: "不卖", fx: "none" }] },
    { key: "restamp", zh: "盖歪的邮戳", say: "有张票的邮戳盖歪了，旁边的老邮差说能重盖。", opts: [{ zh: "花 20 邮花请他重盖（一张票升阶两次）", fx: "restamp", cost: 20 }, { zh: "歪就歪吧", fx: "none" }] },
    { key: "tired", zh: "同行的人走累了", say: "TA 说腿酸，走不动了。", opts: [{ zh: "背 TA 一段（信封 -10，拿一件信物）", fx: "carry" }, { zh: "一起慢慢走（信封 +6）", fx: "heal6" }] },
    { key: "wind2", zh: "风里的信纸", say: "一阵风把一张信纸卷上了天。", opts: [{ zh: "追（一半捡回一张票，一半摔一跤信封 -6）", fx: "chase" }, { zh: "不追了", fx: "none" }] },
    // 物品栏（她 2026-11-08「可以在特殊节点选择解锁物品栏多带几样」）：碰到就能多一格，最多三格
    { key: "trunk", zh: "旧行李箱", say: "路边丢着一只旧行李箱，锁扣是坏的，里面空出一格正好放东西。", opts: [{ zh: "拎上它（这一趟信物栏多一格，最多三格；信封 -6）", fx: "slot" }, { zh: "不拿了（+20 邮花）", fx: "coins20" }] },
    // 主题路线上才有的岔路（用上面现成的效果）
    { key: "stove", theme: "雪国", zh: "借宿的炉火", say: "雪夜里有户人家亮着灯，主人招呼你进来烤火。", opts: [{ zh: "烤一晚（信封 +15）", fx: "heal15" }, { zh: "谢过就走（+20 邮花）", fx: "coins20" }] },
    { key: "prints", theme: "雪国", zh: "雪地上的脚印", say: "雪地上有一串脚印，往你要去的方向。", opts: [{ zh: "跟着走（随机一张票升阶）", fx: "up" }, { zh: "自己开路（信封 -5，+30 邮花）", fx: "hurt5coins" }] },
    { key: "bottle", theme: "海边", zh: "漂流瓶", say: "浪把一个瓶子推到你脚边，里面卷着一张纸。", opts: [{ zh: "打开（多一张票）", fx: "card" }, { zh: "扔回海里（信封 +8）", fx: "heal8" }] },
    { key: "soaked", theme: "海边", zh: "泡过水的旧邮票", say: "礁石缝里卡着一张泡过水的邮票，图案还看得清。", opts: [{ zh: "晾干带上（信封 -6，随机一张票升阶）", fx: "wet" }, { zh: "不管它", fx: "none" }] },
    { key: "oldman", theme: "旧城", zh: "认识 TA 的老人", say: "一个老人看了一眼信封上的名字，说他认得这个人。", opts: [{ zh: "听他讲一会儿（TA 的一张票升阶）", fx: "upTA" }, { zh: "道谢赶路（+15 邮花）", fx: "coins15" }] },
    { key: "renamed", theme: "旧城", zh: "改了名的街", say: "地址上的街名早就改了，得找人问路。", opts: [{ zh: "花 15 邮花问路（信封上限 +5）", fx: "address", cost: 15 }, { zh: "自己摸着找（信封 -5）", fx: "hurt5" }] },
    { key: "seatmate", theme: "夜车", zh: "邻座的乘客", say: "邻座的人睡不着，问你这封信要寄给谁。", opts: [{ zh: "跟他聊到天亮（信封 +10）", fx: "heal10" }, { zh: "他送你一样东西（拿一件信物，信封 -8）", fx: "pocket" }] },
    { key: "platform", theme: "夜车", zh: "凌晨的站台", say: "车在一个小站停了五分钟，站台上有个卖邮票的小摊。", opts: [{ zh: "下车买一张（-30 邮花，多一张票）", fx: "buycard", cost: 30 }, { zh: "留在车上（信封 +6）", fx: "heal6" }] },
    { key: "florist", theme: "花季", zh: "路边的花店", say: "花店老板问你要不要在信里夹一枝花。", opts: [{ zh: "夹一枝（-15 邮花，TA 的一张票升阶）", fx: "upTAcost", cost: 15 }, { zh: "闻一闻就走（信封 +6）", fx: "heal6" }] },
    { key: "petal", theme: "花季", zh: "夹在信里的花瓣", say: "风把一片花瓣吹进了信封里。", opts: [{ zh: "留着（信封上限 +5）", fx: "maxup5" }, { zh: "吹走它（+15 邮花）", fx: "coins15" }] },
    { key: "oasis", theme: "沙漠", zh: "绿洲", say: "远处有一片绿，走近了真的有水。", opts: [{ zh: "喝个够（信封 +15）", fx: "heal15" }, { zh: "灌满水壶继续赶路（+20 邮花）", fx: "coins20" }] },
    { key: "caravan", theme: "沙漠", zh: "驼队", say: "一支驼队停下来，问你要不要搭一段。", opts: [{ zh: "搭（-30 邮花，多一张票）", fx: "buycard", cost: 30 }, { zh: "自己走（随机一张票升阶）", fx: "up" }] },
    { key: "umbrella", theme: "雨季", zh: "借来的伞", say: "有人把伞塞给你，自己冒雨跑了。", opts: [{ zh: "撑着走（信封 +10）", fx: "heal10" }, { zh: "追上去还给他（拿一件信物，信封 -8）", fx: "pocket" }] },
    { key: "puddle", theme: "雨季", zh: "水坑里的倒影", say: "水坑里映着的不是你，是同行的人在笑。", opts: [{ zh: "多看一会儿（TA 的一张票升阶）", fx: "upTA" }, { zh: "踩过去（+15 邮花）", fx: "coins15" }] },
    { key: "sunrise", theme: "山路", zh: "山顶的日出", say: "爬到一半，天边亮起来了。", opts: [{ zh: "停下来看完（信封 +12）", fx: "heal12" }, { zh: "趁亮赶路（随机一张票升阶）", fx: "up" }] },
    { key: "fork", theme: "山路", zh: "走错的岔道", say: "走了半天才发现是条断头路。", opts: [{ zh: "原路回去（信封 -6，路上顺手修好一张票）", fx: "wet" }, { zh: "硬翻过去（信封 -10，拿一件信物）", fx: "carry" }] },
    { key: "lantern", theme: "节日", zh: "猜灯谜", say: "街口挂着一排灯谜，猜中了有奖。", opts: [{ zh: "猜（一半拿信物，一半信封 -10）", fx: "bet" }, { zh: "看看热闹（+20 邮花）", fx: "coins20" }] },
    { key: "feast", theme: "节日", zh: "一桌团圆饭", say: "路边一家人招呼你进来吃口饭。", opts: [{ zh: "吃一口（信封 +15）", fx: "heal15" }, { zh: "带点吃的上路（+15 邮花）", fx: "coins15" }] },
    { key: "mirror", theme: "梦里", zh: "写着你名字的信", say: "地上有封信，收信人写的是你，字迹是同行的人的。", opts: [{ zh: "拆开（TA 的一张票升阶）", fx: "upTA" }, { zh: "留给醒来的自己（拿一件信物，信封 -8）", fx: "pocket" }] },
    { key: "falling", theme: "梦里", zh: "一直往下掉", say: "脚下一空，你一直往下掉，掉进一堆邮票里。", opts: [{ zh: "抓一张（多一张票）", fx: "card" }, { zh: "闭眼等落地（信封 +8）", fx: "heal8" }] },
    { key: "cafe", theme: "TA 的城市", zh: "TA 常去的那家店", say: "同行的人指着一家店说，以前常来这儿。", opts: [{ zh: "进去坐坐（信封 +10）", fx: "heal10" }, { zh: "记下来下次来（TA 的一张票升阶）", fx: "upTA" }] },
    { key: "subway", theme: "TA 的城市", zh: "末班地铁", say: "末班车还有三分钟，跑过去也许赶得上。", opts: [{ zh: "跑（一半捡回一张票，一半摔一跤信封 -6）", fx: "chase" }, { zh: "慢慢走过去（+20 邮花）", fx: "coins20" }] },
    // 信的事件（她 2026-11-08「更想要他给我写信这种意象……有些事件可以花调用和他不同类别的互动」「不用控制次数」）：
    //   letter 是这一种往来的样子，界面那层去叫 TA 写（花一次调用），写完给游戏奖励，信收进信匣
    { key: "postcard", letter: "postcard", zh: "驿站寄来的明信片", say: "驿站的人递给你一张明信片，邮戳还是新的——是同行的人提前寄到这儿等你的。", reward: "信封 +8" },
    { key: "note", letter: "note", zh: "夹在卡里的便条", say: "你翻卡组的时候，发现能在卡背面写字。挑一张，让同行的人在背面写几句。", reward: "那张票升阶" },
    { key: "memory", letter: "memory", zh: "回忆邮筒", say: "一个旧邮筒，投一枚邮花进去，会吐出一张写着旧事的小卡。", reward: "信封 +10", cost: 10 },
    { key: "oneline", letter: "oneline", zh: "写一句寄出去", say: "路边有个只收一句话的小邮筒。你写一句给同行的人，TA 会在背面回你。", reward: "+20 邮花" },
    { key: "ask", letter: "ask", zh: "TA 寄来的问题", say: "同行的人塞给你一张卡片，上面只写了一个问题。", reward: "随机一张票升阶" },
    { key: "future", letter: "future", zh: "寄给以后的信", say: "有家邮局专收「寄给以后」的信。同行的人说想写一封，封好，下一趟出发时才准你拆。", reward: "一件信物" },
    { key: "swap", letter: "swap", zh: "交换邮票", say: "同行的人看上了你卡组里的一张票，想要走留个纪念。", reward: "送出那张票，换一件信物" }
  ];
  // 主题路线（她 2026-11-08「四条都要 全开 让他推荐」）：换路上的麻烦、岔路、一条棋盘规则、信纸的颜色；
  //   theme 字段挂在麻烦和岔路上，只在那条路上出现；没挂的哪条路都会碰到
  const THEMES = {
    雪国: { key: "snow", say: "一路往北，雪越下越大。", rule: "冻住", ruleZh: "每回合你这边随机一格结冰，那一格贴不上票", paper: ["#f4f6f8", "#dfe6ec"], ink: "#3d5468", words: /雪|冬|寒|冰|北方|冷/ },
    海边: { key: "sea", say: "邮路沿着海走，风里都是盐。", rule: "潮汐", ruleZh: "每隔一回合涨一次潮，两边左右两列的票换位置", paper: ["#eef3f3", "#d4e1e2"], ink: "#2f5a63", words: /海|岛|港|船|潮|渔|沙滩/ },
    旧城: { key: "old", say: "这条路穿过一座老城，邮局还是几十年前的样子。", rule: "怀旧", ruleZh: "你起手挑的那几张老票攻击 +2", paper: ["#f3e9d2", "#e2d1ad"], ink: "#5a4426", words: /旧|老|古|城|回忆|过去|民国|书/ },
    夜车: { key: "night", say: "信搭上了一趟夜车，窗外一站一站往后退。", rule: "到站", ruleZh: "路只有五站，中间每站都要打", paper: ["#dfe1ea", "#c3c8d8"], ink: "#2c3350", words: /夜|车|站|旅|月|失眠|远行/ },
    // 她 2026-11-08「这些主题都写」
    花季: { key: "bloom", say: "路两边的花开得正好。", rule: "花落", ruleZh: "每回合你随机一张票回 2 血", paper: ["#f8eef0", "#ecd6db"], ink: "#7a3b4c", words: /花|春|樱|园|香/ },
    沙漠: { key: "desert", say: "邮路穿过一片沙漠，水要省着喝。", rule: "缺水", ruleZh: "每过一站信封 -2；驿站多回 10", paper: ["#f5e8cf", "#e6cc9c"], ink: "#7a4f1e", words: /沙|漠|荒|旱|西域|驼/ },
    雨季: { key: "rain", say: "这一路雨就没停过。", rule: "连阴雨", ruleZh: "从第二回合起，每回合你随机一张票被雨打湿（攻击 -2）；带着雨衣就不怕", paper: ["#e9edee", "#cfd8db"], ink: "#38505a", words: /雨|伞|梅|湿|阴/ },
    山路: { key: "mountain", say: "路一直往上爬，越往上越难走，风景也越好。", rule: "越爬越高", ruleZh: "越往后的站对面越硬，打赢给的邮花也越多", paper: ["#ecf0e6", "#d3dcc6"], ink: "#3f5a35", words: /山|峰|林|登|寺|云/ },
    节日: { key: "fest", say: "街上挂满了灯，过节的人都在往家赶。", rule: "过节", ruleZh: "邮局打对折，每打完一场多 10 邮花", paper: ["#f6ece4", "#e8cfc0"], ink: "#9a2f2a", words: /节|年|庆|灯|烟花/, when: true },
    梦里: { key: "dream", say: "你好像睡着了，路是软的，钟在倒着走。", rule: "做梦", ruleZh: "每场开局，你和对面的牌组随机换两张", paper: ["#ece8f4", "#d5cde6"], ink: "#4f3f73", words: /梦|幻|星|睡|童话/ },
    "TA 的城市": { key: "city", say: "信走进了 TA 住的那座城，TA 熟悉这里的每一条街。", rule: "熟门熟路", ruleZh: "邮筒格上贴着票，每回合再多 1 点胶水", paper: ["#eeebe6", "#d9d3ca"], ink: "#3d3a36", words: /城市|都市|街|公寓|东京|上海|北京|纽约|首尔|伦敦|巴黎/ }
  };
  // 节日那条只在节日前后开（她：节日限定）：圣诞到元旦、春节前后、七夕、中秋
  const FESTS = [["圣诞", 12, 15, 12, 31], ["新年", 1, 1, 1, 7], ["春节", 1, 20, 2, 20], ["情人节", 2, 7, 2, 15], ["七夕", 8, 1, 8, 31], ["中秋", 9, 10, 10, 8], ["万圣节", 10, 24, 11, 2]];
  function festNow(d) { const t = d || new Date(), md = (t.getMonth() + 1) * 100 + t.getDate(); const f = FESTS.find(x => md >= x[1] * 100 + x[2] && md <= x[3] * 100 + x[4]); return f ? f[0] : ""; }
  function festNext(d) { const t = d || new Date(), md = (t.getMonth() + 1) * 100 + t.getDate(); const f = FESTS.slice().sort((a, b) => a[1] * 100 + a[2] - b[1] * 100 - b[2]).find(x => x[1] * 100 + x[2] > md) || FESTS.find(x => x[0] === "新年"); return f[0] + "（" + f[1] + " 月 " + f[2] + " 日开）"; }
  const themeOpen = (k, d) => !!THEMES[k] && (!THEMES[k].when || !!festNow(d));
  // 照 TA 的人设推荐一条：关键词数得最多的那条；一个都没有就按名字随一条
  function themeFor(text, id) {
    const t = String(text || ""); let best = "", n = 0;
    Object.keys(THEMES).forEach(k => { const m = (t.match(new RegExp(THEMES[k].words.source, "g")) || []).length; if (m > n) { n = m; best = k; } });
    if (best && themeOpen(best)) return best;
    const ks = Object.keys(THEMES).filter(k => themeOpen(k)); let hsh = 0; String(id || "").split("").forEach(c => { hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0; }); return ks[hsh % ks.length];
  }
  const PRICE = { card: 40, relic: 80, remove: 50, heal: 30 };
  const LEVEL_MAX = 8;
  const LEVEL_LV = [5, 10, 16, 22, 28, 35, 42, 50];   // 每一级邮路的建议等级
  // 终点 TA 的特别规则：照 TA 的羁绊（她 2026-11-08「终点不只是打一架」）
  const BOSS_RULES = {
    护短: "TA 的信封每回合回 2", 好胜: "TA 每回合多 1 点胶水", 偏执: "TA 每过一回合攻击 +1，越打越疯",
    冷淡: "TA 的票什么戳都盖不上", 温柔: "TA 的票每回合各回 2 血", 默契: "TA 的票每回合各多充 1 格章"
  };

  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (arr, R) => arr[Math.floor(R() * arr.length)];
  const R0 = run => rng((run.seed ^ (run.step * 2654435761)) >>> 0);

  // 路线图：每排两三个站，连到下一排相邻的站；第一排都是普通站，最后一排是终点
  function makeMap(seed, theme) {
    const R = rng(seed), rows = [], ROWS = theme === "夜车" ? 5 : ROWS0;
    for (let r = 0; r < ROWS; r++) {
      const n = r === ROWS - 1 ? 1 : 2 + (R() < 0.5 ? 1 : 0), row = [];
      for (let k = 0; k < n; k++) {
        let t = r === 0 ? "fight" : r === ROWS - 1 ? "boss" : null;
        if (!t && theme === "夜车") t = R() < 0.7 ? "fight" : "elite";   // 到站：中间每站都要打
        if (!t) { const x = R(); t = x < 0.42 ? "fight" : x < 0.56 ? "elite" : x < 0.74 ? "event" : x < 0.86 ? "shop" : "rest"; }
        if (r === ROWS - 2 && k === 0) t = "rest";      // 终点前一站一定有一个驿站
        row.push({ r, k, type: t });
      }
      rows.push(row);
    }
    // 连线：上一排第 k 个连到下一排位置相近的一两个
    for (let r = 0; r < ROWS - 1; r++) rows[r].forEach(nd => {
      const nx = rows[r + 1], f = nd.k / Math.max(1, rows[r].length - 1), c = Math.round(f * (nx.length - 1));
      nd.to = Array.from(new Set([c, Math.max(0, c - 1), Math.min(nx.length - 1, c + 1)])).filter(j => Math.abs(j - c) <= (R() < 0.5 ? 1 : 0) || j === c).sort();
    });
    return rows;
  }

  // 开一趟：toId 寄给谁（终点）、cards 收藏、core 她挑的「带谁」
  function newRun(o) {
    const seed = (o.seed >>> 0) || (Date.now() >>> 0), cards = (o.cards || []).filter(c => c && c.text);
    const offer = D().deckFrom(cards, seed ^ 0x77, 8, o.core || []);
    // 邮路等级（她 2026-11-08）：送到一次解锁下一级；每升一级起手血 -4、路上的麻烦和拦信的人更凶、终点更硬
    // 同行的人（withId）：可以不是收信的那个人；不填就是 TA 本人陪你走
    const theme = themeOpen(o.theme, o.now) ? o.theme : "";
    const level = Math.max(1, Math.min(LEVEL_MAX, Number(o.level) || 1)), hp0 = START_HP - (level - 1) * 4;
    return { seed, toId: o.toId, withId: o.withId || o.toId, level, step: 0, hp: hp0, max: hp0, deck: [], offer, relics: [], coins: 40, theme, fest: theme === "节日" ? festNow(o.now) : "", map: makeMap(seed, theme), pos: null, picked: false, log: [], done: null, letter: "", seen: {}, mats: [], keeps: [], slots: 1 };
  }
  // 起手：从发的 8 张里挑 6 张
  function takeStart(run, idxs) {
    const set = new Set(idxs); run.deck = run.offer.filter((_, i) => set.has(i)).slice(0, START_PICK);
    if (run.deck.length < 4) run.deck = run.offer.slice(0, START_PICK);
    run.deck = run.deck.map(s => Object.assign({}, s, { old: true }));
    const add = Math.round(D().avgLv(run.deck) * 0.8); run.hp += add; run.max += add;   // 卡组等级高，信封也厚   // 起手的老票（旧城的怀旧看它）
    run.offer = null; run.picked = true; return run;
  }
  const reachable = run => !run.pos ? run.map[0].map(n => n.k) : (run.map[run.pos.r].find(n => n.k === run.pos.k).to || []);
  function enter(run, k) {
    const r = run.pos ? run.pos.r + 1 : 0;
    if (!reachable(run).includes(k)) return null;
    run.pos = { r, k }; run.step++;
    if (run.theme === "沙漠" && r > 0) run.hp = Math.max(1, run.hp - 2);
    const nd = run.map[r][k]; run.seen[r + ":" + k] = 1;
    run.log.push({ step: run.step, r, type: nd.type });
    return nd;
  }

  // 敌人：麻烦（普通站）是造出来的票；难站是她别的角色；终点是 TA
  function troubleDeck(run, tr) {
    const R = R0(run), tier = (run.pos ? run.pos.r : 0);
    return Array.from({ length: 12 }, (_, i) => {
      const role = tr.roles[i % tr.roles.length], rar = R() < 0.1 + tier * 0.05 ? "SR" : "R";
      const s = D().stampOf({ id: "tr_" + tr.key + "_" + run.step + "_" + i, rarity: rar, lv: 5 + tier * 6, text: { name: tr.zh } });
      return Object.assign(s, { role, trait: tr.trait, traitFrom: "", charId: "", skill: Object.keys(D().SKILLS[role])[i % 4] });
    });
  }
  // 这一站要打的那一场怎么开：给界面一份 newDuel 要的料
  function battleFor(run, nd, cards, closeOf, others) {
    const R = R0(run), seed = (run.seed ^ (run.step * 40503)) >>> 0;
    const th = THEMES[run.theme], troubles = TROUBLES.filter(t => !t.theme || t.theme === run.theme);
    // 对面照你卡组的平均等级来（她 2026-11-08）：越往后、等级越高、难站和终点越硬；信封跟着卡组等级变厚
    // 对面的等级照邮路等级定（她 2026-11-08 改：固定难度档，卡练强了才打得过高级）：普通站略低、越往后越高，难站、终点再高一截
    const lvB = LEVEL_LV[run.level - 1] || 5, flv = Math.max(1, Math.round(lvB * (nd.type === "boss" ? 1.15 : nd.type === "elite" ? 1.0 : 0.7 + nd.r * 0.06))), ev = (D().ENVELOPE_HP + lvB * 0.6) / D().ENVELOPE_HP;
    // 这一趟做的信物，带着的那几件（终点是做它的人，再强一档）
    const keeps = (run.keeps || []).filter(k => k.on).map(k => ({ fx: k.fx, v: k.v + (nd.type === "boss" && k.charId === run.toId ? 1 : 0), charId: k.charId, name: k.name }));
    const base = { keeps, foeLv: flv, theme: run.theme || "", themeRuleZh: th ? th.rule + "：" + th.ruleZh : "", meHp: run.hp, meMax: run.max, relics: run.relics.slice(), amulet: run.relics.includes("护身符") && !run.amuletUsed };
    if (nd.type === "fight") {
      const tr = pick(troubles, R), hp = 22 + nd.r * (run.theme === "山路" ? 9 : 6) + (run.level - 1) * 3;
      run.dexT = run.dexT || []; if (!run.dexT.includes(tr.key)) run.dexT.push(tr.key);
      return Object.assign(base, { foeName: tr.zh, say: tr.say, foeDeck: troubleDeck(run, tr), foeHp: Math.round(hp * ev), seed, foeId: "" });
    }
    if (nd.type === "elite") {
      const pool = (others || []).filter(id => id !== run.toId && (cards || []).some(c => c.charId === id));
      const who = pool.length ? pick(pool, R) : "";
      const deck = who ? D().foeDeckFrom(cards, who, closeOf ? closeOf(who) : [], seed) : troubleDeck(run, pick(troubles, R));
      return Object.assign(base, { foeId: who, foeDeck: deck, foeHp: Math.round((36 + nd.r * 4 + (run.level - 1) * 4) * ev), seed, hard: true, elite: true });
    }
    // 终点：TA 本人，用 TA 的卡，认真模式
    const rule = (run.bonds && run.bonds[run.toId]) || "默契";
    return Object.assign(base, { foeId: run.toId, foeDeck: D().foeDeckFrom(cards, run.toId, closeOf ? closeOf(run.toId) : [], seed), foeHp: Math.round((55 + (run.level - 1) * 5) * ev), seed, hard: true, boss: true, bossRule: rule, bossRuleZh: BOSS_RULES[rule] || "" });
  }
  // 打完一场：血带着走、给邮花、给三张挑一张（难站另给一件信物）
  function afterBattle(run, st, nd, cards) {
    run.hp = Math.max(0, st.me.hp); if (st.amuletUsed) run.amuletUsed = true;
    if (st.over && st.over.winner !== "me") { run.done = { win: false, at: run.pos.r, by: nd.type }; return { lost: true }; }
    if (run.relics.includes("回执")) run.hp = Math.min(run.max, run.hp + 4);
    // 掉材料（她 2026-11-08）：普通站一样、难站两样、终点两样再加一样「TA 的东西」；走主题路线一半几率多掉一样那条路的
    const mats = D().matDrop((run.seed ^ (run.step * 3301)) >>> 0, nd.type === "boss" ? "boss" : nd.type === "elite" ? "elite" : "win", run.theme);
    run.mats = (run.mats || []).concat(mats);   // 材料只在这一趟里（她 2026-11-08「信物就是远信专属的」）
    if (nd.type === "boss") { run.done = { win: true, at: run.pos.r }; return { won: true, mats }; }
    const R = R0(run), coins = (nd.type === "elite" ? 50 : 25) + Math.floor(R() * 10) + (run.relics.includes("存钱罐") ? 15 : 0) + (run.theme === "山路" ? nd.r * 6 : 0) + (run.theme === "节日" ? 10 : 0);
    run.coins += coins;
    const offer = cardOffer(run, cards, 3);
    const relic = nd.type === "elite" ? relicOffer(run, 1)[0] : null;
    if (relic) run.relics.push(relic);
    return { coins, offer, relic, mats };
  }
  function cardOffer(run, cards, n) {
    const have = new Set(run.deck.map(s => s.cardId)), pool = (cards || []).filter(c => c && c.text && !have.has(c.id));
    return D().deckFrom(pool.length ? pool : cards, (run.seed ^ (run.step * 7919)) >>> 0, n);
  }
  function relicOffer(run, n) {
    const all = Object.keys(D().RELICS).filter(k => !run.relics.includes(k)), R = R0(run), out = [];
    while (out.length < n && all.length) out.push(all.splice(Math.floor(R() * all.length), 1)[0]);
    return out;
  }
  function addRelic(run, k) {
    if (!k || run.relics.includes(k)) return;
    run.relics.push(k);
    if (k === "厚信封") { run.max += 10; run.hp += 10; }
  }
  // 升阶：这一趟里这张票更强（攻击 +2、血 +3，章少攒一格）
  function upgrade(run, i) {
    const s = run.deck[i]; if (!s) return;
    run.deck[i] = Object.assign({}, s, { pow: s.pow + 2, maxHp: s.maxHp + 3, need: Math.max(1, s.need - 1), up: (s.up || 0) + 1, name: s.name.replace(/＋+$/, "") + "＋".repeat((s.up || 0) + 1) });
  }
  // 岔路：选了哪一项、发生什么
  // 同一趟里不重样（她 2026-11-08 加了十种）：没碰过的先来，全碰过了再随便挑
  function eventFor(run) {
    run.evSeen = run.evSeen || [];
    const all = EVENTS.filter(e => !e.theme || e.theme === run.theme), fresh = all.filter(e => !run.evSeen.includes(e.key)), pool = fresh.length ? fresh : all;
    const ev = pool[Math.floor(R0(run)() * pool.length)]; run.evSeen.push(ev.key); return ev;
  }
  function doEvent(run, ev, oi, cards) {
    // 信的事件没有选项（要叫 TA 写，界面那层管）；规则这一层被直接叫到时只发奖励
    const op = ev.opts && ev.opts[oi]; if (!op) return ev.letter ? letterReward(run, ev.letter, 0) || "收到了。" : "";
    const R = R0(run), upRand = () => { const i = Math.floor(R() * run.deck.length); upgrade(run, i); return run.deck[i] ? run.deck[i].name : ""; };
    switch (op.fx) {
      case "wet": run.hp = Math.max(1, run.hp - 6); return "「" + upRand() + "」修好了，还更结实了。";
      case "box": if (run.coins < op.cost) return "邮花不够。"; run.coins -= op.cost; { const k = relicOffer(run, 1)[0]; addRelic(run, k); return k ? "邮筒吐出来一件「" + k + "」。" : "邮筒什么也没吐。"; }
      case "card": { const c = cardOffer(run, cards, 1)[0]; if (c) run.deck.push(c); return c ? "多了一张「" + c.name + "」。" : ""; }
      case "coins30": run.coins += 30; return "邮局给了 30 枚邮花。";
      case "heal12": run.hp = Math.min(run.max, run.hp + 12); return "歇完了，信封回了 12。";
      case "up": return "「" + upRand() + "」升阶了。";
      case "bet": if (R() < 0.5) { const k = relicOffer(run, 1)[0]; addRelic(run, k); return "赢了，拿到「" + k + "」。"; } run.hp = Math.max(1, run.hp - 10); return "输了，信封 -10。";
      case "trade": { if (run.deck.length > 4) { const w = run.deck.reduce((a, s, i) => s.pow + s.maxHp < run.deck[a].pow + run.deck[a].maxHp ? i : a, 0); run.deck.splice(w, 1); } cardOffer(run, cards, 2).forEach(c => run.deck.push(c)); return "换来了两张新票。"; }
      case "heal8": run.hp = Math.min(run.max, run.hp + 8); return "雨小了，信封回了 8。";
      case "heal15": run.hp = Math.min(run.max, run.hp + 15); return "信封 +15。";
      case "heal10": run.hp = Math.min(run.max, run.hp + 10); return "信封 +10。";
      case "hurt5coins": run.hp = Math.max(1, run.hp - 5); run.coins += 30; return "信封 -5，+30 邮花。";
      case "buycard": { if (run.coins < op.cost) return "邮花不够。"; run.coins -= op.cost; const c = cardOffer(run, cards, 1)[0]; if (c) run.deck.push(c); return c ? "买到一张「" + c.name + "」。" : ""; }
      case "slot": run.hp = Math.max(1, run.hp - 6); run.slots = Math.min(D().KEEP_MAX_SLOTS, (run.slots || 1) + 1); return "信物栏多了一格，现在能带 " + run.slots + " 件。";
      case "maxup5": run.max += 5; run.hp += 5; return "信封上限 +5。";
      case "upTAcost": { if (run.coins < op.cost) return "邮花不够。"; run.coins -= op.cost; const idx = run.deck.map((s, i) => s.charId === run.toId ? i : -1).filter(i => i >= 0); const i = idx.length ? idx[Math.floor(R() * idx.length)] : Math.floor(R() * run.deck.length); upgrade(run, i); return "「" + (run.deck[i] || {}).name + "」升阶了。"; }
      case "heal6": run.hp = Math.min(run.max, run.hp + 6); return "信封回了 6。";
      case "coins20": run.coins += 20; return "+20 邮花。";
      case "coins15": run.coins += 15; return "+15 邮花。";
      case "pocket": case "carry": { run.hp = Math.max(1, run.hp - (op.fx === "carry" ? 10 : 8)); const k = relicOffer(run, 1)[0]; addRelic(run, k); return k ? "拿到「" + k + "」。" : "什么也没拿到。"; }
      case "donate": { if (run.deck.length <= 4) return "卡组只剩 4 张了，留着吧。"; const w = run.deck.reduce((a, s, i) => s.pow + s.maxHp < run.deck[a].pow + run.deck[a].maxHp ? i : a, 0); const nm = run.deck[w].name; run.deck.splice(w, 1); run.coins += 25; return "捐出了「" + nm + "」，+25 邮花。"; }
      case "address": if (run.coins < op.cost) return "邮花不够，只好将就着寄。"; run.coins -= op.cost; run.max += 5; run.hp += 5; return "地址改好了，信封上限 +5。";
      case "hurt5": run.hp = Math.max(1, run.hp - 5); return "信封 -5。";
      case "upTA": { const idx = run.deck.map((s, i) => s.charId === run.toId ? i : -1).filter(i => i >= 0); const i = idx.length ? idx[Math.floor(R() * idx.length)] : Math.floor(R() * run.deck.length); upgrade(run, i); return "「" + (run.deck[i] || {}).name + "」升阶了。"; }
      case "lighthouse": run.hp = Math.min(run.max, run.hp + 15); run.coins = Math.max(0, run.coins - 20); return "灯塔下歇了一晚，信封 +15。";
      case "shortcut": run.hp = Math.max(1, run.hp - 8); run.coins += 40; return "摸黑走过来了，信封 -8，+40 邮花。";
      case "sell": { if (run.deck.length <= 4) return "卡组只剩 4 张了，不卖了。"; const i = Math.floor(R() * run.deck.length), nm = run.deck[i].name; run.deck.splice(i, 1); run.coins += 45; return "卖掉了「" + nm + "」，+45 邮花。"; }
      case "restamp": { if (run.coins < op.cost) return "邮花不够。"; run.coins -= op.cost; const i = Math.floor(R() * run.deck.length); upgrade(run, i); upgrade(run, i); return "「" + (run.deck[i] || {}).name + "」升阶两次。"; }
      case "chase": if (R() < 0.5) { const c = cardOffer(run, cards, 1)[0]; if (c) run.deck.push(c); return c ? "追回来了，还多了一张「" + c.name + "」。" : "追回来了。"; } run.hp = Math.max(1, run.hp - 6); return "摔了一跤，信封 -6。";
      default: return "你接着赶路。";
    }
  }
  // 邮局：三张票、两件信物、删一张、回血
  function shopFor(run, cards) { return { cards: cardOffer(run, cards, 3), relics: relicOffer(run, 2), sold: {} }; }
  const priceOf = (run, k) => Math.round(PRICE[k] * (run.relics.includes("优惠券") ? 0.75 : 1) * (run.theme === "节日" ? 0.5 : 1));
  function buy(run, shop, what, i) {
    const cost = priceOf(run, what === "card" ? "card" : what === "relic" ? "relic" : what === "remove" ? "remove" : "heal");
    if (run.coins < cost) return { ok: false, why: "邮花不够" };
    if (shop.sold[what + i]) return { ok: false, why: "已经买过了" };
    if (what === "card") run.deck.push(shop.cards[i]);
    else if (what === "relic") addRelic(run, shop.relics[i]);
    else if (what === "remove") { if (run.deck.length <= 4) return { ok: false, why: "卡组最少留 4 张" }; run.deck.splice(i, 1); }
    else if (what === "heal") run.hp = Math.min(run.max, run.hp + 15);
    run.coins -= cost; if (what !== "remove" && what !== "heal") shop.sold[what + i] = 1;
    return { ok: true };
  }
  // 驿站：回三成血，或者升阶一张
  function rest(run, choice, i) {
    if (choice === "heal") { run.hp = Math.min(run.max, run.hp + Math.round(run.max * 0.3) + (run.relics.includes("旅伴的伞") ? 10 : 0) + (run.theme === "沙漠" ? 10 : 0)); return "歇了一会儿，信封回来了些。"; }
    upgrade(run, i); return "「" + (run.deck[i] || {}).name + "」升阶了。";
  }
  // 给 TA 写回信、给路上聊天用的：这一趟的样子
  function summary(run, nameOf) {
    const nm = id => (nameOf && nameOf(id)) || "";
    const types = run.log.map(l => NODE[l.type] ? NODE[l.type].zh : l.type);
    return (run.theme ? "走的是「" + run.theme + "」那条路（" + THEMES[run.theme].say + (run.fest ? "这几天正赶上" + run.fest : "") + "）；" : "") + "一路走了 " + run.log.length + " 站（" + types.join("→") + "），信封还剩 " + run.hp + "/" + run.max
      + "；带着的票：" + run.deck.map(s => "「" + s.name + "」" + (s.charId && nm(s.charId) ? "（" + nm(s.charId) + "的卡）" : "")).join("、")
      + (run.relics.length ? "；路上捡到的信物：" + run.relics.join("、") : "");
  }

  // 信的事件写完以后的奖励（花了调用，不让白花）
  function letterReward(run, kind, i) {
    const R = R0(run);
    if (kind === "postcard") { run.hp = Math.min(run.max, run.hp + 8); return "信封 +8。"; }
    if (kind === "note") { upgrade(run, i); return "「" + (run.deck[i] || {}).name + "」升阶了。"; }
    if (kind === "memory") { run.hp = Math.min(run.max, run.hp + 10); return "信封 +10。"; }
    if (kind === "oneline") { run.coins += 20; return "+20 邮花。"; }
    if (kind === "ask") { const j = Math.floor(R() * run.deck.length); upgrade(run, j); return "「" + (run.deck[j] || {}).name + "」升阶了。"; }
    if (kind === "future" || kind === "swap") {
      if (kind === "swap" && run.deck.length > 4 && run.deck[i]) run.deck.splice(i, 1);
      const k = relicOffer(run, 1)[0]; addRelic(run, k); return k ? "拿到「" + k + "」：" + D().RELICS[k] + "。" : "";
    }
    return "";
  }
  const API = { LEVEL_LV, THEMES, themeFor, themeOpen, festNow, festNext, LEVEL_MAX, BOSS_RULES, letterReward, ROWS, NODE, TROUBLES, EVENTS, PRICE, newRun, takeStart, reachable, enter, battleFor, afterBattle, addRelic, upgrade, eventFor, doEvent, shopFor, priceOf, buy, rest, summary, cardOffer };
  g.StampRun = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
