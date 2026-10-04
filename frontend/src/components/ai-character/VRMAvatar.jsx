/**
 * VRMAvatar.jsx
 * ─────────────────────────────────────────────────────────────
 * Real 3D human avatar powered by VRoid / @pixiv/three-vrm.
 *
 * Features:
 *  • Loads any .vrm file (VRM 0.x and 1.0 supported)
 *  • Auto-framing: bounding-box measurement centers the model
 *    and positions the camera for a perfect bust-shot
 *  • Idle breathing animation (chest + shoulder sway)
 *  • Lip-sync via ttsAmplitude → mouth viseme morphs
 *  • Expressions driven by CHARACTER_STATES
 *  • Head look-at follows mouse cursor
 *  • Graceful error boundary + loading shimmer
 * ─────────────────────────────────────────────────────────────
 */

import React, { useRef, useEffect, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';

import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { CHARACTER_STATES } from './CharacterAnimations';


// ── Expression presets per state ──────────────────────────────
const STATE_EXPRESSIONS = {
  [CHARACTER_STATES.IDLE]:        { happy: 0,    angry: 0, sad: 0, surprised: 0, relaxed: 0.15 },
  [CHARACTER_STATES.LISTENING]:   { happy: 0.2,  angry: 0, sad: 0, surprised: 0.1, relaxed: 0 },
  [CHARACTER_STATES.THINKING]:    { happy: 0,    angry: 0, sad: 0.05, surprised: 0, relaxed: 0.3 },
  [CHARACTER_STATES.ANALYZING]:   { happy: 0,    angry: 0, sad: 0, surprised: 0.15, relaxed: 0 },
  [CHARACTER_STATES.TALKING]:     { happy: 0.25, angry: 0, sad: 0, surprised: 0,   relaxed: 0 },
  [CHARACTER_STATES.HAPPY]:       { happy: 1.0,  angry: 0, sad: 0, surprised: 0.2, relaxed: 0 },
  [CHARACTER_STATES.GREETING]:    { happy: 0.8,  angry: 0, sad: 0, surprised: 0.3, relaxed: 0 },
  [CHARACTER_STATES.GESTURE]:     { happy: 0.4,  angry: 0, sad: 0, surprised: 0.1, relaxed: 0 },
  [CHARACTER_STATES.ENCOURAGING]: { happy: 0.9,  angry: 0, sad: 0, surprised: 0.1, relaxed: 0 },
};

// ── Auto-frame helper ─────────────────────────────────────────
/**
 * Computes the bounding box of the VRM scene, then returns:
 *   modelOffset  — how much to shift the model so it's centred at origin
 *   cameraTarget — the point the camera should orbit around (eye level)
 *   cameraPos    — where to place the camera for a cinematic bust shot
 */
function computeFraming(vrmScene) {
  const box    = new THREE.Box3().setFromObject(vrmScene);
  const size   = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const height = size.y;

  // Shift model so feet rest at y=0 and x/z are centred
  const modelOffset = new THREE.Vector3(-center.x, -box.min.y, -center.z);

  // Target = chin / lower face level (78% up) — cinematic tight framing
  const targY = (box.min.y + height * 0.78) + modelOffset.y;

  // Camera above eye level (95% up) for a very slight downward perspective
  const camY  = (box.min.y + height * 0.95) + modelOffset.y;

  // Distance = 55% of model height → tighter bust shot, less distortion
  const dist  = height * 0.55;

  return {
    modelOffset,
    cameraTarget: new THREE.Vector3(0, targY, 0),
    cameraPos:    new THREE.Vector3(0, camY,  dist),
  };
}


// ── Camera framer: sets up camera once model is ready ─────────
function CameraFramer({ framing }) {
  const { camera } = useThree();
  const applied = useRef(false);

  useEffect(() => {
    if (!framing || applied.current) return;
    applied.current = true;
    camera.position.set(
      framing.cameraPos.x,
      framing.cameraPos.y,
      framing.cameraPos.z,
    );
    camera.lookAt(framing.cameraTarget);
    camera.fov = 28;   // tight portrait FOV — minimal perspective distortion on face
    camera.updateProjectionMatrix();
  }, [framing, camera]);

  return null;
}

// ── Layered sine noise ─────────────────────────────────────────
// Combines multiple frequencies to avoid robotic periodicity
function lsin(t, f1, a1, f2 = 0, a2 = 0, f3 = 0, a3 = 0) {
  return Math.sin(t * f1) * a1 + Math.sin(t * f2 + 1.3) * a2 + Math.sin(t * f3 + 2.7) * a3;
}
// Smooth lerp (frame-rate independent)
function lerp(cur, target, speed, dt) {
  return cur + (target - cur) * Math.min(1, speed * dt * 60);
}

// ── VRM scene animator ────────────────────────────────────────
function VRMScene({ vrm, framing, state, ttsAmplitude, isSpeaking }) {
  const clock    = useRef(new THREE.Clock());
  const mouseRef = useRef({ x: 0, y: 0 });
  const groupRef = useRef();
  const lookAtTargetRef = useRef(new THREE.Object3D());

  // Per-bone smooth state (avoids sudden jumps)
  const boneState = useRef({
    hipY: 0, hipZ: 0,
    spineX: 0, spineZ: 0,
    chestX: 0, chestZ: 0,
    neckX: 0, neckY: 0,
    headX: 0, headY: 0, headZ: 0,  // headZ = head roll (tilt)
    groupY: 0,                       // subtle body position bob
    lUAz: 1.4, lUAx: 0, lLAz: 0, lWy: 0, lWx: 0, lFinger: 0.75,
    rUAz: -1.4, rUAx: 0, rLAz: 0, rWy: 0, rWx: 0, rFinger: 0.75,
    nextBlink: 3.0,
    blinkVal: 0,
    blinkPhase: 'wait',   // 'wait' | 'closing' | 'opening'
    blinkT: 0,
    jawOpen: 0,           // jaw bone direct control
  });

  // Discovered viseme names from this specific VRM model
  const visemeMapRef = useRef(null);

  // On mount: scan expression manager and log what mouth shapes are available
  useEffect(() => {
    if (!vrm?.expressionManager) return;
    const em  = vrm.expressionManager;
    const map = { aa: null, oh: null, ou: null, ee: null, ii: null };

    // VRM1 standard names
    const candidates = {
      aa: ['aa', 'Aa', 'AA', 'a',  'A',  'mouth_a', 'mouthOpen', 'MouthOpen'],
      oh: ['oh', 'Oh', 'OH', 'o',  'O',  'mouth_o', 'Surprised'],
      ou: ['ou', 'Ou', 'OU', 'u',  'U',  'mouth_u'],
      ee: ['ee', 'Ee', 'EE', 'e',  'E',  'mouth_e', 'ih', 'Ih'],
      ii: ['ii', 'Ii', 'II', 'i',  'I',  'mouth_i'],
    };
    for (const [slot, names] of Object.entries(candidates)) {
      for (const n of names) {
        if (em.getValue(n) !== undefined) { map[slot] = n; break; }
      }
    }
    visemeMapRef.current = map;
    console.info('[VRM Lip Sync] Discovered viseme map:', map);
  }, [vrm]);

  // Apply model offset
  useEffect(() => {
    if (!groupRef.current || !framing) return;
    // X and Z: center the model. Y is animated by the useFrame bob system.
    groupRef.current.position.set(framing.modelOffset.x, framing.modelOffset.y, framing.modelOffset.z);
    // Reset groupY so bob starts from the correct base
    boneState.current.groupY = 0;
  }, [framing]);

  // Mouse tracking
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth)  * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((_, delta) => {
    if (!vrm) return;
    const t  = clock.current.getElapsedTime();
    const dt = Math.min(delta, 0.05);   // cap delta so jumps don't explode
    const bs = boneState.current;
    const isTalking  = state === CHARACTER_STATES.TALKING;
    const isListening = state === CHARACTER_STATES.LISTENING;

    const ARM_DOWN_L =  1.4;
    const ARM_DOWN_R = -1.4;

    // ─────────────────────────────────────────────────────────
    // 1. HIPS — lateral weight shift (the foundation of natural movement)
    // ─────────────────────────────────────────────────────────
    if (vrm.humanoid) {
      const hipSway  = lsin(t, 0.38, 0.012, 0.19, 0.006);  // slow drift
      const hipShift = isTalking ? lsin(t, 0.55, 0.010, 0.28, 0.005) : 0;
      const hipTargZ = hipSway + hipShift;
      const hipTargY = isTalking ? lsin(t, 0.42, 0.006) : 0;

      bs.hipZ = lerp(bs.hipZ, hipTargZ, 1.5, dt);
      bs.hipY = lerp(bs.hipY, hipTargY, 1.2, dt);
      const hips = vrm.humanoid.getNormalizedBoneNode('hips');
      if (hips) { hips.rotation.z = bs.hipZ; hips.rotation.y = bs.hipY; }

      // Group Y bob — very subtle vertical translation that feels like weight shift
      const bobAmt = isTalking ? 0.004 : 0.002;
      bs.groupY = lerp(bs.groupY, lsin(t, 0.48, bobAmt, 0.24, bobAmt * 0.4), 2.0, dt);
      if (groupRef.current) {
        groupRef.current.position.y = (framing?.modelOffset?.y ?? 0) + bs.groupY;
      }

      // ─────────────────────────────────────────────────────
      // 2. SPINE — breathe + counter-rotate hips
      // ─────────────────────────────────────────────────────
      const breatheAmt = isTalking ? 0.022 : 0.013;
      const breatheX = lsin(t, isTalking ? 1.1 : 0.85, breatheAmt, 0.43, breatheAmt * 0.3);
      const leanX    = isTalking ? lsin(t, 0.65, 0.016, 0.31, 0.008) : 0;
      bs.spineX = lerp(bs.spineX, breatheX + leanX,     2.5, dt);
      bs.spineZ = lerp(bs.spineZ, -bs.hipZ * 0.5,       2.0, dt);  // counter-rotate
      const spine = vrm.humanoid.getNormalizedBoneNode('spine');
      if (spine) { spine.rotation.x = bs.spineX; spine.rotation.z = bs.spineZ; }

      // ─────────────────────────────────────────────────────
      // 3. CHEST — more expressive lean + shoulder twist when gesturing
      // ─────────────────────────────────────────────────────
      const chestLean = isTalking ? lsin(t, 0.72, 0.018, 0.36, 0.008) : lsin(t, 0.5, 0.008);
      const chestTwist = isTalking ? lsin(t, 0.45, 0.012) : 0;
      bs.chestX = lerp(bs.chestX, breatheX * 0.6 + chestLean, 2.5, dt);
      bs.chestZ = lerp(bs.chestZ, chestTwist - bs.hipZ * 0.3,  2.0, dt);
      const chest = vrm.humanoid.getNormalizedBoneNode('chest');
      if (chest) { chest.rotation.x = bs.chestX; chest.rotation.z = bs.chestZ; }

      // ─────────────────────────────────────────────────────
      // 4. NECK — S-curve: semi-independent from head
      // ─────────────────────────────────────────────────────
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const neckIdleX = lsin(t, 0.42, 0.008, 0.21, 0.004);
      const neckIdleY = lsin(t, 0.31, 0.006, 0.17, 0.003);
      const neckTargX = isTalking
        ? my * 0.08 + lsin(t, 1.1, 0.010, 0.55, 0.005) + neckIdleX
        : my * 0.10 + neckIdleX;
      const neckTargY = isTalking
        ? mx * 0.10 + lsin(t, 0.32, 0.008) + neckIdleY
        : mx * 0.14 + neckIdleY;

      bs.neckX = lerp(bs.neckX, neckTargX, 3.0, dt);
      bs.neckY = lerp(bs.neckY, neckTargY, 3.0, dt);
      const neck = vrm.humanoid.getNormalizedBoneNode('neck');
      if (neck) { neck.rotation.x = bs.neckX; neck.rotation.y = bs.neckY; }

      // ─────────────────────────────────────────────────────
      // 5. HEAD — expressive, nods + glances + roll tilt
      // ─────────────────────────────────────────────────────
      let headTargX, headTargY, headTargZ;
      if (isTalking) {
        // Nod: peaks on 1.2 Hz rhythm beats
        const nodRaw = Math.sin(t * 1.2);
        const nod    = nodRaw > 0.55 ? (nodRaw - 0.55) * 0.18 : 0;
        // Glance: slow side look during speech (thinking)
        const glance = lsin(t, 0.33, 0.09, 0.17, 0.04);
        headTargX = my * 0.10 + nod + lsin(t, 0.52, 0.008);
        headTargY = mx * 0.12 + glance;
        // Head roll / tilt — follows the glance direction naturally
        headTargZ = -glance * 0.35 + lsin(t, 0.28, 0.012);
      } else if (isListening) {
        // Listening: lean in slightly, tiny micro-nods showing engagement
        const microNod = lsin(t, 0.85, 0.018, 0.42, 0.010);
        headTargX = my * 0.18 + microNod + 0.04;  // lean forward
        headTargY = mx * 0.22 + lsin(t, 0.31, 0.012);
        headTargZ = lsin(t, 0.25, 0.015);
      } else {
        headTargX = my * 0.20 + lsin(t, 0.58, 0.012, 0.29, 0.006);
        headTargY = mx * 0.26 + lsin(t, 0.38, 0.010, 0.19, 0.005);
        headTargZ = lsin(t, 0.22, 0.008, 0.11, 0.004);
      }
      bs.headX = lerp(bs.headX, headTargX, 4.0, dt);
      bs.headY = lerp(bs.headY, headTargY, 4.0, dt);
      bs.headZ = lerp(bs.headZ, headTargZ, 3.5, dt);
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      if (head) { head.rotation.x = bs.headX; head.rotation.y = bs.headY; head.rotation.z = bs.headZ; }

      // Shoulder counter-rotation: when head turns left, left shoulder comes forward slightly
      const shoulderCounterL = vrm.humanoid.getNormalizedBoneNode('leftShoulder');
      const shoulderCounterR = vrm.humanoid.getNormalizedBoneNode('rightShoulder');
      if (shoulderCounterL) shoulderCounterL.rotation.z = lerp(shoulderCounterL.rotation.z,  bs.headY * 0.10 + bs.chestZ * 0.5, 3.0, dt);
      if (shoulderCounterR) shoulderCounterR.rotation.z = lerp(shoulderCounterR.rotation.z, -bs.headY * 0.10 + bs.chestZ * 0.5, 3.0, dt);

      // ─────────────────────────────────────────────────────
      // 6. ARMS — gesture sequencer (talking) or pose table (other)
      // ─────────────────────────────────────────────────────
      let tLUAz, tLUAx, tLLAz, tLWy, tLFinger;
      let tRUAz, tRUAx, tRLAz, tRWy, tRFinger;
      let armLerp = 0.05;  // default smooth

      if (isTalking) {
        // 16-second cycle → 4 gestures of ~4s each for more time in each pose
        const gestureCycle = t % 16;
        const gPhase = Math.floor(gestureCycle / 4);
        // Micromovements layered on top for organic feel
        const mA = lsin(t, 2.6, 0.038, 1.3, 0.022);
        const mB = lsin(t, 1.8, 0.050, 0.9, 0.028);

        switch (gPhase) {
          case 0: // Right open-palm explanation
            tLUAz = ARM_DOWN_L;       tLUAx = 0;    tLLAz = 0;     tLWy = 0;    tLFinger = 0.65;
            tRUAz = ARM_DOWN_R + 0.5 + mB * 0.5; tRUAx = 0.28 + mA;
            tRLAz = -0.35 + mA * 0.6;             tRWy = -0.25 + mA * 0.4;
            tRFinger = 0.08 + Math.abs(mA) * 1.5;
            armLerp = 0.055;
            break;

          case 1: // Both hands open — wide emphasis
            tLUAz = ARM_DOWN_L - 0.30 + mA * 0.4; tLUAx = 0.15;
            tLLAz = 0.18 + mA * 0.3; tLWy = 0.15; tLFinger = 0.08;
            tRUAz = ARM_DOWN_R + 0.30 - mA * 0.4; tRUAx = 0.15;
            tRLAz = -0.18 - mA * 0.3; tRWy = -0.15; tRFinger = 0.08;
            armLerp = 0.048;
            break;

          case 2: // Right arm chop / enumerate with forearm pump
            tLUAz = ARM_DOWN_L;       tLUAx = 0;    tLLAz = 0;     tLWy = 0;    tLFinger = 0.75;
            tRUAz = ARM_DOWN_R + 0.60; tRUAx = 0.38 + lsin(t, 2.4, 0.18);
            tRLAz = -0.52 + lsin(t, 2.4, 0.22); tRWy = 0.18;
            tRFinger = 0.25 + Math.abs(lsin(t, 2.4, 0.45));
            armLerp = 0.08;   // snappier for chop
            break;

          case 3: // Left arm open, right settles — inclusive gesture
            tLUAz = ARM_DOWN_L - 0.22 + mB * 0.3; tLUAx = 0.12;
            tLLAz = 0.12;  tLWy = 0.1;  tLFinger = 0.15;
            tRUAz = ARM_DOWN_R + 0.15 + mB * 0.3; tRUAx = 0.08;
            tRLAz = 0;    tRWy = 0;    tRFinger = 0.60;
            armLerp = 0.045;
            break;

          default:
            tLUAz = ARM_DOWN_L; tLUAx = 0; tLLAz = 0; tLWy = 0; tLFinger = 0.65;
            tRUAz = ARM_DOWN_R; tRUAx = 0; tRLAz = 0; tRWy = 0; tRFinger = 0.65;
        }
      } else {
        armLerp = 0.04;
        const POSE = {
          [CHARACTER_STATES.IDLE]:        { l:[ARM_DOWN_L,0,0,0,0.75],     r:[ARM_DOWN_R,0,0,0,0.75]       },
          [CHARACTER_STATES.LISTENING]:   { l:[ARM_DOWN_L+.05,.05,0,.03,.65], r:[ARM_DOWN_R-.05,.05,0,-.03,.65] },
          [CHARACTER_STATES.THINKING]:    { l:[ARM_DOWN_L,0,0,0,.75],       r:[ARM_DOWN_R+.45,.32,-.48,.2,1.0] },
          [CHARACTER_STATES.ANALYZING]:   { l:[ARM_DOWN_L,0,0,0,.60],       r:[ARM_DOWN_R,.12,0,.05,.60]     },
          [CHARACTER_STATES.HAPPY]:       { l:[ARM_DOWN_L-.22,.06,0,.05,.1], r:[ARM_DOWN_R+.22,.06,0,-.05,.1] },
          [CHARACTER_STATES.GREETING]:    { l:[ARM_DOWN_L,0,0,0,.75],
            r:[ARM_DOWN_R+0.95+lsin(t,3.5,.12),  .30, -.52, .2+lsin(t,3.5,.15), .05] },
          [CHARACTER_STATES.GESTURE]:     { l:[ARM_DOWN_L,0,0,0,.75],       r:[ARM_DOWN_R+.52,.38,-.32,-.12,1.0] },
          [CHARACTER_STATES.ENCOURAGING]: { l:[ARM_DOWN_L-.18,.1,0,.08,.20], r:[ARM_DOWN_R+.18,.1,0,-.08,.20] },
        };
        const p = POSE[state] || POSE[CHARACTER_STATES.IDLE];
        [tLUAz, tLUAx, tLLAz, tLWy, tLFinger] = p.l;
        [tRUAz, tRUAx, tRLAz, tRWy, tRFinger] = p.r;
      }

      // Smooth upper arms
      bs.lUAz = lerp(bs.lUAz, tLUAz, armLerp * 60, dt);
      bs.lUAx = lerp(bs.lUAx, tLUAx, armLerp * 60, dt);
      bs.rUAz = lerp(bs.rUAz, tRUAz, armLerp * 60, dt);
      bs.rUAx = lerp(bs.rUAx, tRUAx, armLerp * 60, dt);
      const lUA = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rUA = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (lUA) { lUA.rotation.z = bs.lUAz; lUA.rotation.x = bs.lUAx; }
      if (rUA) { rUA.rotation.z = bs.rUAz; rUA.rotation.x = bs.rUAx; }

      // Lower arms (forearms) — also add subtle elbow roll
      bs.lLAz = lerp(bs.lLAz, tLLAz, armLerp * 60, dt);
      bs.rLAz = lerp(bs.rLAz, tRLAz, armLerp * 60, dt);
      const lLA = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
      const rLA = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
      if (lLA) lLA.rotation.z = bs.lLAz;
      if (rLA) rLA.rotation.z = bs.rLAz;

      // Wrists — y = forearm twist, x = palm tilt (up/down palm orientation)
      bs.lWy = lerp(bs.lWy, tLWy, armLerp * 60, dt);
      bs.rWy = lerp(bs.rWy, tRWy, armLerp * 60, dt);
      // Palm orientation (x) — natural resting position + gesture tilt
      const lWxTarg = isTalking ? lsin(t, 0.6, 0.08, 0.3, 0.04) - 0.1 : -0.05;
      const rWxTarg = isTalking ? lsin(t, 0.6, 0.08, 0.3, 0.04) + 0.1 : 0.05;
      bs.lWx = lerp(bs.lWx, lWxTarg, armLerp * 60, dt);
      bs.rWx = lerp(bs.rWx, rWxTarg, armLerp * 60, dt);
      const lW = vrm.humanoid.getNormalizedBoneNode('leftHand');
      const rW = vrm.humanoid.getNormalizedBoneNode('rightHand');
      if (lW) { lW.rotation.y = bs.lWy; lW.rotation.x = bs.lWx; }
      if (rW) { rW.rotation.y = bs.rWy; rW.rotation.x = bs.rWx; }

      // ─────────────────────────────────────────────────────
      // 7. FINGERS — per-phalanx curl with stagger + micro-flutter
      // ─────────────────────────────────────────────────────
      bs.lFinger = lerp(bs.lFinger, tLFinger, armLerp * 60, dt);
      bs.rFinger = lerp(bs.rFinger, tRFinger, armLerp * 60, dt);

      const FINGERS   = ['Index', 'Middle', 'Ring', 'Little'];
      const PHALANGES = ['Proximal', 'Intermediate', 'Distal'];
      [['left', bs.lFinger], ['right', bs.rFinger]].forEach(([side, curlTarget]) => {
        const curlSign = side === 'left' ? 1 : -1;
        const flutter  = lsin(t, 1.9, 0.013, 0.95, 0.007) * (side === 'left' ? 1 : -1);
        FINGERS.forEach((finger, fi) => {
          PHALANGES.forEach((phalanx, pi) => {
            const bone = vrm.humanoid.getNormalizedBoneNode(`${side}${finger}${phalanx}`);
            if (!bone) return;
            const curlMult = [0.52, 0.78, 1.0][pi];
            const stagger  = fi * 0.032;
            const goal = curlSign * (curlTarget + stagger + flutter) * curlMult;
            bone.rotation.z = lerp(bone.rotation.z, goal, armLerp * 60, dt);
          });
        });
        const thumbCurl = curlTarget * 0.52;
        ['Proximal', 'Intermediate', 'Distal'].forEach((phalanx, pi) => {
          const bone = vrm.humanoid.getNormalizedBoneNode(`${side}Thumb${phalanx}`);
          if (!bone) return;
          const cm = [0.48, 0.78, 1.0][pi];
          bone.rotation.z = lerp(bone.rotation.z, curlSign * thumbCurl * cm, armLerp * 60, dt);
          bone.rotation.y = lerp(bone.rotation.y, side === 'left' ? 0.28 : -0.28, armLerp * 60, dt);
        });
      });
    }

    // ─────────────────────────────────────────────────────────
    // 8. EXPRESSIONS — eyes, blink, mouth, brows
    // ─────────────────────────────────────────────────────────
    if (vrm.expressionManager) {
      const em = vrm.expressionManager;

      // Base emotion blend
      const eTarget = STATE_EXPRESSIONS[state] || STATE_EXPRESSIONS[CHARACTER_STATES.IDLE];
      ['happy', 'angry', 'sad', 'surprised', 'relaxed'].forEach((name) => {
        const cur = em.getValue(name) ?? 0;
        em.setValue(name, cur + ((eTarget[name] ?? 0) - cur) * Math.min(1, 0.04 * dt * 60));
      });

      // ── Lip sync ───────────────────────────────────────────
      const vm  = visemeMapRef.current;  // discovered viseme name map
      const bs2 = boneState.current;
      const hasAudio = isSpeaking && (ttsAmplitude ?? 0) > 0.005;
      const isMouthActive = hasAudio || isTalking;

      // Jaw bone fallback — works even if expression manager names are wrong
      const jawBone = vrm.humanoid?.getNormalizedBoneNode?.('jaw');

      if (isMouthActive) {
        // Use a strong base floor + amplitude so mouth is ALWAYS visibly open when talking
        const rawAmp = hasAudio ? Math.max(0.30, ttsAmplitude ?? 0) : 0.45;
        const vt     = t * 6.0;  // ~6 phonemes/sec (natural speech rate)

        // Layered mouth shapes — sine waves offset so they don't all peak simultaneously
        const aaVal = rawAmp * (0.55 + 0.45 * Math.abs(Math.sin(vt)));                      // wide open
        const ohVal = rawAmp * (0.25 + 0.35 * Math.abs(Math.sin(vt * 1.3  + 1.0)));        // rounded
        const ouVal = rawAmp * (0.15 + 0.20 * Math.abs(Math.sin(vt * 0.7  + 2.1)));        // pursed
        const eeVal = rawAmp * (0.10 + 0.18 * Math.abs(Math.sin(vt * 1.7  + 3.0)));        // smile-ish

        // Apply to expression manager using discovered names
        if (vm) {
          if (vm.aa) em.setValue(vm.aa, Math.min(1, aaVal));
          if (vm.oh) em.setValue(vm.oh, Math.min(1, ohVal));
          if (vm.ou) em.setValue(vm.ou, Math.min(1, ouVal));
          if (vm.ee) em.setValue(vm.ee, Math.min(1, eeVal));
        } else {
          // Fallback if viseme map not yet computed — try all known names
          for (const n of ['aa','Aa','a','A','mouthOpen','MouthOpen'])
            if (em.getValue(n) !== undefined) { em.setValue(n, Math.min(1, aaVal)); break; }
          for (const n of ['oh','Oh','o','O'])
            if (em.getValue(n) !== undefined) { em.setValue(n, Math.min(1, ohVal)); break; }
        }

        // Jaw bone: rotate X axis — 0.12 rad (≈7°) fully open, scaled by amp
        bs2.jawOpen = lerp(bs2.jawOpen, aaVal * 0.18, 18, dt);
        if (jawBone) jawBone.rotation.x = bs2.jawOpen;

      } else {
        // Fade mouth closed
        if (vm) {
          for (const slot of ['aa','oh','ou','ee','ii']) {
            if (vm[slot]) em.setValue(vm[slot], (em.getValue(vm[slot]) ?? 0) * 0.78);
          }
        } else {
          for (const n of ['aa','Aa','a','A','oh','Oh','o','O','ou','u','U','ee','e','E','mouthOpen']) {
            if (em.getValue(n) !== undefined) em.setValue(n, (em.getValue(n) ?? 0) * 0.78);
          }
        }
        // Jaw closes
        bs2.jawOpen = lerp(bs2.jawOpen, 0, 12, dt);
        if (jawBone) jawBone.rotation.x = bs2.jawOpen;
      }

      // ── Randomised blink ───────────────────────────────────
      bs2.blinkT += dt;
      if (bs2.blinkPhase === 'wait' && bs2.blinkT >= bs2.nextBlink) {
        bs2.blinkPhase = 'closing';
        bs2.blinkT = 0;
        // Random interval 2–6s (shorter when talking)
        bs2.nextBlink = isTalking
          ? 1.8 + Math.random() * 2.5
          : 2.5 + Math.random() * 4.0;
      }
      if (bs2.blinkPhase === 'closing') {
        bs2.blinkVal = Math.min(1, bs2.blinkT / 0.08);
        if (bs2.blinkT >= 0.08) { bs2.blinkPhase = 'opening'; bs2.blinkT = 0; }
      } else if (bs2.blinkPhase === 'opening') {
        bs2.blinkVal = Math.max(0, 1 - bs2.blinkT / 0.12);
        if (bs2.blinkT >= 0.12) { bs2.blinkPhase = 'wait'; bs2.blinkVal = 0; }
      }
      ['blink','Blink','blinkLeft','blinkRight'].forEach((n) => {
        if (em.getValue(n) !== undefined) em.setValue(n, bs2.blinkVal);
      });

      // ── Eyebrows — raise on emphasis ──────────────────────
      const browGoal = isTalking ? Math.max(0, lsin(t, 1.15, 0.38, 0.58, 0.18)) : 0;
      for (const n of ['browUp','browRaiseLeft','browRaiseRight','BrowsUp']) {
        if (em.getValue(n) !== undefined)
          em.setValue(n, lerp(em.getValue(n) ?? 0, browGoal, 3.0, dt));
      }

      // ── Eye darts every ~5–8s ─────────────────────────────
      const dartCycle  = t % 6.5;
      const dartActive = dartCycle < 0.6 && isTalking;
      const dartDir    = Math.floor(t / 6.5) % 4;  // 0=left,1=right,2=up,3=centre
      const dartGoalL  = [0.45, 0.0, 0.0, 0.0][dartDir];
      const dartGoalR  = [0.0, 0.45, 0.0, 0.0][dartDir];
      const dartGoalU  = [0.0, 0.0, 0.35, 0.0][dartDir];
      const eyeReturnSpeed = dartActive ? 6.0 : 4.0;
      for (const n of ['lookLeft'])  if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, dartActive ? dartGoalL : 0, eyeReturnSpeed, dt));
      for (const n of ['lookRight']) if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, dartActive ? dartGoalR : 0, eyeReturnSpeed, dt));
      for (const n of ['lookUp'])    if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, dartActive ? dartGoalU : 0, eyeReturnSpeed, dt));
    }

    // Use VRM's built-in lookAt if available (drives eye bones directly)
    if (vrm.lookAt) {
      lookAtTargetRef.current.position.set(
        mouseRef.current.x * 1.5,
        mouseRef.current.y * 1.0 + (framing?.cameraTarget?.y ?? 1.4),
        2.0
      );
      vrm.lookAt.target = lookAtTargetRef.current;
    }

    vrm.update(delta);
  });

  return (
    <group ref={groupRef}>
      <primitive object={vrm.scene} />
    </group>
  );
}





