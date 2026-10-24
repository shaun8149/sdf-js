#!/usr/bin/env node
// =============================================================================
// genlab-rewrite — DIMENSION 2D 库件重写线 (盲写 + 看图自检两轮)
// -----------------------------------------------------------------------------
// 输入:  examples/genlab/prompts.json        (id → prompt, 一字不改)
//        examples/mvp/system-prompt.md       (生产 system prompt)
//        examples/genlab/rewrite-brief.md    (追加: 输出契约 + 策展负面清单)
// 输出:  examples/genlab/out-v2/<id>.r1.js / .r1.png   第一轮 (盲写, 只给 prompt)
//        examples/genlab/out-v2/<id>.js / .txt / .png  第二轮 (看自己的渲染图改一版)
//        examples/genlab/out-v2/_log.json             用量台账 (按 id 去重)
// 用法:  node sdf-js/scripts/genlab-rewrite.mjs --ids a,b,c [--pilot pilot1.json] [--force]
//        [--model claude-opus-5-5] [--rounds 2] [--size 600]
//        key 读 repo 根 key.txt 或 ANTHROPIC_API_KEY
// =============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import https from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderModule } from './genlab-render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const GENLAB = join(ROOT, 'examples/genlab');
const OUT = join(GENLAB, 'out-v2');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const MODEL = opt('--model', 'claude-opus-5-5');
const ROUNDS = Number(opt('--rounds', 2));
const SIZE = Number(opt('--size', 600));
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 32000);
const force = args.includes('--force');

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

const systemPrompt =
  readFileSync(join(ROOT, 'examples/mvp/system-prompt.md'), 'utf8') +
  '\n\n' +
  readFileSync(join(GENLAB, 'rewrite-brief.md'), 'utf8');
const prompts = JSON.parse(readFileSync(join(GENLAB, 'prompts.json'), 'utf8')).prompts;
const byId = Object.fromEntries(prompts.map((p) => [p.id, p]));

let ids = [];
if (args.includes('--ids')) ids = opt('--ids').split(',');
if (args.includes('--pilot')) {
  const pilot = JSON.parse(readFileSync(join(GENLAB, opt('--pilot')), 'utf8'));
  for (const pool of Object.values(pilot.picked)) for (const p of pool) ids.push(p.id);
}
ids = ids.filter((id) => byId[id] || console.log(`跳过 ${id}: prompts.json 无此 id`));
const queue = ids.filter((id) => force || !existsSync(join(OUT, `${id}.js`)));
console.log(`队列 ${queue.length} 件 → ${OUT}  (model ${MODEL}, rounds ${ROUNDS})`);

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

async function call(messages, attempt = 1) {
  const t0 = Date.now();
  let res;
  try {
    res = await postAnthropic({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages,
    });
  } catch (e) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 30e3 * attempt));
      return call(messages, attempt + 1);
    }
    throw e;
  }
  const elapsed = Number(((Date.now() - t0) / 1000).toFixed(1));
  // 限流 / 过载 / 5xx: 等 30s×n 重试最多 3 次
  if ([429, 500, 502, 503, 529].includes(res.status) && attempt < 4) {
    process.stdout.write(`(${res.status} retry ${attempt}) `);
    await new Promise((r) => setTimeout(r, 30e3 * attempt));
    return call(messages, attempt + 1);
  }
  if (res.status !== 200) throw new Error(`Anthropic ${res.status}: ${res.text.slice(0, 300)}`);
  const data = JSON.parse(res.text);
  if (data.stop_reason === 'refusal') throw new Error('refusal');
  return {
    text: data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(''),
    usage: data.usage,
    elapsed,
    stopReason: data.stop_reason,
  };
}

// 模型输出 = ```js 代码块 + 构图说明
function splitResponse(text) {
  const m = text.match(/```(?:js|javascript)\n([\s\S]*?)```/);
  if (!m) return { code: null, note: text };
  return { code: m[1], note: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim() };
}

const REVIEW_ASK = `Here is the render of the module you just wrote (600×600, same renderer the collection uses).
Look at it as the art director of an editorial illustration series. In 5-10 short lines, list what is
wrong or weak: recognizability of the subject, silhouette strength, proportions, composition balance,
palette harmony, detail restraint, anything that reads as a geometry mistake (parts floating, overlaps,
clipped shapes). Then output the complete revised module in one \`\`\`js block (full file, not a diff),
followed by a one-paragraph composition note. If the piece is already right, keep it and say so, but still
output the full module.`;

