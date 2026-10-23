#!/bin/zsh
# 续跑: 缺终稿的件 (信用额度中断的 162 件) 走 genlab-full.sh 自动续; 终稿渲染失败的 2 件 --force 重跑
cd /Users/hexiaoyang/Documents/sdf-main
export ANTHROPIC_API_KEY=$(tr -d '\n\r ' < /Users/hexiaoyang/Documents/sdf/DIMENSION/key2.txt | sed 's/^ANTHROPIC_API_KEY=//')
WORKERS=${WORKERS:-6} ./sdf-js/scripts/genlab-full.sh
nohup node sdf-js/scripts/genlab-rewrite.mjs --ids cinque-terre,terraced-fields-yunnan --force --log _log-fix.json > sdf-js/examples/genlab/out-v2/_run-fix.log 2>&1 &
echo "resume launched; 跑完后: node sdf-js/scripts/genlab-ab.mjs --pilot full.json --out ~/Downloads/genlab-rewrite-full"
