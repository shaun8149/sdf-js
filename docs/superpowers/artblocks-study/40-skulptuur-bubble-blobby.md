# 第四十课: Skulptuur (Pasma) + Bubble Blobby (Ting) — 待判定清零

## Skulptuur — Piter Pasma

- **ArtBlocks #173** · 原生 js (webgl2) · 6.4KB · NFT License → 纯研究
- 判定: **shader-core, 元编程 SDF 渲染 → 3D 端移交** (实为**渐进式
  路径追踪器**: 5-9 次弹射 + 逐帧 accumulation + ACES 近似 tonemap,
  比 raymarch 高一档; 另有 1/150 金料稀有位)

> 二读勘误 (2026-07-11): 原文核实, 详见 audit/batch-B

与 Växt (L15) / Gumbo (L11) 同族第三例: JS 用 hash 决策拼装 GLSL
距离场源码 (`dg` 字符串累加, `L(max(q,0))-` 即 box SDF, min/max/abs
高尔夫), 6.4KB 内含 xorshift + 场景组合器。Pasma 的 rayhatching
idiom 我们已 port (lines-pasma-rayhatcher); Skulptuur 补的是他的
**SDF 场景语法**: 12 组行列比例 O[] 抽两组做雕塑构图 — 构图先于
形体, 比例目录即风格。**元编程 shader 在语料中三例 (Växt/Skulptuur/
Gumbo 亦近似) = 我们 sdf3.compile 架构的社区共识背书。**

## Bubble Blobby — Jason Ting

- **ArtBlocks #62** · regl/原生 WebGL · 8KB · CC BY-NC 4.0 → recipe-only
- 判定: **shader-core (metaball/blob 场 fragment) → 3D 端移交**

全部视觉在 fragment (soft-min blob 场); JS 只做 canvas/uniform 管理。
一个 2D 端可借的 UX idiom: `URLSearchParams` 的 `?q=` 质量档 (1-3),
运行时可调渲染精度 — 收藏者侧的性能旋钮, 与 Gazers 的 URL 视图层
(L34) 同宗。

## 里程碑: 108 项语料"待判定高价值"清单清零

40 课后判定覆盖: 2D-core 家族源 ×16 / 2D 文档课 ×12 / shader-core
→3D ×8 / CPU-3D ×1 / 第三四形态 ×3。剩余未学项均为常规 2D 队列
(Subscapes 类经典已入库血统) 或 three.js 桶 (3D 端自取)。

## 一句话学到的

"生成器写 shader"在顶级作者处是惯用架构不是奇技 — 我们把它产品化了。
