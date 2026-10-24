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
import https from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(ROOT, 'examples/genlab/out');
mkdirSync(OUT, { recursive: true });

const MODEL = 'claude-opus-5';
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 16384);

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

// node:https 裸请求: 24k token 非流式响应首字节可超 5 分钟,
// 会撞 fetch/undici 默认 headersTimeout → 'fetch failed'。裸 https 无此限制。
function postAnthropic(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, text: buf }));
      },
    );
    req.on('error', reject);
    req.setTimeout(1200e3, () => req.destroy(new Error('hard timeout 20min')));
    req.end(payload);
  });
}

async function callAnthropic(userMessage) {
  const t0 = Date.now();
  const res = await postAnthropic({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // claude-opus-5 defaults thinking to ADAPTIVE (unlike opus-4.x, where omitting
    // `thinking` meant no thinking) — max_tokens caps thinking+text combined, so an
    // unset thinking param can silently burn the whole budget on reasoning and leave
    // 0 tokens for the actual code output (observed: stop_reason=max_tokens,
    // thinking_tokens=16384, 0 text). This pipeline only wants code+caption, not
    // chain-of-thought, so disable it explicitly (allowed at effort<=high, which is
    // the default when effort is unset).
    thinking: { type: 'disabled' },
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.status !== 200) throw new Error(`Anthropic ${res.status}: ${res.text.slice(0, 300)}`);
  const data = JSON.parse(res.text);
  if (data.stop_reason === 'refusal') throw new Error('refusal');
  if (process.env.GENLAB_DEBUG_RAW) {
    writeFileSync(
      join(OUT, '_debug_raw.json'),
      JSON.stringify(
        {
          blockTypes: data.content.map((b) => b.type),
          stop_reason: data.stop_reason,
          usage: data.usage,
        },
        null,
        2,
      ),
    );
  }
  return {
    text: data.content.map((b) => b.text ?? '').join(''),
    usage: data.usage,
    elapsed,
    stopReason: data.stop_reason,
    rawLen: res.text.length,
  };
}

// 模型输出 = ```js 代码块 + 后置构图说明
function splitResponse(text) {
  const m = text.match(/```(?:js|javascript)\n([\s\S]*?)```/);
  if (!m) return { code: null, note: text };
  const note = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  return { code: m[1], note };
}

// 累加台账: 分批调用 (--only chunk) 时不覆盖前面批次的记录, 按 id 去重取最新一条
const logPath = join(OUT, '_log.json');
let log = [];
if (existsSync(logPath)) {
  try {
    log = JSON.parse(readFileSync(logPath, 'utf8'));
  } catch {
    log = [];
  }
}
for (const [i, p] of queue.entries()) {
  process.stdout.write(`[${i + 1}/${queue.length}] ${p.id} … `);
  let entry;
  try {
    const { text, usage, elapsed, stopReason, rawLen } = await callAnthropic(p.prompt);
    const { code, note } = splitResponse(text);
    if (!code) {
      writeFileSync(join(OUT, `_debug_${p.id}.txt`), text);
      throw new Error(
        `响应无代码块 (${text.length} chars, stop=${stopReason}, raw=${rawLen}B, out=${usage?.output_tokens}tok, 存 _debug_${p.id}.txt)`,
      );
    }
    writeFileSync(join(OUT, `${p.id}.js`), code);
    writeFileSync(join(OUT, `${p.id}.txt`), `PROMPT: ${p.prompt}\n\n${note}\n`);
    entry = { id: p.id, ok: true, elapsed: Number(elapsed), usage };
    console.log(
      `OK ${elapsed}s (out ${usage.output_tokens}tok, cache read ${usage.cache_read_input_tokens})`,
    );
  } catch (e) {
    entry = { id: p.id, ok: false, error: String(e.message).slice(0, 200) };
    console.log(`FAIL: ${e.message}`);
  }
  // 按 id 去重: 同一 id 重跑 (--force / 重试) 用新记录替换旧记录, 其余批次记录保留
  const existingIdx = log.findIndex((l) => l.id === p.id);
  if (existingIdx >= 0) log[existingIdx] = entry;
  else log.push(entry);
  writeFileSync(logPath, JSON.stringify(log, null, 2));
}

const ok = log.filter((l) => l.ok).length;
console.log(`\n完成: ${ok}/${log.length} 成功`);
