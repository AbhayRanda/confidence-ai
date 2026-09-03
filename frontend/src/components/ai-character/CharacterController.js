/**
 * CharacterController.js  v4
 * ─────────────────────────────────────────────────────────────
 * Improvements in this version:
 *  • Step 4 — Wrist rotation + random micro-gestures during TALKING
 *  • Step 5 — Eye squint on HAPPY, cheek puff geometry, lip corner tilt
 *  • Step 8 — audioAmplitude prop drives mouthOpen for real lip sync
 *  • Step 9 — preset prop swaps character palette
 *  • Step 10 — All geometries + materials created in useMemo, disposed on unmount
 * ─────────────────────────────────────────────────────────────
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CHARACTER_STATES,
  STATE_CONFIG,
  damp,
  CHARACTER_PRESETS,
} from './CharacterAnimations';

// ── Default Palette ───────────────────────────────────────────
const BASE_PALETTE = {
  skin:        '#e8c090',
  skinShadow:  '#c89060',
  skinLight:   '#f5d8b0',
  hair:        '#18182a',
  hairSheen:   '#3a3a6a',
  shirt:       '#7c5cfc',
  shirtDark:   '#5a3de8',
  pant:        '#18203a',
  eyeWhite:    '#f4f6ff',
  irisOuter:   '#7c5cfc',
  irisInner:   '#4a3ab0',
  pupil:       '#0a0820',
  catchlight:  '#ffffff',
  lip:         '#c07870',
  lipDark:     '#a05858',
  jacket:      '#1e2850',
  jacketLight: '#2a3870',
  lapel:       '#151c38',
  collar:      '#eef0ff',
  tie:         '#5b8def',
  tieDark:     '#3a6adc',
  tieKnot:     '#4a7ae0',
  teeth:       '#f5f5f8',
  sclera:      '#f0f4ff',
  brow:        '#1a1a2e',
  ear:         '#d8a878',
  nose:        '#d09870',
};

// ── Physical material factory ─────────────────────────────────
function pm(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, ...opts });
}

// ── Build material set from palette ──────────────────────────
function buildMaterials(C) {
  return {
    skin: pm(C.skin, {
      roughness: 0.65, metalness: 0.0,
      sheen: 0.25, sheenRoughness: 0.85,
      sheenColor: new THREE.Color(C.skinLight),
      clearcoat: 0.08, clearcoatRoughness: 0.5,
    }),
    skinDark:   pm(C.skinShadow, { roughness: 0.7,  metalness: 0.0 }),
    skinLight:  pm(C.skinLight,  { roughness: 0.55, metalness: 0.0 }),
    hair: pm(C.hair, {
      roughness: 0.35, metalness: 0.05,
      sheen: 0.5, sheenRoughness: 0.6,
      sheenColor: new THREE.Color(C.hairSheen),
    }),
    brow:   pm(C.brow,  { roughness: 0.4,  metalness: 0.0 }),
    shirt:  pm(C.shirt, {
      roughness: 0.55, metalness: 0.08,
      emissive: new THREE.Color(C.shirt), emissiveIntensity: 0.04,
    }),
    jacket: pm(C.jacket, {
      roughness: 0.45, metalness: 0.12,
      clearcoat: 0.3,  clearcoatRoughness: 0.7,
    }),
    jacketLight: pm(C.jacketLight, {
      roughness: 0.5, metalness: 0.1,
      clearcoat: 0.2, clearcoatRoughness: 0.8,
    }),
    lapel:  pm(C.lapel,  { roughness: 0.4, metalness: 0.18 }),
    collar: pm(C.collar, { roughness: 0.8, metalness: 0.0  }),
    tie: pm(C.tie, {
      roughness: 0.4, metalness: 0.05,
      sheen: 0.6, sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#a0c0ff'),
      emissive: new THREE.Color(C.tie), emissiveIntensity: 0.05,
    }),
    tieKnot:  pm(C.tieKnot, { roughness: 0.35, metalness: 0.08 }),
    pants:    pm(C.pant,    { roughness: 0.8,  metalness: 0.0  }),
    eyeWhite: pm(C.sclera,  { roughness: 0.2,  metalness: 0.0  }),
    iris: pm(C.irisOuter, {
      roughness: 0.05, metalness: 0.0,
      emissive: new THREE.Color(C.irisOuter), emissiveIntensity: 0.55,
      clearcoat: 1.0,  clearcoatRoughness: 0.0,
    }),
    irisInner: pm(C.irisInner, {
      roughness: 0.05, metalness: 0.0,
      emissive: new THREE.Color(C.irisInner), emissiveIntensity: 0.35,
    }),
    pupil: pm(C.pupil, { roughness: 0.0, metalness: 0.0 }),
    catchlight: pm(C.catchlight, {
      roughness: 0.0, metalness: 0.0,
      emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.0,
    }),
    lip: pm(C.lip, {
      roughness: 0.5,  metalness: 0.0,
      clearcoat: 0.25, clearcoatRoughness: 0.3,
      sheen: 0.15, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffbbaa'),
    }),
    lipDark: pm(C.lipDark, { roughness: 0.55, metalness: 0.0 }),
    teeth: pm(C.teeth, {
      roughness: 0.4, metalness: 0.0,
      emissive: new THREE.Color('#f8f8f8'), emissiveIntensity: 0.06,
    }),
    nose:  pm(C.nose, { roughness: 0.65, metalness: 0.0 }),
    ear:   pm(C.ear,  { roughness: 0.7,  metalness: 0.0 }),
    cheek: pm(C.skin, {   // Step 5: cheek puff material
      roughness: 0.6, metalness: 0.0,
      transparent: true, opacity: 0.0,
      emissive: new THREE.Color('#ffb0a0'), emissiveIntensity: 0.0,
    }),
    aura: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(C.shirt),
      roughness: 1.0, metalness: 0.0,
      transparent: true, opacity: 0.0,
      emissive: new THREE.Color(C.shirt),
      emissiveIntensity: 0.0,
      side: THREE.BackSide,
    }),
  };
}

// ── Build geometry set ────────────────────────────────────────
function buildGeometries() {
  return {
    // Head
    skull:     new THREE.SphereGeometry(0.225, 40, 40),
    jaw:       new THREE.SphereGeometry(0.200, 32, 28),
    chin:      new THREE.SphereGeometry(0.060, 16, 16),

    // Face features
    eyeball:   new THREE.SphereGeometry(0.058, 24, 24),
    iris:      new THREE.SphereGeometry(0.038, 18, 18),
    pupil:     new THREE.SphereGeometry(0.022, 14, 14),
    catchlight:new THREE.SphereGeometry(0.008, 8, 8),
    brow:      new THREE.CapsuleGeometry(0.006, 0.075, 4, 10),
    ear:       new THREE.SphereGeometry(0.052, 16, 16),
    earLobeL:  new THREE.SphereGeometry(0.028, 12, 12),
    nose:      new THREE.SphereGeometry(0.034, 14, 14),
    nostrilL:  new THREE.SphereGeometry(0.018, 10, 10),
    nostrilR:  new THREE.SphereGeometry(0.018, 10, 10),
    upperLip:  new THREE.CapsuleGeometry(0.009, 0.095, 4, 10),
    lowerLip:  new THREE.CapsuleGeometry(0.011, 0.088, 4, 10),
    lipCornerL:new THREE.SphereGeometry(0.012, 8, 8),   // Step 5
    lipCornerR:new THREE.SphereGeometry(0.012, 8, 8),   // Step 5
    cheekL:    new THREE.SphereGeometry(0.052, 14, 14), // Step 5
    cheekR:    new THREE.SphereGeometry(0.052, 14, 14), // Step 5
    teeth:     new THREE.BoxGeometry(0.095, 0.022, 0.010),
    philtrum:  new THREE.SphereGeometry(0.018, 10, 10),

    // Hair
    hairTop:   new THREE.SphereGeometry(0.228, 36, 28, 0, Math.PI * 2, 0, Math.PI / 2),
    hairFront: new THREE.BoxGeometry(0.18,  0.06,  0.04),
    hairSideL: new THREE.BoxGeometry(0.055, 0.160, 0.230),
    hairSideR: new THREE.BoxGeometry(0.055, 0.160, 0.230),
    hairBack:  new THREE.BoxGeometry(0.380, 0.130, 0.052),

    // Neck / Torso
    neck:     new THREE.CylinderGeometry(0.090, 0.105, 0.150, 20),
    torso:    new THREE.CapsuleGeometry(0.235, 0.440, 10, 20),
    shoulder: new THREE.SphereGeometry(0.130, 20, 20),
    lapelL:   new THREE.BoxGeometry(0.082, 0.300, 0.045),
    lapelR:   new THREE.BoxGeometry(0.082, 0.300, 0.045),
    collarL:  new THREE.BoxGeometry(0.070, 0.065, 0.042),
    collarR:  new THREE.BoxGeometry(0.070, 0.065, 0.042),
    tieBody:  new THREE.BoxGeometry(0.052, 0.340, 0.016),
    tieKnot:  new THREE.BoxGeometry(0.060, 0.045, 0.030),
    button:   new THREE.SphereGeometry(0.010, 8, 8),
    waist:    new THREE.CylinderGeometry(0.220, 0.200, 0.150, 20),

    // Arms
    upperArm: new THREE.CapsuleGeometry(0.078, 0.260, 10, 14),
    lowerArm: new THREE.CapsuleGeometry(0.064, 0.230, 10, 14),
    wrist:    new THREE.SphereGeometry(0.062, 16, 14),
    palm:     new THREE.SphereGeometry(0.072, 18, 14),
    thumb:    new THREE.CapsuleGeometry(0.023, 0.068, 4, 8),
    finger:   new THREE.CapsuleGeometry(0.017, 0.072, 4, 8),
    fingerTip:new THREE.SphereGeometry(0.019, 8, 8),

    // Aura
    aura: new THREE.CapsuleGeometry(0.260, 0.460, 10, 20),
  };
}

// ─────────────────────────────────────────────────────────────
// Eye component — layered construction
// ─────────────────────────────────────────────────────────────
function Eye({ position, pupilOffX = 0, pupilOffY = 0, dilated = false, squint = 0, G, M }) {
  const irisScale = dilated ? 1.15 : 1.0;
  // Step 5: squint compresses eye Y scale
  const squintScale = 1 - squint * 0.35;
  return (
    <group position={position} scale={[1, squintScale, 1]}>
      {/* Sclera */}
      <mesh geometry={G.eyeball} material={M.eyeWhite} />
      {/* Iris outer ring */}
      <mesh
        geometry={G.iris}
        material={M.iris}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.032]}
        scale={[irisScale, irisScale, 1]}
      />
      {/* Iris inner (depth illusion) */}
      <mesh
        geometry={G.iris}
        material={M.irisInner}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.038]}
        scale={[irisScale * 0.6, irisScale * 0.6, 1]}
      />
      {/* Dark pupil */}
      <mesh
        geometry={G.pupil}
        material={M.pupil}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.044]}
      />
      {/* Catchlight (specular highlight) */}
      <mesh
        geometry={G.catchlight}
        material={M.catchlight}
        position={[pupilOffX * 0.013 + 0.014, pupilOffY * 0.011 + 0.014, 0.052]}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Hand component
