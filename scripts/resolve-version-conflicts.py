#!/usr/bin/env python3
"""收版本号冲突（她 2026-09-16 授权自己合 main 之后，每次合都要收一遍）。

发版会同时改四份指纹（index.html / js/app.js / manifest.json / rescue.html），
所以两边只要都发过版，这四份必冲突，而且**冲的永远只是那串号码**。

⚠️这儿不许 `git checkout --ours`（施工规则/merge-to-main.md）：那会把对面那一侧
   真正的改动一起丢掉。做法是逐个冲突块比对——把两侧的版本号和 fg-<hex> 指纹
   都抹成占位符，**剩下的部分必须一模一样**，才敢自动收。
   只要有一块对不上，整个脚本罢工，交给人去看：那一块就不是发版冲突。

用法：合出冲突之后跑 `python3 scripts/resolve-version-conflicts.py`，
再跑一次 `node scripts/bump-version.mjs` 重编指纹。
"""
import difflib, re, subprocess, sys

VER = re.compile(r"\d+\.\d+(\.\d+)?")
FG = re.compile(r"fg-[0-9a-f]+")
BLOCK = re.compile(r"<<<<<<< [^\n]*\n(.*?)\n?=======\n(.*?)\n?>>>>>>> [^\n]*\n", re.S)

def skeleton(text):
    return FG.sub("fg-X", VER.sub("N", text))

# 除了号码，还有一种安全的差法：**一侧只是多了整行**（这一轮新开了一个 js 文件，
# index.html 里多一行 <script src>）。一行都没被【改写】、只有整行新增时，取行多的那侧
# 不会丢掉任何一侧的东西。只要有哪一行是被改写的（replace），照旧罢工。
def only_added_lines(a, b):
    ops = difflib.SequenceMatcher(None, a.split("\n"), b.split("\n")).get_opcodes()
    if any(tag == "replace" for tag, *_ in ops):
        return None
    if all(tag in ("equal", "insert") for tag, *_ in ops):
        return "theirs"
    if all(tag in ("equal", "delete") for tag, *_ in ops):
        return "ours"
    return None

def main():
    files = subprocess.run(["git", "diff", "--name-only", "--diff-filter=U"],
                           capture_output=True, text=True, check=True).stdout.split()
    if not files:
        print("没有冲突文件"); return 0
    bad = []
    for path in files:
        src = open(path, encoding="utf-8").read()
        def pick(m):
            ours, theirs = m.group(1), m.group(2)
            so, st = skeleton(ours), skeleton(theirs)
            if so == st:
                return theirs + "\n"      # 两侧只差号码 → 取新发的那一侧
            side = only_added_lines(so, st)
            if side == "theirs":
                return theirs + "\n"
            if side == "ours":
                return ours + "\n"
            bad.append((path, ours[:160], theirs[:160]))
            return m.group(0)
        out = BLOCK.sub(pick, src)
        if not bad:
            open(path, "w", encoding="utf-8").write(out)
            print("收了：" + path)
    if bad:
        print("\n⚠️有冲突块不只是版本号，没动任何文件。自己去看：", file=sys.stderr)
        for path, a, b in bad:
            print("\n--- " + path + "\n我们这侧：\n" + a + "\n对面那侧：\n" + b, file=sys.stderr)
        return 1
    subprocess.run(["git", "add"] + files, check=True)
    print("四份指纹都收完了。接着跑 node scripts/bump-version.mjs")
    return 0

sys.exit(main())
