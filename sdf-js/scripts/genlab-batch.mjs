#!/usr/bin/env node
// =============================================================================
// genlab-batch — DIMENSION 2D 物件批量生产线
// -----------------------------------------------------------------------------
// 输入:  examples/genlab/prompts.json   (MVP 存档 prompt 原文, 一字未改)
// 系统:  examples/mvp/system-prompt.md  (MVP 存档 system prompt, 一字未改)
// 输出:  examples/genlab/out/<id>.js    (模型返回的完整 SDF 模块)
//        examples/genlab/out/<id>.txt   (模型的构图说明)
//        examples/genlab/out/_log.json  (用量/耗时台账)
//
// 用法:  node sdf-js/scripts/genlab-batch.mjs [--only id1,id2] [--limit N] [--force]
//        key 读 repo 根 key.txt (与 bake-pdf-lifts 同约定), 或 ANTHROPIC_API_KEY
// =============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(ROOT, 'examples/genlab/out');
mkdirSync(OUT, { recursive: true });

const MODEL = 'claude-opus-5';

let API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  const keyFile = join(ROOT, '..', 'key.txt');
  if (existsSync(keyFile))
    API_KEY = readFileSync(keyFile, 'utf8')
      .trim()
      .replace(/^ANTHROPIC_API_KEY=/, '');
}
if (!API_KEY) {
  console.error('无 key: 设 ANTHROPIC_API_KEY 或放 key.txt 在 repo 根');
  process.exit(1);
}

const systemPrompt = readFileSync(join(ROOT, 'examples/mvp/system-prompt.md'), 'utf8');
const { prompts } = JSON.parse(readFileSync(join(ROOT, 'examples/genlab/prompts.json'), 'utf8'));

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const force = args.includes('--force');

const queue = prompts
  .filter((p) => (only ? only.includes(p.id) : true))
  .filter((p) => force || !existsSync(join(OUT, `${p.id}.js`)))
  .slice(0, limit);

console.log(`队列 ${queue.length} 件 (共 ${prompts.length} 条存档) → ${OUT}`);

async function callAnthropic(userMessage) {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('refusal');
  return { text: data.content.map((b) => b.text ?? '').join(''), usage: data.usage, elapsed };
}

// 模型输出 = ```js 代码块 + 后置构图说明
function splitResponse(text) {
  const m = text.match(/```(?:js|javascript)\n([\s\S]*?)```/);
  if (!m) return { code: null, note: text };
  const note = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  return { code: m[1], note };
}

const log = [];
for (const [i, p] of queue.entries()) {
  process.stdout.write(`[${i + 1}/${queue.length}] ${p.id} … `);
  try {
    const { text, usage, elapsed } = await callAnthropic(p.prompt);
    const { code, note } = splitResponse(text);
    if (!code) throw new Error('响应无代码块');
    writeFileSync(join(OUT, `${p.id}.js`), code);
    writeFileSync(join(OUT, `${p.id}.txt`), `PROMPT: ${p.prompt}\n\n${note}\n`);
    log.push({ id: p.id, ok: true, elapsed: Number(elapsed), usage });
    console.log(
      `OK ${elapsed}s (out ${usage.output_tokens}tok, cache read ${usage.cache_read_input_tokens})`,
    );
  } catch (e) {
    log.push({ id: p.id, ok: false, error: String(e.message).slice(0, 200) });
    console.log(`FAIL: ${e.message}`);
  }
  writeFileSync(join(OUT, '_log.json'), JSON.stringify(log, null, 2));
}

const ok = log.filter((l) => l.ok).length;
console.log(`\n完成: ${ok}/${log.length} 成功`);
