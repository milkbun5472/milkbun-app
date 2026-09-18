# 测试切代码，两头一律钉【代码】，不钉注释（2026-09-18 一天踩三次立）

`indexOf` 找不到就返回 **-1**，而 `slice(a, -1)` 不会报错——它只是**一路切到文件末尾**。
于是窗口里混进了后面几千行别的东西，断言红得跟真回退一样，
而真正改坏的地方一个字都没有。

## 这一天的三次

| 那个锚 | 我动了什么 | 结果 |
|---|---|---|
| `"const pinRow = (onTogglePin \|\| onPeek)"` | 条件里加了 `onDeleteItem` | 三条布料测试一起红 |
| `"function CarrySection({ char, …, onTogglePin, onPeek, …"` | 参数表中间插了一个 | 「没有第二份渲染」红 |
| `"// 设置·情侣问答自定义题库"` | 那句注释删了 | 唱片那两页的测试红（窗口吃到文件末尾）|

三次都不是代码坏了，是**锚本身是会变的东西**。

## 规矩

**切片的起点和终点，只许用【函数名】或【常量名】那种改了就等于换了东西的字符串。**

- ✅ `src.indexOf("function ListenTogether(")` → `src.indexOf("function CotConfig(")`
- ✅ `app.indexOf("  const carryDeleteItem = (charId, key, item) => {")`
- ❌ 注释：它天生就是要被改写、被删掉的
- ❌ 一整串参数表 / 一整行条件：中间加一个参数就断
- ❌ 一句中文文案：她随时会让你改措辞

**钉到能认出「是这一段」为止就停手**，别把整行抄进去：
`"function CarrySection({ char, sectionKey, data, gifts, busyKey, giftBusy, pinned,"` 就够了。

## 顺手加一道保险

切完先确认真的切到了，别让 -1 悄悄溜过去：

```js
const i = src.indexOf("function X("), j = src.indexOf("function Y(", i);
assert.ok(i > 0 && j > i, "抠不出 X");
```

一行断言，换来的是**红的时候你知道是锚断了，不是代码回退了**——
这一天我为这件事查了三遍代码，每次都是先怀疑自己刚写的东西。

## 判据一句话

**这个锚，下一次有人改这段代码时会不会顺手改到它？**

会 → 换成函数名。不会 → 才能用。