// ─────────────────────────────────────────────────────────────
function Hand({ position, rotation, thumbsUp = false, isLeft = false, G, M }) {
  const dir = isLeft ? -1 : 1;
  return (
    <group position={position} rotation={rotation}>
      {/* Palm */}
      <mesh geometry={G.palm} material={M.skin} />
      {/* Wrist transition */}
      <mesh geometry={G.wrist} material={M.skin} position={[0, 0.04, 0]} />
      {/* Thumb */}
      <mesh
        geometry={G.thumb}
        material={M.skin}
        position={thumbsUp
          ? [dir * 0.01, 0.11, 0]
          : [dir * 0.07, 0.025, 0.01]}
        rotation={thumbsUp
          ? [0, 0, dir * 0.2]
          : [0.2, dir * 0.3, dir * Math.PI / 2.8]}
      />
      {/* 4 fingers */}
      {[
        { x: dir * -0.045, rot: 0.0 },
        { x: dir * -0.015, rot: 0.0 },
        { x: dir *  0.015, rot: 0.0 },
        { x: dir *  0.042, rot: 0.1 },
      ].map(({ x, rot }, i) => (
        <group key={i}>
          <mesh
            geometry={G.finger}
            material={M.skin}
            position={thumbsUp ? [x, -0.05, 0.06] : [x, 0.09, 0.01]}
            rotation={thumbsUp ? [Math.PI / 2.2, rot, 0] : [0.1, rot, 0]}
          />
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Main CharacterMesh
// ─────────────────────────────────────────────────────────────
export function CharacterMesh({
  state         = CHARACTER_STATES.IDLE,
  mousePosition = { x: 0, y: 0 },
  audioAmplitude = 0,   // Step 8: 0–1 real audio amplitude
  preset        = null, // Step 9: preset index or null
}) {

  // Step 9: Resolve palette from preset
  const C = useMemo(() => {
    if (preset !== null && CHARACTER_PRESETS?.[preset]) {
      return { ...BASE_PALETTE, ...CHARACTER_PRESETS[preset].palette };
    }
    return BASE_PALETTE;
  }, [preset]);

  // Step 10: Build geometries in useMemo — disposed on unmount
  const G = useMemo(() => buildGeometries(), []);
  useEffect(() => () => Object.values(G).forEach(g => g.dispose?.()), [G]);

  // Step 10: Build materials in useMemo keyed on palette — disposed on unmount
  const M = useMemo(() => buildMaterials(C), [C]);
  useEffect(() => () => Object.values(M).forEach(m => m.dispose?.()), [M]);

  // Cloned live-animatable materials
  const shirtMat = useMemo(() => M.shirt.clone(), [M]);
  const tieMat   = useMemo(() => M.tie.clone(),   [M]);
  const auraMat  = useMemo(() => M.aura.clone(),   [M]);
  const cheekMatL = useMemo(() => M.cheek.clone(), [M]);
  const cheekMatR = useMemo(() => M.cheek.clone(), [M]);
  useEffect(() => () => {
    shirtMat.dispose(); tieMat.dispose(); auraMat.dispose();
    cheekMatL.dispose(); cheekMatR.dispose();
  }, [shirtMat, tieMat, auraMat, cheekMatL, cheekMatR]);

  // ── Refs ────────────────────────────────────────────────────
  const rootRef        = useRef();
  const torsoRef       = useRef();
  const headRef        = useRef();
  const neckRef        = useRef();
  const leftArmRef     = useRef();
  const rightArmRef    = useRef();
  const leftForeRef    = useRef();
  const rightForeRef   = useRef();
  const leftWristRef   = useRef(); // Step 4
  const rightWristRef  = useRef(); // Step 4
  const mouthTopRef    = useRef();
  const mouthBotRef    = useRef();
  const leftEyeRef     = useRef();
  const rightEyeRef    = useRef();
  const eyebrowLRef    = useRef();
  const eyebrowRRef    = useRef();
  const teethRef       = useRef();
  const auraRef        = useRef();
  const cheekLRef      = useRef(); // Step 5
  const cheekRRef      = useRef(); // Step 5
  const lipCornerLRef  = useRef(); // Step 5
  const lipCornerRRef  = useRef(); // Step 5

  // ── Animated values ─────────────────────────────────────────
  const anim = useRef({
    time: 0,
    breathY:       0,
    headRotX:      0, headRotY:     0, headRotZ:     0,
    bodyRotZ:      0, torsoRotX:    0,
    leftArmRotZ:   0, rightArmRotZ: 0,
    leftForeRotX:  0, rightForeRotX:0,
    // Step 4: wrist rotation
    leftWristRotY:  0, rightWristRotY: 0,
    mouthOpen:     0, teethScaleY:  0,
    eyeScaleY:     1,
    // Step 5: squint & cheek
    eyeSquint:     0,
    cheekScale:    0,
    lipCornerY:    0,
    eyebrowY:      0, eyebrowRotZ:  0,
    pupilOffX:     0, pupilOffY:    0,
    auraOpacity:   0, auraScale:    1,
    emissiveShirt: 0.04,
    emissiveTie:   0.05,
    nextBlink:     3000, blinkTimer: 0, blinkPhase: 0,
    targetHeadX:   0,   targetHeadY: 0,
    // Step 4: micro-gesture timer
    microGestureTimer: 0,
    microGestureNext:  4000 + Math.random() * 3000,
    microGesturePhase: 0,   // 0=idle, 1=up, 2=hold, 3=down
    microGestureArm:   'left',
    microGestureBoost: 0,
  });

  const cfg = STATE_CONFIG[state] || STATE_CONFIG[CHARACTER_STATES.IDLE];

  const isActive  = [CHARACTER_STATES.TALKING, CHARACTER_STATES.HAPPY, CHARACTER_STATES.GREETING,
                     CHARACTER_STATES.ENCOURAGING, CHARACTER_STATES.GESTURE].includes(state);
  const isHappy   = [CHARACTER_STATES.HAPPY, CHARACTER_STATES.GREETING, CHARACTER_STATES.ENCOURAGING].includes(state);

  const targetAuraOpacity   = isActive ? 0.07 : 0;
  const targetEmissiveShirt = isActive ? 0.14 : 0.04;
  const targetEmissiveTie   = isHappy  ? 0.18 : 0.05;

  useFrame((_, delta) => {
    const a  = anim.current;
    const dt = Math.min(delta, 0.05);
    a.time      += dt;
    a.blinkTimer += dt * 1000;

    // ── Blink ───────────────────────────────────────────────
    if (a.blinkPhase === 0 && a.blinkTimer > a.nextBlink) {
      a.blinkPhase = 1; a.blinkTimer = 0;
    }
    if (a.blinkPhase === 1) {
      a.eyeScaleY = Math.max(0.04, a.eyeScaleY - dt * 14);
      if (a.eyeScaleY <= 0.04) a.blinkPhase = 2;
    }
    if (a.blinkPhase === 2) {
      a.eyeScaleY = Math.min(1.0, a.eyeScaleY + dt * 14);
      if (a.eyeScaleY >= 1.0) {
        a.blinkPhase = 0;
        const [lo, hi] = cfg.blinkInterval;
        a.nextBlink = lo + Math.random() * (hi - lo);
      }
    }

    // Step 5: eye squint — compress Y slightly on happy/encouraging
    const targetSquint = isHappy ? 0.55 : 0;
    a.eyeSquint = damp(a.eyeSquint, targetSquint, 4, dt);
    const squintScaleY = (1 - a.eyeSquint * 0.35) * a.eyeScaleY;
    if (leftEyeRef.current)  leftEyeRef.current.scale.y  = squintScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = squintScaleY;

    // Step 5: cheek puff — inflate on happy states
    const targetCheek = isHappy ? 1.18 : 1.0;
    a.cheekScale = damp(a.cheekScale, targetCheek, 4, dt);
    if (cheekLRef.current) cheekLRef.current.scale.setScalar(a.cheekScale);
    if (cheekRRef.current) cheekRRef.current.scale.setScalar(a.cheekScale);
    // cheek material opacity — fade in when happy
    const targetCheekOpacity = isHappy ? 0.25 : 0;
    cheekMatL.opacity = damp(cheekMatL.opacity, targetCheekOpacity, 4, dt);
    cheekMatR.opacity = damp(cheekMatR.opacity, targetCheekOpacity, 4, dt);
    cheekMatL.emissiveIntensity = cheekMatL.opacity * 0.3;
    cheekMatR.emissiveIntensity = cheekMatR.opacity * 0.3;

    // Step 5: lip corner tilt — up for smile, neutral otherwise
    const targetLipCornerY = isHappy ? 0.007 :
      (state === CHARACTER_STATES.THINKING || state === CHARACTER_STATES.ANALYZING) ? -0.005 : 0;
    a.lipCornerY = damp(a.lipCornerY, targetLipCornerY, 4, dt);
    if (lipCornerLRef.current) lipCornerLRef.current.position.y = -0.018 + a.lipCornerY;
    if (lipCornerRRef.current) lipCornerRRef.current.position.y = -0.018 + a.lipCornerY;

    // ── Mouse tracking ──────────────────────────────────────
    a.targetHeadX = damp(a.targetHeadX, mousePosition.y * 0.20, 3, dt);
    a.targetHeadY = damp(a.targetHeadY, mousePosition.x * 0.28, 3, dt);
    a.pupilOffX   = damp(a.pupilOffX, mousePosition.x, 5, dt);
    a.pupilOffY   = damp(a.pupilOffY, mousePosition.y, 5, dt);

    // ── Breathing ───────────────────────────────────────────
    const breathVal = Math.sin(a.time * cfg.breathSpeed * Math.PI * 2) * cfg.breathAmp;
    a.breathY = damp(a.breathY, breathVal, 8, dt);

    // ── Torso lean ──────────────────────────────────────────
    const targetLean = (cfg.torsoLean || 0) +
      Math.sin(a.time * cfg.breathSpeed * Math.PI * 2) * 0.004;
    a.torsoRotX = damp(a.torsoRotX, targetLean, 4, dt);

    // ── Head ────────────────────────────────────────────────
    const baseX = Math.sin(a.time * cfg.headBobSpeed  * Math.PI * 2) * cfg.headBobAmp;
    const baseY = Math.sin(a.time * cfg.headSwaySpeed * Math.PI * 2) * cfg.headSwayAmp;
    let extraZ  = 0;
    if (state === CHARACTER_STATES.THINKING)  extraZ = Math.sin(a.time * 0.5) * 0.065;
    if (state === CHARACTER_STATES.GREETING)  extraZ = Math.sin(a.time * 2.2) * 0.07 * Math.exp(-a.time * 0.3 % 1);
    if (state === CHARACTER_STATES.ANALYZING) extraZ = Math.sin(a.time * 1.9) * 0.055;
    a.headRotX = damp(a.headRotX, baseX + a.targetHeadX, 6, dt);
    a.headRotY = damp(a.headRotY, baseY + a.targetHeadY, 6, dt);
    a.headRotZ = damp(a.headRotZ, extraZ, 5, dt);

    // ── Body sway ───────────────────────────────────────────
    a.bodyRotZ = damp(a.bodyRotZ,
      Math.sin(a.time * cfg.bodySwaySpeed * Math.PI * 2) * cfg.bodySwayAmp, 6, dt);

    // ── Eyebrows ────────────────────────────────────────────
    const targetEyebrowY    = (cfg.eyebrowRaise || 0) +
      Math.sin(a.time * 1.3) * (cfg.eyebrowRaise || 0) * 0.35;
    const targetEyebrowRotZ = cfg.eyebrowFurrow || 0;
    a.eyebrowY    = damp(a.eyebrowY,    targetEyebrowY,    4, dt);
    a.eyebrowRotZ = damp(a.eyebrowRotZ, targetEyebrowRotZ, 4, dt);
    if (eyebrowLRef.current) {
      eyebrowLRef.current.position.y  = 0.115 + a.eyebrowY;
      eyebrowLRef.current.rotation.z  =  0.30 + a.eyebrowRotZ;
    }
    if (eyebrowRRef.current) {
      eyebrowRRef.current.position.y  = 0.115 + a.eyebrowY;
      eyebrowRRef.current.rotation.z  = -0.30 - a.eyebrowRotZ;
    }

    // ── Arms ────────────────────────────────────────────────
    let lArmZ = -0.3 + Math.sin(a.time * cfg.armIdleAmp * 10) * cfg.armIdleAmp * 2;
    let rArmZ =  0.3 - Math.sin(a.time * cfg.armIdleAmp * 10) * cfg.armIdleAmp * 2;
    let lForeX = 0, rForeX = 0;

    switch (state) {
      case CHARACTER_STATES.TALKING:
      case CHARACTER_STATES.GESTURE: {
        const t = a.time * 1.5;
        lArmZ  = -0.50 + Math.sin(t)       * 0.26;
        rArmZ  =  0.50 - Math.sin(t + 1.0) * 0.26;
        lForeX = -0.30 + Math.sin(t * 1.3) * 0.32;
        rForeX =  0.30 - Math.sin(t * 1.2) * 0.32;
        break;
      }
      case CHARACTER_STATES.GREETING: {
        const t = a.time * 3.2;
        rArmZ  = -0.92 + Math.sin(t) * 0.14;
        rForeX = -0.82 + Math.sin(t * 1.5) * 0.22;
        break;
      }
      case CHARACTER_STATES.HAPPY: {
        const t = a.time * 2.1;
        lArmZ  = -0.62 + Math.sin(t)       * 0.14;
        rArmZ  =  0.62 - Math.sin(t + 0.5) * 0.14;
        lForeX = -0.22 + Math.sin(t) * 0.10;
        rForeX =  0.22 - Math.sin(t) * 0.10;
        break;
      }
      case CHARACTER_STATES.ENCOURAGING: {
        const t = a.time * 1.9;
        rArmZ  = -0.82 + Math.sin(t) * 0.09;
        rForeX = -0.52 + Math.sin(t * 1.2) * 0.10;
        lArmZ  = -0.26 + Math.sin(t + 1.0) * 0.08;
        lForeX =  0.10;
        break;
      }
      case CHARACTER_STATES.THINKING: {
        rArmZ  =  0.18;
        rForeX = -0.62;
        break;
      }
      case CHARACTER_STATES.ANALYZING: {
        const t = a.time * 1.1;
        lArmZ  = -0.36 + Math.sin(t)       * 0.09;
        rArmZ  =  0.36 - Math.sin(t + 0.5) * 0.09;
        lForeX = -0.26;
        rForeX =  0.26;
        break;
      }
      case CHARACTER_STATES.LISTENING: {
        lArmZ  = -0.22;
        rArmZ  =  0.22;
        break;
      }
      default: break;
    }

    // Step 4: Micro-gesture during TALKING / GESTURE
    if (state === CHARACTER_STATES.TALKING || state === CHARACTER_STATES.GESTURE) {
      a.microGestureTimer += dt * 1000;
      if (a.microGesturePhase === 0 && a.microGestureTimer > a.microGestureNext) {
        // Pick random arm and trigger lift
        a.microGestureArm   = Math.random() > 0.5 ? 'left' : 'right';
        a.microGesturePhase = 1;
        a.microGestureTimer = 0;
        a.microGestureNext  = 3000 + Math.random() * 4000;
      }
      if (a.microGesturePhase === 1) {
        a.microGestureBoost = Math.min(1, a.microGestureBoost + dt * 3.5);
        if (a.microGestureBoost >= 1) a.microGesturePhase = 2;
      }
      if (a.microGesturePhase === 2) {
        a.microGestureTimer += dt * 1000;
        if (a.microGestureTimer > 600) a.microGesturePhase = 3;
      }
      if (a.microGesturePhase === 3) {
        a.microGestureBoost = Math.max(0, a.microGestureBoost - dt * 2.5);
        if (a.microGestureBoost <= 0) a.microGesturePhase = 0;
      }

      const boost = a.microGestureBoost * 0.28;
      if (a.microGestureArm === 'left')  lArmZ  -= boost;
      else                               rArmZ  -= boost;
    } else {
      // Reset when not talking
      a.microGesturePhase = 0;
      a.microGestureBoost = Math.max(0, a.microGestureBoost - dt * 3);
    }

    a.leftArmRotZ   = damp(a.leftArmRotZ,   lArmZ,  5, dt);
    a.rightArmRotZ  = damp(a.rightArmRotZ,  rArmZ,  5, dt);
    a.leftForeRotX  = damp(a.leftForeRotX,  lForeX, 5, dt);
    a.rightForeRotX = damp(a.rightForeRotX, rForeX, 5, dt);

    // Step 4: Wrist rotation — follows forearm with added oscillation
    const lWristTarget = Math.sin(a.time * 2.2) * 0.12 + a.leftForeRotX * 0.2;
    const rWristTarget = Math.sin(a.time * 2.0 + 0.8) * 0.12 + a.rightForeRotX * 0.2;
    a.leftWristRotY  = damp(a.leftWristRotY,  lWristTarget, 6, dt);
    a.rightWristRotY = damp(a.rightWristRotY, rWristTarget, 6, dt);
    if (leftWristRef.current)  leftWristRef.current.rotation.y  = a.leftWristRotY;
    if (rightWristRef.current) rightWristRef.current.rotation.y = a.rightWristRotY;

    // ── Mouth — Step 8: blend audio amplitude when speaking ─
    let targetMouth = cfg.mouthOpen;
    const isTalkingOrListening = [
      CHARACTER_STATES.TALKING, CHARACTER_STATES.HAPPY, CHARACTER_STATES.ENCOURAGING,
    ].includes(state);

    if (isTalkingOrListening) {
      if (audioAmplitude > 0.02) {
        // Real amplitude drives mouth
        targetMouth = Math.min(1, audioAmplitude * 2.2);
      } else {
        // Fallback sine wave
        targetMouth = cfg.mouthOpen * (0.45 + Math.abs(Math.sin(a.time * 4.8)) * 0.85);
      }
    }
    a.mouthOpen   = damp(a.mouthOpen,   targetMouth, 8, dt);
    a.teethScaleY = damp(a.teethScaleY, a.mouthOpen > 0.12 ? a.mouthOpen : 0, 8, dt);

    // ── Aura ─────────────────────────────────────────────────
    a.auraOpacity   = damp(a.auraOpacity,   targetAuraOpacity,   3, dt);
    a.emissiveShirt = damp(a.emissiveShirt, targetEmissiveShirt, 3, dt);
    a.emissiveTie   = damp(a.emissiveTie,   targetEmissiveTie,   3, dt);

    // ── Apply ────────────────────────────────────────────────
    if (torsoRef.current) {
      torsoRef.current.scale.y    = 1 + a.breathY;
      torsoRef.current.rotation.z = a.bodyRotZ;
      torsoRef.current.rotation.x = a.torsoRotX;
    }
    if (headRef.current) {
      headRef.current.rotation.x = a.headRotX;
      headRef.current.rotation.y = a.headRotY;
      headRef.current.rotation.z = a.headRotZ;
    }
    if (leftArmRef.current)   leftArmRef.current.rotation.z   = a.leftArmRotZ;
    if (rightArmRef.current)  rightArmRef.current.rotation.z  = a.rightArmRotZ;
    if (leftForeRef.current)  leftForeRef.current.rotation.x  = a.leftForeRotX;
    if (rightForeRef.current) rightForeRef.current.rotation.x = a.rightForeRotX;
    if (mouthTopRef.current)  mouthTopRef.current.position.y  =  0.025 + a.mouthOpen * 0.020;
    if (mouthBotRef.current)  mouthBotRef.current.position.y  = -0.018 - a.mouthOpen * 0.024;
    if (teethRef.current)     teethRef.current.scale.y        = Math.max(0.01, a.teethScaleY);

    if (auraRef.current) {
      auraRef.current.material.opacity           = a.auraOpacity;
      auraRef.current.material.emissiveIntensity = a.auraOpacity * 1.8;
      auraRef.current.scale.set(
        1 + a.auraOpacity * 0.08,
        1 + a.auraOpacity * 0.06,
        1 + a.auraOpacity * 0.08,
      );
    }

    // Shirt & tie emissive glow
    shirtMat.emissiveIntensity = a.emissiveShirt;
    tieMat.emissiveIntensity   = a.emissiveTie;

    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(a.time * 0.48) * 0.010;
    }
  });

  const isEncouraging = state === CHARACTER_STATES.ENCOURAGING;
  const isDilated     = isHappy;
  const a             = anim.current;

  return (
    <group ref={rootRef}>

      {/* ── AURA (back-face emissive shell) ─────────────────── */}
      <mesh ref={auraRef} geometry={G.aura} material={auraMat} position={[0, 0, 0]} />

      {/* ── TORSO ─────────────────────────────────────────── */}
      <group ref={torsoRef} position={[0, 0, 0]}>
        <mesh geometry={G.torso} material={shirtMat} />

        {/* Jacket lapels */}
        <mesh geometry={G.lapelL} material={M.jacket} position={[-0.108, 0.105, 0.180]} rotation={[0, 0.15, 0]} />
        <mesh geometry={G.lapelR} material={M.jacket} position={[ 0.108, 0.105, 0.180]} rotation={[0,-0.15, 0]} />

        {/* Shirt collar */}
        <mesh geometry={G.collarL} material={M.collar} position={[-0.038, 0.305, 0.165]} rotation={[0, 0.2, 0.06]} />
        <mesh geometry={G.collarR} material={M.collar} position={[ 0.038, 0.305, 0.165]} rotation={[0,-0.2,-0.06]} />

        {/* Tie knot + body */}
        <mesh geometry={G.tieKnot} material={M.tieKnot} position={[0, 0.285, 0.195]} />
        <mesh geometry={G.tieBody} material={tieMat}    position={[0, 0.095, 0.205]} />

        {/* Jacket buttons */}
        {[-0.06, 0.02, 0.10].map((y, i) => (
          <mesh key={i} geometry={G.button} material={M.lapel}
            position={[0, y, 0.215]} scale={[1, 1, 0.5]} />
        ))}

        {/* Shoulders */}
        <mesh geometry={G.shoulder} material={M.jacket} position={[-0.280, 0.270, 0]} />
        <mesh geometry={G.shoulder} material={M.jacket} position={[ 0.280, 0.270, 0]} />

        {/* Waist */}
        <mesh geometry={G.waist} material={M.pants} position={[0, -0.340, 0]} />

        {/* ── NECK ─────────────────────────────────────────── */}
        <group ref={neckRef} position={[0, 0.470, 0]}>
          <mesh geometry={G.neck} material={M.skin} />

          {/* ── HEAD ─────────────────────────────────────── */}
          <group ref={headRef} position={[0, 0.310, 0]}>

            {/* Skull */}
            <mesh geometry={G.skull} material={M.skin} />

            {/* Jaw */}
            <mesh geometry={G.jaw} material={M.skin} position={[0, -0.055, 0.042]} scale={[1, 0.78, 1]} />

            {/* Chin */}
            <mesh geometry={G.chin} material={M.skin} position={[0, -0.165, 0.082]} scale={[1.1, 0.7, 0.9]} />

            {/* Ears */}
            <mesh geometry={G.ear}     material={M.ear} position={[-0.218, 0.005, 0]} scale={[0.58, 0.92, 0.48]} />
            <mesh geometry={G.earLobeL} material={M.ear} position={[-0.218,-0.060, 0]} scale={[0.55, 0.55, 0.45]} />
            <mesh geometry={G.ear}     material={M.ear} position={[ 0.218, 0.005, 0]} scale={[0.58, 0.92, 0.48]} />
            <mesh geometry={G.earLobeL} material={M.ear} position={[ 0.218,-0.060, 0]} scale={[0.55, 0.55, 0.45]} />

            {/* Nose */}
            <mesh geometry={G.nose}    material={M.nose} position={[0, -0.042, 0.198]} scale={[1, 0.75, 0.82]} />
            <mesh geometry={G.nostrilL} material={M.nose} position={[-0.028,-0.070, 0.192]} scale={[0.65, 0.55, 0.55]} />
            <mesh geometry={G.nostrilR} material={M.nose} position={[ 0.028,-0.070, 0.192]} scale={[0.65, 0.55, 0.55]} />

            {/* Philtrum groove hint */}
            <mesh geometry={G.philtrum} material={M.skinDark || M.skin}
              position={[0, -0.095, 0.198]} scale={[0.35, 0.55, 0.25]} />

            {/* Step 5: Cheek puffs */}
            <mesh ref={cheekLRef} geometry={G.cheekL} material={cheekMatL}
              position={[-0.115, -0.010, 0.175]} scale={1.0} />
            <mesh ref={cheekRRef} geometry={G.cheekR} material={cheekMatR}
              position={[ 0.115, -0.010, 0.175]} scale={1.0} />

            {/* ── EYES ─────────────────────────────────── */}
            <group ref={leftEyeRef}  position={[-0.090, 0.045, 0.172]}>
              <Eye position={[0,0,0]} pupilOffX={a.pupilOffX} pupilOffY={a.pupilOffY}
                dilated={isDilated} squint={a.eyeSquint} G={G} M={M} />
            </group>
            <group ref={rightEyeRef} position={[ 0.090, 0.045, 0.172]}>
              <Eye position={[0,0,0]} pupilOffX={a.pupilOffX} pupilOffY={a.pupilOffY}
                dilated={isDilated} squint={a.eyeSquint} G={G} M={M} />
            </group>

            {/* ── EYEBROWS (capsule, animated via ref) ─── */}
            <mesh
              ref={eyebrowLRef}
              geometry={G.brow}
              material={M.brow}
              position={[-0.090, 0.115, 0.188]}
              rotation={[Math.PI/2, 0, 0.30]}
            />
            <mesh
              ref={eyebrowRRef}
              geometry={G.brow}
              material={M.brow}
              position={[ 0.090, 0.115, 0.188]}
              rotation={[Math.PI/2, 0, -0.30]}
            />

            {/* ── MOUTH ─────────────────────────────────── */}
            <mesh ref={mouthTopRef} geometry={G.upperLip} material={M.lip}
              position={[0,  0.025, 0.195]} rotation={[Math.PI/2, 0, 0]} />
            <mesh ref={mouthBotRef} geometry={G.lowerLip} material={M.lipDark}
              position={[0, -0.018, 0.195]} rotation={[Math.PI/2, 0, 0]} />
            <mesh ref={teethRef} geometry={G.teeth} material={M.teeth}
              position={[0, 0.004, 0.188]} scale={[1, 0.01, 1]} />

            {/* Step 5: Lip corners (smile / frown) */}
            <mesh ref={lipCornerLRef} geometry={G.lipCornerL} material={M.lip}
              position={[-0.052, -0.018, 0.193]} scale={[0.8, 0.7, 0.6]} />
            <mesh ref={lipCornerRRef} geometry={G.lipCornerR} material={M.lip}
              position={[ 0.052, -0.018, 0.193]} scale={[0.8, 0.7, 0.6]} />

            {/* ── HAIR ──────────────────────────────────── */}
            <mesh geometry={G.hairTop}  material={M.hair} position={[0, 0.012, 0]}    scale={[1.06, 1.12, 1.06]} />
            <mesh geometry={G.hairFront} material={M.hair} position={[0, 0.14, 0.195]} rotation={[0.35, 0, 0]} scale={[1, 0.6, 0.5]} />
            <mesh geometry={G.hairSideL} material={M.hair} position={[-0.210,-0.020, 0]} scale={[0.48, 0.72, 0.96]} />
            <mesh geometry={G.hairSideR} material={M.hair} position={[ 0.210,-0.020, 0]} scale={[0.48, 0.72, 0.96]} />
            <mesh geometry={G.hairBack}  material={M.hair} position={[0, -0.042, -0.198]} />
          </group>
        </group>

        {/* ── LEFT ARM ─────────────────────────────────────── */}
        <group ref={leftArmRef} position={[-0.360, 0.245, 0]}>
          <mesh geometry={G.upperArm} material={M.jacket} />
          <group ref={leftForeRef} position={[0, -0.250, 0]}>
            <mesh geometry={G.lowerArm} material={M.skin} position={[0, -0.145, 0]} />
            {/* Step 4: wrist rotation group */}
            <group ref={leftWristRef} position={[0, -0.320, 0]}>
              <Hand position={[0, 0, 0]} rotation={[0, 0, 0]} thumbsUp={false} isLeft={true} G={G} M={M} />
            </group>
          </group>
        </group>

        {/* ── RIGHT ARM ────────────────────────────────────── */}
        <group ref={rightArmRef} position={[0.360, 0.245, 0]}>
          <mesh geometry={G.upperArm} material={M.jacket} />
          <group ref={rightForeRef} position={[0, -0.250, 0]}>
            <mesh geometry={G.lowerArm} material={M.skin} position={[0, -0.145, 0]} />
            {/* Step 4: wrist rotation group */}
            <group ref={rightWristRef} position={[0, -0.320, 0]}>
              <Hand position={[0, 0, 0]} rotation={[0, 0, 0]} thumbsUp={isEncouraging} isLeft={false} G={G} M={M} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default CharacterMesh;