// ── GLTFLoader hook (uses drei's useGLTF — no direct GLTFLoader import needed) ─
function VRMLoader({ url, onLoad, onError }) {
  useEffect(() => {
    let mounted = true;

    // Dynamically import the GLTFLoader from three's bundled addons
    import('three/examples/jsm/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => {
        if (!mounted) return;
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        loader.load(
          url,
          (gltf) => {
            if (!mounted) return;
            const vrm = gltf.userData.vrm;
            if (!vrm) { onError?.('No VRM data found in file'); return; }
            VRMUtils.rotateVRM0(vrm);

            // ── Material quality pass ─────────────────────────
            vrm.scene.traverse((obj) => {
              if (obj.isMesh) {
                obj.castShadow    = true;
                obj.receiveShadow = true;
                if (obj.material) {
                  const name = (obj.name || '').toLowerCase();
                  const matName = (obj.material.name || '').toLowerCase();
                  const isSkin  = name.includes('skin') || name.includes('face') ||
                                  name.includes('body') || name.includes('head') ||
                                  matName.includes('skin') || matName.includes('face');
                  const isHair  = name.includes('hair') || matName.includes('hair');
                  const isEye   = name.includes('eye')  || matName.includes('eye');
                  const isCloth = name.includes('cloth') || name.includes('wear') || name.includes('dress');

                  if (isSkin) {
                    // Realistic skin: slightly matte with subtle sheen
                    obj.material.roughness       = 0.72;
                    obj.material.metalness       = 0.0;
                    obj.material.envMapIntensity = 0.8;
                  } else if (isHair) {
                    // Hair: slight sheen / gloss
                    obj.material.roughness       = 0.45;
                    obj.material.metalness       = 0.05;
                    obj.material.envMapIntensity = 1.8;
                  } else if (isEye) {
                    // Eyes: wet, reflective
                    obj.material.roughness       = 0.05;
                    obj.material.metalness       = 0.0;
                    obj.material.envMapIntensity = 3.0;
                  } else if (isCloth) {
                    // Fabric: matte
                    obj.material.roughness       = 0.82;
                    obj.material.metalness       = 0.0;
                    obj.material.envMapIntensity = 0.5;
                  } else {
                    // Default
                    obj.material.roughness       = obj.material.roughness ?? 0.55;
                    obj.material.metalness       = obj.material.metalness ?? 0.02;
                    obj.material.envMapIntensity = 1.4;
                  }
                  if (obj.geometry) obj.geometry.computeVertexNormals();
                }
              }
            });
            onLoad?.(vrm);
          },
          undefined,
          (err) => { if (mounted) onError?.(String(err)); }
        );
      })
      .catch((err) => { if (mounted) onError?.(String(err)); });

    return () => { mounted = false; };
  }, [url]); // eslint-disable-line
  return null;
}


