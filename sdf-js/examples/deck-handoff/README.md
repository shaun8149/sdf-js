# deck-handoff — 3D 端 e2e 的契约 fixtures 与弹药包

给 3D 端 e2e 测试的一站式输入。契约全文: [`docs/atlas-deck-contract.md`](../../../docs/atlas-deck-contract.md);
可执行校验器: [`sdf-js/src/present/deck-spec.js`](../../src/present/deck-spec.js) (零依赖, 直接 import)。

## 目录

- **`ammo/`** — 15 个真实 atlas-deck (eval 语料转换而来): 中文新闻 / 英文长文 /
  真季报 (financial-summary 骨架) / 真融资稿 (investor-update 骨架) / QBR /
  VC pitch / SWOT / 课程 / 非营利年报…… 6-14 页不等, twin 覆盖率 100%,
  全部通过五轴 eval。**这就是 2D 端真实产出的分布, 直接当 e2e 输入。**
- **`valid/`** — 5 个边界 fixture, 校验器必须全 ok:
  minimal (最小可行) / cjk-atoms-alias (中文 + `atoms` 历史别名) /
  decor-identity (完整修饰身份, 3D 可整体忽略但须保真回传) /
  empty-deck (零页 = warning 非 error) / unknown-atom-forward-compat
  (未知 atom type = warning, 渲染器 no-op — 前向兼容契约)
- **`invalid/`** — 8 个反例, 每个恰好死于文件名标明的那条 error。
  **把 valid+invalid 钉进你们的 CI**: 契约漂移死在 CI 里, 不死在联调现场。

## 重新生成

```bash
node sdf-js/scripts/manifest-to-deck.mjs --ammo      # 从 eval 语料重烤 ammo/
node sdf-js/scripts/manifest-to-deck.mjs <烤炉目录>   # 任意 bake manifest 转 atlas-deck
```

## 消费要点 (细节见契约文档)

1. `slots[]` 数组序即播放序; 每 slot 的 `sceneData.subjects[]` 是 1280×720
   坐标系上的 2D atoms — 3D lift 的输入。
2. `decor` / `shared` / `liftParams` 都可忽略 (2D 端内部状态), 但 `decor`
   如果回传必须逐字段保真 (作品身份)。
3. 未知 atom type 请 no-op + log, 不要拒收整个 deck。
