import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const finalPath = (outDir, id, ext) => join(outDir, `${id}.${ext}`);

export function hasCompleteRewriteOutput(outDir, id) {
  return existsSync(finalPath(outDir, id, 'js')) && existsSync(finalPath(outDir, id, 'png'));
}

function cleanup(path) {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {}
}

function atomicWriteFile(path, data) {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

export async function commitFinalRewrite({ outDir, id, code, note, prompt, size, renderModule }) {
  const stamp = `${process.pid}-${Date.now()}`;
  const candidate = join(outDir, `_${id}.candidate-${stamp}.js`);
  const candidatePng = join(outDir, `_${id}.candidate-${stamp}.png`);
  const finalPng = finalPath(outDir, id, 'png');

  writeFileSync(candidate, code);
  try {
    await renderModule(candidate, candidatePng, size);
    atomicWriteFile(finalPath(outDir, id, 'js'), code);
    atomicWriteFile(finalPath(outDir, id, 'txt'), `PROMPT: ${prompt}\n\n${note}\n`);
    renameSync(candidatePng, finalPng);
  } finally {
    cleanup(candidate);
    cleanup(candidatePng);
  }
}
