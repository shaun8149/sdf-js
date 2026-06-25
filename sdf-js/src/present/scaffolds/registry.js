// =============================================================================
// scaffolds/registry.js — Atlas Present 10 canonical deck scaffolds
// -----------------------------------------------------------------------------
// Sprint 15E: The final layer of Sprint 15. A "scaffold" is a slot-sequence
// template for a deck — e.g. pitch-deck-vc is [cover, problem, market-size,
// solution, product, traction, model, team, ask]. Each slot declares what
// kind of content goes there + which atoms-2d are recommended/forbidden.
//
// Two-call lift pipeline (when wired by visual-panel/pipeline.js):
//   1. Scaffold-picker call: classify input text → pick best-fit scaffold
//   2. Slot-fill call: for each slot, pick + parameterize atoms from
//      recommended_atoms (with forbidden_atoms as negative constraints)
//
// This file is JUST the registry data. The picker logic lives in picker.js
// (deterministic v1; LLM wrap can land in v2).
// =============================================================================

import { ATLAS_THEMES } from '../themes.js';

/**
 * @typedef {object} ScaffoldSlot
 * @property {string} name — slot identifier (e.g. 'problem', 'cover')
 * @property {string} title — slot display title
 * @property {string} purpose — what content goes here (LLM hint)
 * @property {string[]} recommended_atoms — atom types ranked best-first
 * @property {string[]} [forbidden_atoms] — atoms that DON'T fit here
 * @property {{minH?: number, maxH?: number, aspectHint?: 'tall'|'wide'|'square'}} [layout]
 */

/**
 * @typedef {object} Scaffold
 * @property {string} id — kebab-case stable identifier
 * @property {string} label — display name
 * @property {string} description — one-line summary
 * @property {string} audience — comma-separated audience tags
 * @property {ScaffoldSlot[]} slots — slot sequence (matters; first = cover, last = close)
 * @property {string[]} theme_affinity — ranked theme ids best for this scaffold
 * @property {string[]} keywords — match hints for deterministic picker
 */

