// =============================================================================
// chapter-layout.mjs — shared chapter spatial layouts for deck authoring.
// A "chapter" places its light slide-stations in 3D and frames a touring camera.
// Used by gen-deck-layouts.mjs (showcase) + gen-deck-authored.mjs (real decks).
//
//   layout(kind, n, ty)        → per-station { pos:[x,y,z], cam:{ pos, target } }
//   pickLayout(n)              → auto-choose linear/arc/grid by station count
//   buildChapter(stations, …)  → { subjects, shots } ready for a SceneData
//
// Studio camera is at −z looking +z; light atoms are orientation-agnostic so
// every layout frames each station from its −z front.
// =============================================================================

// per-station placement + camera framing for a layout of n stations
export function layout(kind, n, ty) {
  const out = [];
  if (kind === 'linear') {
    const GAP = 6;
    for (let i = 0; i < n; i++) {
      const x = i * GAP;
      out.push({ pos: [x, 0, 0], cam: { pos: [x - 1.2, ty + 1.6, -7], target: [x, ty, 0] } });
    }
  } else if (kind === 'arc') {
    const R = 7,
      spread = 1.15; // ~66° each side
    for (let i = 0; i < n; i++) {
      const a = n > 1 ? -spread + (2 * spread * i) / (n - 1) : 0;
      const px = R * Math.sin(a),
        pz = R * Math.cos(a) - R; // fan that bulges toward −z at the ends
      const d = 6.5;
      out.push({
        pos: [px, 0, pz],
        cam: { pos: [px * 0.5, ty + 1.6, pz - d], target: [px, ty, pz] },
      });
    }
  } else {
    // grid
    const cols = Math.ceil(Math.sqrt(n)),
      GX = 6,
      GZ = 6;
    for (let i = 0; i < n; i++) {
      const c = i % cols,
        r = Math.floor(i / cols);
      const px = (c - (cols - 1) / 2) * GX,
        pz = r * GZ;
      out.push({ pos: [px, 0, pz], cam: { pos: [px, ty + 1.9, pz - 7], target: [px, ty, pz] } });
    }
  }
  return out;
}

// auto-choose a layout by station count: 1 → linear, 2-3 → arc (a nice fan),
// 4+ → grid (a single row past 3 reads as a wall; grid stays legible).
export function pickLayout(n) {
  if (n <= 1) return 'linear';
  if (n <= 3) return 'arc';
  return 'grid';
}

// Build a chapter's flattened subjects + touring cameraSequence shots.
// stations: [{ subjects:[…], cx, cy, cz, title? }]  (cx/cy/cz = the station's own
// centre; each station's subjects are recentred to its layout position; title =
// the per-station caption text — provenance, e.g. the source slide's name).
// idPrefix: globally-unique subject id prefix.
// Returns { subjects, shots, stationTitles:[{ t, title }] } where t = the time
// (seconds, from the sequence start) at which the camera begins moving to that
// station — the Layer-2 deck player switches the caption main line at each t.
const TRAVEL = 2.4,
  DWELL = 1.6;
export function buildChapter(stations, kind, ty, idPrefix) {
  const places = layout(kind, stations.length, ty);
  const subjects = [];
  const shots = [];
  const stationTitles = [];
  let t = 0;
  stations.forEach((st, i) => {
    const { pos, cam } = places[i];
    const cx = st.cx ?? 0,
      cz = st.cz ?? 0;
    st.subjects.forEach((s, j) => {
      const tr = s.transform?.translate || [0, 0, 0];
      // recentre the station horizontally (x,z) to its layout position; keep y
      // (natural height above the ground — never recentre vertically).
      subjects.push({
        id: `${idPrefix}${i}_${j}`,
        ...s,
        transform: {
          ...s.transform,
          translate: [tr[0] - cx + pos[0], tr[1] + pos[1], tr[2] - cz + pos[2]],
        },
      });
    });
    if (st.title) stationTitles.push({ t: Math.round(t * 100) / 100, title: st.title });
    const fr = { pos: cam.pos, target: cam.target, fov: 33, ease: 'smooth' };
    shots.push({ duration: TRAVEL, ...fr, transition: i === 0 ? 'cut' : 'blend' });
    shots.push({ duration: DWELL, ...fr, transition: 'blend' });
    t += TRAVEL + DWELL;
  });
  return { subjects, shots, stationTitles };
}
