// 角色称呼的唯一判断表。只格式化应用自己的文案，不改玩家文字、模型回复或历史存档。
// 未填写／无法识别的性别用 TA；不从姓名、头像或自由文本猜性别。
(function (root) {
  "use strict";
  const female = new Set(["她", "女", "女性", "女生", "f", "female", "woman"]);
  const male = new Set(["他", "男", "男性", "男生", "m", "male", "man"]);
  function ta(character) {
    const gender = String(character && character.gender || "").trim().toLowerCase();
    return female.has(gender) ? "她" : male.has(gender) ? "他" : "TA";
  }
  // 复数先保持原样，等待产品选择；词里的字不等于代词。
  const token = /其他|他们|他俩|他倆|他两|他仨|他人|他乡|吉他|利他|排他|他杀|他律|他山|他日(?![记历子程])|他处|他国|他者|维他命|他/g;
  function replace(text, pronoun) {
    const value = String(text == null ? "" : text);
    if (!pronoun || pronoun === "他") return value;
    return value.replace(token, word => word === "他" ? pronoun : word);
  }
  function text(character, template) {
    const pronoun = ta(character);
    return replace(template, pronoun).replace(/TA/g, (word, index, value) =>
      /[a-zA-Z]/.test(value[index - 1] || "") || /[a-zA-Z]/.test(value[index + 2] || "") ? word : pronoun);
  }
  const api = { ta, replace, text };
  root.CharacterPronoun = api;
  root.PhonePronoun = api; // 兼容已有调用；判断和替换算法仍只有这一份。
  root.characterText = text;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