const logPath = join(OUT, opt('--log', '_log.json'));
let log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : [];
const record = (entry) => {
  const i = log.findIndex((l) => l.id === entry.id);
  if (i >= 0) log[i] = entry;
  else log.push(entry);
  writeFileSync(logPath, JSON.stringify(log, null, 2));
};

for (const [i, id] of queue.entries()) {
  const p = byId[id];
  process.stdout.write(`[${i + 1}/${queue.length}] ${id} … `);
  const entry = { id, model: MODEL, rounds: [] };
  try {
    // 第一轮: 盲写
    const messages = [{ role: 'user', content: p.prompt }];
    const r1 = await call(messages);
    const s1 = splitResponse(r1.text);
    if (!s1.code) {
      writeFileSync(join(OUT, `_debug_${id}.r1.txt`), r1.text);
      throw new Error(`r1 无代码块 (stop=${r1.stopReason})`);
    }
    writeFileSync(join(OUT, `${id}.r1.js`), s1.code);
    writeFileSync(join(OUT, `${id}.r1.txt`), `PROMPT: ${p.prompt}\n\n${s1.note}\n`);
    entry.rounds.push({ round: 1, elapsed: r1.elapsed, usage: r1.usage, stop: r1.stopReason });
    let png;
    try {
      png = await renderModule(join(OUT, `${id}.r1.js`), join(OUT, `${id}.r1.png`), SIZE);
    } catch (e) {
      entry.rounds[0].renderError = String(e.message).slice(0, 200);
    }
    process.stdout.write(
      `r1 ${r1.elapsed}s/${r1.usage.output_tokens}tok${png ? '' : ' (render FAIL)'} `,
    );

    let finalCode = s1.code,
      finalNote = s1.note;
    if (ROUNDS >= 2) {
      // 第二轮: 看自己的渲染图 (渲染失败时把错误信息给它)
      const content = png
        ? [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') },
            },
            { type: 'text', text: REVIEW_ASK },
          ]
        : [
            {
              type: 'text',
              text: `Your module failed to run: ${entry.rounds[0].renderError}\nFix it and output the complete module in one \`\`\`js block, then a short note.`,
            },
          ];
      messages.push({ role: 'assistant', content: r1.text }, { role: 'user', content });
      const r2 = await call(messages);
      const s2 = splitResponse(r2.text);
      entry.rounds.push({ round: 2, elapsed: r2.elapsed, usage: r2.usage, stop: r2.stopReason });
      if (s2.code) {
        finalCode = s2.code;
        finalNote = s2.note;
      } else {
        writeFileSync(join(OUT, `_debug_${id}.r2.txt`), r2.text);
        entry.rounds[1].noCode = true;
      }
      process.stdout.write(`r2 ${r2.elapsed}s/${r2.usage.output_tokens}tok `);
    }
    writeFileSync(join(OUT, `${id}.js`), finalCode);
    writeFileSync(join(OUT, `${id}.txt`), `PROMPT: ${p.prompt}\n\n${finalNote}\n`);
    try {
      await renderModule(join(OUT, `${id}.js`), join(OUT, `${id}.png`), SIZE);
      entry.ok = true;
      console.log('OK');
    } catch (e) {
      // 终稿跑不起来: 把错误交回去修一轮 (只修代码, 不改构图)
      process.stdout.write(`final render FAIL (${String(e.message).slice(0, 60)}) → fix round `);
      try {
        messages.push(
          {
            role: 'assistant',
            content: finalCode ? '```js\n' + finalCode + '\n```\n' + finalNote : '',
          },
          {
            role: 'user',
            content: `Your revised module throws when run: ${String(e.message).slice(0, 300)}\nFix the code without changing the composition and output the complete module in one \`\`\`js block.`,
          },
        );
        const r3 = await call(messages);
        const s3 = splitResponse(r3.text);
        entry.rounds.push({
          round: 3,
          elapsed: r3.elapsed,
          usage: r3.usage,
          stop: r3.stopReason,
          fix: true,
        });
        if (!s3.code) throw new Error('fix round 无代码块');
        writeFileSync(join(OUT, `${id}.js`), s3.code);
        await renderModule(join(OUT, `${id}.js`), join(OUT, `${id}.png`), SIZE);
        entry.ok = true;
        console.log('OK');
      } catch (e3) {
        entry.ok = false;
        entry.error = 'final render: ' + String(e3.message).slice(0, 200);
        console.log(`FAIL: ${e3.message}`);
      }
    }
  } catch (e) {
    entry.ok = false;
    entry.error = String(e.message).slice(0, 300);
    console.log(`FAIL: ${e.message}`);
  }
  record(entry);
}
console.log(`\n完成: ${log.filter((l) => l.ok).length}/${log.length} 成功`);
