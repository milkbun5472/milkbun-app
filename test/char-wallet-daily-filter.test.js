const fs = require("fs");
const assert = require("assert");

const screens = fs.readFileSync("js/screens.js", "utf8");

assert(screens.includes('const [dailyOpen, setDailyOpen] = useState(false)'), "daily spending must start collapsed");
assert(screens.includes('const [dailyDate, setDailyDate] = useState("")'), "daily spending needs a date filter");
assert(screens.includes('schedDayKey(new Date(e.ts)) === dailyDate'), "filter must use the same local day key as display");
assert(screens.includes('"aria-label": "按日期筛选日常消费"'), "date input must be identifiable and accessible");
assert(screens.includes('setDailyOpen(false); setDailyDate("")'), "switching characters must reset wallet view state");

console.log("character wallet daily filter tests passed");
