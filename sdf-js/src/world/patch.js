// =============================================================================
// world/patch.js — structural copy along a dotted path (M7 §1.3)
//
// applyPatches(world, patches) returns a new world object. Objects/arrays along
// the path are shallow-copied; siblings off the path are referentially shared
// with the input. Last write wins within a single call.
//
// path syntax: "params.rocket.vel.1" — numeric segments index arrays.
//
// Missing intermediates are created as plain objects (this is what lets a rule
// write to `params.newSubject.vel.1` without the runtime knowing about it
// ahead of time).
// =============================================================================

function setPath(node, keys, i, value) {
  if (i === keys.length) return value;
  const head = keys[i];

  if (Array.isArray(node)) {
    const idx = +head;
    const next = node.slice();
    next[idx] = setPath(node[idx], keys, i + 1, value);
    return next;
  }

  if (node == null || typeof node !== 'object') {
    // Create missing path. Decide array vs object by whether the *next* key
    // is numeric — if so, the container we're about to make should be an array.
    const isArrayChild = /^\d+$/.test(head);
    const created = isArrayChild ? [] : {};
    if (isArrayChild) {
      created[+head] = setPath(undefined, keys, i + 1, value);
    } else {
      created[head] = setPath(undefined, keys, i + 1, value);
    }
    return created;
  }

  return { ...node, [head]: setPath(node[head], keys, i + 1, value) };
}

export function applyPatch(world, patch) {
  if (!patch || typeof patch.path !== 'string') {
    throw new Error('patch.path must be a string');
  }
  return setPath(world, patch.path.split('.'), 0, patch.value);
}

export function applyPatches(world, patches) {
  if (!patches || patches.length === 0) return world;
  let next = world;
  for (let i = 0; i < patches.length; i++) {
    next = applyPatch(next, patches[i]);
  }
  return next;
}

// Read-only path access, mirror of applyPatch. Returns undefined for missing keys.
export function getPath(world, path) {
  const keys = path.split('.');
  let node = world;
  for (let i = 0; i < keys.length; i++) {
    if (node == null) return undefined;
    node = node[keys[i]];
  }
  return node;
}
