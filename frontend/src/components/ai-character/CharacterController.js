/**
 * CharacterController.js  v5 — Advanced Humanoid
 * ─────────────────────────────────────────────────────────────
 * Improvements in this version:
 *  • Better facial anatomy: oval skull, forehead ridge, cheekbones,
 *    nose bridge, wider jaw, elongated neck, Adam's apple hint
 *  • SSS skin simulation: high sheen/clearcoat, BackSide ear glow,
 *    pink emissive tint on active states
 *  • Richer 8-segment hair system with per-segment random offsets
 *  • 3-phalanx fingers with knuckle spheres and fingernails
 *  • Per-state finger curl animation
 *  • Secondary physics: head lag, forearm drag, hair momentum
 *  • Richer expressions: independent inner/outer brows, nostril flare,
 *    jaw-drop, tongue hint
 *  • Sternocleidomastoid neck muscle hints
 *  • Eyelash strips on upper lids
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
  skinSSS:     '#ff8870',   // subsurface scatter hint
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
  tongue:      '#d06860',
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
  nail:        '#f0c8c0',
  scm:         '#d4a070',   // sternocleidomastoid muscle
};

// ── Physical material factory ─────────────────────────────────
function pm(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, ...opts });
}

// ── Build material set from palette ──────────────────────────
function buildMaterials(C) {
  return {
    // ── Skin — improved SSS simulation ──
    skin: pm(C.skin, {
      roughness:         0.55,
      metalness:         0.0,
      sheen:             0.60,
      sheenRoughness:    0.65,
      sheenColor:        new THREE.Color(C.skinLight),
      clearcoat:         0.22,
      clearcoatRoughness:0.38,
      emissive:          new THREE.Color(C.skinSSS),
      emissiveIntensity: 0.0,  // animated in active states
    }),
    skinDark:   pm(C.skinShadow, { roughness: 0.68, metalness: 0.0 }),
    skinLight:  pm(C.skinLight,  { roughness: 0.50, metalness: 0.0 }),
    skinSSS: new THREE.MeshPhysicalMaterial({
      color:     new THREE.Color(C.skin),
      roughness: 0.8, metalness: 0.0,
      transparent: true, opacity: 0.22,
      emissive:  new THREE.Color(C.skinSSS),
      emissiveIntensity: 0.28,
      side: THREE.BackSide,
    }),
    // ── Hair ──
    hair: pm(C.hair, {
      roughness: 0.22,
      metalness: 0.06,
      sheen:     0.80,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color(C.hairSheen),
      clearcoat: 0.18,
      clearcoatRoughness: 0.52,
    }),
    brow:   pm(C.brow,  { roughness: 0.38, metalness: 0.0 }),
    // ── Clothes ──
    shirt:  pm(C.shirt, {
      roughness: 0.55, metalness: 0.08,
      emissive: new THREE.Color(C.shirt), emissiveIntensity: 0.04,
    }),
    jacket: pm(C.jacket, {
      roughness: 0.36, metalness: 0.18,
      clearcoat: 0.52, clearcoatRoughness: 0.60,
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
    // ── Eyes ──
    eyeWhite: pm(C.sclera,  { roughness: 0.18, metalness: 0.0  }),
    iris: pm(C.irisOuter, {
      roughness: 0.04, metalness: 0.0,
      emissive: new THREE.Color(C.irisOuter), emissiveIntensity: 0.55,
      clearcoat: 1.0,  clearcoatRoughness: 0.0,
    }),
    irisInner: pm(C.irisInner, {
      roughness: 0.04, metalness: 0.0,
      emissive: new THREE.Color(C.irisInner), emissiveIntensity: 0.35,
    }),
    pupil: pm(C.pupil, { roughness: 0.0, metalness: 0.0 }),
    catchlight: pm(C.catchlight, {
      roughness: 0.0, metalness: 0.0,
      emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.0,
    }),
    // ── Mouth ──
    lip: pm(C.lip, {
      roughness: 0.48,  metalness: 0.0,
      clearcoat: 0.28,  clearcoatRoughness: 0.28,
      sheen: 0.18, sheenRoughness: 0.48,
      sheenColor: new THREE.Color('#ffbbaa'),
    }),
    lipDark: pm(C.lipDark, { roughness: 0.55, metalness: 0.0 }),
    tongue: pm(C.tongue, {
      roughness: 0.8, metalness: 0.0,
      transparent: true, opacity: 0.0, // animated
    }),
    teeth: pm(C.teeth, {
      roughness: 0.4, metalness: 0.0,
      emissive: new THREE.Color('#f8f8f8'), emissiveIntensity: 0.06,
    }),
    // ── Face details ──
    nose:  pm(C.nose,  { roughness: 0.62, metalness: 0.0 }),
    ear:   pm(C.ear,   { roughness: 0.68, metalness: 0.0 }),
    cheek: pm(C.skin, {
      roughness: 0.6, metalness: 0.0,
      transparent: true, opacity: 0.0,
      emissive: new THREE.Color('#ffb0a0'), emissiveIntensity: 0.0,
    }),
    nail: pm(C.nail, {
      roughness: 0.12, metalness: 0.0,
      clearcoat: 0.9, clearcoatRoughness: 0.08,
      transparent: true, opacity: 0.85,
    }),
    scm: pm(C.scm || C.skin, { roughness: 0.7, metalness: 0.0, transparent: true, opacity: 0.55 }),
    // ── Accessories ──
    watch:    pm('#c8d4ea', { roughness: 0.06, metalness: 0.96, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
    watchBand:pm('#0c0a08', { roughness: 0.88, metalness: 0.02 }),
    cufflink: pm('#d0d8ea', { roughness: 0.05, metalness: 0.98, clearcoat: 1.0, clearcoatRoughness: 0.04,
      emissive: new THREE.Color('#c0c8e0'), emissiveIntensity: 0.12 }),
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
    // ── Head — improved oval skull ──
    skull:     new THREE.SphereGeometry(0.225, 48, 40),
    jaw:       new THREE.SphereGeometry(0.205, 36, 30),
    chin:      new THREE.SphereGeometry(0.058, 16, 16),
    foreheadRidge: new THREE.BoxGeometry(0.30, 0.028, 0.018),  // subtle brow shelf
    zygL:      new THREE.SphereGeometry(0.038, 12, 12),        // left cheekbone
    zygR:      new THREE.SphereGeometry(0.038, 12, 12),        // right cheekbone

    // ── Face features ──
    eyeball:   new THREE.SphereGeometry(0.058, 28, 24),
    iris:      new THREE.SphereGeometry(0.038, 20, 18),
    pupil:     new THREE.SphereGeometry(0.022, 14, 14),
    catchlight:new THREE.SphereGeometry(0.008, 8, 8),
    brow:      new THREE.CapsuleGeometry(0.006, 0.065, 4, 12), // shorter, thicker
    browInner: new THREE.CapsuleGeometry(0.006, 0.034, 4, 8),  // independent inner brow
    ear:       new THREE.SphereGeometry(0.050, 18, 16),
    earInner:  new THREE.SphereGeometry(0.030, 10, 10),        // inner ear helix
    earLobe:   new THREE.SphereGeometry(0.026, 12, 12),
    noseBridge:new THREE.BoxGeometry(0.022, 0.065, 0.018),     // nose bridge
    nose:      new THREE.SphereGeometry(0.034, 16, 14),
    nostrilL:  new THREE.SphereGeometry(0.018, 12, 10),
    nostrilR:  new THREE.SphereGeometry(0.018, 12, 10),
    upperLip:  new THREE.CapsuleGeometry(0.009, 0.090, 4, 12),
    lowerLip:  new THREE.CapsuleGeometry(0.012, 0.084, 4, 12),
    lipCornerL:new THREE.SphereGeometry(0.013, 10, 8),
    lipCornerR:new THREE.SphereGeometry(0.013, 10, 8),
    cheekL:    new THREE.SphereGeometry(0.050, 14, 14),
    cheekR:    new THREE.SphereGeometry(0.050, 14, 14),
    teeth:     new THREE.BoxGeometry(0.088, 0.020, 0.010),
    lowerTeeth:new THREE.BoxGeometry(0.080, 0.016, 0.010),
    tongue:    new THREE.SphereGeometry(0.040, 14, 10),
    philtrum:  new THREE.SphereGeometry(0.016, 10, 10),
    // Eyelash strips
    eyelashU:  new THREE.BoxGeometry(0.098, 0.005, 0.003),

    // ── Hair — 8 overlapping segments ──
    hairTop:    new THREE.SphereGeometry(0.232, 40, 30, 0, Math.PI * 2, 0, Math.PI / 2),
    hairCrown:  new THREE.SphereGeometry(0.214, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2.5),
    hairFront:  new THREE.BoxGeometry(0.200, 0.055, 0.042),
    hairFringe: new THREE.CapsuleGeometry(0.018, 0.160, 4, 10), // side fringe piece
    hairSideL:  new THREE.BoxGeometry(0.052, 0.175, 0.240),
    hairSideR:  new THREE.BoxGeometry(0.052, 0.175, 0.240),
    hairBack:   new THREE.BoxGeometry(0.395, 0.140, 0.055),
    hairTempleL:new THREE.BoxGeometry(0.032, 0.075, 0.022),
    hairTempleR:new THREE.BoxGeometry(0.032, 0.075, 0.022),
    hairNape:   new THREE.SphereGeometry(0.070, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.50),

    // ── Neck / torso ──
    neck:     new THREE.CylinderGeometry(0.085, 0.105, 0.180, 22), // taller
    adamApple:new THREE.SphereGeometry(0.018, 10, 8),               // Adam's apple
    scmL:     new THREE.CapsuleGeometry(0.018, 0.145, 4, 10),       // left SCM muscle
    scmR:     new THREE.CapsuleGeometry(0.018, 0.145, 4, 10),       // right SCM
    torso:    new THREE.CapsuleGeometry(0.235, 0.440, 10, 20),
    shoulder: new THREE.SphereGeometry(0.130, 22, 20),
    lapelL:   new THREE.BoxGeometry(0.082, 0.300, 0.045),
    lapelR:   new THREE.BoxGeometry(0.082, 0.300, 0.045),
    collarL:  new THREE.BoxGeometry(0.070, 0.065, 0.042),
    collarR:  new THREE.BoxGeometry(0.070, 0.065, 0.042),
    tieBody:  new THREE.BoxGeometry(0.052, 0.340, 0.016),
    tieKnot:  new THREE.BoxGeometry(0.060, 0.045, 0.030),
    button:   new THREE.SphereGeometry(0.010, 8, 8),
    waist:    new THREE.CylinderGeometry(0.220, 0.200, 0.150, 20),

    // ── Arms ──
    upperArm: new THREE.CapsuleGeometry(0.078, 0.260, 10, 14),
    lowerArm: new THREE.CapsuleGeometry(0.064, 0.230, 10, 14),
    wrist:    new THREE.SphereGeometry(0.060, 18, 14),
    palm:     new THREE.SphereGeometry(0.074, 20, 16),
    thumb:    new THREE.CapsuleGeometry(0.022, 0.055, 4, 8),

    // ── 3-phalanx finger segments ──
    phalanxP: new THREE.CapsuleGeometry(0.014, 0.048, 4, 8), // proximal (base)
    phalanxM: new THREE.CapsuleGeometry(0.013, 0.038, 4, 8), // medial (mid)
    phalanxD: new THREE.CapsuleGeometry(0.012, 0.030, 4, 8), // distal (tip)
    knuckle:  new THREE.SphereGeometry(0.016, 8, 8),          // knuckle bump
    fingernail:new THREE.BoxGeometry(0.022, 0.006, 0.016),    // flat nail plate

    // Eyelid
    eyelidU: new THREE.CapsuleGeometry(0.058, 0.092, 4, 10),

    // Accessories
    watchFace:    new THREE.CylinderGeometry(0.023, 0.023, 0.007, 20),
    watchBand:    new THREE.BoxGeometry(0.020, 0.010, 0.048),
    pocketSquare: new THREE.BoxGeometry(0.022, 0.028, 0.004),
    cufflink:     new THREE.CylinderGeometry(0.009, 0.009, 0.012, 10),

    // Aura
    aura: new THREE.CapsuleGeometry(0.260, 0.460, 10, 20),
  };
}

// ─────────────────────────────────────────────────────────────
// Eye component — layered construction
// ─────────────────────────────────────────────────────────────
function Eye({ position, pupilOffX = 0, pupilOffY = 0, dilated = false, squint = 0,
               G, M, irisMat, irisRef, eyelashMat }) {
  const irisScale   = dilated ? 1.15 : 1.0;
  const squintScale = 1 - squint * 0.35;
  const activeMat   = irisMat || M.iris;
  return (
    <group position={position} scale={[1, squintScale, 1]}>
      {/* Sclera */}
      <mesh geometry={G.eyeball} material={M.eyeWhite} />
      {/* Upper eyelid */}
      <mesh geometry={G.eyelidU} material={M.skinDark}
        position={[0, 0.050, 0.036]} rotation={[0, 0, Math.PI / 2]}
        scale={[0.54, 0.10, 0.22]} />
      {/* Lower eyelid */}
      <mesh geometry={G.eyelidU} material={M.skinDark}
        position={[0, -0.046, 0.038]} rotation={[0, 0, Math.PI / 2]}
        scale={[0.54, 0.07, 0.18]} />
      {/* Eyelash strip — upper */}
      <mesh geometry={G.eyelashU} material={eyelashMat || M.brow}
        position={[0, 0.052, 0.040]} />
      {/* Iris outer */}
      <mesh ref={irisRef} geometry={G.iris} material={activeMat}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.032]}
        scale={[irisScale, irisScale, 1]} />
      {/* Iris inner (depth) */}
      <mesh geometry={G.iris} material={M.irisInner}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.038]}
        scale={[irisScale * 0.6, irisScale * 0.6, 1]} />
      {/* Pupil */}
      <mesh geometry={G.pupil} material={M.pupil}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.044]} />
      {/* Catchlight */}
      <mesh geometry={G.catchlight} material={M.catchlight}
        position={[pupilOffX * 0.013 + 0.014, pupilOffY * 0.011 + 0.014, 0.052]} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Finger — 3 phalanges with knuckle + nail
