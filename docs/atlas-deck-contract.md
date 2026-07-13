# atlas-deck 契约 (v1) — 两端机器契约的唯一真相

> 3D 端 e2e 对接必读。可执行校验器: `sdf-js/src/present/deck-spec.js`
> (零依赖, node/浏览器均可直接 import)。黄金 fixtures:
> `sdf-js/examples/deck-handoff/`。变更此契约 = bump `version` + 更新本文档
> + 校验器 + fixtures, 三者同 PR。

## 0. 先分清三种 "deck.json" (历史方言地图)

| 方言 | 形状 | 生产者 | 消费者 |
|---|---|---|---|
| **atlas-deck (本契约)** | `{format:'atlas-deck', version, slots[].sceneData 内联}` | author-2d 💾 / `manifest-to-deck.mjs` | author-2d 📂、**3D 端移交入口**、导出器 |
| bake manifest | `{deckName, sourceFile, slots[].liftFile}` + `slots/*.json` | CLI 烤炉 (bake-scaffold-pipeline) | eval 五轴、scaffold-deck-viewer |
| 3D 播放列表 | `scenes/<id>.json` = `{segments:[…]}` | 3D 端 lift/手工 | deck-player (3D) |

**移交方向**: 2D 产 atlas-deck → 3D 端 lift 管线消化其中每个 slot 的
`sceneData` (2D atoms, twin 覆盖率 100%) → 生成自己的 segments 播放列表。
bake manifest 可用 `node sdf-js/scripts/manifest-to-deck.mjs <dir>` 一键转
atlas-deck。

## 1. 信封

```jsonc
{
  "format": "atlas-deck",     // 必填, 字面量
  "version": 1,               // 必填, 整数; 消费者拒读比自己新的版本
  "title": "Q3 Review",       // 可选 string
  "theme": { … },             // §2
  "scaffold": { "id": "qbr", "label": "Quarterly Business Review" },  // 可选
  "decor": { … },             // §3, 可选
  "shared": { … },            // §4, 可选 (2D 内部再编辑用)
  "slots": [ … ]              // §5, 必填数组
}
```

## 2. theme

字符串 id (如 `"editorial-navy"`, 消费者用自己的主题表解析) 或完整调色板
对象: `{id, bg:[r,g,b], accent:[r,g,b], colors:[[r,g,b],…], …}`。RGB 分量
0-255。缺失 = warning, 消费者回退默认调色板。

## 3. decor (2D 风格层作品身份)

```jsonc
{ "family": "peg-wraps", "seed": 12345, "personality": "balanced",
  "hash": "b902d873762fe5ad", "v": 3, "serial": 7, "rare": false }
```

**3D 消费者可以整体忽略此字段** (修饰是 2D 端风格层, 两端锁豁免 twin)。
但如果携带, 必须完整保真回传 — `hash`+`v`(+`serial`) 是作品身份,
丢字段 = 拥有者无法复现其作品。字段语义见
`src/present/decor/registry.js` 头注 (hash 定决策 / v 定代码 / 序号定
收藏位置)。

## 3.5 artMount (真迹装裱溯源, Sprint 97)

```jsonc
{ "id": "0xa7d8d9-41", "name": "Fidenza", "artist": "Tyler Hobbs",
  "license": "nc", "hash": "0x…",
  "palette": { "accent": [10,120,200], "colors": [[10,120,200], …] } }
```

可选。deck 出图时穿了哪件真迹装裱 (ArtBlocks 原版脚本铸造, 非商用)。
**图像本体不进契约** — deck.json 是机器契约不是资产包; `id` 可回查
`examples/original-mints/cache/` 复载图像, `palette` 预烘焙供 3D 端直接
re-voice (无像素也能穿上作品的颜色)。`license` 随行是纪律: 消费端出图前
自行核验。2D 端重新打开契约时按 `id` 自动复装 (author-2d open 路径)。

## 4. shared

`deck-io.js` 序列化时把每个 slot 重复携带的 `liftParams.scaffold/slides/
theme` 提升到这里 (15 页 deck 省 ~10×)。**只有需要"再编辑" (重 roll/改写)
的消费者关心它**; 纯渲染/纯移交消费者可忽略。反序列化时按引用还原进各
slot 的 liftParams (见 `deserializeDeck`)。

## 5. slots — 载荷本体

```jsonc
{
  "slotIdx": 3,               // 可选 int; 骨架槽位号 (锁页/重烤对位用)
  "slotName": "key-figures",  // 可选 string
  "slotTitle": "关键数字",     // 可选 string (导航/标题条)
  "sceneData": {              // 必填 — 没有它这页不可渲染
    "subjects": [             // 或 "atoms" (同义, 历史别名)
      {
        "type": "kpi-card",   // 必填 string; 2D atom 类型名
        "x": 40, "y": 160, "w": 280, "h": 200,   // 画布 1280×720 坐标
        "args": { "value": "$30.6M", "label": "GAAP Operating Income" }
      }
    ]
  },
  "liftParams": { … },        // 可选; 2D 再编辑所需 (3D 消费者忽略)
  "locked": false             // 可选; 2D 编辑态
}
```

- **未知 atom type 是 warning 不是 error** — 渲染器对未知类型 no-op,
  deck 跨版本保持可播 (校验器可传入消费者自己的 registry 集合做检查)。
- 坐标系: 1280×720, 左上原点。args 内数字字符串遵守 Rule 18-24
  (数字即载荷、衍生值带引用)。
- slot 顺序即播放顺序 (数组序, 不是 slotIdx 序 — 用户可调序)。

## 6. 校验器用法

```js
import { validateDeck } from '…/src/present/deck-spec.js';
const { ok, errors, warnings } = validateDeck(json /* 对象或字符串 */, {
  knownAtomTypes: myRegistrySet, // 可选
});
```

ERROR = 拒收 (结构性不可消费); WARNING = 可继续但请记录。
黄金 fixtures 里 `valid/` 必须全 ok, `invalid/` 每个恰好死于注释标明的
那条 error — 两端把这批 fixtures 钉进各自 CI, 契约漂移死在 CI 里,
不死在联调现场。
