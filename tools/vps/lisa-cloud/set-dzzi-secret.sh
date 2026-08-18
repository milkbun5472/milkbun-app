#!/bin/sh
set -eu
cd "$(dirname "$0")"
printf "请粘贴 DZZI 密钥（输入不会显示），然后按回车：" >&2
trap 'stty echo 2>/dev/null || true' EXIT HUP INT TERM
stty -echo
IFS= read -r value
stty echo
printf "\n" >&2
printf %s "$value" | node ./set-secret.mjs KEY_DZZI
unset value
sudo docker compose up -d --force-recreate functions gateway
printf "DZZI 保险柜已更新，模型代理已重启。\n"
