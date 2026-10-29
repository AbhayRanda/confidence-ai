/**
 * vrmPresenterEngine.js
 * ─────────────────────────────────────────────────────────────
 * Pure logic and algorithmic calculations for Human Presenter AI:
 *  • Word-synchronized phoneme-to-viseme extraction (evaluateWordVisemes)
 *  • Semantic speech intent analysis (analyzeSpeechIntent)
 *  • Layered sine noise generator (lsin)
 *  • Frame-rate independent lerp (lerp)
 * ─────────────────────────────────────────────────────────────
 */

// ── Word-synchronized Phoneme to Viseme Profiler ─────────────
export function evaluateWordVisemes(word) {
  if (!word || typeof word !== 'string') {
    return { aa: 0.50, oh: 0.25, ou: 0.15, ee: 0.20, jaw: 0.08, isBilabial: false };
  }
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) {
    return { aa: 0.50, oh: 0.25, ou: 0.15, ee: 0.20, jaw: 0.08, isBilabial: false };
  }

  // 1. Bilabial stop consonants (M, B, P) -> lips seal tightly
  const startsWithBilabial = /^[mbp]/.test(clean);
  const hasStrongBilabial = /(?:mb|mp|bb|pp|mm)/.test(clean);
  const isBilabial = startsWithBilabial || hasStrongBilabial;

  // 2. Vowel distribution & mouth shape weights
  let aa = 0.20;
  let oh = 0.15;
  let ou = 0.10;
  let ee = 0.20;
  let jaw = 0.07;

  // Round / O / U vowels (e.g., "you", "go", "forward", "through", "know", "bold", "together", "growth", "opportunity")
  if (/(?:oo|ou|ow|oa|oi|oy|au|aw|[ou])/i.test(clean)) {
    oh += 0.55;
    ou += 0.40;
    aa += 0.15;
    jaw += 0.05;
  }
  // Open / A vowels (e.g., "are", "path", "start", "can", "stand", "impact", "passion", "clarity")
  if (/(?:ah|ar|al|ay|ai|[a])/i.test(clean)) {
    aa += 0.60;
    jaw += 0.10;
  }
  // Wide / Spread / E / I vowels (e.g., "see", "we", "believe", "clear", "metrics", "give", "confidence", "excited")
  if (/(?:ee|ea|ey|ie|[ei])/i.test(clean)) {
    ee += 0.65;
    jaw += 0.04;
  }

  const maxVal = Math.max(aa, oh, ou, ee);
  return {
    aa: aa / maxVal,
    oh: oh / maxVal,
    ou: ou / maxVal,
    ee: ee / maxVal,
    jaw: Math.min(0.22, jaw),
    isBilabial,
  };
}

// ── Semantic Gesture & Intent Analyzer ──────────────────────
export function analyzeSpeechIntent(text) {
  if (!text || typeof text !== 'string') return 'conversational';
  const lower = text.toLowerCase();

  // 1. Enumerate / Counting:
  if (/\b(first|second|third|fourth|one|two|three|step|point|number|firstly|finally)\b/.test(lower)) {
    return 'enumerate';
  }
  // 2. Contrast / Weighing:
  if (/\b(however|but|instead|on the other hand|versus|compare|difference|alternatively|balance)\b/.test(lower)) {
    return 'contrast';
  }
  // 3. Expansive Vision / Growth / Inclusivity:
  if (/\b(growth|vision|future|expand|opportunity|together|everyone|all of us|world|scale|forward|build|impact)\b/.test(lower)) {
    return 'vision';
  }
  // 4. Heart / Personal Conviction / Sincerity:
  if (/\b(i believe|my goal|dedicated|passion|committed|promise|personally|i am|we are|proud|honored)\b/.test(lower)) {
    return 'conviction';
  }
  // 5. Decisive / Emphasis:
  if (/\b(must|crucial|essential|exactly|definitely|results|deliver|key|action|clear|certain)\b/.test(lower)) {
    return 'impact';
  }

  return 'conversational';
}

// ── Layered sine noise ─────────────────────────────────────────
export function lsin(t, f1, a1, f2 = 0, a2 = 0, f3 = 0, a3 = 0) {
  return Math.sin(t * f1) * a1 + Math.sin(t * f2 + 1.3) * a2 + Math.sin(t * f3 + 2.7) * a3;
}

