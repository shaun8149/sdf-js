// =============================================================================
// motifs/path —— SVG path parser + bezier sampler
// -----------------------------------------------------------------------------
// Port 自 Reinder Nijhoff 的 Turtletoy path utility（turtletoy.net/turtle/46adb0ad70）。
// 支持 M / L / C 命令（move-to / line-to / cubic-bezier）。对应 90% 的 hand-traced
// SVG sketch 数据足够——更复杂的 SVG feature（弧 A 命令、quadratic Q 等）可以
// 在加 motif library 时按需扩展。
//
// 核心 API：
//   parsePath(svgString) → Path 对象
//   path.length()        → 总弧长（用于均匀采样）
//   path.pAt(t)          → t ∈ [0,1] 沿路径的 (x, y)
//   path.sample(steps)   → 离散化为 polyline [[x,y], ...]
// =============================================================================

class MoveTo {
  constructor(p) { this.p0 = p; }
  pAt() { return [this.p0[0], this.p0[1]]; }
  length() { return 0; }
}

class LineTo {
  constructor(p0, p1) { this.p0 = p0; this.p1 = p1; }
  pAt(t) {
    const nt = 1 - t;
    return [
      nt * this.p0[0] + t * this.p1[0],
      nt * this.p0[1] + t * this.p1[1],
    ];
  }
  length() {
    const dx = this.p1[0] - this.p0[0];
    const dy = this.p1[1] - this.p0[1];
    return Math.hypot(dx, dy);
  }
}

class BezierTo {
  constructor(p0, c0, c1, p1) {
    this.p0 = p0; this.c0 = c0; this.c1 = c1; this.p1 = p1;
    this._length = null;
  }
  pAt(t) {
    const nt = 1 - t;
    const { p0, c0, c1, p1 } = this;
    return [
      nt * nt * nt * p0[0] + 3 * t * nt * nt * c0[0] + 3 * t * t * nt * c1[0] + t * t * t * p1[0],
      nt * nt * nt * p0[1] + 3 * t * nt * nt * c0[1] + 3 * t * t * nt * c1[1] + t * t * t * p1[1],
    ];
  }
  length() {
    if (this._length != null) return this._length;
    // Numerical integration：25 个 sub-samples 求和（Reinder 同款）
    let len = 0;
    let prev = this.pAt(0);
    for (let i = 1; i <= 25; i++) {
      const cur = this.pAt(i / 25);
      len += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      prev = cur;
    }
    this._length = len;
    return len;
  }
}

export class Path {
  constructor(svgString) {
    this.segments = [];
    this._length = null;
    this._parse(svgString);
  }

  _parse(svg) {
    // Tokenize：number 或 命令字母 M/L/C
    const tokens = svg.match(/([0-9.+\-eE]+|[MLC])/g);
    if (!tokens) return;
    let lastP = null;
    let i = 0;
    const num = () => parseFloat(tokens[i++]);
    while (i < tokens.length) {
      const cmd = tokens[i++];
      switch (cmd) {
        case 'M': {
          const p = [num(), num()];
          this.segments.push(new MoveTo(p));
          lastP = p;
          break;
        }
        case 'L': {
          const p = [num(), num()];
          this.segments.push(new LineTo(lastP, p));
          lastP = p;
          break;
        }
        case 'C': {
          const c0 = [num(), num()];
          const c1 = [num(), num()];
          const p1 = [num(), num()];
          this.segments.push(new BezierTo(lastP, c0, c1, p1));
          lastP = p1;
          break;
        }
        default:
          // skip unknown token (defensive)
          break;
      }
    }
  }

  length() {
    if (this._length != null) return this._length;
    this._length = this.segments.reduce((a, s) => a + s.length(), 0);
    return this._length;
  }

  // t ∈ [0,1] → (x, y) along the path（按弧长均匀参数化）
  pAt(t) {
    t = Math.max(0, Math.min(1, t));
    const total = this.length();
    if (total === 0) {
      return this.segments[0] ? this.segments[0].pAt(0) : [0, 0];
    }
    const target = t * total;
    let acc = 0;
    for (const seg of this.segments) {
      const segLen = seg.length();
      if (segLen === 0) continue; // MoveTo 跳过
      if (target <= acc + segLen) {
        return seg.pAt((target - acc) / segLen);
      }
      acc += segLen;
    }
    return this.segments[this.segments.length - 1].pAt(1);
  }

  // 离散化为 polyline。steps = 采样段数（默认 50）
  sample(steps = 50) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(this.pAt(i / steps));
    }
    return pts;
  }
}

// 便捷工具：直接 svg string → polyline
export function pathToPolyline(svgString, steps = 50) {
  return new Path(svgString).sample(steps);
}
