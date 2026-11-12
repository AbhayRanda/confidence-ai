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

// ── Default Cyber Mecha Palette (Reference: Cyber Anime AI Coach) ───
const BASE_PALETTE = {
  skin:             '#f8d5be',   // Anime skin tone
  skinShadow:       '#dfa98c',
  skinLight:        '#fff2e8',
  skinSSS:          '#ff7864',   // Subsurface scatter hint
  hair:             '#11131c',   // Matte jet black hair
  hairSheen:        '#28324a',   // Cool metallic sheen
  brow:             '#0d0f17',
  armorOrange:      '#ff7700',   // Cyber racing orange
  armorOrangeDark:  '#cc5800',
  armorOrangeGlow:  '#ff8800',
  armorDark:        '#121520',   // Titanium charcoal/black
  armorDarkPlate:   '#181d2e',
  armorWhite:       '#f4f6fa',   // Crisp bionic white
  armorWhiteAccent: '#dce3f0',
  ledOrange:        '#ff8800',   // Vivid neon-orange LED strip glow
  ledOrangeBright:  '#ffaa22',
  coreTriangle:     '#ff9900',   // Glowing power core (inverted triangle ▽)
  coreFrame:        '#2a1608',
  visorGlass:       '#ffffff',   // Holographic translucent AR visor
  visorFrame:       '#1e2232',
  headset:          '#151824',
  eyeWhite:         '#f8f9ff',
  irisOuter:        '#f59e0b',   // Warm amber/golden glowing anime eyes
  irisInner:        '#d97706',
  pupil:            '#0a0814',
  catchlight:       '#ffffff',
  lip:              '#e2867c',
  lipDark:          '#b8554d',
  tongue:           '#d8665c',
  teeth:            '#ffffff',
  // Backward compatibility aliases
  shirt:            '#ff7700',
  shirtDark:        '#cc5800',
  pant:             '#121520',
  jacket:           '#121520',
  jacketLight:      '#181d2e',
  lapel:            '#121520',
  collar:           '#f4f6fa',
  tie:              '#ff8800',
  tieDark:          '#cc5800',
  tieKnot:          '#ff8800',
  sclera:           '#f8f9ff',
  ear:              '#dfa98c',
  nose:             '#dfa98c',
  nail:             '#f4f6fa',
  scm:              '#dfa98c',
};

// ── Physical material factory ─────────────────────────────────
function pm(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, ...opts });
}

// ── Build material set from palette ──────────────────────────
function buildMaterials(C) {
  const orange = C.armorOrange || C.shirt || '#ff7700';
  const dark   = C.armorDark   || C.jacket || '#121520';
  const white  = C.armorWhite  || C.collar || '#f4f6fa';
  const led    = C.ledOrange   || C.tie    || '#ff8800';

  return {
    // ── Skin — refined anime SSS simulation ──
    skin: pm(C.skin, {
      roughness:          0.52,
      metalness:          0.0,
      sheen:              0.65,
      sheenRoughness:     0.55,
      sheenColor:         new THREE.Color(C.skinLight),
      clearcoat:          0.32,
      clearcoatRoughness: 0.28,
      emissive:           new THREE.Color(C.skinSSS),
      emissiveIntensity:  0.0,
    }),
    skinDark:  pm(C.skinShadow, { roughness: 0.65, metalness: 0.0 }),
    skinLight: pm(C.skinLight,  { roughness: 0.45, metalness: 0.0 }),
    skinSSS: new THREE.MeshPhysicalMaterial({
      color:     new THREE.Color(C.skin),
      roughness: 0.8, metalness: 0.0,
      transparent: true, opacity: 0.22,
      emissive:  new THREE.Color(C.skinSSS),
      emissiveIntensity: 0.28,
      side: THREE.BackSide,
    }),

    // ── Hair — layered anime sheen ──
    hair: pm(C.hair, {
      roughness:          0.24,
      metalness:          0.08,
      sheen:              0.85,
      sheenRoughness:     0.35,
      sheenColor:         new THREE.Color(C.hairSheen),
      clearcoat:          0.22,
      clearcoatRoughness: 0.45,
    }),
    brow: pm(C.brow, { roughness: 0.38, metalness: 0.0 }),

    // ── Cyber Armor Materials ──
    armorOrange: pm(orange, {
      roughness:          0.24,
      metalness:          0.15,
      clearcoat:          0.90,
      clearcoatRoughness: 0.12,
      emissive:           new THREE.Color(orange),
      emissiveIntensity:  0.05,
    }),
    armorOrangeDark: pm(C.armorOrangeDark || '#cc5800', {
      roughness: 0.32, metalness: 0.20,
    }),
    armorDark: pm(dark, {
      roughness:          0.28,
      metalness:          0.60,
      clearcoat:          0.45,
      clearcoatRoughness: 0.25,
    }),
    armorDarkPlate: pm(C.armorDarkPlate || '#181d2e', {
      roughness: 0.38, metalness: 0.50,
    }),
    armorWhite: pm(white, {
      roughness:          0.18,
      metalness:          0.10,
      clearcoat:          0.95,
      clearcoatRoughness: 0.08,
    }),
    armorWhiteAccent: pm(C.armorWhiteAccent || '#dce3f0', {
      roughness: 0.28, metalness: 0.15,
    }),

    // ── Glowing LED Light Strips & Core ──
    ledOrange: new THREE.MeshBasicMaterial({
      color: new THREE.Color(led),
    }),
    ledOrangeBright: new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.ledOrangeBright || '#ffaa22'),
    }),
    coreGlow: new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.coreTriangle || '#ff9900'),
    }),
    coreFrame: pm(C.coreFrame || '#2a1608', {
      roughness: 0.35, metalness: 0.75,
    }),

    // ── Holographic AR Visor ──
    visorGlass: new THREE.MeshPhysicalMaterial({
      color:        new THREE.Color('#ffffff'),
      roughness:    0.04,
      metalness:    0.04,
      transmission: 0.90,
      opacity:      0.82,
      transparent:  true,
      ior:          1.52,
      thickness:    0.04,
    }),
    visorFrame: pm(C.visorFrame || '#1e2232', {
      roughness: 0.25, metalness: 0.70,
    }),
    visorOrange: pm(orange, {
      roughness: 0.25, metalness: 0.40,
    }),

    // ── Cyber Headset ──
    headset: pm(C.headset || '#151824', {
      roughness: 0.28, metalness: 0.65,
    }),
    headsetRing: new THREE.MeshBasicMaterial({
      color: new THREE.Color(led),
    }),

    // ── Backward-compatible Aliases ──
    shirt: pm(orange, {
      roughness:          0.24,
      metalness:          0.15,
      clearcoat:          0.90,
      clearcoatRoughness: 0.12,
      emissive:           new THREE.Color(orange),
      emissiveIntensity:  0.05,
    }),
    jacket: pm(dark, {
      roughness: 0.28, metalness: 0.60, clearcoat: 0.45,
    }),
    jacketLight: pm(C.armorDarkPlate || '#181d2e', { roughness: 0.38, metalness: 0.50 }),
    lapel:  pm(dark, { roughness: 0.30, metalness: 0.55 }),
    collar: pm(white, { roughness: 0.20, metalness: 0.10, clearcoat: 0.92 }),
    tie: new THREE.MeshBasicMaterial({ color: new THREE.Color(led) }),
    tieKnot: new THREE.MeshBasicMaterial({ color: new THREE.Color(led) }),
    pants: pm(dark, { roughness: 0.5, metalness: 0.3 }),

    // ── Eyes (Amber Glowing Anime Eyes) ──
    eyeWhite: pm(C.sclera || '#f8f9ff', { roughness: 0.18, metalness: 0.0 }),
    iris: pm(C.irisOuter || '#f59e0b', {
      roughness: 0.04, metalness: 0.0,
      emissive: new THREE.Color(C.irisOuter || '#f59e0b'), emissiveIntensity: 0.65,
      clearcoat: 1.0, clearcoatRoughness: 0.0,
    }),
    irisInner: pm(C.irisInner || '#d97706', {
      roughness: 0.04, metalness: 0.0,
      emissive: new THREE.Color(C.irisInner || '#d97706'), emissiveIntensity: 0.45,
    }),
    pupil: pm(C.pupil || '#0a0814', { roughness: 0.0, metalness: 0.0 }),
    catchlight: pm('#ffffff', {
      roughness: 0.0, metalness: 0.0,
      emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.0,
    }),

    // ── Mouth ──
    lip: pm(C.lip, {
      roughness: 0.40, metalness: 0.0,
      clearcoat: 0.35, clearcoatRoughness: 0.22,
      sheen: 0.25, sheenRoughness: 0.40,
      sheenColor: new THREE.Color('#ffbbaa'),
    }),
    lipDark: pm(C.lipDark, {
      roughness: 0.45, metalness: 0.0,
      clearcoat: 0.30, clearcoatRoughness: 0.25,
      sheen: 0.20, sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#ee9988'),
    }),
    cavity: new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c0406') }),
    tongue: pm(C.tongue, {
      roughness: 0.75, metalness: 0.0,
      transparent: true, opacity: 0.0,
    }),
    teeth: pm(C.teeth || '#ffffff', {
      roughness: 0.35, metalness: 0.0,
      emissive: new THREE.Color('#f0f0f5'), emissiveIntensity: 0.08,
    }),

    // ── Face details ──
    nose:  pm(C.skinShadow, { roughness: 0.62, metalness: 0.0 }),
    ear:   pm(C.skinShadow, { roughness: 0.68, metalness: 0.0 }),
    cheek: pm(C.skin, {
      roughness: 0.6, metalness: 0.0,
      transparent: true, opacity: 0.0,
      emissive: new THREE.Color('#ffb0a0'), emissiveIntensity: 0.0,
    }),
    nail: pm(white, {
      roughness: 0.12, metalness: 0.0,
      clearcoat: 0.9, clearcoatRoughness: 0.08,
      transparent: true, opacity: 0.85,
    }),
    scm: pm(C.skinShadow, { roughness: 0.7, metalness: 0.0, transparent: true, opacity: 0.55 }),

    // ── Accessories ──
    watch:    pm('#c8d4ea', { roughness: 0.06, metalness: 0.96, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
    watchBand:pm('#0c0a08', { roughness: 0.88, metalness: 0.02 }),
    cufflink: pm('#d0d8ea', { roughness: 0.05, metalness: 0.98, clearcoat: 1.0, clearcoatRoughness: 0.04,
      emissive: new THREE.Color('#c0c8e0'), emissiveIntensity: 0.12 }),
    aura: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(orange),
      roughness: 1.0, metalness: 0.0,
      transparent: true, opacity: 0.0,
      emissive: new THREE.Color(orange),
      emissiveIntensity: 0.0,
      side: THREE.BackSide,
    }),
  };
}