// ─────────────────────────────────────────────────────────────
function Finger({ basePos, dir = 1, curl = 0, G, M, showNail = true }) {
  // curl: 0 = flat open, 1 = fully curled
  const c   = curl * (Math.PI / 2.2);
  const c2  = curl * (Math.PI / 1.8);
  const c3  = curl * (Math.PI / 1.6);
  return (
    <group position={basePos}>
      {/* Proximal phalanx */}
      <group rotation={[c, 0, 0]}>
        <mesh geometry={G.phalanxP} material={M.skin} position={[0, 0.040, 0]} />
        <mesh geometry={G.knuckle}  material={M.skin} position={[0, 0.072, 0]} scale={[0.7, 0.5, 0.7]} />
        {/* Medial phalanx */}
        <group position={[0, 0.090, 0]} rotation={[c2 * 0.7, 0, 0]}>
          <mesh geometry={G.phalanxM} material={M.skin} position={[0, 0.032, 0]} />
          <mesh geometry={G.knuckle}  material={M.skin} position={[0, 0.055, 0]} scale={[0.6, 0.45, 0.6]} />
          {/* Distal phalanx */}
          <group position={[0, 0.065, 0]} rotation={[c3 * 0.5, 0, 0]}>
            <mesh geometry={G.phalanxD} material={M.skin} position={[0, 0.025, 0]} />
            {showNail && (
              <mesh geometry={G.fingernail} material={M.nail}
                position={[0, 0.048, 0.010]} rotation={[0.3, 0, 0]} />
            )}
          </group>
        </group>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Hand component — thumb + 4 fingers (3-phalanx)
// ─────────────────────────────────────────────────────────────
function Hand({ position, rotation, curl = 0, thumbsUp = false, isLeft = false, G, M }) {
  const dir = isLeft ? -1 : 1;
  // thumbsUp overrides curl for thumb/other fingers
  const fingerCurl  = thumbsUp ? 0.85 : curl;
  const thumbCurl   = thumbsUp ? 0.0 : curl * 0.6;
  return (
    <group position={position} rotation={rotation}>
      {/* Palm */}
      <mesh geometry={G.palm}  material={M.skin} />
      <mesh geometry={G.wrist} material={M.skin} position={[0, 0.04, 0]} />
      {/* Thumb */}
      <group position={[dir * 0.068, 0.020, 0.012]}
             rotation={[0, dir * -0.5, dir * Math.PI / 2.5]}>
        <Finger basePos={[0, 0, 0]} curl={thumbCurl} G={G} M={M} />
      </group>
      {/* 4 fingers — positions offset laterally */}
      {[
        { x: dir * -0.046, z: 0.006 },
        { x: dir * -0.016, z: 0.008 },
        { x: dir *  0.014, z: 0.008 },
        { x: dir *  0.040, z: 0.004 },
      ].map(({ x, z }, i) => (
        <Finger
          key={i}
          basePos={[x, 0.082, z]}
          curl={fingerCurl}
          G={G} M={M}
          showNail
        />
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Main CharacterMesh
// ─────────────────────────────────────────────────────────────
export function CharacterMesh({
  state          = CHARACTER_STATES.IDLE,
  mousePosition  = { x: 0, y: 0 },
  audioAmplitude = 0,
  preset         = null,
}) {

  // Resolve palette from preset
  const C = useMemo(() => {
    if (preset !== null && CHARACTER_PRESETS?.[preset]) {
      return { ...BASE_PALETTE, ...CHARACTER_PRESETS[preset].palette };
    }
    return BASE_PALETTE;
  }, [preset]);

  // Geometries — disposed on unmount
  const G = useMemo(() => buildGeometries(), []);
  useEffect(() => () => Object.values(G).forEach(g => g.dispose?.()), [G]);

  // Materials — disposed on unmount
  const M = useMemo(() => buildMaterials(C), [C]);
  useEffect(() => () => Object.values(M).forEach(m => m.dispose?.()), [M]);

  // Live-animatable material clones
  const shirtMat   = useMemo(() => M.shirt.clone(),   [M]);
  const tieMat     = useMemo(() => M.tie.clone(),     [M]);
  const auraMat    = useMemo(() => M.aura.clone(),    [M]);
  const cheekMatL  = useMemo(() => M.cheek.clone(),   [M]);
  const cheekMatR  = useMemo(() => M.cheek.clone(),   [M]);
  const irisMatL   = useMemo(() => M.iris.clone(),    [M]);
  const irisMatR   = useMemo(() => M.iris.clone(),    [M]);
  const skinMat    = useMemo(() => M.skin.clone(),    [M]);
  const sssMat     = useMemo(() => M.skinSSS.clone(), [M]);
  const tongueMat  = useMemo(() => M.tongue.clone(),  [M]);
  useEffect(() => () => {
    [shirtMat, tieMat, auraMat, cheekMatL, cheekMatR,
     irisMatL, irisMatR, skinMat, sssMat, tongueMat].forEach(m => m.dispose());
  }, [shirtMat, tieMat, auraMat, cheekMatL, cheekMatR,
      irisMatL, irisMatR, skinMat, sssMat, tongueMat]);

  // ── Refs ────────────────────────────────────────────────────
  const rootRef         = useRef();
  const torsoRef        = useRef();
  const headRef         = useRef();
  const neckRef         = useRef();
  const leftArmRef      = useRef();
  const rightArmRef     = useRef();
  const leftForeRef     = useRef();
  const rightForeRef    = useRef();
  const leftWristRef    = useRef();
  const rightWristRef   = useRef();
  const mouthTopRef     = useRef();
  const mouthBotRef     = useRef();
  const jawRef          = useRef();
  const leftEyeRef      = useRef();
  const rightEyeRef     = useRef();
  const eyebrowLRef     = useRef();
  const eyebrowRRef     = useRef();
  const innerBrowLRef   = useRef();
  const innerBrowRRef   = useRef();
  const teethRef        = useRef();
  const lowerTeethRef   = useRef();
  const tongueRef       = useRef();
  const auraRef         = useRef();
  const cheekLRef       = useRef();
  const cheekRRef       = useRef();
  const lipCornerLRef   = useRef();
  const lipCornerRRef   = useRef();
  const nostrilLRef     = useRef();
  const nostrilRRef     = useRef();
  const hairTopRef      = useRef();
  const hairFrontRef    = useRef();
  const hairCrownRef    = useRef();
  const leftShoulderRef  = useRef();
  const rightShoulderRef = useRef();
  const irisLRef        = useRef();
  const irisRRef        = useRef();
  const lapelLRef       = useRef();
  const lapelRRef       = useRef();
  // Hand curl refs
  const leftHandCurlRef  = useRef(0);
  const rightHandCurlRef = useRef(0);

  // ── Animated values ─────────────────────────────────────────
  const anim = useRef({
    time: 0,
    // Breathing
    breathY: 0,
    // Head
    headRotX: 0, headRotY: 0, headRotZ: 0,
    // Secondary head lag (fake neck compliance)
    headLagX: 0, headLagY: 0,
    // Body
    bodyRotZ: 0, torsoRotX: 0,
    // Arms
    leftArmRotZ:   0, rightArmRotZ:  0,
    leftForeRotX:  0, rightForeRotX: 0,
    // Forearm secondary drag
    leftForeDrag:  0, rightForeDrag: 0,
    // Wrists
    leftWristRotY: 0, rightWristRotY: 0,
    // Hands
    leftCurl: 0, rightCurl: 0,
    // Mouth & jaw
    mouthOpen: 0, teethScaleY: 0,
    jawDropY: 0,
    tongueOpacity: 0,
    // Eyes
    eyeScaleY: 1, eyeSquint: 0,
    // Cheeks
    cheekScale: 0,
    // Lip corners
    lipCornerY: 0,
    // Eyebrows
    eyebrowY: 0, eyebrowRotZ: 0,
    innerBrowY: 0, innerBrowRotZ: 0,
    // Pupil
    pupilOffX: 0, pupilOffY: 0,
    // Nostril flare
    nostrilFlare: 0,
    // Aura / emissive
    auraOpacity: 0, auraScale: 1,
    emissiveShirt: 0.04,
    emissiveTie:   0.05,
    irisGlow: 0.55,
    skinEmissive: 0.0,
    // Hair
    hairWindZ: 0, hairMomentum: 0,
    // Shoulders
    shoulderShrug: 0,
    // Listen nod
    listenNod: 0,
    // Lapel micro-jitter
    lapelJitter: 0,
    // Blink
    nextBlink: 3000, blinkTimer: 0, blinkPhase: 0,
    // Mouse targets
    targetHeadX: 0, targetHeadY: 0,
    // Micro-gesture
    microGestureTimer: 0,
    microGestureNext:  4000 + Math.random() * 3000,
    microGesturePhase: 0,
    microGestureArm:   'left',
    microGestureBoost: 0,
  });

  const cfg = STATE_CONFIG[state] || STATE_CONFIG[CHARACTER_STATES.IDLE];

  const isActive  = [CHARACTER_STATES.TALKING, CHARACTER_STATES.HAPPY,
                     CHARACTER_STATES.GREETING, CHARACTER_STATES.ENCOURAGING,
                     CHARACTER_STATES.GESTURE].includes(state);
  const isHappy   = [CHARACTER_STATES.HAPPY, CHARACTER_STATES.GREETING,
                     CHARACTER_STATES.ENCOURAGING].includes(state);
  const isTalking = [CHARACTER_STATES.TALKING, CHARACTER_STATES.HAPPY,
                     CHARACTER_STATES.ENCOURAGING].includes(state);
  const isThinking = state === CHARACTER_STATES.THINKING;
  const isAnalyzing = state === CHARACTER_STATES.ANALYZING;

  const targetAuraOpacity   = isActive ? 0.07 : 0;
  const targetEmissiveShirt = isActive ? 0.14 : 0.04;
  const targetEmissiveTie   = isHappy  ? 0.18 : 0.05;
  const targetSkinEmissive  = isActive ? 0.025 : 0.0;

  useFrame((_, delta) => {
    const a  = anim.current;
    const dt = Math.min(delta, 0.05);
    a.time       += dt;
    a.blinkTimer += dt * 1000;

    // ── Blink ─────────────────────────────────────────────────
    if (a.blinkPhase === 0 && a.blinkTimer > a.nextBlink) {
      a.blinkPhase = 1; a.blinkTimer = 0;
    }
    if (a.blinkPhase === 1) {
      a.eyeScaleY = Math.max(0.04, a.eyeScaleY - dt * 16);
      if (a.eyeScaleY <= 0.04) a.blinkPhase = 2;
    }
    if (a.blinkPhase === 2) {
      a.eyeScaleY = Math.min(1.0, a.eyeScaleY + dt * 16);
      if (a.eyeScaleY >= 1.0) {
        a.blinkPhase = 0;
        const [lo, hi] = cfg.blinkInterval;
        a.nextBlink = lo + Math.random() * (hi - lo);
      }
    }

    // ── Eye squint (happy) ─────────────────────────────────────
    const targetSquint = isHappy ? 0.55 : 0;
    a.eyeSquint = damp(a.eyeSquint, targetSquint, 4, dt);
    const squintScaleY = (1 - a.eyeSquint * 0.35) * a.eyeScaleY;
    if (leftEyeRef.current)  leftEyeRef.current.scale.y  = squintScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = squintScaleY;

    // ── Cheek puff ────────────────────────────────────────────
    const targetCheek = isHappy ? 1.18 : 1.0;
    a.cheekScale = damp(a.cheekScale, targetCheek, 4, dt);
    if (cheekLRef.current) cheekLRef.current.scale.setScalar(a.cheekScale);
    if (cheekRRef.current) cheekRRef.current.scale.setScalar(a.cheekScale);
    const targetCheekOpacity = isHappy ? 0.22 : 0;
    cheekMatL.opacity = damp(cheekMatL.opacity, targetCheekOpacity, 4, dt);
    cheekMatR.opacity = cheekMatL.opacity;
    cheekMatL.emissiveIntensity = cheekMatL.opacity * 0.3;
    cheekMatR.emissiveIntensity = cheekMatL.opacity * 0.3;

    // ── Nostril flare ─────────────────────────────────────────
    const targetFlare = isHappy || isTalking ? 1.12 : 1.0;
    a.nostrilFlare = damp(a.nostrilFlare, targetFlare, 5, dt);
    if (nostrilLRef.current) nostrilLRef.current.scale.x = a.nostrilFlare;
    if (nostrilRRef.current) nostrilRRef.current.scale.x = a.nostrilFlare;

    // ── Lip corners ───────────────────────────────────────────
    const targetLipCornerY = isHappy ? 0.008
      : isThinking || isAnalyzing ? -0.006 : 0;
    a.lipCornerY = damp(a.lipCornerY, targetLipCornerY, 4, dt);
    if (lipCornerLRef.current) lipCornerLRef.current.position.y = -0.018 + a.lipCornerY;
    if (lipCornerRRef.current) lipCornerRRef.current.position.y = -0.018 + a.lipCornerY;

    // ── Iris emissive glow ─────────────────────────────────────
    const targetIrisGlow = 0.55 + (audioAmplitude > 0.02 ? audioAmplitude * 1.8 : 0);
    a.irisGlow = damp(a.irisGlow, targetIrisGlow, 6, dt);
    irisMatL.emissiveIntensity = a.irisGlow;
    irisMatR.emissiveIntensity = a.irisGlow;

    // ── Skin SSS emissive tint ─────────────────────────────────
    a.skinEmissive = damp(a.skinEmissive, targetSkinEmissive, 3, dt);
    skinMat.emissiveIntensity = a.skinEmissive;

    // ── Hair — wind + momentum physics ────────────────────────
    const windSpeed = isHappy ? 2.2 : 0.9;
    const rawWind   = Math.sin(a.time * windSpeed + 0.5) * 0.014;
    // Momentum: spring-damp the hair behind the raw wind signal
    a.hairMomentum += (rawWind - a.hairWindZ) * dt * 18;
    a.hairMomentum *= Math.pow(0.22, dt);   // damping
    a.hairWindZ    += a.hairMomentum * dt;
    if (hairTopRef.current)   hairTopRef.current.rotation.z   = a.hairWindZ * 0.5;
    if (hairFrontRef.current) hairFrontRef.current.rotation.z = a.hairWindZ;
    if (hairCrownRef.current) hairCrownRef.current.rotation.z = a.hairWindZ * 0.7;

    // ── Shoulder shrug ────────────────────────────────────────
    const targetShrug = state === CHARACTER_STATES.ENCOURAGING ? 0.042 : 0;
    a.shoulderShrug = damp(a.shoulderShrug, targetShrug, 5, dt);
    if (leftShoulderRef.current)  leftShoulderRef.current.position.y  = 0.270 + a.shoulderShrug;
    if (rightShoulderRef.current) rightShoulderRef.current.position.y = 0.270 + a.shoulderShrug;

    // ── Lapel micro-jitter ────────────────────────────────────
    const jitterFreq = isActive ? 4.8 : 1.8;
    a.lapelJitter = Math.sin(a.time * jitterFreq) * (isActive ? 0.0035 : 0.001);
    if (lapelLRef.current) lapelLRef.current.rotation.z =  0.15 + a.lapelJitter;
    if (lapelRRef.current) lapelRRef.current.rotation.z = -0.15 - a.lapelJitter;

    // ── Mouse tracking ────────────────────────────────────────
    a.targetHeadX = damp(a.targetHeadX, mousePosition.y * 0.20, 3, dt);
    a.targetHeadY = damp(a.targetHeadY, mousePosition.x * 0.28, 3, dt);
    a.pupilOffX   = damp(a.pupilOffX, mousePosition.x, 5, dt);
    a.pupilOffY   = damp(a.pupilOffY, mousePosition.y, 5, dt);

    // ── Breathing ─────────────────────────────────────────────
    const breathVal = Math.sin(a.time * cfg.breathSpeed * Math.PI * 2) * cfg.breathAmp;
    a.breathY = damp(a.breathY, breathVal, 8, dt);

    // ── Torso lean ────────────────────────────────────────────
    const targetLean = (cfg.torsoLean || 0)
      + Math.sin(a.time * cfg.breathSpeed * Math.PI * 2) * 0.004;
    a.torsoRotX = damp(a.torsoRotX, targetLean, 4, dt);

    // ── Head motion ───────────────────────────────────────────
    const baseX = Math.sin(a.time * cfg.headBobSpeed  * Math.PI * 2) * cfg.headBobAmp;
    const baseY = Math.sin(a.time * cfg.headSwaySpeed * Math.PI * 2) * cfg.headSwayAmp;
    let extraZ  = 0;
    const listenNodTarget = state === CHARACTER_STATES.LISTENING
      ? Math.sin(a.time * 1.4) * 0.033 : 0;
    a.listenNod = damp(a.listenNod, listenNodTarget, 4, dt);
    if (isThinking)  extraZ = Math.sin(a.time * 0.45) * 0.08;
    if (state === CHARACTER_STATES.GREETING)  extraZ = Math.sin(a.time * 2.2) * 0.07;
    if (isAnalyzing) extraZ = Math.sin(a.time * 1.9) * 0.055;

    a.headRotX = damp(a.headRotX, baseX + a.targetHeadX + a.listenNod, 6, dt);
    a.headRotY = damp(a.headRotY, baseY + a.targetHeadY, 6, dt);
    a.headRotZ = damp(a.headRotZ, extraZ, 5, dt);

    // Secondary head lag — simulates neck compliance
    a.headLagX = damp(a.headLagX, a.headRotX * 0.18, 3.5, dt);
    a.headLagY = damp(a.headLagY, a.headRotY * 0.14, 3.5, dt);

    // ── Body sway ─────────────────────────────────────────────
    a.bodyRotZ = damp(a.bodyRotZ,
      Math.sin(a.time * cfg.bodySwaySpeed * Math.PI * 2) * cfg.bodySwayAmp, 6, dt);

    // ── Eyebrows — outer + inner independently ─────────────────
    const targetEyebrowY    = (cfg.eyebrowRaise || 0)
      + Math.sin(a.time * 1.3) * (cfg.eyebrowRaise || 0) * 0.35;
    const targetEyebrowRotZ = cfg.eyebrowFurrow || 0;
    a.eyebrowY    = damp(a.eyebrowY,    targetEyebrowY,    4, dt);
    a.eyebrowRotZ = damp(a.eyebrowRotZ, targetEyebrowRotZ, 4, dt);

    // Inner brow: raises on GREETING/HAPPY, furrows on THINKING
    const targetInnerY    = isHappy ? 0.018 : isThinking ? -0.008 : 0;
    const targetInnerRotZ = isThinking ? 0.12 : isHappy ? -0.04 : 0;
    a.innerBrowY    = damp(a.innerBrowY,    targetInnerY,    4, dt);
    a.innerBrowRotZ = damp(a.innerBrowRotZ, targetInnerRotZ, 4, dt);

    if (eyebrowLRef.current) {
      eyebrowLRef.current.position.y = 0.115 + a.eyebrowY;
      eyebrowLRef.current.rotation.z =  0.28 + a.eyebrowRotZ;
    }
    if (eyebrowRRef.current) {
      eyebrowRRef.current.position.y = 0.115 + a.eyebrowY;
      eyebrowRRef.current.rotation.z = -0.28 - a.eyebrowRotZ;
    }
    if (innerBrowLRef.current) {
      innerBrowLRef.current.position.y = 0.112 + a.innerBrowY;
      innerBrowLRef.current.rotation.z =  0.55 + a.innerBrowRotZ;
    }
    if (innerBrowRRef.current) {
      innerBrowRRef.current.position.y = 0.112 + a.innerBrowY;
      innerBrowRRef.current.rotation.z = -0.55 - a.innerBrowRotZ;
    }

    // ── Arms ──────────────────────────────────────────────────
    let lArmZ = -0.3 + Math.sin(a.time * cfg.armIdleAmp * 10) * cfg.armIdleAmp * 2;
    let rArmZ =  0.3 - Math.sin(a.time * cfg.armIdleAmp * 10) * cfg.armIdleAmp * 2;
    let lForeX = 0, rForeX = 0;
    let lCurl = 0.15, rCurl = 0.15; // default relaxed curl

    switch (state) {
      case CHARACTER_STATES.TALKING:
      case CHARACTER_STATES.GESTURE: {
        const t = a.time * 1.5;
        lArmZ  = -0.50 + Math.sin(t)       * 0.26;
        rArmZ  =  0.50 - Math.sin(t + 1.0) * 0.26;
        lForeX = -0.30 + Math.sin(t * 1.3) * 0.32;
        rForeX =  0.30 - Math.sin(t * 1.2) * 0.32;
        lCurl = 0.08; rCurl = 0.08;
        break;
      }
      case CHARACTER_STATES.GREETING: {
        const t = a.time * 3.2;
        rArmZ  = -0.92 + Math.sin(t) * 0.14;
        rForeX = -0.82 + Math.sin(t * 1.5) * 0.22;
        rCurl = 0.05;
        lCurl = 0.18;
        break;
      }
      case CHARACTER_STATES.HAPPY: {
        const t = a.time * 2.1;
        lArmZ  = -0.62 + Math.sin(t)       * 0.14;
        rArmZ  =  0.62 - Math.sin(t + 0.5) * 0.14;
        lForeX = -0.22 + Math.sin(t) * 0.10;
        rForeX =  0.22 - Math.sin(t) * 0.10;
        lCurl = 0.06; rCurl = 0.06;
        break;
      }
      case CHARACTER_STATES.ENCOURAGING: {
        const t = a.time * 1.9;
        rArmZ  = -0.82 + Math.sin(t) * 0.09;
        rForeX = -0.52 + Math.sin(t * 1.2) * 0.10;
        lArmZ  = -0.26 + Math.sin(t + 1.0) * 0.08;
        lForeX =  0.10;
        // thumbs-up right hand = fingers curled, thumb out
        rCurl = 0.90;  // hand component switches to thumbsUp=true
        lCurl = 0.15;
        break;
      }
      case CHARACTER_STATES.THINKING: {
        rArmZ  =  0.10;
        rForeX = -0.78;
        lArmZ  = -0.22;
        lForeX =  0.08;
        lCurl = 0.35; rCurl = 0.45;
        break;
      }
      case CHARACTER_STATES.ANALYZING: {
        const t = a.time * 1.1;
        lArmZ  = -0.36 + Math.sin(t)       * 0.09;
        rArmZ  =  0.36 - Math.sin(t + 0.5) * 0.09;
        lForeX = -0.26;
        rForeX =  0.26;
        lCurl = 0.20; rCurl = 0.20;
        break;
      }
      case CHARACTER_STATES.LISTENING: {
        lArmZ  = -0.22;
        rArmZ  =  0.22;
        lCurl = 0.18; rCurl = 0.18;
        break;
      }
      default: break;
    }

    // Micro-gesture during TALKING / GESTURE
    if (state === CHARACTER_STATES.TALKING || state === CHARACTER_STATES.GESTURE) {
      a.microGestureTimer += dt * 1000;
      if (a.microGesturePhase === 0 && a.microGestureTimer > a.microGestureNext) {
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
      if (a.microGestureArm === 'left')  lArmZ -= boost;
      else                               rArmZ -= boost;
    } else {
      a.microGesturePhase = 0;
      a.microGestureBoost = Math.max(0, a.microGestureBoost - dt * 3);
    }

    a.leftArmRotZ  = damp(a.leftArmRotZ,  lArmZ,  5, dt);
    a.rightArmRotZ = damp(a.rightArmRotZ, rArmZ,  5, dt);

    // Forearm primary damp
    a.leftForeRotX  = damp(a.leftForeRotX,  lForeX, 5, dt);
    a.rightForeRotX = damp(a.rightForeRotX, rForeX, 5, dt);

    // Forearm secondary drag (20% lag behind primary)
    a.leftForeDrag  = damp(a.leftForeDrag,  a.leftForeRotX,  3.5, dt);
    a.rightForeDrag = damp(a.rightForeDrag, a.rightForeRotX, 3.5, dt);

    // Wrist
    const lWristTarget = Math.sin(a.time * 2.2) * 0.12 + a.leftForeRotX * 0.2;
    const rWristTarget = Math.sin(a.time * 2.0 + 0.8) * 0.12 + a.rightForeRotX * 0.2;
    a.leftWristRotY  = damp(a.leftWristRotY,  lWristTarget, 6, dt);
    a.rightWristRotY = damp(a.rightWristRotY, rWristTarget, 6, dt);
    if (leftWristRef.current)  leftWristRef.current.rotation.y  = a.leftWristRotY;
    if (rightWristRef.current) rightWristRef.current.rotation.y = a.rightWristRotY;

    // Hand curl
    a.leftCurl  = damp(a.leftCurl,  lCurl, 6, dt);
    a.rightCurl = damp(a.rightCurl, rCurl, 6, dt);
    leftHandCurlRef.current  = a.leftCurl;
    rightHandCurlRef.current = a.rightCurl;

    // ── Mouth — jaw-drop + audio amplitude ──────────────────
    let targetMouth = cfg.mouthOpen;
    if (isTalking) {
      targetMouth = audioAmplitude > 0.02
        ? Math.min(1, audioAmplitude * 2.2)
        : cfg.mouthOpen * (0.45 + Math.abs(Math.sin(a.time * 4.8)) * 0.85);
    }
    a.mouthOpen   = damp(a.mouthOpen,   targetMouth, 8, dt);
    a.teethScaleY = damp(a.teethScaleY, a.mouthOpen > 0.12 ? a.mouthOpen : 0, 8, dt);

    // Jaw drop — whole jaw moves down, not just lips
    const targetJawDrop = a.mouthOpen * 0.022;
    a.jawDropY = damp(a.jawDropY, targetJawDrop, 8, dt);

    // Tongue — appears at moderate mouth-open
    const targetTongue = a.mouthOpen > 0.3 ? Math.min(1, (a.mouthOpen - 0.3) * 2) : 0;
    a.tongueOpacity = damp(a.tongueOpacity, targetTongue * 0.65, 6, dt);
    tongueMat.opacity = a.tongueOpacity;

    // ── Aura ─────────────────────────────────────────────────
    a.auraOpacity   = damp(a.auraOpacity,   targetAuraOpacity,   3, dt);
    a.emissiveShirt = damp(a.emissiveShirt, targetEmissiveShirt, 3, dt);
    a.emissiveTie   = damp(a.emissiveTie,   targetEmissiveTie,   3, dt);

    // ── Apply transforms ──────────────────────────────────────
    if (torsoRef.current) {
      torsoRef.current.scale.y    = 1 + a.breathY;
      torsoRef.current.rotation.z = a.bodyRotZ;
      torsoRef.current.rotation.x = a.torsoRotX;
    }
    if (headRef.current) {
      // Primary head rotation + secondary lag added
      headRef.current.rotation.x = a.headRotX + a.headLagX;
      headRef.current.rotation.y = a.headRotY + a.headLagY;
      headRef.current.rotation.z = a.headRotZ;
    }
    if (jawRef.current) jawRef.current.position.y = -0.055 - a.jawDropY;

    if (leftArmRef.current)   leftArmRef.current.rotation.z   = a.leftArmRotZ;
    if (rightArmRef.current)  rightArmRef.current.rotation.z  = a.rightArmRotZ;
    // Use drag for forearm — gives slight secondary motion
    if (leftForeRef.current)  leftForeRef.current.rotation.x  = a.leftForeDrag;
    if (rightForeRef.current) rightForeRef.current.rotation.x = a.rightForeDrag;

    if (mouthTopRef.current)  mouthTopRef.current.position.y  =  0.025 + a.mouthOpen * 0.018;
    if (mouthBotRef.current)  mouthBotRef.current.position.y  = -0.018 - a.mouthOpen * 0.022;
    if (teethRef.current)     teethRef.current.scale.y        = Math.max(0.01, a.teethScaleY);
    if (lowerTeethRef.current) lowerTeethRef.current.position.y = -0.026 - a.jawDropY * 0.5;

    if (auraRef.current) {
      auraRef.current.material.opacity           = a.auraOpacity;
      auraRef.current.material.emissiveIntensity = a.auraOpacity * 1.8;
      auraRef.current.scale.set(1 + a.auraOpacity * 0.08, 1 + a.auraOpacity * 0.06, 1 + a.auraOpacity * 0.08);
    }
    shirtMat.emissiveIntensity = a.emissiveShirt;
    tieMat.emissiveIntensity   = a.emissiveTie;

    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(a.time * 0.48) * 0.010;
    }
  });

  const isEncouraging = state === CHARACTER_STATES.ENCOURAGING;
  const isDilated     = isHappy;
  const a             = anim.current;

  // Eyelash material (dark, thin)
  const eyelashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a0818' }), []);
  useEffect(() => () => eyelashMat.dispose(), [eyelashMat]);

  return (
    <group ref={rootRef}>

      {/* ── AURA ──────────────────────────────────────────── */}
      <mesh ref={auraRef} geometry={G.aura} material={auraMat} />

      {/* ── TORSO ─────────────────────────────────────────── */}
      <group ref={torsoRef}>
        <mesh geometry={G.torso} material={shirtMat} />

        {/* Jacket lapels — with micro-jitter refs */}
        <mesh ref={lapelLRef} geometry={G.lapelL} material={M.jacket}
          position={[-0.108, 0.105, 0.180]} rotation={[0, 0.15, 0]} />
        <mesh ref={lapelRRef} geometry={G.lapelR} material={M.jacket}
          position={[ 0.108, 0.105, 0.180]} rotation={[0,-0.15, 0]} />

        {/* Shirt collar */}
        <mesh geometry={G.collarL} material={M.collar}
          position={[-0.038, 0.305, 0.165]} rotation={[0, 0.2, 0.06]} />
        <mesh geometry={G.collarR} material={M.collar}
          position={[ 0.038, 0.305, 0.165]} rotation={[0,-0.2,-0.06]} />

        {/* Tie */}
        <mesh geometry={G.tieKnot} material={M.tieKnot} position={[0, 0.285, 0.195]} />
        <mesh geometry={G.tieBody} material={tieMat}    position={[0, 0.095, 0.205]} />

        {/* Buttons */}
        {[-0.06, 0.02, 0.10].map((y, i) => (
          <mesh key={i} geometry={G.button} material={M.lapel}
            position={[0, y, 0.215]} scale={[1, 1, 0.5]} />
        ))}

        {/* Pocket square */}
        <mesh geometry={G.pocketSquare} material={M.collar}
          position={[-0.122, 0.232, 0.188]} rotation={[0, 0.15, 0.09]}
          scale={[0.82, 0.88, 0.55]} />

        {/* Shoulders */}
        <mesh ref={leftShoulderRef}  geometry={G.shoulder} material={M.jacket}
          position={[-0.280, 0.270, 0]} />
        <mesh ref={rightShoulderRef} geometry={G.shoulder} material={M.jacket}
          position={[ 0.280, 0.270, 0]} />

        {/* Waist */}
        <mesh geometry={G.waist} material={M.pants} position={[0, -0.340, 0]} />

        {/* ── NECK ─────────────────────────────────────── */}
        <group ref={neckRef} position={[0, 0.470, 0]}>
          <mesh geometry={G.neck} material={skinMat} />

          {/* Adam's apple */}
          <mesh geometry={G.adamApple} material={M.skinDark}
            position={[0, 0.040, 0.078]} scale={[1, 0.7, 0.55]} />

          {/* SCM muscles — angle from behind-ear to collarbone */}
          <mesh geometry={G.scmL} material={M.scm}
            position={[-0.052, 0.010, 0.032]}
            rotation={[0.18, 0.22, -0.35]} />
          <mesh geometry={G.scmR} material={M.scm}
            position={[ 0.052, 0.010, 0.032]}
            rotation={[0.18, -0.22,  0.35]} />

          {/* SSS BackSide ear glow shell on neck */}
          <mesh geometry={G.neck} material={sssMat} scale={[1.04, 1.01, 1.04]} />

          {/* ── HEAD ─────────────────────────────────── */}
          <group ref={headRef} position={[0, 0.310, 0]}>

            {/* SSS BackSide glow — surrounds skull for ear/rim translucency */}
            <mesh geometry={G.skull} material={sssMat} scale={[1.06, 1.06, 1.06]} />

            {/* Skull — slightly flattened oval */}
            <mesh geometry={G.skull} material={skinMat} scale={[1, 1.08, 0.92]} />

            {/* Forehead ridge — subtle brow shelf */}
            <mesh geometry={G.foreheadRidge} material={M.skinDark}
              position={[0, 0.110, 0.178]}
              scale={[1, 0.45, 0.5]} />

            {/* Zygomatic arches (cheekbones) */}
            <mesh geometry={G.zygL} material={M.skinDark}
              position={[-0.138, -0.008, 0.150]} scale={[0.8, 0.65, 0.55]} />
            <mesh geometry={G.zygR} material={M.skinDark}
              position={[ 0.138, -0.008, 0.150]} scale={[0.8, 0.65, 0.55]} />

            {/* Jaw — wider, more defined */}
            <mesh ref={jawRef} geometry={G.jaw} material={skinMat}
              position={[0, -0.055, 0.042]} scale={[1.08, 0.76, 1.01]} />

            {/* Chin */}
            <mesh geometry={G.chin} material={skinMat}
              position={[0, -0.168, 0.082]} scale={[1.1, 0.68, 0.90]} />

            {/* Ears — composed ear with inner helix */}
            <group position={[-0.218, 0.005, 0]}>
              <mesh geometry={G.ear}      material={M.ear}  scale={[0.56, 0.90, 0.46]} />
              <mesh geometry={G.earInner} material={M.skinDark} position={[0.008, 0, 0]} scale={[0.4, 0.7, 0.35]} />
              <mesh geometry={G.earLobe}  material={M.ear}  position={[0, -0.058, 0]}   scale={[0.55, 0.54, 0.44]} />
            </group>
            <group position={[ 0.218, 0.005, 0]}>
              <mesh geometry={G.ear}      material={M.ear}  scale={[0.56, 0.90, 0.46]} />
              <mesh geometry={G.earInner} material={M.skinDark} position={[-0.008, 0, 0]} scale={[0.4, 0.7, 0.35]} />
              <mesh geometry={G.earLobe}  material={M.ear}  position={[0, -0.058, 0]}   scale={[0.55, 0.54, 0.44]} />
            </group>

            {/* Nose bridge */}
            <mesh geometry={G.noseBridge} material={M.skinDark}
              position={[0, -0.008, 0.198]} scale={[1, 1, 0.5]} />

            {/* Nose tip + nostrils */}
            <mesh geometry={G.nose} material={M.nose}
              position={[0, -0.042, 0.200]} scale={[1, 0.74, 0.82]} />
            <mesh ref={nostrilLRef} geometry={G.nostrilL} material={M.nose}
              position={[-0.028,-0.070, 0.194]} scale={[0.64, 0.54, 0.54]} />
            <mesh ref={nostrilRRef} geometry={G.nostrilR} material={M.nose}
              position={[ 0.028,-0.070, 0.194]} scale={[0.64, 0.54, 0.54]} />

            {/* Philtrum */}
            <mesh geometry={G.philtrum} material={M.skinDark}
              position={[0, -0.096, 0.198]} scale={[0.34, 0.54, 0.24]} />

            {/* Cheek puffs */}
            <mesh ref={cheekLRef} geometry={G.cheekL} material={cheekMatL}
              position={[-0.115, -0.010, 0.176]} />
            <mesh ref={cheekRRef} geometry={G.cheekR} material={cheekMatR}
              position={[ 0.115, -0.010, 0.176]} />

            {/* ── EYES ─────────────────────────────────── */}
            <group ref={leftEyeRef}  position={[-0.090, 0.045, 0.172]}>
              <Eye position={[0,0,0]} pupilOffX={a.pupilOffX} pupilOffY={a.pupilOffY}
                dilated={isDilated} squint={a.eyeSquint} G={G} M={M}
                irisMat={irisMatL} irisRef={irisLRef} eyelashMat={eyelashMat} />
            </group>
            <group ref={rightEyeRef} position={[ 0.090, 0.045, 0.172]}>
              <Eye position={[0,0,0]} pupilOffX={a.pupilOffX} pupilOffY={a.pupilOffY}
                dilated={isDilated} squint={a.eyeSquint} G={G} M={M}
                irisMat={irisMatR} irisRef={irisRRef} eyelashMat={eyelashMat} />
            </group>

            {/* ── EYEBROWS — outer + inner ─────────────── */}
            <mesh ref={eyebrowLRef} geometry={G.brow} material={M.brow}
              position={[-0.084, 0.115, 0.188]} rotation={[Math.PI/2, 0,  0.28]} />
            <mesh ref={eyebrowRRef} geometry={G.brow} material={M.brow}
              position={[ 0.084, 0.115, 0.188]} rotation={[Math.PI/2, 0, -0.28]} />
            {/* Inner brow segments — emotion detail */}
            <mesh ref={innerBrowLRef} geometry={G.browInner} material={M.brow}
              position={[-0.048, 0.112, 0.190]} rotation={[Math.PI/2, 0,  0.55]} />
            <mesh ref={innerBrowRRef} geometry={G.browInner} material={M.brow}
              position={[ 0.048, 0.112, 0.190]} rotation={[Math.PI/2, 0, -0.55]} />

            {/* ── MOUTH ────────────────────────────────── */}
            <mesh ref={mouthTopRef} geometry={G.upperLip} material={M.lip}
              position={[0,  0.025, 0.196]} rotation={[Math.PI/2, 0, 0]} />
            <mesh ref={mouthBotRef} geometry={G.lowerLip} material={M.lipDark}
              position={[0, -0.018, 0.196]} rotation={[Math.PI/2, 0, 0]} />

            {/* Upper teeth */}
            <mesh ref={teethRef} geometry={G.teeth} material={M.teeth}
              position={[0, 0.004, 0.190]} scale={[1, 0.01, 1]} />
            {/* Lower teeth — moves with jaw */}
            <mesh ref={lowerTeethRef} geometry={G.lowerTeeth} material={M.teeth}
              position={[0, -0.026, 0.190]} scale={[1, 0.01, 1]} />
            {/* Tongue — appears on wide mouth-open */}
            <mesh ref={tongueRef} geometry={G.tongue} material={tongueMat}
              position={[0, -0.008, 0.168]} scale={[0.8, 0.35, 0.55]} />

            {/* Lip corners */}
            <mesh ref={lipCornerLRef} geometry={G.lipCornerL} material={M.lip}
              position={[-0.052, -0.018, 0.194]} scale={[0.78, 0.68, 0.58]} />
            <mesh ref={lipCornerRRef} geometry={G.lipCornerR} material={M.lip}
              position={[ 0.052, -0.018, 0.194]} scale={[0.78, 0.68, 0.58]} />

            {/* ── HAIR — 8 overlapping segments ────────── */}
            {/* Top dome */}
            <mesh ref={hairTopRef} geometry={G.hairTop} material={M.hair}
              position={[0, 0.012, 0]} scale={[1.06, 1.12, 1.06]} />
            {/* Crown layer (slightly smaller, random z offset) */}
            <mesh ref={hairCrownRef} geometry={G.hairCrown} material={M.hair}
              position={[0, 0.028, -0.010]} scale={[1.02, 1.08, 1.04]}
              rotation={[0.05, 0.03, 0]} />
            {/* Front swoop */}
            <mesh ref={hairFrontRef} geometry={G.hairFront} material={M.hair}
              position={[0, 0.148, 0.196]} rotation={[0.35, 0, 0]}
              scale={[1, 0.58, 0.48]} />
            {/* Side fringe — left */}
            <mesh geometry={G.hairFringe} material={M.hair}
              position={[-0.110, 0.135, 0.160]}
              rotation={[0.6, -0.3, 0.15]} scale={[0.8, 0.9, 0.7]} />
            {/* Side volumes */}
            <mesh geometry={G.hairSideL} material={M.hair}
              position={[-0.210,-0.020, 0]} scale={[0.47, 0.72, 0.96]} />
            <mesh geometry={G.hairSideR} material={M.hair}
              position={[ 0.210,-0.020, 0]} scale={[0.47, 0.72, 0.96]} />
            {/* Temple strips */}
            <mesh geometry={G.hairTempleL} material={M.hair}
              position={[-0.198, 0.062, 0.068]} rotation={[0, -0.25, 0.08]} />
            <mesh geometry={G.hairTempleR} material={M.hair}
              position={[ 0.198, 0.062, 0.068]} rotation={[0,  0.25,-0.08]} />
            {/* Back & nape */}
            <mesh geometry={G.hairBack} material={M.hair}
              position={[0, -0.042, -0.198]} />
            <mesh geometry={G.hairNape} material={M.hair}
              position={[0, -0.088, -0.186]} scale={[1.08, 0.80, 0.70]} />

          </group>{/* /head */}
        </group>{/* /neck */}

        {/* ── LEFT ARM ──────────────────────────────────── */}
        <group ref={leftArmRef} position={[-0.360, 0.245, 0]}>
          <mesh geometry={G.upperArm} material={M.jacket} />
          <group ref={leftForeRef} position={[0, -0.250, 0]}>
            <mesh geometry={G.lowerArm} material={skinMat} position={[0, -0.145, 0]} />
            <group ref={leftWristRef} position={[0, -0.320, 0]}>
              <Hand
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                curl={a.leftCurl}
                thumbsUp={false}
                isLeft={true}
                G={G} M={{ ...M, skin: skinMat }}
              />
            </group>
          </group>
        </group>

        {/* ── RIGHT ARM ─────────────────────────────────── */}
        <group ref={rightArmRef} position={[0.360, 0.245, 0]}>
          <mesh geometry={G.upperArm} material={M.jacket} />
          <group ref={rightForeRef} position={[0, -0.250, 0]}>
            <mesh geometry={G.lowerArm} material={skinMat} position={[0, -0.145, 0]} />
            <group ref={rightWristRef} position={[0, -0.320, 0]}>
              <Hand
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                curl={a.rightCurl}
                thumbsUp={isEncouraging}
                isLeft={false}
                G={G} M={{ ...M, skin: skinMat }}
              />
            </group>
          </group>
        </group>

      </group>{/* /torso */}
    </group>
  );
}

export default CharacterMesh;
