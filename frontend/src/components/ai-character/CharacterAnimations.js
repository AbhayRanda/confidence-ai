/**
 * CharacterAnimations.js
 * ─────────────────────────────────────────────────────────────
 * Defines all animation states and provides easing/lerp helpers.
 * This is the single source of truth for animation parameters.
 * ─────────────────────────────────────────────────────────────
 */

export const CHARACTER_STATES = {
  IDLE:        'idle',
  LISTENING:   'listening',
  THINKING:    'thinking',
  ANALYZING:   'analyzing',   // NEW — during video upload/processing
  TALKING:     'talking',
  HAPPY:       'happy',
  GREETING:    'greeting',
  GESTURE:     'gesture',
  ENCOURAGING: 'encouraging',
};

/**
 * Animation configuration per state.
 *
 * Fields:
 *   breathSpeed / breathAmp        — torso breathing
 *   headBobSpeed / headBobAmp      — vertical head bob
 *   headSwaySpeed / headSwayAmp    — side-to-side head sway
 *   bodySwaySpeed / bodySwayAmp    — body sway
 *   armIdleAmp                     — idle arm swing amplitude
 *   blinkInterval                  — [min, max] ms between blinks
 *   mouthOpen                      — base mouth openness (0–1)
 *   torsoLean                      — forward lean amount (0 = upright, positive = forward)
 *   eyebrowRaise                   — how much eyebrows lift (0 = neutral)
 *   eyebrowFurrow                  — how much eyebrows angle/furrow (0 = neutral)
 *   label / description            — UI labels
 */
export const STATE_CONFIG = {
  [CHARACTER_STATES.IDLE]: {
    breathSpeed:    0.8,
    breathAmp:      0.012,
    headBobSpeed:   0.4,
    headBobAmp:     0.008,
    headSwaySpeed:  0.3,
    headSwayAmp:    0.006,
    bodySwaySpeed:  0.2,
    bodySwayAmp:    0.004,
    armIdleAmp:     0.008,
    blinkInterval:  [2500, 5000],
    mouthOpen:      0,
    torsoLean:      0,
    eyebrowRaise:   0,
    eyebrowFurrow:  0,
    label:          'Idle',
    description:    'Natural resting state with subtle breathing',
  },
  [CHARACTER_STATES.LISTENING]: {
    breathSpeed:    1.0,
    breathAmp:      0.014,
    headBobSpeed:   0.6,
    headBobAmp:     0.012,
    headSwaySpeed:  0.5,
    headSwayAmp:    0.01,
    bodySwaySpeed:  0.3,
    bodySwayAmp:    0.006,
    armIdleAmp:     0.005,
    blinkInterval:  [2000, 4000],
    mouthOpen:      0,
    torsoLean:      0.06,   // slight forward lean — attentive
    eyebrowRaise:   0.010,  // slightly raised — engaged
    eyebrowFurrow:  0,
    label:          'Listening',
    description:    'Attentive posture, slight forward lean',
  },
  [CHARACTER_STATES.THINKING]: {
    breathSpeed:    0.55,
    breathAmp:      0.009,
    headBobSpeed:   0.25,
    headBobAmp:     0.010,
    headSwaySpeed:  0.35,
    headSwayAmp:    0.028,  // more pronounced slow sway — pondering
    bodySwaySpeed:  0.12,
    bodySwayAmp:    0.003,
    armIdleAmp:     0.002,
    blinkInterval:  [3500, 7000], // blinks less often — deep thought
    mouthOpen:      0,
    torsoLean:      0.05,
    eyebrowRaise:   0,
    eyebrowFurrow:  0.026, // strongly furrowed — concentrating
    label:          'Thinking',
    description:    'Deep contemplative pose with chin-touch and head tilt',
  },
  [CHARACTER_STATES.ANALYZING]: {
    breathSpeed:    0.7,
    breathAmp:      0.011,
    headBobSpeed:   0.8,
    headBobAmp:     0.010,
    headSwaySpeed:  1.2,    // faster side-scan
    headSwayAmp:    0.025,
    bodySwaySpeed:  0.2,
    bodySwayAmp:    0.003,
    armIdleAmp:     0.012,
    blinkInterval:  [1200, 2500], // rapid blinking — "processing"
    mouthOpen:      0,
    torsoLean:      0.05,
    eyebrowRaise:   0,
    eyebrowFurrow:  0.012,
    label:          'Analyzing',
    description:    'Scanning/processing — rapid eye movement',
  },
  [CHARACTER_STATES.TALKING]: {
    breathSpeed:    1.4,
    breathAmp:      0.018,
    headBobSpeed:   1.2,
    headBobAmp:     0.018,
    headSwaySpeed:  0.9,
    headSwayAmp:    0.015,
    bodySwaySpeed:  0.8,
    bodySwayAmp:    0.01,
    armIdleAmp:     0.02,
    blinkInterval:  [1800, 3500],
    mouthOpen:      0.6,
    torsoLean:      0,
    eyebrowRaise:   0.008,  // slightly animated brows while talking
    eyebrowFurrow:  0,
    label:          'Talking',
    description:    'Active speaking with gestures and mouth movement',
  },
  [CHARACTER_STATES.HAPPY]: {
    breathSpeed:    1.6,
    breathAmp:      0.022,
    headBobSpeed:   1.4,
    headBobAmp:     0.025,
    headSwaySpeed:  1.0,
    headSwayAmp:    0.02,
    bodySwaySpeed:  1.0,
    bodySwayAmp:    0.015,
    armIdleAmp:     0.03,
    blinkInterval:  [1500, 3000],
    mouthOpen:      0.5,
    torsoLean:      -0.02,  // slight back lean — relaxed/joyful
    eyebrowRaise:   0.022,  // raised — happy surprise
    eyebrowFurrow:  0,
    label:          'Happy',
    description:    'Energetic and expressive happy state',
  },
  [CHARACTER_STATES.GREETING]: {
    breathSpeed:    1.2,
    breathAmp:      0.016,
    headBobSpeed:   1.0,
    headBobAmp:     0.02,
    headSwaySpeed:  0.7,
    headSwayAmp:    0.012,
    bodySwaySpeed:  0.6,
    bodySwayAmp:    0.008,
    armIdleAmp:     0.04,
    blinkInterval:  [2000, 4000],
    mouthOpen:      0.4,
    torsoLean:      -0.01,
    eyebrowRaise:   0.018,  // friendly raised brows
    eyebrowFurrow:  0,
    label:          'Greeting',
    description:    'Welcoming wave and nod',
  },
  [CHARACTER_STATES.GESTURE]: {
    breathSpeed:    1.1,
    breathAmp:      0.015,
    headBobSpeed:   0.9,
    headBobAmp:     0.016,
    headSwaySpeed:  0.8,
    headSwayAmp:    0.014,
    bodySwaySpeed:  0.7,
    bodySwayAmp:    0.009,
    armIdleAmp:     0.035,
    blinkInterval:  [2000, 4000],
    mouthOpen:      0.3,
    torsoLean:      0.02,
    eyebrowRaise:   0.012,
    eyebrowFurrow:  0.005,
    label:          'Gesture',
    description:    'Explanatory hand gestures',
  },
  [CHARACTER_STATES.ENCOURAGING]: {
    breathSpeed:    1.3,
    breathAmp:      0.018,
    headBobSpeed:   1.1,
    headBobAmp:     0.022,
    headSwaySpeed:  0.8,
    headSwayAmp:    0.016,
    bodySwaySpeed:  0.9,
    bodySwayAmp:    0.012,
    armIdleAmp:     0.025,
    blinkInterval:  [1800, 3500],
    mouthOpen:      0.45,
    torsoLean:      -0.01,
    eyebrowRaise:   0.020,  // enthusiastically raised
    eyebrowFurrow:  0,
    label:          'Encouraging',
    description:    'Motivational thumbs-up gesture',
  },
};