// ── Build geometry set ────────────────────────────────────────
function buildGeometries() {
  return {
    // ── Head — anime aesthetic oval skull & refined jaw ──
    skull:        new THREE.SphereGeometry(0.212, 48, 40),
    jaw:          new THREE.SphereGeometry(0.182, 36, 30),
    chin:         new THREE.SphereGeometry(0.048, 16, 16),
    foreheadRidge:new THREE.BoxGeometry(0.28, 0.024, 0.016),
    zygL:         new THREE.SphereGeometry(0.035, 12, 12),
    zygR:         new THREE.SphereGeometry(0.035, 12, 12),

    // ── Face features ──
    eyeball:      new THREE.SphereGeometry(0.062, 28, 24),
    iris:         new THREE.SphereGeometry(0.044, 22, 20),
    pupil:        new THREE.SphereGeometry(0.024, 16, 16),
    catchlight:   new THREE.SphereGeometry(0.010, 8, 8),
    eyelashU:     new THREE.BoxGeometry(0.108, 0.007, 0.004),
    eyelidU:      new THREE.CapsuleGeometry(0.060, 0.096, 4, 10),
    brow:         new THREE.CapsuleGeometry(0.007, 0.072, 4, 12),
    browInner:    new THREE.CapsuleGeometry(0.006, 0.036, 4, 8),
    ear:          new THREE.SphereGeometry(0.046, 18, 16),
    earInner:     new THREE.SphereGeometry(0.028, 10, 10),
    earLobe:      new THREE.SphereGeometry(0.024, 12, 12),
    nose:         new THREE.ConeGeometry(0.018, 0.044, 12),
    noseBridge:   new THREE.BoxGeometry(0.018, 0.055, 0.016),
    nostrilL:     new THREE.SphereGeometry(0.014, 10, 8),
    nostrilR:     new THREE.SphereGeometry(0.014, 10, 8),
    cheekL:       new THREE.SphereGeometry(0.048, 14, 14),
    cheekR:       new THREE.SphereGeometry(0.048, 14, 14),
    philtrum:     new THREE.SphereGeometry(0.012, 8, 8),

    // ── Mouth Lip-Sync Elements ──
    upperLip:     new THREE.CapsuleGeometry(0.0075, 0.076, 4, 16),
    lowerLip:     new THREE.CapsuleGeometry(0.0095, 0.068, 4, 16),
    mouthCavity:  new THREE.BoxGeometry(0.076, 0.038, 0.018),
    lipCornerL:   new THREE.SphereGeometry(0.0085, 10, 8),
    lipCornerR:   new THREE.SphereGeometry(0.0085, 10, 8),
    teeth:        new THREE.BoxGeometry(0.066, 0.015, 0.008),
    lowerTeeth:   new THREE.BoxGeometry(0.060, 0.013, 0.008),
    tongue:       new THREE.SphereGeometry(0.026, 14, 10),

    // ── Layered Anime Hair ──
    hairCap:      new THREE.SphereGeometry(0.222, 40, 30, 0, Math.PI * 2, 0, Math.PI / 1.85),
    hairCrown:    new THREE.SphereGeometry(0.216, 32, 24),
    hairTop:      new THREE.SphereGeometry(0.226, 40, 30, 0, Math.PI * 2, 0, Math.PI / 1.9),
    hairFront:    new THREE.BoxGeometry(0.180, 0.050, 0.040),
    hairTuftLg:   new THREE.ConeGeometry(0.058, 0.170, 8),
    hairTuftMd:   new THREE.ConeGeometry(0.046, 0.145, 8),
    hairTuftSm:   new THREE.ConeGeometry(0.035, 0.115, 8),
    hairTuftBang: new THREE.ConeGeometry(0.042, 0.155, 8),
    hairSideL:    new THREE.BoxGeometry(0.048, 0.165, 0.210),
    hairSideR:    new THREE.BoxGeometry(0.048, 0.165, 0.210),
    hairBack:     new THREE.BoxGeometry(0.360, 0.150, 0.070),
    hairNape:     new THREE.SphereGeometry(0.075, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.50),

    // ── Holographic AR Smart-Visor ──
    visorGlass:   new THREE.CylinderGeometry(0.228, 0.228, 0.075, 36, 1, true, -Math.PI * 0.35, Math.PI * 0.70),
    visorFrameTop:new THREE.BoxGeometry(0.260, 0.012, 0.014),
    visorFrameSide: new THREE.BoxGeometry(0.012, 0.055, 0.085),
    visorAccent:  new THREE.BoxGeometry(0.026, 0.008, 0.012),

    // ── Cyber Headset & Boom Mic ──
    headsetBand:  new THREE.TorusGeometry(0.226, 0.014, 12, 32, Math.PI * 0.85),
    headsetCup:   new THREE.CylinderGeometry(0.056, 0.056, 0.035, 24),
    headsetLedRing: new THREE.TorusGeometry(0.040, 0.006, 12, 28),
    headsetCenter:new THREE.CylinderGeometry(0.026, 0.026, 0.038, 16),
    headsetBoomMic:new THREE.CapsuleGeometry(0.007, 0.165, 6, 12),
    headsetMicTip:new THREE.CylinderGeometry(0.011, 0.011, 0.024, 12),
    headsetMicLed:new THREE.SphereGeometry(0.006, 8, 8),

    // ── Neck & High Cyber Collar ──
    neck:         new THREE.CylinderGeometry(0.076, 0.098, 0.165, 22),
    collarInner:  new THREE.CylinderGeometry(0.108, 0.118, 0.115, 24, 1, true, -Math.PI * 0.82, Math.PI * 1.64),
    collarOuter:  new THREE.CylinderGeometry(0.120, 0.134, 0.098, 24, 1, true, -Math.PI * 0.78, Math.PI * 1.56),
    collarLapelL: new THREE.BoxGeometry(0.035, 0.090, 0.015),
    collarLapelR: new THREE.BoxGeometry(0.035, 0.090, 0.015),
    collarL:      new THREE.BoxGeometry(0.035, 0.090, 0.015),
    collarR:      new THREE.BoxGeometry(0.035, 0.090, 0.015),

    // ── Cyber Armor Vest & Glowing Power Core ──
    torsoBody:    new THREE.CapsuleGeometry(0.215, 0.420, 10, 20),
    torso:        new THREE.CapsuleGeometry(0.215, 0.420, 10, 20),
    chestCenter:  new THREE.BoxGeometry(0.165, 0.320, 0.050),
    vestArmorL:   new THREE.BoxGeometry(0.105, 0.355, 0.065),
    vestArmorR:   new THREE.BoxGeometry(0.105, 0.355, 0.065),
    lapelL:       new THREE.BoxGeometry(0.105, 0.355, 0.065),
    lapelR:       new THREE.BoxGeometry(0.105, 0.355, 0.065),
    vestWhiteStripeL: new THREE.BoxGeometry(0.018, 0.325, 0.072),
    vestWhiteStripeR: new THREE.BoxGeometry(0.018, 0.325, 0.072),
    vestLedStripL:new THREE.BoxGeometry(0.009, 0.270, 0.076),
    vestLedStripR:new THREE.BoxGeometry(0.009, 0.270, 0.076),

    // Inverted Triangle Power Core (▽)
    coreFrame:    new THREE.CylinderGeometry(0.052, 0.052, 0.014, 3),
    coreTriangle: new THREE.CylinderGeometry(0.040, 0.040, 0.018, 3),
    coreInner:    new THREE.CylinderGeometry(0.024, 0.024, 0.020, 3),

    // ── Waist & Belt ──
    waistBelt:    new THREE.CylinderGeometry(0.205, 0.190, 0.130, 22),
    waist:        new THREE.CylinderGeometry(0.205, 0.190, 0.130, 22),
    beltBuckle:   new THREE.BoxGeometry(0.065, 0.040, 0.035),
    beltAccent:   new THREE.BoxGeometry(0.025, 0.015, 0.038),

    // ── Shoulders (Dark Pauldrons with Glowing LED Ring ◎) ──
    shoulderBall:     new THREE.SphereGeometry(0.105, 22, 20),
    shoulderPauldron: new THREE.SphereGeometry(0.132, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
    shoulder:         new THREE.SphereGeometry(0.132, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
    shoulderLedRing:  new THREE.TorusGeometry(0.042, 0.006, 12, 28),
    shoulderLedCenter:new THREE.CylinderGeometry(0.022, 0.022, 0.014, 16),

    // ── Arms ──
    upperArm:     new THREE.CapsuleGeometry(0.074, 0.235, 10, 14),
    elbowRing:    new THREE.TorusGeometry(0.066, 0.012, 10, 24),
    forearmBionic:new THREE.CapsuleGeometry(0.068, 0.235, 10, 14),
    lowerArm:     new THREE.CapsuleGeometry(0.068, 0.235, 10, 14),
    forearmLed:   new THREE.BoxGeometry(0.012, 0.170, 0.016),
    wristCuff:    new THREE.CylinderGeometry(0.062, 0.062, 0.028, 18),
    wrist:        new THREE.SphereGeometry(0.058, 18, 14),
    palm:         new THREE.SphereGeometry(0.068, 20, 16),
    thumb:        new THREE.CapsuleGeometry(0.020, 0.052, 4, 8),

    // ── 3-phalanx finger segments ──
    phalanxP:     new THREE.CapsuleGeometry(0.014, 0.048, 4, 8),
    phalanxM:     new THREE.CapsuleGeometry(0.013, 0.038, 4, 8),
    phalanxD:     new THREE.CapsuleGeometry(0.012, 0.030, 4, 8),
    knuckle:      new THREE.SphereGeometry(0.016, 8, 8),
    fingernail:   new THREE.BoxGeometry(0.022, 0.006, 0.016),

    // ── Aura ──
    aura:         new THREE.CapsuleGeometry(0.260, 0.460, 10, 20),
  };
}

// ─────────────────────────────────────────────────────────────
// Eye component — anime layered construction with amber glow
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
        position={[0, 0.052, 0.038]} rotation={[0, 0, Math.PI / 2]}
        scale={[0.55, 0.10, 0.22]} />
      {/* Lower eyelid */}
      <mesh geometry={G.eyelidU} material={M.skinDark}
        position={[0, -0.048, 0.040]} rotation={[0, 0, Math.PI / 2]}
        scale={[0.55, 0.07, 0.18]} />
      {/* Upper anime eyelash strip */}
      <mesh geometry={G.eyelashU} material={eyelashMat || M.brow}
        position={[0, 0.054, 0.042]} />
      {/* Iris outer — golden amber anime glow */}
      <mesh ref={irisRef} geometry={G.iris} material={activeMat}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.034]}
        scale={[irisScale, irisScale, 1]} />
      {/* Iris inner depth ring */}
      <mesh geometry={G.iris} material={M.irisInner}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.040]}
        scale={[irisScale * 0.65, irisScale * 0.65, 1]} />
      {/* Dark Pupil */}
      <mesh geometry={G.pupil} material={M.pupil}
        position={[pupilOffX * 0.013, pupilOffY * 0.011, 0.046]} />
      {/* Main Catchlight — anime sparkle */}
      <mesh geometry={G.catchlight} material={M.catchlight}
        position={[pupilOffX * 0.013 + 0.015, pupilOffY * 0.011 + 0.015, 0.054]} />
      {/* Secondary soft catchlight */}
      <mesh geometry={G.catchlight} material={M.catchlight}
        position={[pupilOffX * 0.013 - 0.012, pupilOffY * 0.011 - 0.010, 0.053]}
        scale={[0.55, 0.55, 0.55]} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Fully Articulated Biomechanical Hand Component
