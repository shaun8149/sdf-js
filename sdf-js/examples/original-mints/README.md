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
> 铸造管线 (两代): ① browse iframe 会话 (无 WebGL, 适合 2D/setup 同步型);
> ② **playwright + 系统 Chrome (WebGL 1+2 全通, 主力)** — 判稳捕获 +
> 元素级截图 (绕开 preserveDrawingBuffer)。产物命名: `<Lxx>-large.*`
> (长边 1280/1400, 封面全幅) / `<Lxx>-small-0..2.png` (高 240 三变体,
> banner 胶片条 — 小画布让整幅构图进标题栏) / 旧代 `<Lxx>-small.*` 作
> fallback。已知个案: 少数多层纹理/重型作品两代运行器都空白 (manifest
> 标 blocked:runtime)。
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
