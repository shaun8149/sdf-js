# 第三十课: phase — Loren Bednar

- **ArtBlocks #143** · 原生 js + WebGL 多 pass · 23KB · CC BY-NC 4.0 → recipe-only
- 视觉: 平静的节奏条纹带, 相位错落的软波

## 分流判定: 第三形态偏 shader → 文档课

管线署名即判定: drawArt → blurArt → blendArt → compositeArt →
renderFinal — 条纹画进纹理后, **模糊/混合/合成全在 fragment 链**
(自带 compileShader 工具函数)。零 p5 几何调用 (rect/line 均为 0)。
"相位"感 = 多层条纹在 GPU 里错相叠加, 静态截面无法还原其柔度。
条纹带领域已被 scan-tides (L21) / strata-lines (L5) 覆盖, 不 port。

## 值得带走的 idiom

1. **pass 链有署名**: 五个函数名就是渲染管线文档 — 比注释可靠,
   因为重构会强迫改名。我们 3D 端 pass 链可学此命名纪律。
2. blur-then-blend: 模糊不是后处理是**混合前置件** — 相邻层先各自
   失焦再叠加, 边界即消失, "软"是流程位置而非参数大小。
3. hexToHSV/HSLtoHSV 双色彩空间桥: 设计给 HSL, 计算走 HSV —
   色彩空间按用途换轨 (与我们 OKLab-for-lerp 同一哲学)。

## 一句话学到的

管线的每个 pass 用动词命名, 渲染架构就自动有了不会撒谎的文档。
