// =============================================================================
// eslint.config.js — Atlas root ESLint config (flat config, ESLint 9+)
//
// Philosophy (per 2026-06-16 engineering audit, Wave 2):
//   - Baseline = @eslint/js recommended.
//   - Loosened where the existing 45k-line codebase would otherwise fail CI
//     for stylistic reasons that don't justify a flag day.
//   - `no-unused-vars` is a warn (not error) with leading-underscore escape.
//   - Test / script / example files get a slightly looser ruleset (allow
//     console, occasional unused destructure).
//   - Formatting is Prettier's job, not ESLint's — we don't enable any
//     stylistic rules here.
// =============================================================================

import js from '@eslint/js';
import globals from 'globals';

export default [
  // -----------------------------------------------------------------------
  // Ignores — anything we explicitly don't lint
  // -----------------------------------------------------------------------
  {
    ignores: [
      'node_modules/**',
      'sdf-js/scripts/regression/results/**',
      'sdf-js/tests/smoke/baselines/**',
      '.claude/**',
      'memory/**',
      'package-lock.json',
      '*.min.js',
    ],
  },

  // -----------------------------------------------------------------------
  // Baseline: @eslint/js recommended
  // -----------------------------------------------------------------------
  js.configs.recommended,

  // -----------------------------------------------------------------------
  // All JS/MJS source under Atlas
  // -----------------------------------------------------------------------
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser, // WebGL / canvas / document
        ...globals.node, // process / require for scripts
        ...globals.es2024,
      },
    },
    rules: {
      // Unused vars: warn only; underscore-prefix escape hatch.
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Empty blocks are sometimes intentional (placeholder catch / branch)
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Loops like `while (true)` are intentional in render / game loops
      'no-constant-condition': ['warn', { checkLoops: false }],
      // Common in shader / generative-art code where prototype mutations OK
      'no-prototype-builtins': 'off',
      // Conditional assignment is OK if wrapped in extra parens for clarity
      'no-cond-assign': ['error', 'except-parens'],
      // Function declarations inside blocks are fine in ES2024
      'no-inner-declarations': 'off',
      // ASI is well-established here; we use semis but allow occasional miss
      'no-unexpected-multiline': 'warn',
      // Numbers used as bitmasks in shader-derived code
      'no-bitwise': 'off',
      // ESLint 10 strict rules disabled — non-actionable on legacy code:
      //   preserve-caught-error: requires `throw new Error(m, { cause: e })`
      //     wrapping at every catch; not a real bug class for our code.
      //   no-useless-assignment: control-flow dependent, often false-positives
      //     on patterns like `let s = "init"; if (x) s = "done"; return s;`.
      'preserve-caught-error': 'off',
      'no-useless-assignment': 'off',
    },
  },

  // -----------------------------------------------------------------------
  // Browser-only p5.js sketches (examples/sdf/*) use p5 globals (background,
  // createCanvas, rect, etc.) injected by <script src="p5.js"></script>.
  // ESLint can't see those without explicit declaration.
  // -----------------------------------------------------------------------
  {
    files: ['sdf-js/examples/sdf/**/*.js'],
    languageOptions: {
      globals: {
        // p5.js sketch entry points + globals
        setup: 'readonly',
        draw: 'readonly',
        preload: 'readonly',
        mousePressed: 'readonly',
        keyPressed: 'readonly',
        windowResized: 'readonly',
        // p5 drawing API
        createCanvas: 'readonly',
        background: 'readonly',
        fill: 'readonly',
        stroke: 'readonly',
        noStroke: 'readonly',
        noFill: 'readonly',
        rect: 'readonly',
        ellipse: 'readonly',
        circle: 'readonly',
        line: 'readonly',
        point: 'readonly',
        triangle: 'readonly',
        quad: 'readonly',
        beginShape: 'readonly',
        endShape: 'readonly',
        vertex: 'readonly',
        curveVertex: 'readonly',
        bezierVertex: 'readonly',
        push: 'readonly',
        pop: 'readonly',
        translate: 'readonly',
        rotate: 'readonly',
        scale: 'readonly',
        strokeWeight: 'readonly',
        color: 'readonly',
        text: 'readonly',
        textSize: 'readonly',
        textAlign: 'readonly',
        loadImage: 'readonly',
        image: 'readonly',
        pixelDensity: 'readonly',
        noLoop: 'readonly',
        loop: 'readonly',
        redraw: 'readonly',
        drawingContext: 'readonly',
        random: 'readonly',
        noise: 'readonly',
        map: 'readonly',
        lerp: 'readonly',
        constrain: 'readonly',
        dist: 'readonly',
        // p5 state
        mouseX: 'readonly',
        mouseY: 'readonly',
        width: 'readonly',
        height: 'readonly',
        frameCount: 'readonly',
        frameRate: 'readonly',
        keyIsPressed: 'readonly',
        // p5 constants
        PI: 'readonly',
        TWO_PI: 'readonly',
        HALF_PI: 'readonly',
        CENTER: 'readonly',
        LEFT: 'readonly',
        RIGHT: 'readonly',
        TOP: 'readonly',
        BOTTOM: 'readonly',
        CORNER: 'readonly',
        CORNERS: 'readonly',
        RGB: 'readonly',
        HSB: 'readonly',
        HSL: 'readonly',
        WEBGL: 'readonly',
      },
    },
  },

  // -----------------------------------------------------------------------
  // Tests, scripts, examples: looser — console allowed
  // -----------------------------------------------------------------------
  {
    files: [
      '**/test/**',
      '**/tests/**',
      '**/scripts/**',
      '**/examples/**',
      '**/test-*.{js,mjs}',
      '**/*.test.{js,mjs}',
      '**/*.spec.{js,mjs}',
    ],
    rules: {
      'no-unused-vars': 'off', // tests often destructure things they don't use
    },
  },
];
