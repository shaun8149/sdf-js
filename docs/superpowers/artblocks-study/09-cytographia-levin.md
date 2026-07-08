# 第九课: Cytographia — Golan Levin (后期队列)

- **ArtBlocks #487** · p5 (2D + WebGL 材质层) · 287KB (语料最大) · **CC BY-NC 4.0 → recipe-only**
- 视觉: 无义生物图谱 — 伪文字 (asemic writing) + 生物细胞线描 + 古籍版面, 书法笔触

## 分流判定: 第三种形态 (本课首要产出)

既非纯 2D 也非 shader-core — **2D-core 构图 + shader 材质部门**:
构图/几何 (细胞、伪文字、版面) 全是 2D; shader 只负责"材质": frag_paper
(纸纹) / frag_blur / frag_comp (柔光合成+水印噪声) / **笔尖 vertex shader**
(书法笔画渲染) / stamp corrupter。渲染技术地图新增第三类:
2D-core + shader materials → **2D 队列, 材质层 idiom 可选移交 3D**。

## 结构 (287KB 的图书装置)

```
asemic 字形系统   看起来像文字但无语义的字形生成 (整本"古籍"的正文)
细胞/blob 生成    converge 增长算法 + 相交检测 — 生物形态线描
版面系统          cell 布局 + 装饰边框 + 图注 — 完整书籍版面语法
StyledPolyline ★  笔尖 vertex shader: 笔画宽度 =
                  基宽 × nib(笔画方向 vs nibAngle, nibStrength)
                  × iqPerlinNoise6 (6 倍频噪声"呼吸")
                  — 书法的算法本体: 宽度是方向和行进的函数
材质 shader 层    纸纹/柔光/水印 — 古籍质感全在后处理
```

## 三个可提取 idiom (2D 侧)

1. **笔尖宽度调制** (最有价值): 书法感 = 笔画宽度随 (a) 笔画方向与固定
   笔尖角的夹角 (b) 行进噪声 变化 — canvas 可廉价复现: 沿曲线逐点算宽度,
   左右各偏移 w/2 成飘带多边形填充。
2. **材质与构图分层**: 构图管几何、材质管质感, 两层可独立替换 —
   与我们 palette-注入 / decor-垫底 的分层哲学同构。
3. **asemic 概念**: 伪文字做纹理。⚠ 判定: deck 场景不 port —
   数据文档里的"假文字"有误导嫌疑 (幻觉相邻), 修饰不能制造可读性错觉。

## Port 判定

- **recipe-only**: `nib-flourish` 家族 = idiom 1 独立重写 — 噪声路径 +
  笔尖宽度调制 + 飘带填充, 优雅书法曲线点缀角落。editorial/hr 亲和。
- asemic 字形明确不 port (上述判定); 材质 shader 层记入 3D 端可选移交。

## 一句话学到的

书法不是曲线的形状, 是**宽度的函数** — 同一条路径, 宽度恒定是几何,
宽度随方向与呼吸变化就成了手迹; Levin 把整支笔装进了一个 vertex shader。
