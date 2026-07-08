# 第二十五课: Still Moving — Nathaniel Stern & Sasha Stiles

- **ArtBlocks #433** · p5 纯 2D · 24KB · CC BY-NC-SA 4.0 → recipe-only (SA 病毒条款, 从严)
- 视觉: 诗句穿过低清网格的"静止的运动" — 文字被视频化处理

## 分流判定: 2D-core, 文档课 (伦理线: 文字内容不进修饰层)

数据是一组诗行 (`PO=["I don't know much about minds…"]`, Stiles 是
诗人), 渲染是 36×24 低清网格 + 阈值 (thrsh=75) 的伪视频处理。
文字 = 语义内容 — 修饰层伦理与 asemic 一课 (Cytographia 判定) 同规:
**修饰不能制造可读性/文字性错觉**, 不 port。

## 值得带走的 idiom

1. **双 PRNG 交替 + 1e6 预热 (第二次目击)**: prngA/prngB 各吃 hash
   一半, RD() 交替消费 — 与 Neural Sediments (L6, Eko33) 完全同构。
   两位互不相识的作者收敛到同一防御 = 该 idiom 从 decor v2 候选
   升级为"社区共识"级输入。
2. **低清网格 + 阈值 = 免费的"视频感"**: 任何输入 (文字/图形) 过
   36×24 网格再阈值化, 就获得监控器/新闻纪录片质感 — 是采样屏
   (L20 场×屏) 的又一皮肤。
3. 诗-代码合著: 文本是链上数据的一部分, 作品身份 = hash × 诗行 —
   provenance 可以携带内容, 不止参数。

## 一句话学到的

采样屏换一个皮肤就是另一种媒介感 — 点阵是印刷, 低清阈值网格是录像。
