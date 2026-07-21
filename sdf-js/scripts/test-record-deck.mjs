// sdf-js/scripts/test-record-deck.mjs — recording-gate script guardrails.
import { readFileSync } from 'node:fs';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== record-deck guardrails ===\n');

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const src = readFileSync(new URL('./record-deck.mjs', import.meta.url), 'utf8');

ok(!!pkg.devDependencies?.['ffmpeg-static'], 'ffmpeg-static is declared for clean installs');

const loadIdx = src.indexOf('const ffmpeg = await loadFfmpeg();');
const captureIdx = src.indexOf("await cdp.send('Page.startScreencast'");
ok(
  loadIdx >= 0 && captureIdx >= 0 && loadIdx < captureIdx,
  'ffmpeg dependency is checked before capture',
);

ok(
  src.includes("await Promise.race([page.waitForSelector('#loading.done'") &&
    src.includes('pageReadyFailed'),
  'shader warm-up wait fails fast on page errors',
);
ok(
  src.includes('window.__figStudio?.setSequenceTime?.(0);') &&
    src.indexOf('setSequenceTime?.(0)') < captureIdx,
  'deck clock resets to t=0 before screencast starts',
);
ok(
  !src.includes("const ffmpeg = (await import('ffmpeg-static')).default;"),
  'ffmpeg is not imported after capture',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
