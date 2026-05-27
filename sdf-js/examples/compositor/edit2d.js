// =============================================================================
// edit2d.js — Atlas 2D Editor (M3) integrated as a Compositor mode
// -----------------------------------------------------------------------------
// Pencil-style 2D scene editor. Mounted by compositor.js when the
// "2D Edit" tab activates.
//
// Architecture:
//   - State: 2D-SceneData JSON (canvas + layers + shapes)
//   - Three mutation modalities (NONE require user-written code):
//     (1) Toolbar tool + viewport click-drag → adds shape
//     (2) Drag handles on selected shape (Day 2+)
//     (3) LLM chat → JSON-Patch on state (Day 4+)
//
// init({ sidebarEl, viewportEl }) mounts UI into the two containers.
// destroy() tears down for tab switch.
// =============================================================================

// ---------------------------------------------------------------------------
// 2D-SceneData v1
// ---------------------------------------------------------------------------
const DEFAULT_CANVAS = { width: 1024, height: 1024, background: [240, 235, 225] };
const DEFAULT_LAYER  = { id: 'L1', name: 'Layer 1', visible: true, opacity: 1.0 };
const DEFAULT_FILL   = [205, 95, 87];

const API_KEY_STORAGE = 'atlas-anthropic-key';
const DEFAULT_MODEL   = 'claude-sonnet-4-5';
const EDIT_PROMPT_URL = './edit-2d-prompt.md';
let _editSystemPrompt = null;

let _instance = null;  // Module-level singleton (one editor per page)

export function init({ sidebarEl, viewportEl }) {
  if (_instance) destroy();
  _instance = new Editor2D(sidebarEl, viewportEl);
  return _instance;
}

export function destroy() {
  if (_instance) {
    _instance.teardown();
    _instance = null;
  }
}

export function getInstance() { return _instance; }

// ---------------------------------------------------------------------------
class Editor2D {
  constructor(sidebarEl, viewportEl) {
    this.sidebarEl = sidebarEl;
    this.viewportEl = viewportEl;
    this.nextShapeId = 1;
    this.nextLayerSeq = 2;
    this.state = {
      canvas: { ...DEFAULT_CANVAS },
      layers: [ { ...DEFAULT_LAYER } ],
      shapes: [],
      activeLayerId: 'L1',
      selectedShapeIds: [],
      tool: 'select',
    };
    this.dragState = null;
    this.onResize = () => this.fitCanvas();
    this.chatHistory = [];   // [{ role: 'user'|'assistant'|'system', text }]
    this.undoStack   = [];   // stack of prior `state.shapes` snapshots (Day 5 will do deeper)
    this.buildUI();
    this.wireEvents();
    this.fitCanvas();
    this.render();
    this.renderLayers();
    this.wireChat();
    window.addEventListener('resize', this.onResize);
  }

  // -------------------------------------------------------------------------
  // UI scaffolding (creates DOM inside the two passed containers)
  // -------------------------------------------------------------------------
  buildUI() {
    this.sidebarEl.innerHTML = `
      <div class="e2d-sidebar-brand">
        <span class="text">Atlas</span><span class="sub">2D Editor</span>
      </div>
      <div class="e2d-subtabs">
        <button class="subtab active" data-tab="agent">Agent</button>
        <button class="subtab" data-tab="layers">Layers</button>
        <button class="subtab" data-tab="inspector">Inspector</button>
      </div>

      <div class="e2d-panel active" data-panel="agent">
        <div class="e2d-chat-history" data-role="chat-history">
          <div class="placeholder">Describe your edit in natural language.<br>e.g. "make all circles 50% bigger" / "change the red rectangle to blue" / "add a green star top-left"</div>
        </div>
        <div class="e2d-chat-input-wrap">
          <textarea class="e2d-chat-input" data-role="chat-input" rows="2" placeholder="Describe the change…"></textarea>
          <div class="e2d-chat-actions">
            <span class="model">Claude Sonnet 4.5</span>
            <button class="send" data-role="chat-send">Send ↑</button>
          </div>
        </div>
      </div>

      <div class="e2d-panel" data-panel="layers">
        <div class="e2d-panel-body">
          <div class="e2d-panel-row">
            <span>Layers</span>
            <button class="add-btn" data-action="add-layer" title="Add layer">+</button>
          </div>
          <div data-role="layers-list"></div>
        </div>
      </div>

      <div class="e2d-panel" data-panel="inspector">
        <div class="e2d-panel-body" data-role="inspector">
          <div class="e2d-inspector-empty">Select a shape on the canvas to inspect.</div>
        </div>
      </div>
    `;

    // IMPORTANT: viewportEl is compositor's #render-area, which contains the
    // shared #canvas-wrap with #c / #c-gpu / etc. We must NOT replace its
    // innerHTML — that destroys the global canvases used by FLY 3D / BOB GPU
    // / silhouette / etc. across the rest of compositor. Instead we APPEND
    // our editor UI as a SIBLING container, and teardown removes only that.
    // CSS body.editmode-2d hides #canvas-wrap while editor is active.
    this.viewportRoot = document.createElement('div');
    this.viewportRoot.dataset.editorRoot = '2d';
    this.viewportRoot.style.cssText = 'position:absolute; inset:0; z-index: 5;';
    this.viewportRoot.innerHTML = `
      <div class="e2d-tools" data-role="tools">
        <button class="e2d-tool active" data-tool="select">
          <svg viewBox="0 0 24 24"><path d="M5 3 L5 17 L9 13 L11 18 L13 17 L11 12 L17 12 Z"/></svg>
          <span class="tip">Select (V)</span>
        </button>
        <div class="e2d-tool-divider"></div>
        <button class="e2d-tool" data-tool="rectangle">
          <svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>
          <span class="tip">Rectangle (R)</span>
        </button>
        <button class="e2d-tool" data-tool="circle">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>
          <span class="tip">Circle (C)</span>
        </button>
        <button class="e2d-tool" data-tool="polygon">
          <svg viewBox="0 0 24 24"><polygon points="12,3 21,9 18,20 6,20 3,9"/></svg>
          <span class="tip">Polygon (P)</span>
        </button>
        <button class="e2d-tool" data-tool="star">
          <svg viewBox="0 0 24 24"><polygon points="12,3 14,9 21,9 16,13 18,20 12,16 6,20 8,13 3,9 10,9"/></svg>
          <span class="tip">Star (S)</span>
        </button>
        <button class="e2d-tool" data-tool="line">
          <svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4"/></svg>
          <span class="tip">Line (L)</span>
        </button>
      </div>

      <div class="e2d-viewport-wrap">
        <canvas class="e2d-canvas" data-role="canvas" width="1024" height="1024"></canvas>
        <div class="e2d-overlay" data-role="overlay"></div>
      </div>

      <div class="e2d-indicator e2d-shape-count" data-role="shape-count">0 shapes</div>
      <div class="e2d-indicator e2d-zoom">100%</div>
    `;
    this.viewportEl.appendChild(this.viewportRoot);

    // Cache element refs (scoped to our viewportRoot, not the whole #render-area)
    this.$canvas      = this.viewportRoot.querySelector('[data-role=canvas]');
    this.$overlay     = this.viewportRoot.querySelector('[data-role=overlay]');
    this.$shapeCount  = this.viewportRoot.querySelector('[data-role=shape-count]');
    this.$tools       = this.viewportRoot.querySelector('[data-role=tools]');
    this.$layersList  = this.sidebarEl.querySelector('[data-role=layers-list]');
    this.$inspector   = this.sidebarEl.querySelector('[data-role=inspector]');
    this.ctx          = this.$canvas.getContext('2d');
  }

