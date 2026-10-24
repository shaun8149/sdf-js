#!/bin/zsh
# 全库重写: full.json 里全部 id (已有 out-v2/<id>.js 的自动跳过), 6 个 worker 轮转分片, 各自台账
set -e
cd /Users/hexiaoyang/Documents/sdf-main
export ANTHROPIC_API_KEY=$(tr -d '\n\r ' < /Users/hexiaoyang/Documents/sdf/DIMENSION/key2.txt | sed 's/^ANTHROPIC_API_KEY=//')
W=${WORKERS:-6}
OUT=sdf-js/examples/genlab/out-v2
node -e '
const p=require("./sdf-js/examples/genlab/full.json").picked; const fs=require("fs");
const ids=[]; for(const k of ["objects","landscapes","themes"]) for(const x of p[k]) if(!fs.existsSync("'$OUT'/"+x.id+".js")) ids.push(x.id);
const W='$W'; const chunks=Array.from({length:W},()=>[]); ids.forEach((id,i)=>chunks[i%W].push(id));
chunks.forEach((c,i)=>fs.writeFileSync("/tmp/genlab-chunk-"+i+".txt", c.join(",")));
console.log("todo", ids.length, "per worker ~", Math.ceil(ids.length/W));'
for i in $(seq 0 $((W-1))); do
  ids=$(cat /tmp/genlab-chunk-$i.txt); [ -z "$ids" ] && continue
  nohup node sdf-js/scripts/genlab-rewrite.mjs --ids "$ids" --log "_log-full-$i.json" > "$OUT/_run-full-$i.log" 2>&1 &
done
sleep 1; echo "launched $(pgrep -f 'genlab-rewrite.mjs --ids' | wc -l | tr -d ' ') workers"
