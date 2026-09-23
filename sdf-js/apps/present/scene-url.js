// URL-sourced scene identifiers must stay inside the shared scenes/ tree.
// Scene/deck ids in this repo use slug characters only; reject path separators,
// dots, and encoded traversal before constructing a fetch URL.
const ID_RE = /^[A-Za-z0-9_-]+$/;
const FILE_RE = /^[A-Za-z0-9_-]+\.json$/;

function assertSlug(value, label) {
  if (!ID_RE.test(value || '')) {
    throw new Error(`${label} id contains unsupported characters`);
  }
  return value;
}

export function sceneJsonPath(id, label = 'scene') {
  return `../../scenes/${assertSlug(id, label)}.json`;
}

export function irJsonPath(id, label = 'ir') {
  return `../../scenes/ir/${assertSlug(id, label)}.json`;
}

export function sceneFilePath(file) {
  if (!FILE_RE.test(file || '')) {
    throw new Error('scene file contains unsupported characters');
  }
  return `../../scenes/${file}`;
}
