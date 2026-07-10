// test-beats.mjs — beat derivation: tagged shots → hold boundaries.
import { deriveBeats } from '../src/scene/beats.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== beats (deriveBeats) ===\n');

// hand-built sequence: 2 stations, station 0 has a super, then a finale
const seq = {
  shots: [
    { duration: 1.0 },                                   // establishing (untagged)
    { duration: 0.5, beat: 'super', station: 0 },        // punch-in
    { duration: 1.5, beat: 'station', station: 0 },      // station 0 payoff
    { duration: 1.2 },                                   // transit (untagged)
    { duration: 2.0, beat: 'station', station: 1 },      // station 1 payoff
    { duration: 3.0, beat: 'finale' },                   // pull-back
  ],
};
const beats = deriveBeats(seq);
ok(beats.length === 4, '4 beats (super, station0, station1, finale)');
ok(beats.map((b) => b.kind).join(',') === 'super,station,station,finale', 'kinds in timeline order');
ok(Math.abs(beats[0].t - 1.5) < 1e-9, 'super boundary at end of its shot (1.0+0.5)');
ok(Math.abs(beats[1].t - 3.0) < 1e-9, 'station0 boundary includes untagged lead-in');
ok(Math.abs(beats[3].t - 9.2) < 1e-9, 'finale boundary = total duration');
ok(beats[0].station === 0 && beats[2].station === 1, 'station attribution carried');

// untagged sequence → one beat spanning everything (fallback)
const plain = deriveBeats({ shots: [{ duration: 2 }, { duration: 3 }] });
ok(plain.length === 1 && Math.abs(plain[0].t - 5) < 1e-9 && plain[0].kind === 'finale', 'untagged → single full-span beat');

// real chain: staged deck emits tagged shots → beats derivable
const funnelIR = { structure: 'sequence', nodes: ['A', 'B', 'C'], magnitude: [9, 4, 1], emphasis: [2], title: 'F' };
const orgIR = { structure: 'hierarchy', nodes: ['R', 'X', 'Y'], relations: [[0, 1], [0, 2]], title: 'O' };
const deck = assembleDeck({ title: 't', slides: [funnelIR, orgIR] }, { stage: true });
const db = deriveBeats(deck.cameraSequence);
ok(db.length >= 3, `deck yields ≥3 beats (got ${db.length})`);
ok(db.some((b) => b.kind === 'super'), 'deck has a super beat (emphasis)');
ok(db[db.length - 1].kind === 'finale', 'deck ends on the finale beat');
ok(db.every((b, i) => i === 0 || b.t > db[i - 1].t), 'boundaries strictly increasing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