// With real-time 60 FPS finger curl, phalanx cascade, natural splay,
// opposable thumb articulation, and co-speech micro-flutter.
// ─────────────────────────────────────────────────────────────
function Hand({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  isLeft = false,
  state = CHARACTER_STATES.IDLE,
  animRef,
  audioAmplitude = 0,
  G,
  M,
}) {
  const dir = isLeft ? -1 : 1;

  // Thumb joint refs: base (metacarpal), proximal, medial, distal
  const thumbBaseRef = useRef();
  const thumbPRef    = useRef();
  const thumbMRef    = useRef();
  const thumbDRef    = useRef();

  // 4 fingers: Index (0), Middle (1), Ring (2), Little (3)
  // Each has: root (splay abduction), proximal, medial, distal phalanx
  const fRoot0 = useRef(); const fRoot1 = useRef(); const fRoot2 = useRef(); const fRoot3 = useRef();
  const fP0    = useRef(); const fP1    = useRef(); const fP2    = useRef(); const fP3    = useRef();
  const fM0    = useRef(); const fM1    = useRef(); const fM2    = useRef(); const fM3    = useRef();
  const fD0    = useRef(); const fD1    = useRef(); const fD2    = useRef(); const fD3    = useRef();

  const fRoots = [fRoot0, fRoot1, fRoot2, fRoot3];
  const fPs    = [fP0, fP1, fP2, fP3];
  const fMs    = [fM0, fM1, fM2, fM3];
  const fDs    = [fD0, fD1, fD2, fD3];

  // Smooth interpolated joint values to prevent popping during state switches
  const smoothValues = useRef({
    thumbCurl: 0.22,
    thumbRotZ: dir * (Math.PI / 2.5),
    thumbRotX: 0,
    thumbRotY: dir * -0.5,
    curls: [0.24, 0.28, 0.34, 0.40],
    splays: [dir * -0.05, 0, dir * 0.035, dir * 0.08],
  });

  useFrame((_, dt) => {
    const a = animRef?.current;
    const t = a ? a.time : performance.now() * 0.001;
    const baseCurl = a ? (isLeft ? a.leftCurl : a.rightCurl) : 0.25;
    const sv = smoothValues.current;
    const clampDt = Math.min(dt, 0.05);

    let tThumbCurl = 0.22;
    let tThumbRotZ = dir * (Math.PI / 2.5);
    let tThumbRotX = 0;
    let tThumbRotY = dir * -0.5;
    let tCurls = [0.24, 0.28, 0.34, 0.40];
    let tSplays = [dir * -0.05, 0, dir * 0.035, dir * 0.08];

    const isTalking     = state === CHARACTER_STATES.TALKING;
    const isGreeting    = state === CHARACTER_STATES.GREETING;
    const isEncouraging = state === CHARACTER_STATES.ENCOURAGING;
    const isThinking    = state === CHARACTER_STATES.THINKING;
    const isHappy       = state === CHARACTER_STATES.HAPPY;
    const isGesture     = state === CHARACTER_STATES.GESTURE;

    if (isEncouraging && !isLeft) {
      // ── RIGHT HAND: CONFIDENT PROUD THUMBS UP ──
      tThumbCurl = 0.02;
      tThumbRotZ = -0.42;  // rotated vertically upward
      tThumbRotX = -0.32;
      tThumbRotY =  0.18;
      // All 4 fingers curled firmly into palm
      tCurls = [0.92, 0.95, 0.96, 0.96];
      tSplays = [0, 0, 0, 0];
    } else if (isGreeting && !isLeft) {
      // ── RIGHT HAND: VIBRANT WELCOMING WAVING HAND ──
      const waveFlutter = Math.sin(t * 8.0) * 0.05;
      tThumbCurl = 0.08;
      tThumbRotZ = dir * (Math.PI / 2.2);
      tThumbRotY = dir * -0.65;
      tCurls = [
        0.08 + waveFlutter,
        0.10 + waveFlutter,
        0.14 + waveFlutter,
        0.18 + waveFlutter,
      ];
      tSplays = [dir * -0.12, dir * -0.02, dir * 0.08, dir * 0.18];
    } else if (isGesture && !isLeft) {
      // ── RIGHT HAND: PRECISION POINT / EMPHASIS ──
      tThumbCurl = 0.36;
      tThumbRotZ = dir * (Math.PI / 2.8);
      tThumbRotY = dir * -0.30;
      tCurls = [
        0.04 + Math.sin(t * 4.0) * 0.02, // Index straight pointer
        0.75, // Middle tucked
        0.84, // Ring tucked
        0.88, // Little tucked
      ];
      tSplays = [dir * -0.09, dir * 0.02, dir * 0.04, dir * 0.06];
    } else if (isThinking && !isLeft) {
      // ── RIGHT HAND: CONTEMPLATIVE CHIN-TOUCH ──
      tThumbCurl = 0.22;
      tThumbRotZ = dir * (Math.PI / 2.4);
      tCurls = [0.32, 0.65, 0.72, 0.78];
      tSplays = [dir * -0.05, 0, dir * 0.03, dir * 0.06];
    } else if (isHappy) {
      // ── CELEBRATORY JOYFUL OPEN HANDS ──
      const joyFlutter = Math.sin(t * 5.0 + (isLeft ? 0 : 1)) * 0.04;
      tThumbCurl = 0.12;
      tThumbRotZ = dir * (Math.PI / 2.3);
      tCurls = [
        0.10 + joyFlutter,
        0.12 + joyFlutter,
        0.16 + joyFlutter,
        0.20 + joyFlutter,
      ];
      tSplays = [dir * -0.10, 0, dir * 0.06, dir * 0.14];
    } else if (isTalking) {
      // ── CO-SPEECH DYNAMIC ARTICULATION ──
      const cadence = Math.sin(t * 2.2 + (isLeft ? 1.2 : 0));
      const ampBoost = audioAmplitude > 0.03 ? Math.min(0.18, audioAmplitude * 0.8) : 0;
      const dynCurl = 0.20 - cadence * 0.08 - ampBoost;
      const fFlutter = Math.sin(t * 3.5 + (isLeft ? 0.7 : 0)) * 0.025;

      tThumbCurl = Math.max(0.08, dynCurl * 0.85);
      tThumbRotZ = dir * (Math.PI / 2.5 - cadence * 0.08);
      tThumbRotY = dir * (-0.5 - cadence * 0.1);

      tCurls = [
        Math.max(0.06, dynCurl + fFlutter),
        Math.max(0.08, dynCurl * 1.15 + fFlutter),
        Math.max(0.12, dynCurl * 1.35 + fFlutter),
        Math.max(0.16, dynCurl * 1.55 + fFlutter),
      ];
      tSplays = [
        dir * (-0.08 - cadence * 0.03),
        0,
        dir * (0.05 + cadence * 0.02),
        dir * (0.12 + cadence * 0.04),
      ];
    } else {
      // ── IDLE / LISTENING: NATURAL BIOMECHANICAL RESTING ARC ──
      const restBreath = Math.sin(t * 1.1 + (isLeft ? 0.5 : 0)) * 0.015;
      const bCurl = Math.max(0.16, Math.min(0.38, baseCurl));
      tThumbCurl = bCurl * 0.85 + restBreath;
      tThumbRotZ = dir * (Math.PI / 2.5);
      tThumbRotY = dir * -0.5;
      tCurls = [
        bCurl * 0.90 + restBreath,
        bCurl * 1.05 + restBreath,
        bCurl * 1.20 + restBreath,
        bCurl * 1.35 + restBreath,
      ];
      tSplays = [dir * -0.05, 0, dir * 0.035, dir * 0.08];
    }

    // Damp values smoothly at 12 rad/s
    const dampRate = 12 * clampDt;
    sv.thumbCurl = sv.thumbCurl + (tThumbCurl - sv.thumbCurl) * dampRate;
    sv.thumbRotZ = sv.thumbRotZ + (tThumbRotZ - sv.thumbRotZ) * dampRate;
    sv.thumbRotX = sv.thumbRotX + (tThumbRotX - sv.thumbRotX) * dampRate;
    sv.thumbRotY = sv.thumbRotY + (tThumbRotY - sv.thumbRotY) * dampRate;

    for (let i = 0; i < 4; i++) {
      sv.curls[i]  = sv.curls[i]  + (tCurls[i]  - sv.curls[i])  * dampRate;
      sv.splays[i] = sv.splays[i] + (tSplays[i] - sv.splays[i]) * dampRate;
    }

    // Apply to Thumb
    if (thumbBaseRef.current) {
      thumbBaseRef.current.rotation.x = sv.thumbRotX;
      thumbBaseRef.current.rotation.y = sv.thumbRotY;
      thumbBaseRef.current.rotation.z = sv.thumbRotZ;
    }
    const tC = sv.thumbCurl * (Math.PI / 2.2);
    if (thumbPRef.current) thumbPRef.current.rotation.x = tC;
    if (thumbMRef.current) thumbMRef.current.rotation.x = tC * 0.65;
    if (thumbDRef.current) thumbDRef.current.rotation.x = tC * 0.45;

    // Apply to 4 fingers
    for (let i = 0; i < 4; i++) {
      const curlVal = sv.curls[i];
      const splayVal = sv.splays[i];
      if (fRoots[i].current) fRoots[i].current.rotation.z = splayVal;
      if (fPs[i].current)    fPs[i].current.rotation.x    = curlVal * (Math.PI / 2.2);
      if (fMs[i].current)    fMs[i].current.rotation.x    = curlVal * (Math.PI / 1.8) * 0.72;
      if (fDs[i].current)    fDs[i].current.rotation.x    = curlVal * (Math.PI / 1.6) * 0.54;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Palm */}
      <mesh geometry={G.palm} material={M.skin} />
      <mesh geometry={G.wrist} material={M.skin} position={[0, 0.04, 0]} />

      {/* Opposable Thumb */}
      <group
        ref={thumbBaseRef}
        position={[dir * 0.068, 0.020, 0.012]}
        rotation={[0, dir * -0.5, dir * Math.PI / 2.5]}
      >
        <group ref={thumbPRef}>
          <mesh geometry={G.phalanxP} material={M.skin} position={[0, 0.038, 0]} />
          <mesh geometry={G.knuckle} material={M.skin} position={[0, 0.068, 0]} scale={[0.75, 0.55, 0.75]} />
          <group ref={thumbMRef} position={[0, 0.082, 0]}>
            <mesh geometry={G.phalanxM} material={M.skin} position={[0, 0.028, 0]} />
            <mesh geometry={G.knuckle} material={M.skin} position={[0, 0.050, 0]} scale={[0.65, 0.48, 0.65]} />
            <group ref={thumbDRef} position={[0, 0.058, 0]}>
              <mesh geometry={G.phalanxD} material={M.skin} position={[0, 0.022, 0]} />
              <mesh
                geometry={G.fingernail}
                material={M.nail}
                position={[0, 0.042, 0.010]}
                rotation={[0.3, 0, 0]}
              />
            </group>
          </group>
        </group>
      </group>

      {/* 4 Fingers: Index, Middle, Ring, Little */}
      {[
        { x: dir * -0.046, z: 0.006, scale: [0.95, 0.96, 0.95] }, // Index
        { x: dir * -0.016, z: 0.008, scale: [1.00, 1.02, 1.00] }, // Middle (longest)
        { x: dir *  0.014, z: 0.008, scale: [0.96, 0.98, 0.96] }, // Ring
        { x: dir *  0.040, z: 0.004, scale: [0.84, 0.82, 0.84] }, // Little
      ].map(({ x, z, scale }, i) => (
        <group key={i} position={[x, 0.082, z]} scale={scale}>
          <group ref={fRoots[i]}>
            <group ref={fPs[i]}>
              <mesh geometry={G.phalanxP} material={M.skin} position={[0, 0.040, 0]} />
              <mesh geometry={G.knuckle} material={M.skin} position={[0, 0.072, 0]} scale={[0.7, 0.5, 0.7]} />
              <group ref={fMs[i]} position={[0, 0.090, 0]}>
                <mesh geometry={G.phalanxM} material={M.skin} position={[0, 0.032, 0]} />
                <mesh geometry={G.knuckle} material={M.skin} position={[0, 0.055, 0]} scale={[0.6, 0.45, 0.6]} />
                <group ref={fDs[i]} position={[0, 0.065, 0]}>
                  <mesh geometry={G.phalanxD} material={M.skin} position={[0, 0.025, 0]} />
                  <mesh
                    geometry={G.fingernail}
                    material={M.nail}
                    position={[0, 0.048, 0.010]}
                    rotation={[0.3, 0, 0]}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
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
  const mouthCavityRef  = useRef();
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
    // Wrists (3-axis articulation)
    leftWristRotX: 0, leftWristRotY: 0, leftWristRotZ: 0,
    rightWristRotX: 0, rightWristRotY: 0, rightWristRotZ: 0,
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
    if (lipCornerLRef.current) lipCornerLRef.current.position.y = -0.118 + a.lipCornerY - a.mouthOpen * 0.005;
    if (lipCornerRRef.current) lipCornerRRef.current.position.y = -0.118 + a.lipCornerY - a.mouthOpen * 0.005;

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

    // Wrists (3-axis: flexion/extension X, pronation/supination Y, lateral wave/deviation Z)
    let lWristX = -0.06, lWristY =  0.10, lWristZ = -0.02;
    let rWristX = -0.06, rWristY = -0.10, rWristZ =  0.02;

    if (state === CHARACTER_STATES.GREETING) {
      // Right hand raises and waves energetically side-to-side!
      rWristZ = Math.sin(a.time * 7.5) * 0.36;
      rWristX = -0.16 + Math.cos(a.time * 3.5) * 0.06;
      rWristY = 0.28;
      lWristX = -0.04; lWristY = 0.08; lWristZ = 0;
    } else if (state === CHARACTER_STATES.ENCOURAGING) {
      // Right hand held upright in firm thumbs-up!
      rWristX =  0.24;
      rWristY = -0.36;
      rWristZ =  0.06;
      lWristX =  0.10; lWristY = 0.12;
    } else if (isTalking || state === CHARACTER_STATES.GESTURE) {
      // Natural co-speech wrist articulation following forearm movement with secondary lag
      const t = a.time;
      rWristX = Math.sin(t * 3.2) * 0.14 + a.rightForeRotX * 0.25 + (audioAmplitude || 0) * 0.25;
      rWristY = -0.22 + Math.sin(t * 1.8) * 0.12;
      rWristZ = Math.cos(t * 2.8) * 0.08;

      lWristX = Math.sin(t * 2.8 + 1.2) * 0.12 + a.leftForeRotX * 0.25 + (audioAmplitude || 0) * 0.18;
      lWristY =  0.22 - Math.sin(t * 1.6) * 0.12;
      lWristZ = -Math.cos(t * 2.4) * 0.08;
    } else if (state === CHARACTER_STATES.HAPPY) {
      rWristX = 0.18 + Math.sin(a.time * 5.0) * 0.14;
      rWristZ = Math.cos(a.time * 5.0) * 0.12;
      lWristX = 0.18 + Math.sin(a.time * 5.0 + 0.8) * 0.14;
      lWristZ = -Math.cos(a.time * 5.0 + 0.8) * 0.12;
    } else if (state === CHARACTER_STATES.THINKING) {
      rWristX =  0.32;
      rWristY =  0.40;
      rWristZ = -0.12;
    } else {
      // Idle / Listening: gentle subtle breathing micro-sway
      rWristX = -0.06 + Math.sin(a.time * 1.2) * 0.02;
      lWristX = -0.06 + Math.sin(a.time * 1.2 + 0.5) * 0.02;
    }

    a.leftWristRotX  = damp(a.leftWristRotX,  lWristX, 8, dt);
    a.leftWristRotY  = damp(a.leftWristRotY,  lWristY, 8, dt);
    a.leftWristRotZ  = damp(a.leftWristRotZ,  lWristZ, 8, dt);
    a.rightWristRotX = damp(a.rightWristRotX, rWristX, 8, dt);
    a.rightWristRotY = damp(a.rightWristRotY, rWristY, 8, dt);
    a.rightWristRotZ = damp(a.rightWristRotZ, rWristZ, 8, dt);

    if (leftWristRef.current) {
      leftWristRef.current.rotation.x = a.leftWristRotX;
      leftWristRef.current.rotation.y = a.leftWristRotY;
      leftWristRef.current.rotation.z = a.leftWristRotZ;
    }
    if (rightWristRef.current) {
      rightWristRef.current.rotation.x = a.rightWristRotX;
      rightWristRef.current.rotation.y = a.rightWristRotY;
      rightWristRef.current.rotation.z = a.rightWristRotZ;
    }

    // Hand curl
    a.leftCurl  = damp(a.leftCurl,  lCurl, 6, dt);
    a.rightCurl = damp(a.rightCurl, rCurl, 6, dt);
    leftHandCurlRef.current  = a.leftCurl;
    rightHandCurlRef.current = a.rightCurl;

    // ── Mouth — jaw-drop + audio amplitude ──────────────────
    let targetMouth = cfg.mouthOpen;
    if (isTalking) {
      targetMouth = audioAmplitude > 0.02
        ? Math.min(1, audioAmplitude * 2.5)
        : (cfg.mouthOpen || 0.45) * (0.35 + Math.abs(Math.sin(a.time * 6.5)) * 0.95);
    }
    a.mouthOpen   = damp(a.mouthOpen,   targetMouth, 10, dt);
    a.teethScaleY = damp(a.teethScaleY, a.mouthOpen > 0.08 ? a.mouthOpen : 0, 10, dt);

    // Jaw drop — whole jaw moves down with mouth opening
    const targetJawDrop = a.mouthOpen * 0.022;
    a.jawDropY = damp(a.jawDropY, targetJawDrop, 8, dt);

    // Tongue — appears when mouth opens
    const targetTongue = a.mouthOpen > 0.25 ? Math.min(1, (a.mouthOpen - 0.25) * 2.2) : 0;
    a.tongueOpacity = damp(a.tongueOpacity, targetTongue * 0.75, 8, dt);
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

    // Dynamic lip stretch for speech phonemes (stretch wide on vowels, puckered on consonants/O)
    const speechWave = Math.sin(a.time * 12);
    const lipStretchX = 1 + (isTalking ? (speechWave > 0 ? 0.14 : -0.10) * a.mouthOpen : 0);

    if (mouthTopRef.current) {
      mouthTopRef.current.position.y = -0.112 + a.mouthOpen * 0.008;
      mouthTopRef.current.scale.set(lipStretchX, 1, 1);
    }
    if (mouthBotRef.current) {
      mouthBotRef.current.position.y = -0.124 - a.mouthOpen * 0.022 - a.jawDropY * 0.4;
      mouthBotRef.current.scale.set(lipStretchX, 1, 1);
    }
    if (teethRef.current) {
      teethRef.current.scale.set(1, Math.max(0.01, a.teethScaleY), 1);
    }
    if (lowerTeethRef.current) {
      lowerTeethRef.current.position.y = -0.123 - a.mouthOpen * 0.018 - a.jawDropY * 0.4;
      lowerTeethRef.current.scale.set(1, Math.max(0.01, a.teethScaleY), 1);
    }
    if (mouthCavityRef.current) {
      mouthCavityRef.current.scale.set(lipStretchX, Math.max(0.01, a.mouthOpen), 1);
    }
    if (tongueRef.current) {
      tongueRef.current.position.y = -0.123 - a.jawDropY * 0.3;
    }

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
        {/* Base dark titanium compression chassis */}
        <mesh geometry={G.torsoBody} material={M.armorDark} />

        {/* Center chest dark plate */}
        <mesh geometry={G.chestCenter} material={M.armorDarkPlate}
          position={[0, 0.075, 0.175]} />

        {/* ── CYBER ORANGE ARMOR VEST (Left & Right) ─────── */}
        <mesh ref={lapelLRef} geometry={G.vestArmorL} material={shirtMat}
          position={[-0.118, 0.080, 0.170]} rotation={[0, 0.14, 0]} />
        <mesh ref={lapelRRef} geometry={G.vestArmorR} material={shirtMat}
          position={[ 0.118, 0.080, 0.170]} rotation={[0, -0.14, 0]} />

        {/* ── BIONIC WHITE ACCENT STRIPES ─────────────────── */}
        <mesh geometry={G.vestWhiteStripeL} material={M.armorWhite}
          position={[-0.068, 0.078, 0.188]} rotation={[0, 0.08, 0]} />
        <mesh geometry={G.vestWhiteStripeR} material={M.armorWhite}
          position={[ 0.068, 0.078, 0.188]} rotation={[0, -0.08, 0]} />

        {/* ── GLOWING NEON ORANGE LED LIGHT STRIPS ────────── */}
        <mesh geometry={G.vestLedStripL} material={tieMat}
          position={[-0.086, 0.075, 0.194]} rotation={[0, 0.10, 0]} />
        <mesh geometry={G.vestLedStripR} material={tieMat}
          position={[ 0.086, 0.075, 0.194]} rotation={[0, -0.10, 0]} />

        {/* ── GLOWING CHEST POWER CORE (Inverted Triangle ▽) ── */}
        <group position={[0, 0.138, 0.208]}>
          {/* Outer dark titanium triangular frame */}
          <mesh geometry={G.coreFrame} material={M.coreFrame}
            rotation={[Math.PI / 2, 0, Math.PI]} />
          {/* Glowing neon-orange triangle core */}
          <mesh geometry={G.coreTriangle} material={M.coreGlow}
            position={[0, 0, 0.003]}
            rotation={[Math.PI / 2, 0, Math.PI]} />
          {/* Inner bright yellow-orange hotspot */}
          <mesh geometry={G.coreInner} material={M.ledOrangeBright}
            position={[0, 0, 0.006]}
            rotation={[Math.PI / 2, 0, Math.PI]} />
        </group>

        {/* ── WAIST & MECHA BELT ──────────────────────────── */}
        <mesh geometry={G.waistBelt} material={M.armorDark} position={[0, -0.290, 0]} />
        <mesh geometry={G.beltBuckle} material={M.armorDarkPlate} position={[0, -0.270, 0.195]} />
        <mesh geometry={G.beltAccent} material={M.ledOrange} position={[0, -0.270, 0.210]} />

        {/* ── MECHA SHOULDERS (Dark Pauldrons with Glowing LED Ring ◎) ── */}
        <group position={[-0.295, 0.255, 0]}>
          <mesh ref={leftShoulderRef} geometry={G.shoulderPauldron} material={M.armorDark}
            rotation={[0, 0, 0.35]} />
          {/* Glowing Circular Orange LED Ring on shoulder */}
          <mesh geometry={G.shoulderLedRing} material={M.ledOrange}
            position={[-0.108, 0.015, 0]} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={G.shoulderLedCenter} material={M.armorDarkPlate}
            position={[-0.105, 0.015, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>

        <group position={[0.295, 0.255, 0]}>
          <mesh ref={rightShoulderRef} geometry={G.shoulderPauldron} material={M.armorDark}
            rotation={[0, 0, -0.35]} />
          {/* Glowing Circular Orange LED Ring on shoulder */}
          <mesh geometry={G.shoulderLedRing} material={M.ledOrange}
            position={[0.108, 0.015, 0]} rotation={[0, -Math.PI / 2, 0]} />
          <mesh geometry={G.shoulderLedCenter} material={M.armorDarkPlate}
            position={[0.105, 0.015, 0]} rotation={[0, -Math.PI / 2, 0]} />
        </group>

        {/* ── NECK & CYBER MANDARIN COLLAR ────────────────── */}
        <group ref={neckRef} position={[0, 0.440, 0]}>
          {/* Sleek neck */}
          <mesh geometry={G.neck} material={skinMat} />

          {/* High Dark Titanium Inner Collar */}
          <mesh geometry={G.collarInner} material={M.armorDarkPlate}
            position={[0, -0.015, 0]} />

          {/* Cyber Orange Outer Collar */}
          <mesh geometry={G.collarOuter} material={shirtMat}
            position={[0, -0.025, 0]} />

          {/* Orange Collar Lapel Notches */}
          <mesh geometry={G.collarLapelL} material={shirtMat}
            position={[-0.045, 0.020, 0.118]} rotation={[0, 0.25, 0.12]} />
          <mesh geometry={G.collarLapelR} material={shirtMat}
            position={[ 0.045, 0.020, 0.118]} rotation={[0, -0.25, -0.12]} />

          {/* SSS neck glow shell */}
          <mesh geometry={G.neck} material={sssMat} scale={[1.04, 1.01, 1.04]} />

          {/* ── HEAD ───────────────────────────────────────── */}
          <group ref={headRef} position={[0, 0.280, 0]}>
            {/* SSS Glow shell */}
            <mesh geometry={G.skull} material={sssMat} scale={[1.05, 1.05, 1.05]} />

            {/* Anime Skull */}
            <mesh geometry={G.skull} material={skinMat} scale={[1, 1.06, 0.94]} />

            {/* Forehead ridge */}
            <mesh geometry={G.foreheadRidge} material={M.skinDark}
              position={[0, 0.105, 0.174]} scale={[1, 0.42, 0.5]} />

            {/* Anime V-Jaw */}
            <mesh ref={jawRef} geometry={G.jaw} material={skinMat}
              position={[0, -0.052, 0.038]} scale={[1.05, 0.76, 0.98]} />

            {/* Chin */}
            <mesh geometry={G.chin} material={skinMat}
              position={[0, -0.162, 0.080]} scale={[1.05, 0.70, 0.88]} />

            {/* Ears */}
            <group position={[-0.205, 0.005, 0]}>
              <mesh geometry={G.ear}      material={skinMat} scale={[0.52, 0.88, 0.45]} />
              <mesh geometry={G.earInner} material={M.skinDark} position={[0.008, 0, 0]} scale={[0.4, 0.7, 0.35]} />
            </group>
            <group position={[ 0.205, 0.005, 0]}>
              <mesh geometry={G.ear}      material={skinMat} scale={[0.52, 0.88, 0.45]} />
              <mesh geometry={G.earInner} material={M.skinDark} position={[-0.008, 0, 0]} scale={[0.4, 0.7, 0.35]} />
            </group>

            {/* Anime Nose */}
            <mesh geometry={G.nose} material={skinMat}
              position={[0, -0.032, 0.202]} rotation={[0.42, 0, 0]} />

            {/* Cheek blush */}
            <mesh ref={cheekLRef} geometry={G.cheekL} material={cheekMatL}
              position={[-0.108, -0.012, 0.168]} />
            <mesh ref={cheekRRef} geometry={G.cheekR} material={cheekMatR}
              position={[ 0.108, -0.012, 0.168]} />

            {/* ── EYES (Warm Amber Glowing Anime Eyes) ──────── */}
            <group ref={leftEyeRef} position={[-0.088, 0.046, 0.170]}>
              <Eye position={[0,0,0]} pupilOffX={a.pupilOffX} pupilOffY={a.pupilOffY}
                dilated={isDilated} squint={a.eyeSquint} G={G} M={M}
                irisMat={irisMatL} irisRef={irisLRef} eyelashMat={eyelashMat} />
            </group>
            <group ref={rightEyeRef} position={[ 0.088, 0.046, 0.170]}>
              <Eye position={[0,0,0]} pupilOffX={a.pupilOffX} pupilOffY={a.pupilOffY}
                dilated={isDilated} squint={a.eyeSquint} G={G} M={M}
                irisMat={irisMatR} irisRef={irisRRef} eyelashMat={eyelashMat} />
            </group>

            {/* ── EYEBROWS ───────────────────────────────────── */}
            <mesh ref={eyebrowLRef} geometry={G.brow} material={M.brow}
              position={[-0.084, 0.118, 0.188]} rotation={[Math.PI/2, 0,  0.26]} />
            <mesh ref={eyebrowRRef} geometry={G.brow} material={M.brow}
              position={[ 0.084, 0.118, 0.188]} rotation={[Math.PI/2, 0, -0.26]} />
            <mesh ref={innerBrowLRef} geometry={G.browInner} material={M.brow}
              position={[-0.046, 0.114, 0.190]} rotation={[Math.PI/2, 0,  0.50]} />
            <mesh ref={innerBrowRRef} geometry={G.browInner} material={M.brow}
              position={[ 0.046, 0.114, 0.190]} rotation={[Math.PI/2, 0, -0.50]} />

            {/* ── MOUTH (Horizontal Lip-Sync with Speech Audio) ── */}
            {/* Dark oral cavity */}
            <mesh ref={mouthCavityRef} geometry={G.mouthCavity} material={M.cavity}
              position={[0, -0.118, 0.222]} scale={[1, 0.01, 1]} />

            {/* Upper lip */}
            <mesh ref={mouthTopRef} geometry={G.upperLip} material={M.lip}
              position={[0, -0.112, 0.233]} rotation={[0, 0, Math.PI / 2]} />

            {/* Lower lip */}
            <mesh ref={mouthBotRef} geometry={G.lowerLip} material={M.lipDark}
              position={[0, -0.124, 0.231]} rotation={[0, 0, Math.PI / 2]} />

            {/* Upper teeth */}
            <mesh ref={teethRef} geometry={G.teeth} material={M.teeth}
              position={[0, -0.113, 0.227]} scale={[1, 0.01, 1]} />

            {/* Lower teeth */}
            <mesh ref={lowerTeethRef} geometry={G.lowerTeeth} material={M.teeth}
              position={[0, -0.123, 0.225]} scale={[1, 0.01, 1]} />

            {/* Tongue */}
            <mesh ref={tongueRef} geometry={G.tongue} material={tongueMat}
              position={[0, -0.123, 0.221]} scale={[0.8, 0.35, 0.55]} />

            {/* Lip corners */}
            <mesh ref={lipCornerLRef} geometry={G.lipCornerL} material={M.lip}
              position={[-0.045, -0.118, 0.228]} scale={[0.78, 0.68, 0.58]} />
            <mesh ref={lipCornerRRef} geometry={G.lipCornerR} material={M.lip}
              position={[ 0.045, -0.118, 0.228]} scale={[0.78, 0.68, 0.58]} />

            {/* ── HOLOGRAPHIC AR SMART-VISOR ─────────────────── */}
            <group position={[0, 0.048, 0.088]}>
              {/* Translucent curved visor glass plate */}
              <mesh geometry={G.visorGlass} material={M.visorGlass} />
              {/* Titanium top frame bar */}
              <mesh geometry={G.visorFrameTop} material={M.visorFrame}
                position={[0, 0.038, 0.128]} />
              {/* Left & Right temple connectors */}
              <mesh geometry={G.visorFrameSide} material={M.visorFrame}
                position={[-0.142, 0.005, 0.075]} rotation={[0, 0.25, 0]} />
              <mesh geometry={G.visorFrameSide} material={M.visorFrame}
                position={[ 0.142, 0.005, 0.075]} rotation={[0, -0.25, 0]} />
              {/* Neon orange accent tabs */}
              <mesh geometry={G.visorAccent} material={M.visorOrange}
                position={[-0.142, 0.038, 0.115]} />
              <mesh geometry={G.visorAccent} material={M.visorOrange}
                position={[ 0.142, 0.038, 0.115]} />
            </group>

            {/* ── CYBER HEADSET WITH BOOM MIC ────────────────── */}
            <group position={[0, 0, 0]}>
              {/* Over-head cyber arch band */}
              <mesh geometry={G.headsetBand} material={M.headset}
                position={[0, 0.110, -0.015]} rotation={[0.15, 0, 0]} />

              {/* Left ear unit */}
              <mesh geometry={G.headsetCup} material={M.headset}
                position={[-0.225, 0.008, 0]} rotation={[0, 0, Math.PI / 2]} />
              <mesh geometry={G.headsetLedRing} material={M.headsetRing}
                position={[-0.245, 0.008, 0]} rotation={[0, Math.PI / 2, 0]} />
              <mesh geometry={G.headsetCenter} material={M.armorDarkPlate}
                position={[-0.235, 0.008, 0]} rotation={[0, 0, Math.PI / 2]} />

              {/* Right ear unit (with glowing ring & boom mic) */}
              <mesh geometry={G.headsetCup} material={M.headset}
                position={[0.225, 0.008, 0]} rotation={[0, 0, -Math.PI / 2]} />
              <mesh geometry={G.headsetLedRing} material={M.headsetRing}
                position={[0.245, 0.008, 0]} rotation={[0, -Math.PI / 2, 0]} />
              <mesh geometry={G.headsetCenter} material={M.armorDarkPlate}
                position={[0.235, 0.008, 0]} rotation={[0, 0, -Math.PI / 2]} />

              {/* Boom Microphone extending forward towards mouth */}
              <group position={[0.232, 0.008, 0]} rotation={[0.42, 0.48, -0.32]}>
                <mesh geometry={G.headsetBoomMic} material={M.headset}
                  position={[-0.010, -0.115, 0.105]} rotation={[0.65, 0, 0]} />
                <mesh geometry={G.headsetMicTip} material={M.armorDarkPlate}
                  position={[-0.010, -0.185, 0.170]} rotation={[0.65, 0, 0]} />
                {/* Glowing neon-orange mic LED */}
                <mesh geometry={G.headsetMicLed} material={M.ledOrange}
                  position={[-0.010, -0.198, 0.182]} />
              </group>
            </group>

            {/* ── LAYERED ANIME HAIR ─────────────────────────── */}
            {/* Hair base cap */}
            <mesh ref={hairTopRef} geometry={G.hairCap} material={M.hair}
              position={[0, 0.016, 0]} scale={[1.05, 1.12, 1.05]} />
            <mesh ref={hairCrownRef} geometry={G.hairCrown} material={M.hair}
              position={[0, 0.032, -0.015]} scale={[1.02, 1.08, 1.03]} />

            {/* Voluminous styled top tufts */}
            <mesh geometry={G.hairTuftLg} material={M.hair}
              position={[0.025, 0.225, 0.040]} rotation={[-0.45, 0.20, -0.25]} />
            <mesh geometry={G.hairTuftMd} material={M.hair}
              position={[-0.065, 0.215, 0.030]} rotation={[-0.40, -0.30, 0.35]} />
            <mesh geometry={G.hairTuftMd} material={M.hair}
              position={[0.085, 0.200, 0.015]} rotation={[-0.35, 0.35, -0.40]} />
            <mesh geometry={G.hairTuftSm} material={M.hair}
              position={[0.010, 0.245, -0.040]} rotation={[-0.60, 0.10, -0.15]} />

            {/* Forehead Swept Anime Bangs */}
            <mesh ref={hairFrontRef} geometry={G.hairTuftBang} material={M.hair}
              position={[-0.055, 0.145, 0.185]} rotation={[0.75, -0.22, 0.35]} />
            <mesh geometry={G.hairTuftBang} material={M.hair}
              position={[0.045, 0.152, 0.182]} rotation={[0.70, 0.28, -0.30]} />
            <mesh geometry={G.hairTuftSm} material={M.hair}
              position={[-0.115, 0.130, 0.165]} rotation={[0.85, -0.45, 0.55]} />
            <mesh geometry={G.hairTuftSm} material={M.hair}
              position={[0.115, 0.130, 0.165]} rotation={[0.85, 0.45, -0.55]} />

            {/* Side volume & nape */}
            <mesh geometry={G.hairSideL} material={M.hair}
              position={[-0.198, -0.015, 0]} scale={[0.55, 0.75, 0.95]} />
            <mesh geometry={G.hairSideR} material={M.hair}
              position={[ 0.198, -0.015, 0]} scale={[0.55, 0.75, 0.95]} />
            <mesh geometry={G.hairBack} material={M.hair}
              position={[0, -0.038, -0.195]} />
            <mesh geometry={G.hairNape} material={M.hair}
              position={[0, -0.085, -0.182]} scale={[1.08, 0.80, 0.70]} />

          </group>{/* /head */}
        </group>{/* /neck */}

        {/* ── LEFT ARM ──────────────────────────────────── */}
        <group ref={leftArmRef} position={[-0.360, 0.245, 0]}>
          {/* Upper arm mecha sleeve */}
          <mesh geometry={G.upperArm} material={M.armorDark} />
          {/* Cyber elbow joint */}
          <mesh geometry={G.elbowRing} material={M.armorDarkPlate} position={[0, -0.140, 0]} />

          <group ref={leftForeRef} position={[0, -0.250, 0]}>
            {/* Crisp Bionic White Forearm Gauntlet */}
            <mesh geometry={G.forearmBionic} material={M.armorWhite} position={[0, -0.145, 0]} />
            {/* Glowing neon-orange energy channel strip */}
            <mesh geometry={G.forearmLed} material={M.ledOrange} position={[0, -0.145, 0.070]} />
            {/* Cyber wrist cuff */}
            <mesh geometry={G.wristCuff} material={M.armorDarkPlate} position={[0, -0.265, 0]} />

            <group ref={leftWristRef} position={[0, -0.320, 0]}>
              <Hand
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                isLeft={true}
                state={state}
                animRef={anim}
                audioAmplitude={audioAmplitude}
                G={G} M={{ ...M, skin: skinMat }}
              />
            </group>
          </group>
        </group>

        {/* ── RIGHT ARM ─────────────────────────────────── */}
        <group ref={rightArmRef} position={[0.360, 0.245, 0]}>
          {/* Upper arm mecha sleeve */}
          <mesh geometry={G.upperArm} material={M.armorDark} />
          {/* Cyber elbow joint */}
          <mesh geometry={G.elbowRing} material={M.armorDarkPlate} position={[0, -0.140, 0]} />

          <group ref={rightForeRef} position={[0, -0.250, 0]}>
            {/* Crisp Bionic White Forearm Gauntlet */}
            <mesh geometry={G.forearmBionic} material={M.armorWhite} position={[0, -0.145, 0]} />
            {/* Glowing neon-orange energy channel strip */}
            <mesh geometry={G.forearmLed} material={M.ledOrange} position={[0, -0.145, 0.070]} />
            {/* Cyber wrist cuff */}
            <mesh geometry={G.wristCuff} material={M.armorDarkPlate} position={[0, -0.265, 0]} />

            <group ref={rightWristRef} position={[0, -0.320, 0]}>
              <Hand
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                isLeft={false}
                state={state}
                animRef={anim}
                audioAmplitude={audioAmplitude}
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