  // -------------------------------------------------------------------------
  // Event wiring
  // -------------------------------------------------------------------------
  wireEvents() {
    // Sidebar tab switcher
    this.sidebarEl.querySelector('.e2d-subtabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.subtab');
      if (!btn) return;
      const target = btn.dataset.tab;
      for (const t of this.sidebarEl.querySelectorAll('.subtab')) {
        t.classList.toggle('active', t.dataset.tab === target);
      }
      for (const p of this.sidebarEl.querySelectorAll('.e2d-panel')) {
        p.classList.toggle('active', p.dataset.panel === target);
      }
    });

    // Toolbar
    this.$tools.addEventListener('click', (e) => {
      const btn = e.target.closest('.e2d-tool');
      if (!btn) return;
      this.setTool(btn.dataset.tool);
    });

    // Keyboard shortcuts (V R C P S L)
    this.onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      const map = { v: 'select', r: 'rectangle', c: 'circle', p: 'polygon', s: 'star', l: 'line' };
      if (map[key]) { this.setTool(map[key]); e.preventDefault(); }
    };
    document.addEventListener('keydown', this.onKeyDown);

    // ---- Canvas pointer interaction ----
    // - tool=select: click → pick / deselect; drag shape → move; drag handle → resize
    // - tool=others: click-drag adds a new shape
    this.$canvas.addEventListener('pointerdown', (e) => {
      const p = this.canvasCoords(e);
      if (this.state.tool === 'select') {
        const shape = this.pickShapeAt(p[0], p[1]);
        const isShift = e.shiftKey;
        if (shape) {
          // Shift-click: toggle this id in selection. Plain click: replace
          // selection (unless clicking an already-selected shape — keep
          // current selection so group drag works).
          if (isShift) {
            const idx = this.state.selectedShapeIds.indexOf(shape.id);
            if (idx >= 0) this.state.selectedShapeIds.splice(idx, 1);
            else          this.state.selectedShapeIds.push(shape.id);
          } else if (!this.state.selectedShapeIds.includes(shape.id)) {
            this.state.selectedShapeIds = [shape.id];
          }
          // Start group move drag (snapshot all selected shapes' translates)
          this.dragState = {
            kind: 'move',
            ids: [...this.state.selectedShapeIds],
            startPointer: p,
            originalTranslates: Object.fromEntries(
              this.state.selectedShapeIds.map(id => {
                const s = this.state.shapes.find(sh => sh.id === id);
                return [id, [...(s?.transform.translate || [0, 0])]];
              })
            ),
          };
          this.$canvas.setPointerCapture(e.pointerId);
        } else {
          if (!isShift) this.state.selectedShapeIds = [];
        }
        this.render();
        this.renderSelectionOverlay();
        this.renderInspector();
        return;
      }
      // Add-shape tool: click-drag spans the new shape
      this.dragState = { kind: 'add', tool: this.state.tool, start: p, current: p };
      this.$canvas.setPointerCapture(e.pointerId);
      this.drawDragPreview();
    });
    this.$canvas.addEventListener('pointermove', (e) => {
      if (!this.dragState) return;
      const p = this.canvasCoords(e);
      if (this.dragState.kind === 'add') {
        this.dragState.current = p;
        this.drawDragPreview();
      } else if (this.dragState.kind === 'move') {
        const dx = p[0] - this.dragState.startPointer[0];
        const dy = p[1] - this.dragState.startPointer[1];
        // Group move: shift every selected shape by the same delta.
        for (const id of this.dragState.ids) {
          const shape = this.state.shapes.find(s => s.id === id);
          if (!shape) continue;
          const orig = this.dragState.originalTranslates[id];
          shape.transform.translate = [orig[0] + dx, orig[1] + dy];
        }
        this.render();
        this.renderSelectionOverlay();
        this.renderInspector();
      } else if (this.dragState.kind === 'resize') {
        this.applyResizeDrag(p);
      }
    });
    this.$canvas.addEventListener('pointerup', () => {
      if (!this.dragState) return;
      if (this.dragState.kind === 'add') {
        const finalShape = this.buildShapeFromDrag(this.dragState);
        if (finalShape) {
          this.state.shapes.push(finalShape);
          this.render();
          this.renderLayers();
        }
      }
      this.dragState = null;
      this.$overlay.querySelector('[data-role=drag-preview]')?.remove();
      this.renderSelectionOverlay();
    });

    // Delete key removes the selected shape(s); only when not typing
    this.onWindowKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.state.selectedShapeIds.length === 0) return;
        const drop = new Set(this.state.selectedShapeIds);
        this.state.shapes = this.state.shapes.filter(s => !drop.has(s.id));
        this.state.selectedShapeIds = [];
        this.render(); this.renderLayers(); this.renderSelectionOverlay(); this.renderInspector();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        this.state.selectedShapeIds = [];
        this.renderSelectionOverlay(); this.renderInspector();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        // Cmd/Ctrl + Z → undo last patch
        this.undoLastPatch();
        e.preventDefault();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === ']' || e.key === '[')) {
        // Z-order: Cmd/Ctrl + ] = bring forward (front of array), + [ = send back.
        if (this.state.selectedShapeIds.length === 0) return;
        const front = (e.key === ']');
        const sel = new Set(this.state.selectedShapeIds);
        const keep = this.state.shapes.filter(s => !sel.has(s.id));
        const moved = this.state.shapes.filter(s => sel.has(s.id));
        this.state.shapes = front ? [...keep, ...moved] : [...moved, ...keep];
        this.render(); this.renderLayers(); this.renderSelectionOverlay();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', this.onWindowKey);
  }

  setTool(tool) {
    this.state.tool = tool;
    for (const btn of this.$tools.querySelectorAll('.e2d-tool')) {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    }
    this.$canvas.style.cursor = (tool === 'select') ? 'default' : 'crosshair';
  }

  canvasCoords(e) {
    const rect = this.$canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.$canvas.width  / rect.width);
    const y = (e.clientY - rect.top)  * (this.$canvas.height / rect.height);
    return [x, y];
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  render() {
    const { width, height, background } = this.state.canvas;
    if (this.$canvas.width !== width)  this.$canvas.width  = width;
    if (this.$canvas.height !== height) this.$canvas.height = height;

    this.ctx.fillStyle = rgbToCss(background);
    this.ctx.fillRect(0, 0, width, height);

    const layerById = new Map(this.state.layers.map(l => [l.id, l]));
    for (const shape of this.state.shapes) {
      const layer = layerById.get(shape.layerId);
      if (layer && !layer.visible) continue;
      this.ctx.save();
      if (layer && layer.opacity !== 1.0) this.ctx.globalAlpha = layer.opacity;
      this.drawShape(shape);
      this.ctx.restore();
    }

    const n = this.state.shapes.length;
    this.$shapeCount.textContent = `${n} shape${n === 1 ? '' : 's'}`;
  }

  drawShape(shape) {
    const ctx = this.ctx;
    const { type, args, transform, fill, stroke } = shape;
    const [tx, ty] = transform.translate || [0, 0];
    const rot      = transform.rotate ?? 0;
    const sc       = transform.scale  ?? 1;

    ctx.translate(tx, ty);
    if (rot) ctx.rotate(rot);
    if (sc !== 1) ctx.scale(sc, sc);

    ctx.fillStyle = rgbToCss(fill);
    if (stroke) {
      ctx.strokeStyle = rgbToCss(stroke.color);
      ctx.lineWidth = stroke.width;
    }

    if (type === 'rectangle') {
      const [w, h] = args.size;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      if (stroke) ctx.strokeRect(-w / 2, -h / 2, w, h);
    } else if (type === 'circle') {
      const r = args.radius;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      if (stroke) ctx.stroke();
    } else if (type === 'polygon') {
      const pts = args.points || [];
      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath(); ctx.fill();
        if (stroke) ctx.stroke();
      }
    } else if (type === 'star') {
      const points = args.points ?? 5;
      const outerR = args.outerR ?? 50;
      const innerR = args.innerR ?? outerR * 0.4;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const r = (i % 2 === 0) ? outerR : innerR;
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      if (stroke) ctx.stroke();
    } else if (type === 'line') {
      const [ax, ay] = args.a, [bx, by] = args.b;
      ctx.strokeStyle = stroke ? rgbToCss(stroke.color) : rgbToCss(fill);
      ctx.lineWidth = stroke ? stroke.width : 4;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
  }

  renderLayers() {
    this.$layersList.innerHTML = '';
    const N = this.state.layers.length;
    for (let i = N - 1; i >= 0; i--) {
      const layer = this.state.layers[i];
      const count = this.state.shapes.filter(s => s.layerId === layer.id).length;
      const row = document.createElement('div');
      row.className = 'e2d-layer-row' + (layer.id === this.state.activeLayerId ? ' active' : '');
      row.dataset.layerId = layer.id;
      row.innerHTML = `
        <span class="eye" data-action="toggle-visible">${layer.visible ? '👁' : '⬚'}</span>
        <span class="name" data-action="select-layer">${escapeHtml(layer.name)}</span>
        <span class="count">${count}</span>
        <span class="row-actions"></span>
      `;
      const actions = row.querySelector('.row-actions');
      actions.innerHTML = `
        <button class="layer-btn" data-action="move-up"   title="Move up"   ${i === N - 1 ? 'disabled' : ''}>▲</button>
        <button class="layer-btn" data-action="move-down" title="Move down" ${i === 0     ? 'disabled' : ''}>▼</button>
        <button class="layer-btn" data-action="delete-layer" title="Delete" ${N === 1 ? 'disabled' : ''}>×</button>
      `;
      // Opacity slider (separate row body underneath, only when active)
      if (layer.id === this.state.activeLayerId) {
        const opacityRow = document.createElement('div');
        opacityRow.className = 'e2d-layer-opacity';
        opacityRow.innerHTML = `
          <span>opacity</span>
          <input type="range" min="0" max="100" value="${Math.round(layer.opacity * 100)}" data-action="opacity">
          <span class="opacity-val">${Math.round(layer.opacity * 100)}%</span>
        `;
        row.appendChild(opacityRow);
      }

      // Click handlers — delegate by action attr
      row.addEventListener('click', (e) => {
        const a = e.target.closest('[data-action]');
        if (!a) return;
        const action = a.dataset.action;
        e.stopPropagation();
        if (action === 'toggle-visible') {
          layer.visible = !layer.visible;
          this.render(); this.renderLayers();
        } else if (action === 'select-layer') {
          this.state.activeLayerId = layer.id;
          this.renderLayers();
        } else if (action === 'move-up') {
          if (i < N - 1) {
            [this.state.layers[i], this.state.layers[i + 1]] = [this.state.layers[i + 1], this.state.layers[i]];
            this.render(); this.renderLayers();
          }
        } else if (action === 'move-down') {
          if (i > 0) {
            [this.state.layers[i], this.state.layers[i - 1]] = [this.state.layers[i - 1], this.state.layers[i]];
            this.render(); this.renderLayers();
          }
        } else if (action === 'delete-layer') {
          if (N === 1) return;
          // Reassign shapes on deleted layer to first remaining
          const fallbackId = (i === 0 ? this.state.layers[1].id : this.state.layers[0].id);
          for (const s of this.state.shapes) {
            if (s.layerId === layer.id) s.layerId = fallbackId;
          }
          this.state.layers.splice(i, 1);
          if (this.state.activeLayerId === layer.id) this.state.activeLayerId = fallbackId;
          this.render(); this.renderLayers();
        }
      });

      // Double-click name to rename
      row.querySelector('.name').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const span = e.target;
        const oldName = layer.name;
        const input = document.createElement('input');
        input.type = 'text'; input.value = oldName;
        input.className = 'layer-name-edit';
        const commit = () => {
          layer.name = input.value.trim() || oldName;
          this.renderLayers();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') input.blur();
          if (ev.key === 'Escape') { input.value = oldName; input.blur(); }
        });
        span.replaceWith(input);
        input.focus(); input.select();
      });

      // Opacity slider live-update
      const opSlider = row.querySelector('input[data-action=opacity]');
      if (opSlider) {
        opSlider.addEventListener('input', (e) => {
          e.stopPropagation();
          layer.opacity = (parseInt(opSlider.value, 10) || 0) / 100;
          row.querySelector('.opacity-val').textContent = Math.round(layer.opacity * 100) + '%';
          this.render();
        });
      }

      this.$layersList.appendChild(row);
    }

    // Wire the + add layer button (panel header)
    const addBtn = this.sidebarEl.querySelector('[data-action=add-layer]');
    if (addBtn && !addBtn.dataset.wired) {
      addBtn.dataset.wired = '1';
      addBtn.addEventListener('click', () => {
        const id = `L${this.nextLayerSeq++}`;
        this.state.layers.push({ id, name: `Layer ${this.nextLayerSeq - 1}`, visible: true, opacity: 1.0 });
        this.state.activeLayerId = id;
        this.renderLayers();
      });
    }
  }

  // -------------------------------------------------------------------------
  // Shape add via drag
  // -------------------------------------------------------------------------
  buildShapeFromDrag({ tool, start, current }) {
    const [sx, sy] = start;
    const [cx, cy] = current;
    const cxMid = (sx + cx) / 2, cyMid = (sy + cy) / 2;
    const w = Math.abs(cx - sx), h = Math.abs(cy - sy);
    if (w < 4 && h < 4) return null;

    const id = `s${this.nextShapeId++}`;
    const common = {
      id,
      transform: { translate: [cxMid, cyMid], rotate: 0, scale: 1 },
      fill: [...DEFAULT_FILL],
      stroke: null,
      layerId: this.state.activeLayerId,
    };

    if (tool === 'rectangle') {
      return { ...common, type: 'rectangle', args: { size: [w || 4, h || 4] } };
    }
    if (tool === 'circle') {
      const r = Math.max(w, h) / 2;
      return { ...common, type: 'circle', args: { radius: Math.max(r, 4) } };
    }
    if (tool === 'star') {
      const outerR = Math.max(w, h) / 2;
      return { ...common, type: 'star',
               args: { points: 5, outerR: Math.max(outerR, 8), innerR: Math.max(outerR, 8) * 0.4 } };
    }
    if (tool === 'polygon') {
      const outerR = Math.max(w, h) / 2;
      const pts = [];
      const sides = 6;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        pts.push([Math.cos(a) * outerR, Math.sin(a) * outerR]);
      }
      return { ...common, type: 'polygon', args: { points: pts } };
    }
    if (tool === 'line') {
      return { ...common, type: 'line',
               args: { a: [sx - cxMid, sy - cyMid], b: [cx - cxMid, cy - cyMid] },
               stroke: { color: [...DEFAULT_FILL], width: 4 } };
    }
    return null;
  }

  drawDragPreview() {
    // Remove only the drag-preview node (keep selection overlay intact)
    this.$overlay.querySelector('[data-role=drag-preview]')?.remove();
    if (!this.dragState || this.dragState.kind !== 'add') return;
    const rect = this.$canvas.getBoundingClientRect();
    const vpRect = this.viewportRoot.getBoundingClientRect();
    const sx = this.dragState.start[0]   * (rect.width  / this.$canvas.width)  + rect.left;
    const sy = this.dragState.start[1]   * (rect.height / this.$canvas.height) + rect.top;
    const cx = this.dragState.current[0] * (rect.width  / this.$canvas.width)  + rect.left;
    const cy = this.dragState.current[1] * (rect.height / this.$canvas.height) + rect.top;
    const left = Math.min(sx, cx) - vpRect.left;
    const top  = Math.min(sy, cy) - vpRect.top;
    const w    = Math.abs(cx - sx);
    const h    = Math.abs(cy - sy);
    const node = document.createElement('div');
    node.dataset.role = 'drag-preview';
    node.style.cssText = `position:absolute; left:${left}px; top:${top}px; width:${w}px; height:${h}px; border: 1px dashed #ffd070; background: rgba(255,208,112,0.08); pointer-events: none;`;
    this.$overlay.appendChild(node);
  }

  // -------------------------------------------------------------------------
  // Layout fitting
  // -------------------------------------------------------------------------
  fitCanvas() {
    const vw = this.viewportRoot.clientWidth - 80;   // leave margin for floating tools
    const vh = this.viewportRoot.clientHeight - 40;
    if (vw <= 0 || vh <= 0) return;
    const aspect = this.state.canvas.width / this.state.canvas.height;
    let w, h;
    if (vw / vh > aspect) { h = vh; w = h * aspect; }
    else                  { w = vw; h = w / aspect; }
    this.$canvas.style.width  = w + 'px';
    this.$canvas.style.height = h + 'px';
  }

  // -------------------------------------------------------------------------
  // Teardown — called on tab switch away from 2d-edit
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Hit testing — uses ctx.isPointInPath after applying the same transform
  // chain as drawShape, but without filling. Layer-aware (skips hidden).
  // -------------------------------------------------------------------------
  pickShapeAt(x, y) {
    const ctx = this.ctx;
    const layerById = new Map(this.state.layers.map(l => [l.id, l]));
    // Walk top-of-stack first (last drawn = visually on top)
    for (let i = this.state.shapes.length - 1; i >= 0; i--) {
      const shape = this.state.shapes[i];
      const layer = layerById.get(shape.layerId);
      if (layer && !layer.visible) continue;
      ctx.save();
      const [tx, ty] = shape.transform.translate || [0, 0];
      const rot = shape.transform.rotate ?? 0;
      const sc  = shape.transform.scale  ?? 1;
      ctx.translate(tx, ty);
      if (rot) ctx.rotate(rot);
      if (sc !== 1) ctx.scale(sc, sc);
      ctx.beginPath();
      this.buildPath(shape);
      let hit = false;
      if (shape.type === 'line') {
        // Line has no fillable region — use isPointInStroke with thick line width
        ctx.lineWidth = (shape.stroke?.width || 4) + 6;  // 6px slop for picking
        hit = ctx.isPointInStroke(x, y);
      } else {
        hit = ctx.isPointInPath(x, y);
      }
      ctx.restore();
      if (hit) return shape;
    }
    return null;
  }

  // Build just the path commands for a shape (no fill/stroke).
  // Caller is responsible for translate/rotate/scale + beginPath().
  buildPath(shape) {
    const ctx = this.ctx;
    const { type, args } = shape;
    if (type === 'rectangle') {
      const [w, h] = args.size;
      ctx.rect(-w / 2, -h / 2, w, h);
    } else if (type === 'circle') {
      ctx.arc(0, 0, args.radius, 0, Math.PI * 2);
    } else if (type === 'polygon') {
      const pts = args.points || [];
      if (pts.length >= 3) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
      }
    } else if (type === 'star') {
      const points = args.points ?? 5;
      const outerR = args.outerR ?? 50;
      const innerR = args.innerR ?? outerR * 0.4;
      for (let i = 0; i < points * 2; i++) {
        const r = (i % 2 === 0) ? outerR : innerR;
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (type === 'line') {
      ctx.moveTo(args.a[0], args.a[1]);
      ctx.lineTo(args.b[0], args.b[1]);
    }
  }

  // -------------------------------------------------------------------------
  // Bbox in CANVAS coordinates (axis-aligned, ignores rotation for Day 2)
  // -------------------------------------------------------------------------
  shapeBboxCanvas(shape) {
    const { type, args, transform } = shape;
    const [tx, ty] = transform.translate || [0, 0];
    const sc = transform.scale ?? 1;
    let halfW = 4, halfH = 4;
    if (type === 'rectangle') {
      halfW = (args.size[0] / 2) * sc;
      halfH = (args.size[1] / 2) * sc;
    } else if (type === 'circle') {
      halfW = halfH = args.radius * sc;
    } else if (type === 'star') {
      halfW = halfH = (args.outerR ?? 50) * sc;
    } else if (type === 'polygon') {
      const pts = args.points || [];
      let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
      for (const [px, py] of pts) {
        if (px < mnX) mnX = px; if (px > mxX) mxX = px;
        if (py < mnY) mnY = py; if (py > mxY) mxY = py;
      }
      if (isFinite(mnX)) {
        halfW = Math.max(Math.abs(mnX), Math.abs(mxX)) * sc;
        halfH = Math.max(Math.abs(mnY), Math.abs(mxY)) * sc;
      }
    } else if (type === 'line') {
      const ax = args.a[0], ay = args.a[1], bx = args.b[0], by = args.b[1];
      halfW = Math.max(Math.abs(ax), Math.abs(bx)) * sc;
      halfH = Math.max(Math.abs(ay), Math.abs(by)) * sc;
    }
    return { x: tx - halfW, y: ty - halfH, w: 2 * halfW, h: 2 * halfH };
  }

  // -------------------------------------------------------------------------
  // Selection overlay: bbox + 8 drag handles, in screen pixels.
  // -------------------------------------------------------------------------
  renderSelectionOverlay() {
    // Remove existing selection overlay nodes (keep drag-preview node intact)
    for (const n of [...this.$overlay.querySelectorAll('[data-role=selection]')]) n.remove();
    if (this.state.selectedShapeIds.length === 0) return;

    const rect   = this.$canvas.getBoundingClientRect();
    const vpRect = this.viewportRoot.getBoundingClientRect();
    const sx = (cx) => (cx * rect.width  / this.$canvas.width)  + rect.left - vpRect.left;
    const sy = (cy) => (cy * rect.height / this.$canvas.height) + rect.top  - vpRect.top;

    const single = this.state.selectedShapeIds.length === 1;
    for (const id of this.state.selectedShapeIds) {
      const shape = this.state.shapes.find(s => s.id === id);
      if (!shape) continue;
      const bb = this.shapeBboxCanvas(shape);
      const x1 = sx(bb.x), y1 = sy(bb.y);
      const x2 = sx(bb.x + bb.w), y2 = sy(bb.y + bb.h);
      const w = x2 - x1, h = y2 - y1;

      // Bounding rectangle (slightly different look for multi-select)
      const box = document.createElement('div');
      box.dataset.role = 'selection';
      const borderStyle = single ? 'solid' : 'dashed';
      box.style.cssText = `position:absolute; left:${x1}px; top:${y1}px; width:${w}px; height:${h}px; border:1px ${borderStyle} #4a9eff; pointer-events: none; box-sizing: border-box;`;
      this.$overlay.appendChild(box);

      if (!single) continue;  // skip handles for multi-select (Day 3 simplification)

      // 8 handles (single selection only)
      const cxMid = (x1 + x2) / 2;
      const cyMid = (y1 + y2) / 2;
      const handles = [
        ['nw', x1,    y1,    'nwse-resize'],
        ['n',  cxMid, y1,    'ns-resize'  ],
        ['ne', x2,    y1,    'nesw-resize'],
        ['e',  x2,    cyMid, 'ew-resize'  ],
        ['se', x2,    y2,    'nwse-resize'],
        ['s',  cxMid, y2,    'ns-resize'  ],
        ['sw', x1,    y2,    'nesw-resize'],
        ['w',  x1,    cyMid, 'ew-resize'  ],
      ];
      for (const [name, hx, hy, cursor] of handles) {
        const hEl = document.createElement('div');
        hEl.dataset.role = 'selection';
        hEl.dataset.handle = name;
        hEl.dataset.shapeId = id;
        hEl.style.cssText = `position:absolute; left:${hx-4}px; top:${hy-4}px; width:8px; height:8px; background:#fff; border:1px solid #4a9eff; pointer-events: auto; cursor: ${cursor}; box-sizing: border-box;`;
        hEl.addEventListener('pointerdown', (e) => this.onHandleDown(e, name, id));
        this.$overlay.appendChild(hEl);
      }
    }
  }

  onHandleDown(e, handle, shapeId) {
    e.stopPropagation();  // don't trigger canvas pointerdown
    const shape = this.state.shapes.find(s => s.id === shapeId);
    if (!shape) return;
    const bb = this.shapeBboxCanvas(shape);
    const startPointer = this.canvasCoords(e);
    this.dragState = {
      kind: 'resize',
      handle, shapeId,
      startBbox: { ...bb },
      startPointer,
      // Snapshot the original args so we can scale from
      originalArgs: JSON.parse(JSON.stringify(shape.args)),
      originalTranslate: [...(shape.transform.translate || [0, 0])],
      originalScale: shape.transform.scale ?? 1,
    };
    e.target.setPointerCapture?.(e.pointerId);
    // After capture, all subsequent pointermove/up go to the canvas listener
    // (we attached them on $canvas). We re-route by listening on the handle:
    const move = (ev) => this.applyResizeDrag(this.canvasCoords(ev));
    const up = () => {
      e.target.releasePointerCapture?.(e.pointerId);
      e.target.removeEventListener('pointermove', move);
      e.target.removeEventListener('pointerup', up);
      this.dragState = null;
      this.renderSelectionOverlay();
    };
    e.target.addEventListener('pointermove', move);
    e.target.addEventListener('pointerup', up);
  }

  applyResizeDrag(p) {
    const ds = this.dragState;
    if (!ds || ds.kind !== 'resize') return;
    const shape = this.state.shapes.find(s => s.id === ds.shapeId);
    if (!shape) return;
    const bb = ds.startBbox;

    // Compute new bbox edges. Anchor opposite edge of dragged handle.
    let left = bb.x, top = bb.y, right = bb.x + bb.w, bottom = bb.y + bb.h;
    if (ds.handle.includes('w')) left   = p[0];
    if (ds.handle.includes('e')) right  = p[0];
    if (ds.handle.includes('n')) top    = p[1];
    if (ds.handle.includes('s')) bottom = p[1];
    // Normalize (handle drag past opposite edge)
    if (right < left)  [left, right] = [right, left];
    if (bottom < top)  [top, bottom] = [bottom, top];
    const newW = Math.max(8, right - left);
    const newH = Math.max(8, bottom - top);
    const cxMid = (left + right) / 2;
    const cyMid = (top + bottom) / 2;

    // Update args based on shape type. Scale stays 1; we adjust args directly
    // for clean numeric inspection. Translate becomes new bbox center.
    shape.transform.translate = [cxMid, cyMid];
    shape.transform.scale = 1;

    if (shape.type === 'rectangle') {
      shape.args.size = [newW, newH];
    } else if (shape.type === 'circle') {
      shape.args.radius = Math.max(4, Math.min(newW, newH) / 2);
    } else if (shape.type === 'star') {
      const outerR = Math.max(8, Math.max(newW, newH) / 2);
      const ratio = shape.args.innerR / (shape.args.outerR || 1);
      shape.args.outerR = outerR;
      shape.args.innerR = outerR * (isFinite(ratio) ? ratio : 0.4);
    } else if (shape.type === 'polygon') {
      // Scale points proportionally to new half-extents
      const origBb = { w: ds.startBbox.w, h: ds.startBbox.h };
      const sxF = newW / Math.max(1, origBb.w);
      const syF = newH / Math.max(1, origBb.h);
      shape.args.points = ds.originalArgs.points.map(([px, py]) => [px * sxF, py * syF]);
    } else if (shape.type === 'line') {
      const origBb = { w: ds.startBbox.w, h: ds.startBbox.h };
      const sxF = newW / Math.max(1, origBb.w);
      const syF = newH / Math.max(1, origBb.h);
      shape.args.a = [ds.originalArgs.a[0] * sxF, ds.originalArgs.a[1] * syF];
      shape.args.b = [ds.originalArgs.b[0] * sxF, ds.originalArgs.b[1] * syF];
    }
    this.render();
    this.renderSelectionOverlay();
    this.renderInspector();
  }

  // -------------------------------------------------------------------------
  // Inspector panel — populated when selection changes
  // -------------------------------------------------------------------------
  renderInspector() {
    const ids = this.state.selectedShapeIds;
    if (ids.length === 0) {
      this.$inspector.innerHTML = `<div class="e2d-inspector-empty">Select a shape on the canvas to inspect.</div>`;
      return;
    }
    if (ids.length > 1) {
      // Multi-select: show count + group fill picker that recolors all selected
      const fills = ids.map(id => this.state.shapes.find(s => s.id === id)?.fill).filter(Boolean);
      const commonFill = fills.every(f => f[0] === fills[0][0] && f[1] === fills[0][1] && f[2] === fills[0][2]) ? fills[0] : [128,128,128];
      this.$inspector.innerHTML = `
        <div class="inspector-section">
          <h4>${ids.length} shapes selected</h4>
          <div style="font-size: 11px; color: #777; margin-bottom: 10px;">
            Drag any to move all. Cmd+] front / Cmd+[ back. Delete to remove.
          </div>
        </div>
        <div class="inspector-section">
          <h4>Group fill</h4>
          <div class="inspector-field"><label>color</label> <input type="color" data-field="group-fill" value="${rgbToHex(commonFill)}"></div>
        </div>
      `;
      this.$inspector.querySelector('input[data-field=group-fill]')?.addEventListener('input', (e) => {
        const rgb = hexToRgb(e.target.value);
        for (const id of ids) {
          const s = this.state.shapes.find(sh => sh.id === id);
          if (s) s.fill = [...rgb];
        }
        this.render();
      });
      return;
    }
    const shape = this.state.shapes.find(s => s.id === ids[0]);
    if (!shape) {
      this.$inspector.innerHTML = `<div class="e2d-inspector-empty">Shape not found.</div>`;
      return;
    }
    const t = shape.transform;
    const tx = (t.translate?.[0] ?? 0).toFixed(1);
    const ty = (t.translate?.[1] ?? 0).toFixed(1);
    const rot = ((t.rotate ?? 0) * 180 / Math.PI).toFixed(1);
    const fillHex = rgbToHex(shape.fill);

    // Per-type args row
    let argsRow = '';
    if (shape.type === 'rectangle') {
      argsRow = `
        <div class="inspector-field"><label>width</label> <input type="number" data-field="args.size.0" value="${(shape.args.size[0]||0).toFixed(1)}"></div>
        <div class="inspector-field"><label>height</label> <input type="number" data-field="args.size.1" value="${(shape.args.size[1]||0).toFixed(1)}"></div>`;
    } else if (shape.type === 'circle') {
      argsRow = `<div class="inspector-field"><label>radius</label> <input type="number" data-field="args.radius" value="${(shape.args.radius||0).toFixed(1)}"></div>`;
    } else if (shape.type === 'star') {
      argsRow = `
        <div class="inspector-field"><label>points</label> <input type="number" data-field="args.points" value="${shape.args.points ?? 5}" step="1"></div>
        <div class="inspector-field"><label>outerR</label> <input type="number" data-field="args.outerR" value="${(shape.args.outerR||0).toFixed(1)}"></div>
        <div class="inspector-field"><label>innerR</label> <input type="number" data-field="args.innerR" value="${(shape.args.innerR||0).toFixed(1)}"></div>`;
    }

    this.$inspector.innerHTML = `
      <div class="inspector-section">
        <h4>Subject</h4>
        <div class="inspector-field"><label>id</label> <input type="text" value="${escapeHtml(shape.id)}" disabled></div>
        <div class="inspector-field"><label>type</label> <input type="text" value="${escapeHtml(shape.type)}" disabled></div>
      </div>
      <div class="inspector-section">
        <h4>Transform</h4>
        <div class="inspector-field"><label>x</label> <input type="number" data-field="transform.translate.0" value="${tx}"></div>
        <div class="inspector-field"><label>y</label> <input type="number" data-field="transform.translate.1" value="${ty}"></div>
        <div class="inspector-field"><label>rotate°</label> <input type="number" data-field="transform.rotate.deg" value="${rot}"></div>
      </div>
      <div class="inspector-section">
        <h4>Args</h4>
        ${argsRow || '<div style="color:#666; font-size:11px;">(no editable args for this type yet)</div>'}
      </div>
      <div class="inspector-section">
        <h4>Fill</h4>
        <div class="inspector-field"><label>color</label> <input type="color" data-field="fill" value="${fillHex}"></div>
      </div>
    `;

    // Wire inspector input changes
    this.$inspector.querySelectorAll('input[data-field]').forEach(inp => {
      const apply = () => this.applyInspectorEdit(shape, inp.dataset.field, inp.value);
      inp.addEventListener('input', apply);
    });
  }

  applyInspectorEdit(shape, field, value) {
    if (field === 'fill') {
      shape.fill = hexToRgb(value);
    } else if (field === 'transform.translate.0') {
      shape.transform.translate[0] = parseFloat(value) || 0;
    } else if (field === 'transform.translate.1') {
      shape.transform.translate[1] = parseFloat(value) || 0;
    } else if (field === 'transform.rotate.deg') {
      shape.transform.rotate = (parseFloat(value) || 0) * Math.PI / 180;
    } else if (field.startsWith('args.')) {
      const path = field.split('.').slice(1);  // ['size', '0']
      let target = shape.args;
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
      const leaf = path[path.length - 1];
      const num = parseFloat(value);
      target[leaf] = isNaN(num) ? value : num;
    }
    this.render();
    this.renderSelectionOverlay();
  }

  // -------------------------------------------------------------------------
  // Chat (Day 4) — LLM produces JSON-Patch on current scene
  // -------------------------------------------------------------------------
  wireChat() {
    this.$chatHistory = this.sidebarEl.querySelector('[data-role=chat-history]');
    this.$chatInput   = this.sidebarEl.querySelector('[data-role=chat-input]');
    this.$chatSend    = this.sidebarEl.querySelector('[data-role=chat-send]');
    const submit = () => this.handleChatSubmit();
    this.$chatSend.addEventListener('click', submit);
    this.$chatInput.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
    });
  }

  async handleChatSubmit() {
    const text = (this.$chatInput.value || '').trim();
    if (!text) return;
    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    if (!apiKey) {
      this.appendChat('system', 'No Anthropic API key. Set it in the Text tab first (top of code panel).');
      this.renderChat();
      return;
    }
    this.appendChat('user', text);
    this.$chatInput.value = '';
    this.$chatInput.disabled = true;
    this.$chatSend.disabled = true;
    this.appendChat('assistant', '…', { pending: true });
    this.renderChat();

    try {
      if (!_editSystemPrompt) {
        const res = await fetch(EDIT_PROMPT_URL);
        _editSystemPrompt = await res.text();
      }
      const userPayload = JSON.stringify({
        scene: this.exportScene(),
        selectedShapeIds: [...this.state.selectedShapeIds],
        userRequest: text,
      });
      const llmText = await this.callEditLLM(userPayload, apiKey);
      const ops = this.parsePatchFromText(llmText);
      // Replace pending bubble with proposed-patch preview
      this.chatHistory.pop();
      if (ops.length === 0) {
        this.appendChat('assistant', '(no-op — request was ambiguous or scope not selected)');
      } else {
        this.appendChat('assistant', '', { ops, raw: llmText });
      }
    } catch (e) {
      this.chatHistory.pop();
      this.appendChat('system', `✗ ${e.message}`);
    } finally {
      this.$chatInput.disabled = false;
      this.$chatSend.disabled = false;
      this.renderChat();
    }
  }

  async callEditLLM(userMsg, apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        system: _editSystemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.content[0].text;
  }

  parsePatchFromText(text) {
    // Find first fenced JSON block; fallback to plain JSON.
    const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    const body = fence ? fence[1] : text.trim();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      throw new Error(`patch parse failed: ${e.message}`);
    }
    if (!Array.isArray(parsed)) {
      // No-op object form
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length === 0) return [];
      throw new Error('patch must be an array of ops');
    }
    return parsed;
  }

  // Minimal RFC 6902 apply — supports replace / add / remove only.
  // Mutates the doc in place AND returns it.
  applyJsonPatch(doc, ops) {
    for (const op of ops) {
      if (!op || typeof op.path !== 'string') throw new Error('bad op: missing path');
      const parts = op.path.split('/').slice(1).map(decodeJsonPointerSegment);
      if (op.op === 'replace' || op.op === 'add') {
        const last = parts.pop();
        let target = doc;
        for (const p of parts) {
          if (target == null) throw new Error('path traversal failed at ' + p);
          target = Array.isArray(target) ? target[parseInt(p, 10)] : target[p];
        }
        if (Array.isArray(target)) {
          if (last === '-') target.push(op.value);
          else {
            const idx = parseInt(last, 10);
            if (op.op === 'add') target.splice(idx, 0, op.value);
            else                 target[idx] = op.value;
          }
        } else if (target && typeof target === 'object') {
          target[last] = op.value;
        } else {
          throw new Error('cannot set on non-object at ' + op.path);
        }
      } else if (op.op === 'remove') {
        const last = parts.pop();
        let target = doc;
        for (const p of parts) {
          target = Array.isArray(target) ? target[parseInt(p, 10)] : target[p];
        }
        if (Array.isArray(target)) {
          target.splice(parseInt(last, 10), 1);
        } else if (target && typeof target === 'object') {
          delete target[last];
        }
      } else {
        throw new Error('unsupported op: ' + op.op);
      }
    }
    return doc;
  }

  // Apply a patch to the current state. Pushes prior state onto undoStack.
  applyPatchToState(ops) {
    const prevSnapshot = JSON.stringify(this.exportScene());
    // Build a working copy in the shape the LLM was reasoning about
    const working = this.exportScene();
    try {
      this.applyJsonPatch(working, ops);
    } catch (e) {
      this.appendChat('system', `✗ patch failed: ${e.message}`);
      this.renderChat();
      return;
    }
    // Push undo BEFORE absorbing
    this.undoStack.push(prevSnapshot);
    // Absorb working back into live state
    this.absorbScene(working);
    this.render();
    this.renderLayers();
    this.renderSelectionOverlay();
    this.renderInspector();
  }

  undoLastPatch() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.absorbScene(JSON.parse(prev));
    this.render();
    this.renderLayers();
    this.renderSelectionOverlay();
    this.renderInspector();
  }

  // Build a scene-only object (no editor UI state like tool / activeLayerId
  // / selectedShapeIds) for serialization + LLM input.
  exportScene() {
    return {
      v: 1,
      canvas: JSON.parse(JSON.stringify(this.state.canvas)),
      layers: JSON.parse(JSON.stringify(this.state.layers)),
      shapes: JSON.parse(JSON.stringify(this.state.shapes)),
    };
  }

  absorbScene(scene) {
    if (scene.canvas) this.state.canvas = scene.canvas;
    if (scene.layers) this.state.layers = scene.layers;
    if (scene.shapes) this.state.shapes = scene.shapes;
  }

  appendChat(role, text, extras = {}) {
    this.chatHistory.push({ role, text, ...extras });
  }

  renderChat() {
    if (!this.$chatHistory) return;
    if (this.chatHistory.length === 0) {
      this.$chatHistory.innerHTML = `<div class="placeholder">Describe your edit in natural language.<br>e.g. "make all circles 50% bigger" / "change the red rectangle to blue" / "add a green star top-left"</div>`;
      return;
    }
    let html = '';
    for (let i = 0; i < this.chatHistory.length; i++) {
      const m = this.chatHistory[i];
      if (m.role === 'user') {
        html += `<div class="msg user">${escapeHtml(m.text)}</div>`;
      } else if (m.role === 'system') {
        html += `<div class="msg assistant" style="color:#e57;">${escapeHtml(m.text)}</div>`;
      } else if (m.pending) {
        html += `<div class="msg assistant"><span style="opacity:0.6;">thinking…</span></div>`;
      } else if (m.ops) {
        // Patch preview with Apply / Reject buttons
        const summary = m.ops.map(opSummary).join('\n');
        html += `
          <div class="msg assistant">
            <div style="font-size: 11px; color: #888; margin-bottom: 6px;">${m.ops.length} change${m.ops.length === 1 ? '' : 's'}:</div>
            <pre style="margin: 0; padding: 6px 8px; background: #0d0d0d; border-radius: 4px; font-size: 11px; color: #aaa; white-space: pre-wrap; line-height: 1.4;">${escapeHtml(summary)}</pre>
            <div style="margin-top: 6px; display: flex; gap: 6px;">
              <button class="patch-apply"  data-idx="${i}">Apply</button>
              <button class="patch-reject" data-idx="${i}">Reject</button>
            </div>
          </div>
        `;
      } else {
        html += `<div class="msg assistant">${escapeHtml(m.text)}</div>`;
      }
    }
    this.$chatHistory.innerHTML = html;
    this.$chatHistory.scrollTop = this.$chatHistory.scrollHeight;
    // Wire patch action buttons
    this.$chatHistory.querySelectorAll('.patch-apply').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const m = this.chatHistory[idx];
        if (m && m.ops) {
          this.applyPatchToState(m.ops);
          // Mark consumed
          m.applied = true;
          m.ops = null;
          m.text = '✓ applied';
          this.renderChat();
        }
      });
    });
    this.$chatHistory.querySelectorAll('.patch-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const m = this.chatHistory[idx];
        if (m) { m.ops = null; m.text = '✗ rejected'; this.renderChat(); }
      });
    });
  }

  teardown() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKeyDown);
    if (this.onWindowKey) window.removeEventListener('keydown', this.onWindowKey);
    // Sidebar gets repopulated by next tab's TAB_CONTENT — safe to empty.
    this.sidebarEl.innerHTML = '';
    // Render-area: ONLY remove our appended root; preserve compositor's
    // global #canvas-wrap / #c / #c-gpu / etc. that other tabs depend on.
    if (this.viewportRoot && this.viewportRoot.parentNode) {
      this.viewportRoot.parentNode.removeChild(this.viewportRoot);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rgbToCss([r, g, b]) { return `rgb(${r|0},${g|0},${b|0})`; }
function rgbToHex([r, g, b]) {
  const h = (n) => ('0' + (n|0).toString(16)).slice(-2);
  return `#${h(r)}${h(g)}${h(b)}`;
}
function hexToRgb(hex) {
  const s = hex.replace(/^#/, '');
  return [parseInt(s.slice(0,2), 16), parseInt(s.slice(2,4), 16), parseInt(s.slice(4,6), 16)];
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// JSON Pointer segment decoding (RFC 6901): ~1 → /, ~0 → ~
function decodeJsonPointerSegment(s) {
  return s.replace(/~1/g, '/').replace(/~0/g, '~');
}

// Human-readable summary of a single JSON-Patch op
function opSummary(op) {
  if (!op || !op.op) return '(invalid op)';
  if (op.op === 'replace') return `replace ${op.path} → ${shortValue(op.value)}`;
  if (op.op === 'add')     return `add     ${op.path} = ${shortValue(op.value)}`;
  if (op.op === 'remove')  return `remove  ${op.path}`;
  return `${op.op} ${op.path || ''}`;
}
function shortValue(v) {
  if (v == null) return 'null';
  if (typeof v === 'number') return v.toString();
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (v.length <= 4 && v.every(x => typeof x === 'number')) return `[${v.join(', ')}]`;
    return `Array(${v.length})`;
  }
  if (typeof v === 'object') {
    if (v.type) return `{${v.type} …}`;
    return '{ … }';
  }
  return String(v);
}
