# original-mints — 链上原版脚本的非商用运行产物缓存

> **性质**: 本目录缓存 *运行 ArtBlocks 链上原始脚本* 得到的作品图片 (mint),
> 供 Atlas Present 的演示 deck 作 `decorArt` / `decorArtStrip` 素材。
> 原始脚本 **不进 repo** — 运行时从 ArtBlocks 公开 GraphQL
> (`data.artblocks.io`) 拉取, 在浏览器 iframe 里逐字执行 (p5@1.0.0 /
> p5@1.9.0 / 原生 js), tokenData.hash 固定 → 同 hash 永久复现。
>
> **License**: 各项目 license 见 `cache/manifest.json` (CC BY-NC 为主,
> 含 ND/SA/NFT License 个例)。仅限**非商用**演示; 任何商用前须逐项目
> 重新核对 license。ND 项目注意: 裁切/平铺可能构成改编, 使用完整原图。
>
> 铸造管线: 每项目独立 iframe 会话 (防动画泄漏), 双尺寸 —
> `<Lxx>-small.*` (高 240, banner 平铺用 — 小画布让整幅构图进标题栏) /
> `<Lxx>-large.*` (长边 1280/1400, 封面全幅用)。svg 型走 XMLSerializer
> 栅格化 fallback。
>
> `cache/` 整目录 gitignore (产物不入库, 本地重铸即得)。

## 用法

```js
const strip = await Promise.all([...])   // 小画布 mints
await renderSceneDataToCanvas(canvas, sceneData, {
  palette, decorRole,
  decorArt: bigMint,        // 封面全幅
  decorArtStrip: strip,     // banner 小画布平铺 (胶片条)
});
```