// ── Smooth lerp (frame-rate independent) ────────────────────────
export function lerp(cur, target, speed, dt) {
  return cur + (target - cur) * Math.min(1, speed * dt * 60);
}

// ── Sentence splitter ensuring complete, clean sentences ────────
export function splitIntoSentences(text) {
  if (!text) return [];
  // Split on punctuation followed by whitespace, or line breaks
  let raw = text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  // If text lacked punctuation and resulted in only 1 long sentence, break by clauses or length
  if (raw.length <= 1 && text.split(/\s+/).length > 15) {
    const clauses = text
      .split(/\s*(?:,|;\s*|\s+(?:and then|so|but|however|also|because|additionally|moreover|furthermore)\s+)\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    if (clauses.length > 1) {
      raw = clauses;
    } else {
      const words = text.split(/\s+/);
      raw = [];
      const chunkSize = 14;
      for (let i = 0; i < words.length; i += chunkSize) {
        raw.push(words.slice(i, i + chunkSize).join(' '));
      }
    }
  }

  // Ensure each segment ends with proper punctuation
  return raw.map(s => {
    let cap = s.charAt(0).toUpperCase() + s.slice(1);
    return /[.!?]$/.test(cap) ? cap : cap + '.';
  });
}

// ── Phase 3: Prosodic Pitch & Cadence Engine ───────────────────
export function analyzeProsodicCadence(sentence, activeWord, t = 0) {
  if (!sentence || typeof sentence !== 'string') {
    return { isQuestion: false, isEmphasis: false, headPitchDelta: 0, headRollDelta: 0, browDelta: 0, nodForce: 0.12 };
  }
  const sTrim = sentence.trim();
  const isQuestion = /\?$/.test(sTrim) || /^(?:how|what|why|where|can we|do you|is it|will we)\b/i.test(sTrim);
  const isEmphasis = /!$/.test(sTrim) || /\b(?:absolutely|crucial|essential|transform|must|key|paramount|breakthrough)\b/i.test(sTrim);

  // Word syllable downbeat beat detection
  const isStressedWord = activeWord && (activeWord.length > 5 || /\b(?:bold|key|growth|scale|first|crucial|drive)\b/i.test(activeWord));
  const rhythmBeat = Math.sin(t * 7.2);
  const nodForce = isEmphasis ? 0.22 : (isStressedWord ? 0.18 : 0.12);
  const downbeatNod = (rhythmBeat > 0.80 && isStressedWord) ? 0.024 : 0;

  // Interrogative pitch contour: head tilts up slightly (+ brows raise)
  // Declarative drop: head settles downward slightly
  const headPitchDelta = isQuestion ? -0.038 : (isEmphasis ? 0.025 + downbeatNod : downbeatNod);
  const headRollDelta  = isQuestion ? 0.022 : (Math.sin(t * 1.5) * 0.012);
  const browDelta      = isQuestion ? 0.35 : (isEmphasis ? 0.28 : (downbeatNod > 0 ? 0.14 : 0));

  return {
    isQuestion,
    isEmphasis,
    headPitchDelta,
    headRollDelta,
    browDelta,
    nodForce,
  };
}

// ── Phase 3: Autonomic Swallow Reflex Simulator ───────────────
export function computeSwallowReflex(elapsedTime, lastSentenceChangeTime = 0) {
  // Swallow occurs every ~26 seconds or shortly after a sentence transition pause
  const cycleTime = 26.0;
  const cyclePhase = elapsedTime % cycleTime;
  const isPeriodicSwallow = cyclePhase > 25.82 && cyclePhase < 26.0;
  const isSentencePauseSwallow = (elapsedTime - lastSentenceChangeTime > 0.35 && elapsedTime - lastSentenceChangeTime < 0.52);

  const isSwallowing = isPeriodicSwallow || isSentencePauseSwallow;
  // Laryngeal bob: quick 0.16s vertical neck dip
  const swallowDip = isSwallowing ? 0.008 : 0.0;

  return { isSwallowing, swallowDip };
}

// ── Phase 3: Camera Shot Presets ──────────────────────────────
export const CAMERA_PRESETS = {
  bust: {
    id: 'bust',
    label: 'Cinematic Bust',
    icon: '👤',
    fov: 28,
    distMult: 0.55,
    yOffset: 0.78,
    camYMult: 0.95,
  },
  keynote: {
    id: 'keynote',
    label: 'Keynote Medium',
    icon: '🎙️',
    fov: 34,
    distMult: 0.85,
    yOffset: 0.72,
    camYMult: 0.90,
  },
  profile: {
    id: 'profile',
    label: 'Stage 45°',
    icon: '📐',
    fov: 30,
    distMult: 0.65,
    yOffset: 0.76,
    camYMult: 0.92,
    xAngleMult: 0.45,
  },
};

// ── Phase 4: Broadcast Studio Lighting Presets ────────────────
export const STUDIO_LIGHTING_PRESETS = {
  keynote: {
    id: 'keynote',
    label: 'Keynote Cyber Stage',
    icon: '🌌',
    keyColor: '#ffffff',
    keyIntensity: 1.35,
    keyPos: [0.6, 2.0, 1.4],
    rimColor: '#38bdf8',
    rimIntensity: 2.2,
    rimPos: [-0.9, 1.8, -1.1],
    fillColor: '#818cf8',
    fillIntensity: 0.50,
    fillPos: [-0.6, 1.0, 1.0],
    ambientColor: '#1e1b4b',
    ambientIntensity: 0.40,
    catchlightColor: '#38bdf8',
    catchlightIntensity: 2.2,
    description: 'Crisp 6500K keynote keylight with deep cyber-cyan edge contour',
  },
  ted: {
    id: 'ted',
    label: 'TED Global Warmth',
    icon: '✨',
    keyColor: '#fffbeb',
    keyIntensity: 1.45,
    keyPos: [0.5, 2.2, 1.5],
    rimColor: '#f59e0b',
    rimIntensity: 2.0,
    rimPos: [-0.8, 1.7, -1.0],
    fillColor: '#fbbf24',
    fillIntensity: 0.55,
    fillPos: [-0.5, 1.1, 0.9],
    ambientColor: '#292524',
    ambientIntensity: 0.45,
    catchlightColor: '#fef3c7',
    catchlightIntensity: 2.0,
    description: 'Warm 3200K tungsten spotlight with golden auditorium rim highlights',
  },
  daylight: {
    id: 'daylight',
    label: 'Broadcast Daylight',
    icon: '☀️',
    keyColor: '#ffffff',
    keyIntensity: 1.30,
    keyPos: [0.4, 2.2, 1.6],
    rimColor: '#e2e8f0',
    rimIntensity: 1.4,
    rimPos: [-0.7, 1.6, -0.9],
    fillColor: '#94a3b8',
    fillIntensity: 0.70,
    fillPos: [-0.6, 1.2, 1.2],
    ambientColor: '#334155',
    ambientIntensity: 0.55,
    catchlightColor: '#ffffff',
    catchlightIntensity: 2.4,
    description: 'Diffused 5600K high-key broadcast softboxes with neutral corneas',
  },
};

// ── Phase 4: Expressive Chironomia & Per-Finger Kinesics Engine
export function computeFingerPose(intent, finger, phalanx, side = 'right', t = 0) {
  const phalanxMultMap = {
    Proximal: 0.50,
    Intermediate: 0.80,
    Distal: 1.00,
  };
  const pMult = phalanxMultMap[phalanx] ?? 0.75;
  const flutter = lsin(t, 2.1, 0.012, 1.1, 0.006) * (side === 'left' ? 1 : -1);

  // Default resting curl
  let baseCurl = 0.65;
  let splay = 0.0;

  if (side === 'right') {
    switch (intent) {
      case 'enumerate':
        // Precision Index Point: index is straight, other fingers curled inward
        if (finger === 'Index') {
          baseCurl = 0.04 + Math.sin(t * 5.0) * 0.015;
          splay = -0.05;
        } else if (finger === 'Thumb') {
          baseCurl = 0.45;
          splay = -0.15;
        } else if (finger === 'Middle') {
          baseCurl = 0.82;
        } else if (finger === 'Ring') {
          baseCurl = 0.88;
        } else if (finger === 'Little') {
          baseCurl = 0.92;
        }
        break;

      case 'vision':
        // Expansive Open Welcoming Palm (Supine fanning)
        if (finger === 'Thumb') {
          baseCurl = 0.12;
          splay = -0.22;
        } else if (finger === 'Index') {
          baseCurl = 0.06;
          splay = -0.08;
        } else if (finger === 'Middle') {
          baseCurl = 0.10;
          splay = 0.0;
        } else if (finger === 'Ring') {
          baseCurl = 0.16;
          splay = 0.07;
        } else if (finger === 'Little') {
          baseCurl = 0.22;
          splay = 0.14;
        }
        break;

      case 'conviction':
        // Gentle Heart/Sternum Cup curvature
        if (finger === 'Thumb') {
          baseCurl = 0.28;
          splay = -0.10;
        } else if (finger === 'Index') {
          baseCurl = 0.32;
        } else if (finger === 'Middle') {
          baseCurl = 0.38;
        } else if (finger === 'Ring') {
          baseCurl = 0.42;
        } else if (finger === 'Little') {
          baseCurl = 0.46;
        }
        break;

      case 'impact':
        // Decisive tensioned chop
        if (finger === 'Thumb') {
          baseCurl = 0.24;
          splay = -0.18;
        } else if (finger === 'Index') {
          baseCurl = 0.16;
          splay = -0.04;
        } else if (finger === 'Middle') {
          baseCurl = 0.19;
        } else if (finger === 'Ring') {
          baseCurl = 0.22;
        } else if (finger === 'Little') {
          baseCurl = 0.26;
          splay = 0.05;
        }
        break;

      case 'contrast':
        // Balanced weighing palm
        if (finger === 'Thumb') {
          baseCurl = 0.18;
        } else if (finger === 'Index') {
          baseCurl = 0.14;
        } else if (finger === 'Middle') {
          baseCurl = 0.18;
        } else if (finger === 'Ring') {
          baseCurl = 0.22;
        } else if (finger === 'Little') {
          baseCurl = 0.26;
        }
        break;

      default:
        // Conversational dynamic curl with natural stagger
        if (finger === 'Thumb') baseCurl = 0.32;
        else if (finger === 'Index') baseCurl = 0.28;
        else if (finger === 'Middle') baseCurl = 0.38;
        else if (finger === 'Ring') baseCurl = 0.46;
        else if (finger === 'Little') baseCurl = 0.54;
        break;
    }
  } else {
    // Left hand: bilateral support or resting balance
    if (intent === 'vision' || intent === 'contrast') {
      if (finger === 'Thumb') baseCurl = 0.14;
      else if (finger === 'Index') baseCurl = 0.08;
      else if (finger === 'Middle') baseCurl = 0.12;
      else if (finger === 'Ring') baseCurl = 0.18;
      else if (finger === 'Little') baseCurl = 0.24;
    } else {
      // Relaxed resting hand
      if (finger === 'Thumb') baseCurl = 0.50;
      else if (finger === 'Index') baseCurl = 0.60;
      else if (finger === 'Middle') baseCurl = 0.68;
      else if (finger === 'Ring') baseCurl = 0.72;
      else if (finger === 'Little') baseCurl = 0.76;
    }
  }

  const sign = side === 'left' ? 1 : -1;
  const targetCurl = sign * (baseCurl + flutter) * pMult;
  const targetSplay = splay * (side === 'left' ? -1 : 1);

  return {
    curl: targetCurl,
    splay: targetSplay,
    baseCurl,
  };
}

// ── Phase 4: Biomechanical Audience Tracking & VOR Decoupling ─
export function computeAudienceTracking(mouseNorm, isAudienceActive = false, headLimits = { maxYaw: 0.32, maxPitch: 0.20 }) {
  if (!isAudienceActive || !mouseNorm) {
    return {
      eyeX: 0,
      eyeY: 0,
      headYaw: 0,
      headPitch: 0,
      isTracking: false,
    };
  }

  // Biological Vestibulo-Ocular Reflex (VOR):
  // 1. Eyes lead to track viewer pointer
  const eyeX = Math.max(-0.45, Math.min(0.45, mouseNorm.x * 0.42));
  const eyeY = Math.max(-0.35, Math.min(0.35, mouseNorm.y * 0.38));

  // 2. Head and neck smoothly follow with anatomical comfort limits
  const headYaw = Math.max(-headLimits.maxYaw, Math.min(headLimits.maxYaw, mouseNorm.x * 0.28));
  const headPitch = Math.max(-headLimits.maxPitch, Math.min(headLimits.maxPitch, -mouseNorm.y * 0.18));

  return {
    eyeX,
    eyeY,
    headYaw,
    headPitch,
    isTracking: true,
  };
}

