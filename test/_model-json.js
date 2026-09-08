const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
const start = src.indexOf('function repairJSON(');
const end = src.indexOf('\n// ============================================================', start);
if (start < 0 || end <= start) throw new Error('找不到公共 JSON 解析器');
module.exports = new Function(src.slice(start, end) + '\nreturn parseJSONLoose;')();