// ── Step 9: Character appearance presets (5 — matches app themes) ───
export const CHARACTER_PRESETS = [
  {
    id:    0,
    name:  'Cosmic Violet',
    color: '#7c5cfc',
    palette: {
      shirt:      '#7c5cfc',
      irisOuter:  '#7c5cfc',
      irisInner:  '#4a3ab0',
      tie:        '#5b8def',
      tieDark:    '#3a6adc',
      tieKnot:    '#4a7ae0',
      jacket:     '#1e2850',
      jacketLight:'#2a3870',
    },
  },
  {
    id:    1,
    name:  'Ocean Blue',
    color: '#00b4d8',
    palette: {
      skin:       '#f0c8a0',
      skinShadow: '#d4a070',
      skinLight:  '#ffe0c0',
      hair:       '#2a1a0a',
      hairSheen:  '#5a3a1a',
      shirt:      '#00b4d8',
      irisOuter:  '#00b4d8',
      irisInner:  '#0077aa',
      tie:        '#0096c7',
      tieDark:    '#0077a0',
      tieKnot:    '#00a0c8',
      jacket:     '#1a3040',
      jacketLight:'#224050',
      lapel:      '#102030',
    },
  },
  {
    id:    2,
    name:  'Sunset Orange',
    color: '#f97316',
    palette: {
      skin:       '#d4956a',
      skinShadow: '#b07040',
      skinLight:  '#e8b090',
      hair:       '#0f0a00',
      hairSheen:  '#2a1a00',
      shirt:      '#f97316',
      irisOuter:  '#f97316',
      irisInner:  '#c05010',
      tie:        '#ea580c',
      tieDark:    '#c2410c',
      tieKnot:    '#f06010',
      jacket:     '#1c1008',
      jacketLight:'#2a1810',
      lapel:      '#100800',
    },
  },
  {
    id:    3,
    name:  'Peak Emerald',
    color: '#10b981',
    palette: {
      skin:       '#f0c8a0',
      skinShadow: '#d4a070',
      skinLight:  '#ffe0c0',
      hair:       '#0a1a0a',
      hairSheen:  '#1a3a1a',
      shirt:      '#10b981',
      irisOuter:  '#10b981',
      irisInner:  '#065f46',
      tie:        '#0d9268',
      tieDark:    '#047857',
      tieKnot:    '#0fa678',
      jacket:     '#0a1f18',
      jacketLight:'#122b22',
      lapel:      '#061410',
    },
  },
  {
    id:    4,
    name:  'Executive Gold',
    color: '#f59e0b',
    palette: {
      skin:       '#e8c090',
      skinShadow: '#c89060',
      skinLight:  '#f5d8b0',
      hair:       '#18100a',
      hairSheen:  '#3a2a10',
      shirt:      '#f59e0b',
      irisOuter:  '#f59e0b',
      irisInner:  '#b45309',
      tie:        '#d97706',
      tieDark:    '#b45309',
      tieKnot:    '#e8a500',
      jacket:     '#1a1500',
      jacketLight:'#261e00',
      lapel:      '#100e00',
    },
  },
];

// ── Easing helpers ──────────────────────────────────────────────

/** Linear interpolation */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smooth-step easing */
export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Clamp value between min and max */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Damp (exponential approach) — dt-independent lerp */
export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}