/** @type {Scaffold[]} */
export const SCAFFOLDS = [
  // ============================================================================
  // pitch-deck-vc — Sequoia/YC-style VC pitch
  // ============================================================================
  {
    id: 'pitch-deck-vc',
    label: 'VC Pitch Deck',
    description: 'Seed/Series A fundraise pitch (Sequoia / YC structure)',
    audience: 'vc, angel, partners',
    keywords: ['pitch', 'fundraise', 'series', 'seed', 'investor', 'vc', 'ask', 'tam'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Company name + one-line tagline + author/date',
        recommended_atoms: ['cover'],
      },
      {
        name: 'problem',
        title: 'Problem',
        purpose: 'Pain point — who hurts and how much',
        recommended_atoms: [
          'quote-pull',
          'bullet-list',
          'icon-row',
          'icon-grid',
          'kpi-card',
          'icon-badge',
        ],
        forbidden_atoms: ['org-chart', 'gantt'],
      },
      {
        name: 'market-size',
        title: 'Market Size',
        purpose: 'TAM/SAM/SOM with numbers',
        recommended_atoms: ['pyramid', 'kpi-card', 'sphere-fill', 'bar'],
      },
      {
        name: 'solution',
        title: 'Our Solution',
        purpose: 'Product overview + value prop',
        recommended_atoms: ['bullet-list', 'flow-chart', 'icon-badge'],
      },
      {
        name: 'product',
        title: 'Product Demo',
        purpose: 'Screenshot mockup or feature highlight',
        recommended_atoms: ['device-mockup-frame', 'device-mockup-row', 'bullet-list'],
      },
      {
        name: 'section-divider',
        title: 'Section Break',
        purpose: 'Visual section break between Solution and Traction',
        recommended_atoms: ['section-number-divider', 'cover'],
      },
      {
        name: 'traction',
        title: 'Traction',
        purpose: 'Revenue / users / growth charts',
        recommended_atoms: [
          'stat-banner',
          'line',
          'bar',
          'kpi-card',
          'dashboard-multi-kpi-composite',
        ],
        forbidden_atoms: ['mindmap', 'venn'],
      },
      {
        name: 'business-model',
        title: 'Business Model',
        purpose: 'How we make money — unit economics',
        recommended_atoms: ['comparison-table', 'break-even', 'waterfall', 'kpi-card', 'pie'],
      },
      {
        name: 'team',
        title: 'Team',
        purpose: 'Founders + key hires with credentials',
        recommended_atoms: [
          'circle-image-hub-spoke',
          'isotype-stat-comparison',
          'icon-row',
          'bullet-list',
        ],
      },
      {
        name: 'ask',
        title: 'The Ask',
        purpose: 'Funding amount + use of funds + milestones',
        recommended_atoms: ['kpi-card', 'pie', 'progression', 'timeline'],
      },
    ],
    theme_affinity: ['pitch-cobalt-orange', 'pitch-black-neon', 'pitch-charcoal-yellow'],
  },

  // ============================================================================
  // company-overview — recruiting / business-dev / sales intro
  // ============================================================================
  {
    id: 'company-overview',
    label: 'Company Overview',
    description: 'Intro deck for prospects, partners, or recruits',
    audience: 'prospect, partner, candidate, customer',
    keywords: ['overview', 'about', 'company', 'introduction', 'who we are'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Company name + tagline',
        recommended_atoms: ['cover'],
      },
      {
        name: 'mission',
        title: 'Mission',
        purpose: 'Why we exist',
        recommended_atoms: ['quote-pull', 'icon-row', 'icon-grid', 'bullet-list', 'icon-badge'],
      },
      {
        name: 'what-we-do',
        title: 'What We Do',
        purpose: 'Products + service overview',
        recommended_atoms: ['flow-chart', 'magazine-column-grid', 'icon-row', 'bullet-list'],
      },
      {
        name: 'products',
        title: 'Products',
        purpose: 'Feature lineup',
        recommended_atoms: [
          'device-mockup-row',
          'magazine-column-grid',
          'icon-row',
          'icon-grid',
          'bullet-list',
        ],
      },
      {
        name: 'market',
        title: 'Market',
        purpose: 'Where we play',
        recommended_atoms: ['pie', 'bar', 'sphere-fill', 'kpi-card'],
      },
      {
        name: 'values',
        title: 'Values',
        purpose: 'Company values 3-6 items',
        recommended_atoms: ['radial-wheel-segmented', 'icon-row', 'icon-grid', 'bullet-list'],
      },
      {
        name: 'team',
        title: 'Team',
        purpose: 'Leadership and culture',
        recommended_atoms: ['org-chart', 'circle-image-hub-spoke', 'icon-row', 'bullet-list'],
      },
      {
        name: 'contact',
        title: 'Get in Touch',
        purpose: 'Contact + CTA — mail/phone/globe/location',
        recommended_atoms: ['icon-row', 'icon-grid', 'kpi-card', 'bullet-list'],
      },
    ],
    theme_affinity: ['editorial-navy', 'editorial-forest', 'organic-teal'],
  },

  // ============================================================================
  // product-launch — internal announcement / press / blog companion
  // ============================================================================
  {
    id: 'product-launch',
    label: 'Product Launch',
    description: 'Announce a new product, feature, or release',
    audience: 'customer, press, internal',
    keywords: ['launch', 'release', 'announcement', 'new', 'introducing'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Product name + reveal teaser',
        recommended_atoms: ['cover'],
      },
      {
        name: 'problem',
        title: 'Why We Built It',
        purpose: 'The pain we are addressing',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
      {
        name: 'feature-1',
        title: 'Feature Highlight',
        purpose: 'Lead feature with detail',
        recommended_atoms: [
          'radial-wheel-segmented',
          'icon-row',
          'icon-grid',
          'device-mockup-frame',
          'bullet-list',
        ],
      },
      {
        name: 'feature-2',
        title: 'Feature Highlight',
        purpose: 'Second feature with detail',
        recommended_atoms: ['icon-row', 'icon-grid', 'device-mockup-frame', 'bullet-list'],
      },
      {
        name: 'feature-3',
        title: 'Feature Highlight',
        purpose: 'Third feature with detail',
        recommended_atoms: ['icon-row', 'icon-grid', 'device-mockup-frame', 'bullet-list'],
      },
      {
        name: 'demo',
        title: 'See It In Action',
        purpose: 'Visual demo / mockup',
        recommended_atoms: ['device-mockup-row', 'flow-chart'],
      },
      {
        name: 'pricing',
        title: 'Pricing',
        purpose: 'Plans + pricing tiers',
        recommended_atoms: ['comparison-table', 'magazine-column-grid', 'kpi-card'],
      },
      {
        name: 'cta',
        title: 'Get Started',
        purpose: 'CTA + next steps',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
    ],
    theme_affinity: ['pitch-cobalt-orange', 'organic-coral', 'pitch-charcoal-yellow'],
  },

  // ============================================================================
  // qbr — Quarterly Business Review
  // ============================================================================
  {
    id: 'qbr',
    label: 'Quarterly Business Review',
    description: 'Internal Q review — KPIs, wins, challenges, outlook',
    audience: 'exec, board, manager, customer-success',
    keywords: ['qbr', 'quarterly', 'review', 'q1', 'q2', 'q3', 'q4', 'business review'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Q-name + reviewer + period',
        recommended_atoms: ['cover'],
      },
      {
        name: 'executive-summary',
        title: 'Executive Summary',
        purpose: '3-5 highlights at-a-glance',
        recommended_atoms: [
          'stat-banner',
          'quote-pull',
          'dashboard-multi-kpi-composite',
          'bullet-list',
        ],
      },
      {
        name: 'kpis',
        title: 'KPI Dashboard',
        purpose: 'Critical metrics quarter-over-quarter',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'kpi-card', 'line', 'bar'],
      },
      {
        name: 'wins',
        title: 'Wins',
        purpose: 'What went well this quarter',
        recommended_atoms: ['bullet-list', 'kpi-card', 'icon-badge'],
      },
      {
        name: 'challenges',
        title: 'Challenges',
        purpose: 'What did not go to plan',
        recommended_atoms: ['bullet-list', 'fishbone', 'waterfall'],
      },
      {
        name: 'outlook',
        title: 'Outlook',
        purpose: 'Forecast + next-Q targets',
        recommended_atoms: ['change-curve-chart', 'line', 'progression', 'kpi-card'],
      },
      {
        name: 'next-steps',
        title: 'Next Steps',
        purpose: 'Action items + owners + dates',
        recommended_atoms: ['bullet-list', 'timeline', 'gantt'],
      },
    ],
    theme_affinity: ['editorial-navy', 'editorial-burgundy', 'pitch-cobalt-orange'],
  },

  // ============================================================================
  // training — workshop / onboarding / how-to
  // ============================================================================
  {
    id: 'training',
    label: 'Training',
    description: 'Workshop / onboarding / how-to-do-X',
    audience: 'employee, customer, student',
    keywords: ['training', 'workshop', 'tutorial', 'onboard', 'how to', 'guide'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Topic + facilitator + duration',
        recommended_atoms: ['cover'],
      },
      {
        name: 'objectives',
        title: 'Learning Objectives',
        purpose: 'What you will know after this',
        recommended_atoms: ['radial-wheel-segmented', 'bullet-list', 'icon-badge'],
      },
      {
        name: 'context',
        title: 'Why This Matters',
        purpose: 'Stakes + motivation',
        recommended_atoms: ['bullet-list', 'kpi-card', 'isotype-people-grid'],
      },
      {
        name: 'concept',
        title: 'Core Concept',
        purpose: 'The main idea visualized',
        recommended_atoms: ['change-curve-chart', 'flow-chart', 'mindmap', 'venn', 'layer-stack'],
      },
      {
        name: 'steps',
        title: 'Step by Step',
        purpose: 'Sequential process',
        recommended_atoms: ['progression', 'flow-chart', 'timeline'],
      },
      {
        name: 'example',
        title: 'Worked Example',
        purpose: 'Concrete walk-through',
        recommended_atoms: ['bullet-list', 'device-mockup-frame', 'flow-chart'],
      },
      {
        name: 'exercise',
        title: 'Try It Yourself',
        purpose: 'Hands-on activity',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
      {
        name: 'summary',
        title: 'Summary',
        purpose: 'Key takeaways',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
    ],
    theme_affinity: ['organic-teal', 'organic-coral', 'editorial-forest'],
  },

  // ============================================================================
  // thesis-defense — academic
  // ============================================================================
  {
    id: 'thesis-defense',
    label: 'Thesis Defense',
    description: "PhD / Master's defense — research question, method, results",
    audience: 'committee, examiner, peer',
    keywords: ['thesis', 'defense', 'dissertation', 'research', 'phd', 'master'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Thesis title + author + advisor + date',
        recommended_atoms: ['cover'],
      },
      {
        name: 'research-question',
        title: 'Research Question',
        purpose: 'The central question',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
      {
        name: 'literature',
        title: 'Literature Review',
        purpose: 'Prior work + gap',
        recommended_atoms: ['mindmap', 'tree-diagram', 'bullet-list'],
      },
      {
        name: 'methodology',
        title: 'Methodology',
        purpose: 'How we investigated',
        recommended_atoms: ['flow-chart', 'progression', 'bullet-list'],
      },
      {
        name: 'data',
        title: 'Data',
        purpose: 'What we collected',
        recommended_atoms: ['bar', 'line', 'scatter', 'histogram', 'isotype-people-grid'],
      },
      {
        name: 'results',
        title: 'Results',
        purpose: 'What we found',
        recommended_atoms: ['scatter', 'bar', 'line', 'kpi-card', 'matrix-grid'],
      },
      {
        name: 'discussion',
        title: 'Discussion',
        purpose: 'What it means',
        recommended_atoms: ['bullet-list', 'venn', 'nine-field-matrix'],
      },
      {
        name: 'limitations',
        title: 'Limitations',
        purpose: 'What we did not cover',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
      {
        name: 'conclusion',
        title: 'Conclusion',
        purpose: 'Contribution + next steps',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
    ],
    theme_affinity: ['editorial-navy', 'editorial-forest', 'editorial-burgundy'],
  },

  // ============================================================================
  // business-plan — formal multi-section plan
  // ============================================================================
  {
    id: 'business-plan',
    label: 'Business Plan',
    description: 'Formal multi-section plan for bank / advisor / partner',
    audience: 'bank, advisor, partner, internal',
    keywords: ['business plan', 'plan', 'strategy', 'roadmap', 'go-to-market'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Plan title + period + author',
        recommended_atoms: ['cover'],
      },
      {
        name: 'executive-summary',
        title: 'Executive Summary',
        purpose: 'One-pager overview',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'bullet-list'],
      },
      {
        name: 'market-analysis',
        title: 'Market Analysis',
        purpose: 'Size + segments + competition',
        recommended_atoms: [
          'comparison-table',
          'swot',
          'pie',
          'bar',
          'pyramid',
          'nine-field-matrix',
        ],
      },
      {
        name: 'strategy',
        title: 'Strategy',
        purpose: 'Positioning + go-to-market',
        recommended_atoms: ['value-chain-diagram', 'matrix-grid', 'venn', 'flow-chart'],
      },
      {
        name: 'operations',
        title: 'Operations',
        purpose: 'How we deliver',
        recommended_atoms: ['flow-chart', 'org-chart', 'progression'],
      },
      {
        name: 'financials',
        title: 'Financials',
        purpose: 'Forecast + break-even + burn',
        recommended_atoms: ['line', 'waterfall', 'break-even', 'kpi-card'],
      },
      {
        name: 'risks',
        title: 'Risks',
        purpose: 'What could go wrong',
        recommended_atoms: ['fishbone', 'matrix-grid', 'bullet-list'],
      },
      {
        name: 'milestones',
        title: 'Milestones',
        purpose: 'Timeline + deliverables',
        recommended_atoms: ['timeline', 'gantt', 'progression'],
      },
    ],
    theme_affinity: ['editorial-navy', 'editorial-burgundy', 'pitch-cobalt-orange'],
  },

  // ============================================================================
  // vision-mission — values / brand identity
  // ============================================================================
  {
    id: 'vision-mission',
    label: 'Vision & Mission',
    description: 'Company vision, mission, values, principles',
    audience: 'employee, prospect, partner',
    keywords: ['vision', 'mission', 'values', 'principles', 'culture', 'manifesto'],
    slots: [
      { name: 'cover', title: 'Title', purpose: 'Brand statement', recommended_atoms: ['cover'] },
      {
        name: 'section-divider',
        title: 'Section Break',
        purpose: 'Visual section break between cover and vision',
        recommended_atoms: ['section-number-divider', 'cover'],
      },
      {
        name: 'vision',
        title: 'Vision',
        purpose: 'Where we are going',
        recommended_atoms: ['quote-pull', 'bullet-list', 'icon-badge', 'kpi-water-drop'],
      },
      {
        name: 'mission',
        title: 'Mission',
        purpose: 'Why we exist',
        recommended_atoms: ['quote-pull', 'bullet-list', 'icon-badge'],
      },
      {
        name: 'values',
        title: 'Values',
        purpose: 'What we stand for (3-7)',
        recommended_atoms: [
          'radial-wheel-segmented',
          'icon-row',
          'icon-grid',
          'magazine-column-grid',
          'isotype-prop-row',
          'bullet-list',
        ],
      },
      {
        name: 'principles',
        title: 'Principles',
        purpose: 'How we work',
        recommended_atoms: ['bullet-list', 'icon-badge', 'flow-chart'],
      },
      {
        name: 'commitments',
        title: 'Commitments',
        purpose: 'What we promise',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
    ],
    theme_affinity: ['organic-teal', 'organic-coral', 'organic-lavender'],
  },

  // ============================================================================
  // strategic-plan — annual planning
  // ============================================================================
  {
    id: 'strategic-plan',
    label: 'Strategic Plan',
    description: 'Annual planning — SWOT + goals + initiatives + metrics',
    audience: 'exec, board, manager',
    keywords: ['strategic', 'strategy', 'annual', 'planning', 'swot', 'goals', 'initiatives'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Plan title + period',
        recommended_atoms: ['cover'],
      },
      {
        name: 'mission',
        title: 'Mission',
        purpose: 'Reaffirm purpose',
        recommended_atoms: ['icon-row', 'icon-grid', 'bullet-list', 'icon-badge'],
      },
      {
        name: 'swot',
        title: 'SWOT',
        purpose: 'Strengths/Weaknesses/Opportunities/Threats',
        recommended_atoms: ['swot', 'matrix-grid', 'nine-field-matrix'],
      },
      {
        name: 'goals',
        title: 'Strategic Goals',
        purpose: '3-5 north stars',
        recommended_atoms: ['radial-wheel-segmented', 'bullet-list', 'pyramid', 'icon-badge'],
      },
      {
        name: 'initiatives',
        title: 'Initiatives',
        purpose: 'Workstreams that move goals',
        recommended_atoms: ['value-chain-diagram', 'matrix-grid', 'gantt', 'magazine-column-grid'],
      },
      {
        name: 'metrics',
        title: 'Success Metrics',
        purpose: 'How we measure progress',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'line', 'kpi-card'],
      },
      {
        name: 'timeline',
        title: 'Timeline',
        purpose: 'Milestones across the year',
        recommended_atoms: ['gantt', 'timeline', 'progression'],
      },
    ],
    theme_affinity: ['editorial-navy', 'editorial-forest', 'pitch-cobalt-orange'],
  },

  // ============================================================================
  // okr-goal-setting — quarterly objectives
  // ============================================================================
  {
    id: 'okr-goal-setting',
    label: 'OKR Goal-Setting',
    description: 'Objectives + Key Results for the quarter',
    audience: 'team, individual, manager',
    keywords: ['okr', 'goal', 'objective', 'key result', 'kr', 'north star'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'OKR period + owner',
        recommended_atoms: ['cover'],
      },
      {
        name: 'north-star',
        title: 'North Star',
        purpose: 'The big-picture company KR',
        recommended_atoms: ['stat-banner', 'kpi-card', 'sphere-fill', 'kpi-water-drop'],
      },
      {
        name: 'objective-1',
        title: 'Objective',
        purpose: 'Aspirational, qualitative',
        recommended_atoms: ['radial-wheel-segmented', 'bullet-list', 'icon-badge'],
      },
      {
        name: 'key-results-1',
        title: 'Key Results',
        purpose: 'Measurable outcomes for O1',
        recommended_atoms: [
          'stat-banner',
          'dashboard-multi-kpi-composite',
          'progression',
          'kpi-card',
        ],
      },
      {
        name: 'objective-2',
        title: 'Objective',
        purpose: 'Aspirational, qualitative',
        recommended_atoms: ['bullet-list', 'icon-badge'],
      },
      {
        name: 'key-results-2',
        title: 'Key Results',
        purpose: 'Measurable outcomes for O2',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'progression', 'kpi-card'],
      },
      {
        name: 'actions',
        title: 'Top Actions',
        purpose: 'This-week / this-month priorities',
        recommended_atoms: ['bullet-list', 'gantt', 'timeline'],
      },
      {
        name: 'milestones',
        title: 'Milestones',
        purpose: 'Date-anchored checkpoints',
        recommended_atoms: ['timeline', 'progression', 'gantt'],
      },
    ],
    theme_affinity: ['pitch-cobalt-orange', 'pitch-black-neon', 'organic-teal'],
  },

  // ============================================================================
  // sales-pitch — externally-facing deal-closing sales pitch
  // ============================================================================
  {
    id: 'sales-pitch',
    label: 'Sales Pitch',
    description: 'Externally-facing deal-closing pitch — context, product, proof, CTA',
    audience: 'prospect, buyer, enterprise',
    keywords: ['sales', 'pitch', 'deal', 'close', 'playbook', 'proposal', 'commercial'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Company name + pitch tagline + presenter',
        recommended_atoms: ['cover'],
      },
      {
        name: 'hook',
        title: 'Executive Hook',
        purpose: 'One compelling statistic or pain point that opens the conversation',
        recommended_atoms: ['cover', 'kpi-card'],
      },
      {
        name: 'market-context',
        title: 'Market Context',
        purpose: 'Industry backdrop — size, trends, dynamics relevant to the buyer',
        recommended_atoms: ['kpi-card', 'line', 'column', 'bar'],
      },
      {
        name: 'product',
        title: 'Product Overview',
        purpose: 'What we offer — features and capabilities',
        recommended_atoms: ['icon-row', 'icon-grid', 'bullet-list'],
      },
      {
        name: 'value-prop',
        title: 'Value Proposition',
        purpose: 'Why us — differentiated benefits for this buyer',
        recommended_atoms: ['icon-grid', 'bullet-list', 'kpi-card'],
      },
      {
        name: 'proof',
        title: 'Proof Points',
        purpose: 'Customer results, case study metrics, references',
        recommended_atoms: ['stat-banner', 'quote-pull', 'kpi-card', 'line', 'bar'],
      },
      {
        name: 'pricing',
        title: 'Pricing',
        purpose: 'Tier structure, packages, or custom pricing note',
        recommended_atoms: ['comparison-table', 'pyramid', 'bullet-list', 'kpi-card'],
      },
      {
        name: 'objections',
        title: 'Common Objections',
        purpose: 'Anticipated buyer objections + rebuttals',
        recommended_atoms: ['bullet-list', 'fishbone'],
      },
      {
        name: 'cta',
        title: 'Call to Action',
        purpose: 'Next step — trial, pilot, POC, contract signature',
        recommended_atoms: ['cover', 'icon-row', 'bullet-list'],
      },
    ],
    theme_affinity: ['consulting-charcoal', 'financial-navy-cerulean', 'pitch-cobalt-orange'],
  },

  // ============================================================================
  // consulting-recommendation — McKinsey-style situation → recommendation arc
  // ============================================================================
  {
    id: 'consulting-recommendation',
    label: 'Consulting Recommendation',
    description: 'Situation → findings → recommendations arc (McKinsey pyramid principle)',
    audience: 'exec, board, client',
    keywords: [
      'consulting',
      'recommendation',
      'mckinsey',
      'situation',
      'findings',
      'framework',
      'advisory',
    ],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Engagement title + client + date',
        recommended_atoms: ['cover'],
      },
      {
        name: 'situation',
        title: 'Situation',
        purpose: 'Current state — what is happening and why it matters',
        recommended_atoms: ['bullet-list', 'kpi-card', 'icon-grid'],
      },
      {
        name: 'problem-def',
        title: 'Problem Definition',
        purpose: 'Root causes and contributing factors — what is broken',
        recommended_atoms: ['bullet-list', 'fishbone'],
      },
      {
        name: 'findings',
        title: 'Findings',
        purpose: 'Evidence and data — what the analysis reveals',
        recommended_atoms: ['bullet-list', 'kpi-card', 'line', 'bar'],
      },
      {
        name: 'framework',
        title: 'Framework',
        purpose: 'Analytical framework applied to structure the solution space',
        recommended_atoms: ['pyramid', 'layer-stack', 'matrix-grid', 'value-chain-diagram'],
      },
      {
        name: 'recommendations',
        title: 'Recommendations',
        purpose: 'Prioritized actions — what to do and why',
        recommended_atoms: ['bullet-list', 'icon-grid', 'kpi-card'],
      },
      {
        name: 'roadmap',
        title: 'Implementation Roadmap',
        purpose: 'Phased delivery plan with milestones and owners',
        recommended_atoms: ['timeline', 'progression'],
      },
      {
        name: 'next-steps',
        title: 'Next Steps',
        purpose: 'Immediate actions — who does what and when',
        recommended_atoms: ['timeline', 'bullet-list', 'icon-row'],
      },
    ],
    theme_affinity: ['consulting-charcoal', 'editorial-navy', 'editorial-burgundy'],
  },

  // ============================================================================
  // analysis-report — define → collect → analyze → interpret → recommend
  // ============================================================================
  {
    id: 'analysis-report',
    label: 'Analysis Report',
    description: 'Strategic analysis deck — SWOT, market, competitor, or thematic analysis',
    audience: 'exec, manager, analyst, stakeholder',
    keywords: [
      'analysis',
      'report',
      'swot',
      'market',
      'competitor',
      'research',
      'findings',
      'strategic analysis',
    ],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Report title + scope + date',
        recommended_atoms: ['cover'],
      },
      {
        name: 'scope',
        title: 'Scope & Methodology',
        purpose: 'What was analyzed and how data was collected',
        recommended_atoms: ['bullet-list', 'icon-row'],
      },
      {
        name: 'definition',
        title: 'Context & Definition',
        purpose: 'Define the subject — what are we analyzing and why',
        recommended_atoms: ['value-chain-diagram', 'pyramid', 'layer-stack'],
      },
      {
        name: 'data-findings',
        title: 'Data & Findings',
        purpose: 'Quantitative evidence — charts, metrics, raw data',
        recommended_atoms: ['stat-banner', 'line', 'column', 'bar', 'pie', 'kpi-card', 'scatter'],
      },
      {
        name: 'framework-analysis',
        title: 'Framework Analysis',
        purpose: 'Apply a strategic framework (SWOT, Porter, BCG, Ansoff)',
        recommended_atoms: [
          'swot',
          'value-chain-diagram',
          'matrix-grid',
          'nine-field-matrix',
          'fishbone',
        ],
      },
      {
        name: 'interpretation',
        title: 'Interpretation',
        purpose: 'What the data means — synthesis and insight',
        recommended_atoms: ['bullet-list', 'quote-pull', 'kpi-card'],
      },
      {
        name: 'recommendations',
        title: 'Recommendations',
        purpose: 'Actionable next steps based on findings',
        recommended_atoms: ['bullet-list', 'icon-grid'],
      },
      {
        name: 'appendix',
        title: 'Appendix',
        purpose: 'Supporting data, raw tables, methodology details',
        recommended_atoms: ['bullet-list', 'kpi-card', 'timeline'],
      },
    ],
    theme_affinity: ['editorial-navy', 'consulting-charcoal', 'financial-navy-cerulean'],
  },
  {
    id: 'financial-summary',
    label: 'Financial Summary',
    description: 'Formal financial summary report — income, balance, cashflow, ratios, outlook',
    audience: 'exec, board, investor, bank',
    keywords: [
      'financial',
      'finance',
      'income',
      'balance sheet',
      'cashflow',
      'ratios',
      'outlook',
      'annual report',
      'financial report',
    ],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Report title + period + presenter',
        recommended_atoms: ['cover'],
      },
      {
        name: 'exec-statement',
        title: 'Executive Statement',
        purpose: 'CEO or CFO opening statement — key message for the period',
        recommended_atoms: ['quote-pull', 'bullet-list'],
      },
      {
        name: 'highlights-kpi',
        title: 'Financial Highlights',
        purpose: 'Top-line KPIs — revenue, EBITDA, net income, cash',
        recommended_atoms: ['stat-banner', 'dashboard-multi-kpi-composite', 'kpi-card'],
      },
      {
        name: 'income',
        title: 'Income Statement',
        purpose: 'Revenue breakdown and profitability waterfall',
        recommended_atoms: ['kpi-card', 'bar', 'column'],
      },
      {
        name: 'balance-sheet',
        title: 'Balance Sheet',
        purpose: 'Assets vs liabilities snapshot',
        recommended_atoms: ['kpi-card', 'dashboard-multi-kpi-composite'],
      },
      {
        name: 'cashflow',
        title: 'Cash Flow',
        purpose: 'Operating / investing / financing cash flows',
        recommended_atoms: ['line', 'column', 'bar'],
      },
      {
        name: 'ratios',
        title: 'Key Ratios',
        purpose: 'Liquidity, profitability, leverage ratios',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'radial-spoke', 'gauge'],
      },
      {
        name: 'segments',
        title: 'Segment Analysis',
        purpose: 'Revenue by business unit or geography',
        recommended_atoms: ['comparison-table', 'pie', 'bar', 'stacked-area'],
      },
      {
        name: 'outlook',
        title: 'Outlook & Forecast',
        purpose: 'Forward guidance and scenario planning',
        recommended_atoms: ['line', 'progression', 'timeline'],
      },
      {
        name: 'appendix',
        title: 'Appendix',
        purpose: 'Supporting tables and methodology notes',
        recommended_atoms: ['bullet-list', 'kpi-card'],
      },
    ],
    theme_affinity: ['financial-navy-cerulean', 'consulting-charcoal', 'editorial-navy'],
  },
  {
    id: 'hr-people-update',
    label: 'HR & People Update',
    description: 'Board-facing people update — hiring, headcount, development, retention',
    audience: 'board, exec, hr director',
    keywords: [
      'hr',
      'people',
      'human resources',
      'hiring',
      'headcount',
      'recruitment',
      'talent',
      'retention',
      'development',
    ],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'People update title + period',
        recommended_atoms: ['cover'],
      },
      {
        name: 'hiring',
        title: 'Hiring Overview',
        purpose: 'Open roles, offers made, hires closed',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'bar', 'kpi-card'],
      },
      {
        name: 'headcount',
        title: 'Headcount Metrics',
        purpose: 'Team size by department, region, or role type',
        recommended_atoms: ['kpi-card', 'bar', 'column', 'pie'],
      },
      {
        name: 'development',
        title: 'Team Development',
        purpose: 'Promotions, skills programs, learning initiatives',
        recommended_atoms: ['radial-wheel-segmented', 'bullet-list', 'progression', 'icon-grid'],
      },
      {
        name: 'training',
        title: 'Training & Learning',
        purpose: 'Training completion rates and programs underway',
        recommended_atoms: ['progression', 'bullet-list', 'agenda-list'],
      },
      {
        name: 'retention',
        title: 'Retention & Wellbeing',
        purpose: 'Turnover rates, engagement scores, wellbeing initiatives',
        recommended_atoms: ['line', 'kpi-card', 'gauge', 'swot'],
      },
      {
        name: 'culture',
        title: 'Culture & Engagement',
        purpose: 'Employee feedback, culture initiatives, recognition',
        recommended_atoms: ['quote-pull', 'bullet-list', 'icon-grid'],
      },
      {
        name: 'next-quarter',
        title: 'Next Quarter Plan',
        purpose: 'Hiring targets, initiatives planned, key milestones',
        recommended_atoms: ['timeline', 'bullet-list', 'kpi-card'],
      },
    ],
    theme_affinity: ['hr-slate-teal', 'editorial-navy', 'organic-teal'],
  },
  {
    id: 'change-roadmap',
    label: 'Change & Transformation Roadmap',
    description:
      'Change management deck — case for change, current→target state, journey, enablers',
    audience: 'exec, manager, change team',
    keywords: [
      'change',
      'transformation',
      'roadmap',
      'change management',
      'current state',
      'target state',
      'journey',
      'enablers',
    ],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Change program name + sponsor + date',
        recommended_atoms: ['cover'],
      },
      {
        name: 'case-for-change',
        title: 'Case for Change',
        purpose: 'Why change is necessary — data, context, burning platform',
        recommended_atoms: ['stat-banner', 'bullet-list', 'kpi-card', 'fishbone'],
      },
      {
        name: 'current-state',
        title: 'Current State',
        purpose: 'As-is situation — strengths, weaknesses, root causes',
        recommended_atoms: ['bullet-list', 'kpi-card', 'swot'],
      },
      {
        name: 'target-state',
        title: 'Target State',
        purpose: 'To-be vision — what success looks like',
        recommended_atoms: ['bullet-list', 'icon-grid', 'kpi-card'],
      },
      {
        name: 'journey-phases',
        title: 'Change Journey',
        purpose: 'Phase-by-phase transition path with milestones',
        recommended_atoms: ['change-curve-chart', 'progression', 'timeline'],
      },
      {
        name: 'enablers',
        title: 'Enablers',
        purpose: 'People, process, and technology levers that enable change',
        recommended_atoms: [
          'value-chain-diagram',
          'radial-wheel-segmented',
          'icon-grid',
          'bullet-list',
        ],
      },
      {
        name: 'risks',
        title: 'Risks & Mitigations',
        purpose: 'Top risks and mitigation strategies',
        recommended_atoms: ['swot', 'fishbone', 'bullet-list'],
      },
      {
        name: 'timeline',
        title: 'Delivery Timeline',
        purpose: 'Programme timeline with key deliverables and gates',
        recommended_atoms: ['timeline', 'progression', 'gantt'],
      },
    ],
    theme_affinity: ['consulting-charcoal', 'financial-navy-cerulean', 'editorial-navy'],
  },
  {
    id: 'investor-update',
    label: 'Investor Update',
    description: 'LP/seed-investor periodic update — quarterly cadence, metrics, wins, challenges',
    audience: 'lp, seed investor, board',
    keywords: [
      'investor update',
      'lp update',
      'quarterly update',
      'portfolio update',
      'investor letter',
    ],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Company name + update period + author',
        recommended_atoms: ['cover'],
      },
      {
        name: 'tldr',
        title: 'TL;DR',
        purpose: 'Headline summary — 3 key points this quarter',
        recommended_atoms: ['stat-banner', 'kpi-card', 'quote-pull'],
      },
      {
        name: 'metrics',
        title: 'Key Metrics',
        purpose: 'Current quarter KPIs — revenue, users, growth rates',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'stat-grid-large', 'line'],
      },
      {
        name: 'wins',
        title: 'Wins',
        purpose: 'Top accomplishments this quarter',
        recommended_atoms: ['bullet-list', 'icon-grid', 'quote-pull'],
      },
      {
        name: 'challenges',
        title: 'Challenges',
        purpose: 'What did not go well and what we learned',
        recommended_atoms: ['bullet-list', 'fishbone', 'swot'],
      },
      {
        name: 'next-quarter',
        title: 'Next Quarter',
        purpose: 'Plan and priorities for the coming quarter',
        recommended_atoms: ['bullet-list', 'timeline', 'progression'],
      },
      {
        name: 'ask',
        title: 'Ask',
        purpose: 'What we need from LPs — intros, advice, resources',
        recommended_atoms: ['bullet-list', 'icon-row', 'call-to-action'],
      },
      {
        name: 'cap-table-burn',
        title: 'Financials',
        purpose: 'Burn rate, runway, cap table highlights',
        recommended_atoms: ['kpi-card', 'dashboard-multi-kpi-composite', 'pie'],
      },
    ],
    theme_affinity: ['financial-navy-cerulean', 'consulting-charcoal', 'editorial-navy'],
  },
  {
    id: 'marketing-campaign',
    label: 'Marketing Campaign',
    description:
      'Campaign deck for launching a marketing initiative — audience, message, channels, budget',
    audience: 'marketing team, stakeholder, agency',
    keywords: ['marketing', 'campaign', 'launch', 'brand', 'advertising', 'go-to-market', 'gtm'],
    slots: [
      {
        name: 'cover',
        title: 'Title',
        purpose: 'Campaign name + tagline + date',
        recommended_atoms: ['cover'],
      },
      {
        name: 'brief',
        title: 'Campaign Brief',
        purpose: 'Campaign concept and strategic objective',
        recommended_atoms: ['quote-pull', 'bullet-list', 'stat-banner'],
      },
      {
        name: 'audience',
        title: 'Target Audience',
        purpose: 'Persona definition — who we are reaching',
        recommended_atoms: ['bullet-list', 'icon-grid', 'dashboard-multi-kpi-composite'],
      },
      {
        name: 'message',
        title: 'Core Message',
        purpose: 'Campaign narrative and key messaging pillars',
        recommended_atoms: ['quote-pull', 'bullet-list', 'icon-row'],
      },
      {
        name: 'channels',
        title: 'Channels',
        purpose: 'Where we will show up — digital, social, OOH, events',
        recommended_atoms: ['icon-grid', 'icon-row', 'comparison-table'],
      },
      {
        name: 'timeline',
        title: 'Campaign Timeline',
        purpose: 'Launch waves and campaign phases',
        recommended_atoms: ['timeline', 'progression', 'process-arrows'],
      },
      {
        name: 'budget',
        title: 'Budget',
        purpose: 'Spend allocation by channel or initiative',
        recommended_atoms: ['pie', 'bar', 'dashboard-multi-kpi-composite'],
      },
      {
        name: 'metrics',
        title: 'Success Metrics',
        purpose: 'KPIs we will measure — impressions, conversions, CAC',
        recommended_atoms: ['dashboard-multi-kpi-composite', 'kpi-card', 'stat-grid-large'],
      },
      {
        name: 'cta',
        title: 'Sign-off / Approval',
        purpose: 'Final CTA — campaign approval or next steps',
        recommended_atoms: ['call-to-action', 'bullet-list'],
      },
    ],
    theme_affinity: ['pitch-cobalt-orange', 'organic-coral', 'pitch-charcoal-yellow'],
  },
];

