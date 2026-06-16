// =============================================================================
// scene/expr.js — string expression → TimeExpr parser
// -----------------------------------------------------------------------------
// SceneData AnimationChannel.expr is a human/LLM-friendly string like
// "sin(t * 0.5) * 0.3 + 0.3" or "0.4 + 0.075 * sin(t * 0.333)".
// This module parses it into the structured TimeExpr objects from
// `src/sdf/time.js` (`{kind:'time', form:'sin', amp, freq, phase}` etc.)
// so the compile pipeline (sdf3.compile.emitTimeExpr) can emit GLSL.
//
// Grammar (v1 — minimal, matches SPEC.md "Expression language" section):
//   expr     := term (('+' | '-') term)*
//   term     := factor ('*' factor)*
//   factor   := '(' expr ')' | function | number | 't'
//   function := ('sin' | 'cos') '(' expr ')'
//   number   := /-?[0-9]+(\.[0-9]+)?/
//
// Limitations (v1):
//   - No division (use multiplication by reciprocal: `t * 0.333` not `t / 3`)
//   - No nested functions like `sin(cos(t))` (caller uses `value` structured form)
//   - No identifiers other than `t`
//   - No unary minus standalone (`-5` ok, `-(t)` not ok — use `0 - t`)
//
// Output: TimeExpr in canonical form. Constant expressions (no `t`) collapse
// to JS numbers. Expressions reducing to pure linear/sin/cos return that form;
// composite expressions return `{form:'sum', terms:[...]}`.
// =============================================================================

import { linearT, sinT, cosT, sumT, mulT, isTimeExpr } from '../sdf/time.js';

// =============================================================================
// Tokenizer
// =============================================================================

