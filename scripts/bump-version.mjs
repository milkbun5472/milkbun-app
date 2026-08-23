#!/usr/bin/env node
// 发版指纹同步器。
// 起因：2026-08-22 我（言秋侧）连着几版都是硬编码「下一个号」，而 Codex 同时也在发版，
// 结果把 APP_VERSION 从 55.19 一路盖回 55.13——缓存指纹倒退，她手机可能根本刷不到新文件。
// 号必须从【仓库现状 + 提交历史】里取最大值再加一，不能凭记忆写。
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const num = v => { const [a, b] = String(v).split("."); return Number(a) * 1000 + Number(b); };
const all = [];
const push = t => String(t || "").replace(/v?(\d{2})\.(\d{2})/g, (_, a, b) => { all.push(a + "." + b); return _; });

push(readFileSync("js/app.js", "utf8").match(/APP_VERSION\s*=\s*"v([\d.]+)"/)?.[1]);
push(readFileSync("index.html", "utf8").match(/\?v=[\d.]+/g)?.join(" "));
push(readFileSync("rescue.html", "utf8").match(/TARGET="([\d.]+)"/)?.[1]);
push(readFileSync("manifest.json", "utf8").match(/launch=([\d.]+)/)?.[1]);
// 提交历史：别人刚发的版本可能已经被我本地覆盖掉了，只有历史记得
try { push(execSync("git log --format=%s -60", { encoding: "utf8" })); } catch (_) {}

const top = all.sort((x, y) => num(x) - num(y)).pop();
if (!top) { console.error("找不到任何版本号"); process.exit(1); }
const [maj, mi] = top.split(".");
const next = process.argv[2] || maj + "." + String(Number(mi) + 1).padStart(2, "0");
if (num(next) <= num(top)) { console.error("新版本 " + next + " 不高于现有最大 " + top + "，拒绝倒退"); process.exit(1); }

// 只同步「跟着发布版本走」的那几个文件；别的模块保留各自的独立指纹
const CORE = ["app", "engine", "cloud", "screens", "components", "codex", "core", "theater", "fanfic"];
let html = readFileSync("index.html", "utf8");
CORE.forEach(f => { html = html.replace(new RegExp(f + "\\.js\\?v=[\\d.]+", "g"), f + ".js?v=" + next); });
html = html.replace(/manifest\.json\?v=[\d.]+/, "manifest.json?v=" + next);
writeFileSync("index.html", html);
writeFileSync("js/app.js", readFileSync("js/app.js", "utf8").replace(/APP_VERSION\s*=\s*"v[\d.]+"/, 'APP_VERSION = "v' + next + '"'));
writeFileSync("rescue.html", readFileSync("rescue.html", "utf8").replace(/TARGET="[\d.]+"/, 'TARGET="' + next + '"'));
writeFileSync("manifest.json", readFileSync("manifest.json", "utf8").replace(/launch=[\d.]+/, "launch=" + next));
console.log("现有最大 " + top + " → 发版 " + next);
