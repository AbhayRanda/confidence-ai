import {
  evaluateWordVisemes,
  analyzeSpeechIntent,
  lsin,
  lerp,
  splitIntoSentences,
  analyzeProsodicCadence,
  computeSwallowReflex,
  CAMERA_PRESETS,
  STUDIO_LIGHTING_PRESETS,
  computeFingerPose,
  computeAudienceTracking,
} from './vrmPresenterEngine';

describe('Phase 2 Human Presenter Systems', () => {
  describe('evaluateWordVisemes', () => {
    test('handles empty or non-string input safely', () => {
      const res1 = evaluateWordVisemes('');
      expect(res1.aa).toBeGreaterThan(0);
      expect(res1.isBilabial).toBe(false);

      const res2 = evaluateWordVisemes(null);
      expect(res2.aa).toBeGreaterThan(0);
      expect(res2.isBilabial).toBe(false);
    });

    test('detects bilabial consonant stops (m, b, p)', () => {
      expect(evaluateWordVisemes('make').isBilabial).toBe(true);
      expect(evaluateWordVisemes('build').isBilabial).toBe(true);
      expect(evaluateWordVisemes('people').isBilabial).toBe(true);
      expect(evaluateWordVisemes('proud').isBilabial).toBe(true);
      expect(evaluateWordVisemes('impact').isBilabial).toBe(true);
      expect(evaluateWordVisemes('growth').isBilabial).toBe(false);
    });

    test('maps vowel phonemes accurately with normalized ranges [0, 1]', () => {
      const roundWord = evaluateWordVisemes('opportunity');
      expect(roundWord.oh).toBeGreaterThan(0.4);
      expect(roundWord.ou).toBeGreaterThan(0.3);
      expect(roundWord.oh).toBeLessThanOrEqual(1.0);

      const openWord = evaluateWordVisemes('path');
      expect(openWord.aa).toBe(1.0); // Dominant shape normalized to 1
      expect(openWord.jaw).toBeGreaterThan(0.05);

      const spreadWord = evaluateWordVisemes('believe');
      expect(spreadWord.ee).toBe(1.0); // Dominant shape normalized to 1
    });
  });

  describe('analyzeSpeechIntent', () => {
    test('identifies semantic gesture categories accurately', () => {
      expect(analyzeSpeechIntent('First, let us examine the core issue.')).toBe('enumerate');
      expect(analyzeSpeechIntent('However, on the other hand we have alternatives.')).toBe('contrast');
      expect(analyzeSpeechIntent('Together we will build the future vision.')).toBe('vision');
      expect(analyzeSpeechIntent('I believe in our shared mission.')).toBe('conviction');
      expect(analyzeSpeechIntent('We must deliver clear results.')).toBe('impact');
      expect(analyzeSpeechIntent('Let us start the demo.')).toBe('conversational');
    });
  });

  describe('lsin and lerp utilities', () => {
    test('lsin generates layered periodic noise', () => {
      const val = lsin(1.0, 1.2, 0.5, 0.4, 0.2);
      expect(typeof val).toBe('number');
      expect(isNaN(val)).toBe(false);
    });

    test('lerp smoothly moves towards target without overshoot', () => {
      const res = lerp(0, 10, 0.1, 0.016);
      expect(res).toBeGreaterThan(0);
      expect(res).toBeLessThan(10);
    });
  });

  describe('splitIntoSentences', () => {
    test('splits sentences cleanly with terminal punctuation', () => {
      const raw = 'Hello everyone! Today we will discuss our vision. Are you ready?';
      const sentences = splitIntoSentences(raw);
      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('Hello everyone!');
      expect(sentences[1]).toBe('Today we will discuss our vision.');
      expect(sentences[2]).toBe('Are you ready?');
    });

    test('breaks long unpunctuated text into clauses', () => {
      const raw = 'I want to thank everyone for coming and then we will discuss our future growth and also our strategy';
      const sentences = splitIntoSentences(raw);
      expect(sentences.length).toBeGreaterThan(1);
      sentences.forEach(s => {
        expect(/[.!?]$/.test(s)).toBe(true);
      });
    });
  });

  describe('Phase 3 Advanced Presenter Systems', () => {
    describe('analyzeProsodicCadence', () => {
      test('detects questions and triggers inquisitive upward pitch tilt + brow lift', () => {
        const res = analyzeProsodicCadence('How do we scale our impact?', 'scale', 1.0);
        expect(res.isQuestion).toBe(true);
        expect(res.headPitchDelta).toBeLessThan(0); // Upward pitch tilt in standard Three.js rotation.x
        expect(res.browDelta).toBeGreaterThan(0.3);
      });

      test('detects high emphasis statements and downbeat cadence', () => {
        const res = analyzeProsodicCadence('We must deliver exceptional results!', 'must', 1.0);
        expect(res.isEmphasis).toBe(true);
        expect(res.nodForce).toBeGreaterThan(0.2);
      });

      test('gracefully handles empty input', () => {
        const res = analyzeProsodicCadence('', '', 0);
        expect(res.isQuestion).toBe(false);
        expect(res.isEmphasis).toBe(false);
      });
    });

    describe('computeSwallowReflex', () => {
      test('computes swallow dip accurately on cycle', () => {
        const atSwallow = computeSwallowReflex(25.9, 0);
        expect(atSwallow.isSwallowing).toBe(true);
        expect(atSwallow.swallowDip).toBeGreaterThan(0);

        const normal = computeSwallowReflex(10.0, 0);
        expect(normal.isSwallowing).toBe(false);
        expect(normal.swallowDip).toBe(0);
      });
    });

    describe('CAMERA_PRESETS', () => {
      test('defines bust, keynote, and profile camera modes', () => {
        expect(CAMERA_PRESETS.bust).toBeDefined();
        expect(CAMERA_PRESETS.keynote).toBeDefined();
        expect(CAMERA_PRESETS.profile).toBeDefined();
        expect(CAMERA_PRESETS.bust.fov).toBe(28);
        expect(CAMERA_PRESETS.keynote.fov).toBe(34);
      });
    });
  });

  describe('Phase 4 Enterprise Broadcast & Adaptive Audience Kinesics', () => {
    describe('STUDIO_LIGHTING_PRESETS', () => {
      test('defines keynote, ted, and daylight broadcast environments', () => {
        expect(STUDIO_LIGHTING_PRESETS.keynote).toBeDefined();
        expect(STUDIO_LIGHTING_PRESETS.ted).toBeDefined();
        expect(STUDIO_LIGHTING_PRESETS.daylight).toBeDefined();
        expect(STUDIO_LIGHTING_PRESETS.keynote.keyIntensity).toBeGreaterThan(1.0);
        expect(STUDIO_LIGHTING_PRESETS.ted.rimColor).toBe('#f59e0b');
        expect(STUDIO_LIGHTING_PRESETS.daylight.catchlightColor).toBe('#ffffff');
      });
    });

    describe('computeFingerPose', () => {
      test('articulates index finger straight and other fingers curled in enumerate intent', () => {
        const indexPose = computeFingerPose('enumerate', 'Index', 'Distal', 'right', 0);
        const littlePose = computeFingerPose('enumerate', 'Little', 'Distal', 'right', 0);

        // Negative sign for right hand in Three.js
        expect(Math.abs(indexPose.curl)).toBeLessThan(0.15); // Straight index finger
        expect(Math.abs(littlePose.curl)).toBeGreaterThan(0.70); // Curled little finger into palm
      });

      test('applies expansive open palm splay in vision intent', () => {
        const visionIndex = computeFingerPose('vision', 'Index', 'Proximal', 'right', 0);
        const visionLittle = computeFingerPose('vision', 'Little', 'Proximal', 'right', 0);

        expect(Math.abs(visionIndex.curl)).toBeLessThan(0.10);
        expect(visionLittle.splay).toBeGreaterThan(0.10); // Outward fan
      });

      test('applies phalanx scaling properly (Proximal < Intermediate < Distal)', () => {
        const prox = computeFingerPose('conversational', 'Middle', 'Proximal', 'right', 0);
        const dist = computeFingerPose('conversational', 'Middle', 'Distal', 'right', 0);

        expect(Math.abs(prox.curl)).toBeLessThan(Math.abs(dist.curl));
      });
    });

    describe('computeAudienceTracking', () => {
      test('returns zero delta when audience mode is inactive', () => {
        const res = computeAudienceTracking({ x: 0.8, y: -0.5 }, false);
        expect(res.isTracking).toBe(false);
        expect(res.eyeX).toBe(0);
        expect(res.headYaw).toBe(0);
      });

      test('tracks pointer position and clamps head to anatomical limits when active', () => {
        const res = computeAudienceTracking({ x: 0.9, y: 0.8 }, true);
        expect(res.isTracking).toBe(true);
        expect(res.eyeX).toBeGreaterThan(0.3);
        // Head yaw clamped to comfort limit (default 0.32)
        expect(res.headYaw).toBeLessThanOrEqual(0.32);
        expect(Math.abs(res.headPitch)).toBeLessThanOrEqual(0.20);
      });
    });
  });
});

