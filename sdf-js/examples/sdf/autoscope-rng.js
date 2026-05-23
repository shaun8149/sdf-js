// =============================================================================
// autoscope-rng —— SFC32 PRNG + URL hash helpers
// -----------------------------------------------------------------------------
// 用户提供的代码（2026-05-16），改成无 global state 的 module。
// 让 autoscope-clone "New scene" 按钮可以反复 new Random(newHash) 重生成。
//
// 用法：
//   import { Random, generateHash, readHashFromURL, writeHashToURL } from './autoscope-rng.js';
//   const hash = readHashFromURL() || generateHash();
//   const rng = new Random(hash);
//   rng.random_int(15, 30);
//   rng.random_choice([0,0,1,2]);
//
// URL 格式：`?hash=0x...` 或 `?payload=base64(JSON{hash:"0x..."})`
// 同一 hash 永远生成同一序列 → 可分享 / 可收藏（Autoscope 同款）
// =============================================================================

// Random class moved to src/util/random.js so both renderer-side and
// scene-side (Generator-S) can share. Re-export for existing callers.
export { Random } from '../../src/util/random.js';

// =============================================================================
// URL hash helpers
// =============================================================================

export function generateHash() {
  return '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function readHashFromURL() {
  const params = new URLSearchParams(window.location.search);
  // 优先 payload (base64 encoded JSON, Autoscope 平台 idiom)
  const payload = params.get('payload');
  if (payload) {
    try {
      const parsed = JSON.parse(atob(payload));
      if (parsed.hash) return parsed.hash;
    } catch {}
  }
  // fallback: ?hash=0x...
  return params.get('hash');
}

export function writeHashToURL(hash) {
  const url = new URL(window.location);
  url.searchParams.set('hash', hash);
  // Don't change scene query param if present
  window.history.replaceState(null, '', url);
}

export function isValidHash(hash) {
  return typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash);
}

// =============================================================================
// Split-hash URL helpers (Generator-S × Generator-V cross product)
// -----------------------------------------------------------------------------
// 2026-05-23: 把单 hash 拆成两个独立 hash：sceneHash 控制 Generator-S 输出
// (SDF 场景结构变体)，styleHash 控制 Generator-V 输出 (BOB GPU palette / chess /
// 渲染参数)。两者 orthogonal → 笛卡尔积变体空间。
//
// Backwards compat: 老的 ?hash= 自动 fallback 当 sceneHash 用，styleHash 现 random
// 派生（避免老链接出来全黑）。
// =============================================================================

export function readSceneHashFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('sceneHash') || params.get('hash') || null;
}

export function readStyleHashFromURL() {
  return new URLSearchParams(window.location.search).get('styleHash') || null;
}

export function writeSplitHashToURL(sceneHash, styleHash) {
  const url = new URL(window.location);
  url.searchParams.set('sceneHash', sceneHash);
  url.searchParams.set('styleHash', styleHash);
  url.searchParams.delete('hash');  // remove legacy single-hash param
  window.history.replaceState(null, '', url);
}