/**
 * Total slots across all scaffolds — useful for stats.
 * @returns {number}
 */
export function totalSlots() {
  return SCAFFOLDS.reduce((sum, s) => sum + s.slots.length, 0);
}

/**
 * Look up a scaffold by id. Returns null if not found.
 * @param {string} id
 * @returns {Scaffold|null}
 */
export function getScaffold(id) {
  return SCAFFOLDS.find((s) => s.id === id) || null;
}

/**
 * List all scaffolds (clones the array, safe to mutate).
 * @returns {Scaffold[]}
 */
export function listScaffolds() {
  return SCAFFOLDS.slice();
}

/**
 * For a given scaffold, return the affine theme objects ranked best-first.
 * Falls back to the first 3 atlas themes if affinity is empty.
 * @param {Scaffold|string} scaffoldOrId
 * @returns {import('../themes.js').ThemePreset[]}
 */
export function getThemeAffinity(scaffoldOrId) {
  const scaffold = typeof scaffoldOrId === 'string' ? getScaffold(scaffoldOrId) : scaffoldOrId;
  if (!scaffold) return [];
  const ranked = scaffold.theme_affinity
    .map((id) => ATLAS_THEMES.find((t) => t.id === id))
    .filter(Boolean);
  return ranked.length > 0 ? ranked : ATLAS_THEMES.slice(0, 3);
}

/**
 * Aggregate stats — useful for inventory dashboards.
 */
export function scaffoldStats() {
  const totalScaffoldCount = SCAFFOLDS.length;
  const slotCount = totalSlots();
  const uniqueAtomsRecommended = new Set();
  for (const s of SCAFFOLDS) {
    for (const slot of s.slots) {
      for (const a of slot.recommended_atoms) uniqueAtomsRecommended.add(a);
    }
  }
  return {
    scaffolds: totalScaffoldCount,
    totalSlots: slotCount,
    uniqueAtomsReferenced: uniqueAtomsRecommended.size,
    avgSlotsPerScaffold: Math.round((slotCount / totalScaffoldCount) * 10) / 10,
  };
}
