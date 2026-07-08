# 第三十八课: Ringers — Dmitri Cherniak

- **ArtBlocks #13** · p5 纯 2D · 7.7KB (字符串数组混淆) · CC BY-NC 4.0 → recipe-only
- 视觉: 钉阵 + 一根绳的缠绕 — "There are an almost infinite number of ways to wrap a string around a set of pegs."

## 分流判定: 2D-core → 2D 队列, 出家族 (生成艺术史级 icon)

代码经字符串数组混淆但骨架可辨: pegs 网格 + getTangents (圆间切线)
+ pAlg (缠绕算法) + shrinkConcavePegs (凹侧钉收缩) + connects。
The Goose (#879) 所在系列, 拍卖史注脚不赘述。

## 解剖 (recipe)

1. **构图即排列**: 一件 Ringers = 钉集上的一个访问排列 + 每钉的
   缠绕侧别 — 组合空间就是作品空间 ("almost infinite ways")。
   参数不是数值是**离散结构** (排列/侧别序列)。
2. **切线几何**: 同半径圆的外切线 = 圆心连线垂直偏移 ±R;
   异侧缠绕时切线穿过中线 (内切线), 绳出现交叉 — 编织感的来源。
3. **绳是主角钉是配角**: 钉画成静点, 绳一笔连续 (arc + tangent
   交替) — 视觉权重全押在路径上。
4. shrinkConcavePegs: 凹侧的钉半径微缩, 绳贴得更紧 — 物理直觉
   的一行近似。

## Port: peg-wraps 家族 (registry.js, DECOR_V=1 下新增)

钉网格 + 无重复随机游走 (访问排列) + 同半径外切线 + 逐钉交替侧别
(weave) + 弯折处 ctx.arc 连续路径。人格 = 网格密度 × 访问数 ×
是否编织。适配 pitch/consulting (图钉板/流程绳感)。零代码复制。

## 一句话学到的

参数可以是离散结构: 一个排列 + 一串侧别, 组合空间即无限 — 数值参数
只是生成艺术的小学。