const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  IDENT: 'IDENT',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  EOF: 'EOF',
};

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c === '+') {
      tokens.push({ type: TOKEN_TYPES.PLUS, pos: i });
      i++;
      continue;
    }
    if (c === '-') {
      tokens.push({ type: TOKEN_TYPES.MINUS, pos: i });
      i++;
      continue;
    }
    if (c === '*') {
      tokens.push({ type: TOKEN_TYPES.STAR, pos: i });
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: TOKEN_TYPES.LPAREN, pos: i });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: TOKEN_TYPES.RPAREN, pos: i });
      i++;
      continue;
    }

    // Number: [0-9]+ (.[0-9]+)?
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      if (src[j] === '.') {
        j++;
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(src.slice(i, j)), pos: i });
      i = j;
      continue;
    }

    // Identifier: [a-zA-Z_][a-zA-Z0-9_]*
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i;
      while (
        j < src.length &&
        ((src[j] >= 'a' && src[j] <= 'z') ||
          (src[j] >= 'A' && src[j] <= 'Z') ||
          (src[j] >= '0' && src[j] <= '9') ||
          src[j] === '_')
      )
        j++;
      tokens.push({ type: TOKEN_TYPES.IDENT, value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character "${c}" at position ${i} in expression: "${src}"`);
  }
  tokens.push({ type: TOKEN_TYPES.EOF, pos: src.length });
  return tokens;
}

// =============================================================================
// Recursive descent parser → produce number OR TimeExpr
// =============================================================================

class Parser {
  constructor(tokens, src) {
    this.tokens = tokens;
    this.pos = 0;
    this.src = src;
  }
  peek() {
    return this.tokens[this.pos];
  }
  consume() {
    return this.tokens[this.pos++];
  }
  expect(type) {
    const t = this.consume();
    if (t.type !== type) {
      throw new Error(`Expected ${type} but got ${t.type} at position ${t.pos} in: "${this.src}"`);
    }
    return t;
  }

  // expr := term (('+' | '-') term)*
  parseExpr() {
    let left = this.parseTerm();
    while (this.peek().type === TOKEN_TYPES.PLUS || this.peek().type === TOKEN_TYPES.MINUS) {
      const op = this.consume();
      const right = this.parseTerm();
      // Combine. If left/right both numbers, fold. If either is TimeExpr, sumT them.
      if (op.type === TOKEN_TYPES.PLUS) {
        left = addValues(left, right);
      } else {
        left = addValues(left, negateValue(right));
      }
    }
    return left;
  }

  // term := factor ('*' factor)*
  parseTerm() {
    let left = this.parseFactor();
    while (this.peek().type === TOKEN_TYPES.STAR) {
      this.consume();
      const right = this.parseFactor();
      left = mulValues(left, right);
    }
    return left;
  }

  // factor := '(' expr ')' | function | number | 't' | '-' factor (unary minus)
  parseFactor() {
    const t = this.peek();
    if (t.type === TOKEN_TYPES.MINUS) {
      this.consume();
      const inner = this.parseFactor();
      return negateValue(inner);
    }
    if (t.type === TOKEN_TYPES.LPAREN) {
      this.consume();
      const inner = this.parseExpr();
      this.expect(TOKEN_TYPES.RPAREN);
      return inner;
    }
    if (t.type === TOKEN_TYPES.NUMBER) {
      this.consume();
      return t.value;
    }
    if (t.type === TOKEN_TYPES.IDENT) {
      this.consume();
      // function call?
      if (this.peek().type === TOKEN_TYPES.LPAREN) {
        if (t.value !== 'sin' && t.value !== 'cos') {
          throw new Error(
            `Unsupported function "${t.value}" at position ${t.pos} (v1 supports: sin, cos)`,
          );
        }
        this.consume(); // (
        const arg = this.parseExpr();
        this.expect(TOKEN_TYPES.RPAREN);
        // sin(arg) where arg is TimeExpr (typically `t*freq + phase`)
        return makeSinOrCos(t.value, arg);
      }
      // bare identifier — only `t` allowed
      if (t.value === 't') {
        return linearT(1.0); // t = 1*t
      }
      throw new Error(`Unknown identifier "${t.value}" at position ${t.pos} (only "t" is valid)`);
    }
    throw new Error(`Unexpected token ${t.type} at position ${t.pos} in: "${this.src}"`);
  }
}

// =============================================================================
// Value combinators — handle both number and TimeExpr operands
// =============================================================================

function addValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  // At least one is TimeExpr → sumT
  return sumT(a, b);
}

function negateValue(v) {
  if (typeof v === 'number') return -v;
  return mulT(v, -1);
}

function mulValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a * b;
  // Time × number: distribute (mulT handles linear/sin/cos/sum)
  if (typeof a === 'number') return mulT(b, a);
  if (typeof b === 'number') return mulT(a, b);
  // Time × Time — not supported in v1
  throw new Error(
    `Multiplication of two time-dependent expressions not supported in v1 (use structured "value" form)`,
  );
}

// sin/cos with TimeExpr arg of shape (freq*t + phase) or (t*freq + phase) etc.
// We need to extract (freq, phase) from the arg. Supported arg patterns:
//   - linearT(coef)              → sin(coef * t)        → amp=1, freq=coef, phase=0
//   - sumT(number, linearT(coef)) or sumT(linearT(coef), number)
//                                 → sin(coef*t + phase) → amp=1, freq=coef, phase=number
//   - sumT(linearT(coef), number) (same)
//   - number (constant)          → fold to constant sin(num)
function makeSinOrCos(fnName, arg) {
  const factory = fnName === 'sin' ? sinT : cosT;

  if (typeof arg === 'number') {
    // sin(const) = const (fold at parse time, but renderer can't tell us t=0
    // so just emit as static amp with freq=0 — but then phase=arg)
    const v = fnName === 'sin' ? Math.sin(arg) : Math.cos(arg);
    return v;
  }

  if (!isTimeExpr(arg)) {
    throw new Error(`sin/cos argument must reduce to a TimeExpr or number`);
  }

  // arg form == 'linear': arg = coef*t → sin(coef*t)
  if (arg.form === 'linear') {
    return factory(1, arg.coef, 0);
  }

  // arg form == 'sum': try to extract one linear term + constant terms
  if (arg.form === 'sum') {
    let coef = 0;
    let phase = 0;
    let foundLinear = false;
    let leftover = []; // unhandled terms

    for (const term of arg.terms) {
      if (typeof term === 'number') {
        phase += term;
      } else if (isTimeExpr(term) && term.form === 'linear') {
        if (foundLinear) {
          // multiple linear terms — coef sum
          coef += term.coef;
        } else {
          coef = term.coef;
          foundLinear = true;
        }
      } else {
        leftover.push(term);
      }
    }

    if (leftover.length === 0 && foundLinear) {
      return factory(1, coef, phase);
    }
    throw new Error(`sin/cos argument too complex for v1 parser; use "value" structured form`);
  }

  throw new Error(`sin/cos argument shape unsupported in v1 parser (got form="${arg.form}")`);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse a string expression into a TimeExpr (or plain number if no `t` reference).
 * Throws on syntax / semantic errors. v1 grammar; see file header.
 *
 * @param {string} src — expression source, e.g. "sin(t * 0.5) * 0.3 + 0.3"
 * @returns {number | import('../sdf/time.js').TimeExpr}
 */
export function parseExpr(src) {
  if (typeof src !== 'string') {
    throw new Error(`parseExpr: expected string, got ${typeof src}`);
  }
  if (src.trim() === '') {
    throw new Error(`parseExpr: empty expression`);
  }
  const tokens = tokenize(src);
  const parser = new Parser(tokens, src);
  const result = parser.parseExpr();
  if (parser.peek().type !== TOKEN_TYPES.EOF) {
    throw new Error(`Unexpected trailing token at position ${parser.peek().pos} in: "${src}"`);
  }
  return result;
}

/**
 * Inverse: TimeExpr (or number) → canonical string expression.
 * Used by serialize.stringify() to emit both `expr` and `value` for round-trip
 * stability. Output is a valid v1 input to parseExpr().
 *
 * @param {number | import('../sdf/time.js').TimeExpr} v
 * @returns {string}
 */
export function stringifyExpr(v) {
  if (typeof v === 'number') return formatNumber(v);
  if (!isTimeExpr(v)) {
    throw new Error(`stringifyExpr: not a TimeExpr or number: ${JSON.stringify(v)}`);
  }
  if (v.form === 'linear') {
    if (v.coef === 1) return 't';
    if (v.coef === -1) return '-t';
    return `${formatNumber(v.coef)} * t`;
  }
  if (v.form === 'sin' || v.form === 'cos') {
    const arg = stringifyFreqPhase(v.freq, v.phase);
    const inner = `${v.form}(${arg})`;
    if (v.amp === 1) return inner;
    if (v.amp === -1) return `-${inner}`;
    return `${formatNumber(v.amp)} * ${inner}`;
  }
  if (v.form === 'sum') {
    return v.terms
      .map((t, i) => {
        const s = stringifyExpr(t);
        if (i === 0) return s;
        if (s.startsWith('-')) return ` - ${s.slice(1)}`;
        return ` + ${s}`;
      })
      .join('');
  }
  throw new Error(`stringifyExpr: unknown form "${v.form}"`);
}

function stringifyFreqPhase(freq, phase) {
  // arg = freq*t + phase
  const freqPart = freq === 1 ? 't' : freq === -1 ? '-t' : `${formatNumber(freq)} * t`;
  if (phase === 0) return freqPart;
  if (phase < 0) return `${freqPart} - ${formatNumber(-phase)}`;
  return `${freqPart} + ${formatNumber(phase)}`;
}

function formatNumber(n) {
  // Avoid 5e-7 style for small numbers in [-1e-6, 1e-6]. Otherwise default.
  if (n === Math.floor(n)) return n.toString();
  // Limit to 6 decimal places to avoid floating-point cruft in output
  const fixed = n.toFixed(6);
  // Strip trailing zeros
  return fixed.replace(/\.?0+$/, '');
}

// =============================================================================
// Normalize: take an AnimationChannel.expr or .value and return canonical
// TimeExpr (or number). Used by compile.js and serialize.js.
// =============================================================================

/**
 * Convert an AnimationChannel's expr/value into a canonical TimeExpr (or number).
 *
 * @param {{ expr?: string, value?: object }} channel
 * @returns {number | import('../sdf/time.js').TimeExpr}
 */
export function normalizeChannel(channel) {
  if (channel.expr != null) return parseExpr(channel.expr);
  if (channel.value != null) return channel.value;
  // Defensive: incomplete channels are tolerated by validator (warning, not
  // error). Return null so compile-time consumers can skip rather than throw.
  return null;
}
