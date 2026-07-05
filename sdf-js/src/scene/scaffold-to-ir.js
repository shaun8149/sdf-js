// sdf-js/src/scene/scaffold-to-ir.js
// Input adapter: a 2D scaffold slot with a funnel → sequence IR. Reads data only,
// never x/y/w/h — that's what lets a text→IR adapter slot in later unchanged.
export function funnelSlotToIR(sceneData) {
  const f = (sceneData.subjects || []).find((s) => s.type === 'funnel');
  if (!f) throw new Error('funnelSlotToIR: no funnel subject in slot');
  const stages = Array.isArray(f.args?.stages) ? f.args.stages : [];
  return {
    structure: 'sequence',
    nodes: stages.map((s) => (typeof s === 'string' ? s : s.label || '')),
    magnitude: stages.map((s) => Number(s?.value) || 0),
    emphasis: [Math.max(0, stages.length - 1)],
    order: stages.map((_, i) => i),
    title: f.args?.title || '',
  };
}