// ── Loading state UI ──────────────────────────────────────────
function LoadingShimmer() {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'transparent',   // shows through to the dark bg div beneath
      borderRadius: 'inherit', zIndex: 2,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: '3px solid rgba(180,140,255,0.15)',
        borderTop: '3px solid #c8aaff',
        animation: 'vrm-spin 1s linear infinite',
      }} />
      <p style={{ color: 'rgba(200,180,255,0.65)', marginTop: 16, fontSize: 13 }}>
        Loading 3D Avatar…
      </p>
      <style>{`@keyframes vrm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────
export function VRMAvatar({
  vrmUrl       = '/avatar1.vrm',
  state        = CHARACTER_STATES.IDLE,
  ttsAmplitude = 0,
  isSpeaking   = false,
  onReady,
  onError: externalOnError,
  style,
  className,
}) {
  const [vrm,     setVrm]     = useState(null);
  const [framing, setFraming] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const handleLoad = useCallback((loadedVrm) => {
    // Compute framing from the loaded VRM scene bounding box
    const f = computeFraming(loadedVrm.scene);
    setFraming(f);
    setVrm(loadedVrm);
    setLoading(false);
    setError(null);
    onReady?.();
  }, [onReady]);

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {/* Rich cinematic background — warm-cool gradient with subtle vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, #1e1245 0%, #120c30 40%, #07040f 100%)',
        borderRadius: 'inherit',
      }} />

      {loading && !error && <LoadingShimmer />}

      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
          background: 'linear-gradient(135deg,#0f0f1a,#1a1040)',
          color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: 24, textAlign: 'center',
        }}>
          <span style={{ fontSize: 32 }}>⚠️</span>
          <span>Failed to load VRM avatar</span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>{error}</span>
        </div>
      )}

      <Canvas
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
        camera={{ position: [0, 1.6, 1.5], fov: 28 }}
        shadows="soft"
        gl={{
          antialias:           true,
          alpha:               false,
          powerPreference:     'high-performance',
          toneMapping:         THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.45,   // elevated for vibrant, cinematic look
          outputColorSpace:    'srgb',
          preserveDrawingBuffer: false,
        }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        {/* ── Cinematic 4-Point Portrait Lighting ── */}

        {/* PRIMARY KEY: warm golden-hour sun from upper-right front */}
        <directionalLight
          position={[1.8, 4.0, 3.0]}
          intensity={3.4}
          color="#fff5e8"
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-near={0.05}
          shadow-camera-far={15}
          shadow-camera-left={-2}
          shadow-camera-right={2}
          shadow-camera-top={4}
          shadow-camera-bottom={-0.5}
          shadow-bias={-0.0002}
        />

        {/* FILL: soft blue-lavender from left — softens key shadows, reveals detail */}
        <directionalLight
          position={[-2.8, 1.8, 1.5]}
          intensity={0.70}
          color="#b8c8ff"
        />

        {/* RIM (HAIR): strong purple-white from upper-back-left — separates hair from bg */}
        <directionalLight
          position={[-1.0, 5.5, -4.0]}
          intensity={2.40}
          color="#e0d0ff"
        />

        {/* COUNTER-RIM: warm amber from upper-back-right — adds depth on opposite shoulder */}
        <directionalLight
          position={[3.5, 3.0, -2.5]}
          intensity={0.80}
          color="#ffc890"
        />

        {/* SKIN FILL: warm, very soft, close-range point light — simulates ambient bounce */}
        <pointLight
          position={[0.2, 0.5, 1.6]}
          intensity={0.50}
          color="#ffe8d0"
          distance={4}
          decay={2}
        />

        {/* EYE CATCHLIGHT: tiny frontal point — creates life-like specular in eyes */}
        <pointLight
          position={[0, 0.2, 1.2]}
          intensity={0.18}
          color="#ffffff"
          distance={2}
          decay={2}
        />

        {/* Low ambient — keeps deep shadows from going fully black */}
        <ambientLight intensity={0.22} color="#d0d8ff" />

        {/* Environment IBL — studio preset for crisp reflections on eyes/hair */}
        {Environment && (
          <Suspense fallback={null}>
            <Environment preset="studio" background={false} environmentIntensity={1.6} />
          </Suspense>
        )}

        {/* Soft contact shadow */}
        {ContactShadows && (
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.45}
            scale={2.5}
            blur={1.5}
            far={2.5}
            color="#060212"
          />
        )}

        {/* Loader */}
        <VRMLoader
          url={vrmUrl}
          onLoad={handleLoad}
          onError={(e) => {
            setError(e);
            setLoading(false);
            externalOnError?.(e);
          }}
        />

        {framing && <CameraFramer framing={framing} />}

        {vrm && framing && (
          <VRMScene
            vrm={vrm}
            framing={framing}
            state={state}
            ttsAmplitude={ttsAmplitude}
            isSpeaking={isSpeaking}
          />
        )}

        {OrbitControls && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3.5}
            maxPolarAngle={Math.PI / 1.8}
            target={framing ? [framing.cameraTarget.x, framing.cameraTarget.y, framing.cameraTarget.z] : [0, 1.4, 0]}
            autoRotate={!vrm}
            autoRotateSpeed={0.8}
          />
        )}
      </Canvas>
    </div>
  );
}


export default VRMAvatar;

