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
import {
  evaluateWordVisemes,
  analyzeSpeechIntent,
  lsin,
  lerp,
  analyzeProsodicCadence,
  computeSwallowReflex,
  CAMERA_PRESETS,
  STUDIO_LIGHTING_PRESETS,
  computeFingerPose,
  computeAudienceTracking,
} from './vrmPresenterEngine';

export {
  evaluateWordVisemes,
  analyzeSpeechIntent,
  analyzeProsodicCadence,
  computeSwallowReflex,
  CAMERA_PRESETS,
  STUDIO_LIGHTING_PRESETS,
  computeFingerPose,
  computeAudienceTracking,
};


// ── Expression presets per state ──────────────────────────────
const STATE_EXPRESSIONS = {
  [CHARACTER_STATES.IDLE]: { happy: 0, angry: 0, sad: 0, surprised: 0, relaxed: 0.15 },
  [CHARACTER_STATES.LISTENING]: { happy: 0.2, angry: 0, sad: 0, surprised: 0.1, relaxed: 0 },
  [CHARACTER_STATES.THINKING]: { happy: 0, angry: 0, sad: 0.05, surprised: 0, relaxed: 0.3 },
  [CHARACTER_STATES.ANALYZING]: { happy: 0, angry: 0, sad: 0, surprised: 0.15, relaxed: 0 },
  [CHARACTER_STATES.TALKING]: { happy: 0.25, angry: 0, sad: 0, surprised: 0, relaxed: 0 },
  [CHARACTER_STATES.HAPPY]: { happy: 1.0, angry: 0, sad: 0, surprised: 0.2, relaxed: 0 },
  [CHARACTER_STATES.GREETING]: { happy: 0.8, angry: 0, sad: 0, surprised: 0.3, relaxed: 0 },
  [CHARACTER_STATES.GESTURE]: { happy: 0.4, angry: 0, sad: 0, surprised: 0.1, relaxed: 0 },
  [CHARACTER_STATES.ENCOURAGING]: { happy: 0.9, angry: 0, sad: 0, surprised: 0.1, relaxed: 0 },
};

// ── Auto-frame helper ─────────────────────────────────────────
/**
 * Computes the bounding box of the VRM scene, then returns:
 *   modelOffset  — how much to shift the model so it's centred at origin
 *   cameraTarget — the point the camera should orbit around (eye level)
 *   cameraPos    — where to place the camera for a cinematic bust shot
 */
function computeFraming(vrmScene, cameraMode = 'bust') {
  const box = new THREE.Box3().setFromObject(vrmScene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const height = size.y;
  const cfg = CAMERA_PRESETS[cameraMode] || CAMERA_PRESETS.bust;

  // Shift model so feet rest at y=0 and x/z are centred
  const modelOffset = new THREE.Vector3(-center.x, -box.min.y, -center.z);

  // Target chin / face level
  const targY = (box.min.y + height * cfg.yOffset) + modelOffset.y;

  // Camera height
  const camY = (box.min.y + height * cfg.camYMult) + modelOffset.y;

  // Distance based on preset
  const dist = height * cfg.distMult;
  const camX = cfg.xAngleMult ? dist * cfg.xAngleMult : 0;
  const camZ = cfg.xAngleMult ? dist * 0.90 : dist;

  return {
    modelOffset,
    cameraTarget: new THREE.Vector3(0, targY, 0),
    cameraPos: new THREE.Vector3(camX, camY, camZ),
    fov: cfg.fov,
    height,
    boxMinY: box.min.y,
  };
}

// ── Camera framer: sets up camera with smooth director shot transitions ─
function CameraFramer({ framing, cameraMode = 'bust' }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 1.4, 1.5));
  const targetLook = useRef(new THREE.Vector3(0, 1.3, 0));
  const targetFov = useRef(28);

  useEffect(() => {
    if (!framing) return;
    const cfg = CAMERA_PRESETS[cameraMode] || CAMERA_PRESETS.bust;
    const height = framing.height || 1.6;
    const dist = height * cfg.distMult;
    const camX = cfg.xAngleMult ? dist * cfg.xAngleMult : 0;
    const camY = framing.boxMinY + height * cfg.camYMult + framing.modelOffset.y;
    const camZ = cfg.xAngleMult ? dist * 0.90 : dist;
    const targY = framing.boxMinY + height * cfg.yOffset + framing.modelOffset.y;

    targetPos.current.set(camX, camY, camZ);
    targetLook.current.set(0, targY, 0);
    targetFov.current = cfg.fov;
  }, [framing, cameraMode]);

  // Subtle broadcast camera breathing + smooth transition between director shot presets
  useFrame(({ clock }, delta) => {
    if (!framing) return;
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const driftX = Math.sin(t * 0.42) * 0.003 + Math.sin(t * 0.19) * 0.0015;
    const driftY = Math.cos(t * 0.38) * 0.0025 + Math.sin(t * 0.14) * 0.0012;

    camera.position.x = lerp(camera.position.x, targetPos.current.x + driftX, 3.5, dt);
    camera.position.y = lerp(camera.position.y, targetPos.current.y + driftY, 3.5, dt);
    camera.position.z = lerp(camera.position.z, targetPos.current.z, 3.5, dt);

    camera.fov = lerp(camera.fov, targetFov.current, 3.5, dt);
    camera.updateProjectionMatrix();

    camera.lookAt(targetLook.current);
  });

  return null;
}



// ── VRM scene animator ────────────────────────────────────────
function VRMScene({
  vrm,
  framing,
  state,
  ttsAmplitude,
  isSpeaking,
  currentSpeechText,
  activeWord = '',
  studioLighting = 'keynote',
  audienceTracking = false,
  onTelemetryUpdate,
}) {
  const clock = useRef(new THREE.Clock());
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

    // Human presenter physiological systems:
    breathLift: 0,
    shoulderLift: 0,
    gazeState: 'camera', // 'camera' (70%) | 'aversion' (30% cognitive thinking glance)
    gazeTimer: 0,
    nextGazeAversion: 4.5,
    aversionTargetX: 0,
    aversionTargetY: 0,
    prevSpeaking: false,
    prevSpeechText: '',
    inhalationT: 0,
    inhalationActive: false,
    activeIntent: 'conversational',

    // Phase 2: Postural Contrapposto weight shifting & emotional warmth
    postureWeight: 0.0,       // -0.6 (left leg dominant) to +0.6 (right leg dominant)
    weightTarget: 0.55,       // active target balance side
    weightTimer: 0.0,
    nextWeightShift: 10.5,    // 9 - 14s natural interval
    warmthVal: 0.12,          // Duchenne smile / zygomatic micro-warmth marker

    // Phase 3: Prosodic Cadence, Swallow Reflex & Thoracic Depth
    lastSentenceChangeTime: 0,
    swallowDip: 0,
    prosodyPitch: 0,
    prosodyRoll: 0,
    prosodyBrow: 0,
  });

  // Discovered viseme names from this specific VRM model
  const visemeMapRef = useRef(null);

  // On mount: scan expression manager and log what mouth shapes are available
  useEffect(() => {
    if (!vrm?.expressionManager) return;
    const em = vrm.expressionManager;
    const map = { aa: null, oh: null, ou: null, ee: null, ii: null };

    // VRM1 standard names
    const candidates = {
      aa: ['aa', 'Aa', 'AA', 'a', 'A', 'mouth_a', 'mouthOpen', 'MouthOpen'],
      oh: ['oh', 'Oh', 'OH', 'o', 'O', 'mouth_o', 'Surprised'],
      ou: ['ou', 'Ou', 'OU', 'u', 'U', 'mouth_u'],
      ee: ['ee', 'Ee', 'EE', 'e', 'E', 'mouth_e', 'ih', 'Ih'],
      ii: ['ii', 'Ii', 'II', 'i', 'I', 'mouth_i'],
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
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((_, delta) => {
    if (!vrm) return;
    const t = clock.current.getElapsedTime();
    const dt = Math.min(delta, 0.05);   // cap delta so jumps don't explode
    const bs = boneState.current;
    const isTalking = state === CHARACTER_STATES.TALKING;
    const isListening = state === CHARACTER_STATES.LISTENING;

    // Phase 4: Biomechanical Audience Tracking & VOR Decoupling
    const audience = computeAudienceTracking(mouseRef.current, audienceTracking);

    const ARM_DOWN_L = 1.4;
    const ARM_DOWN_R = -1.4;

    // ─────────────────────────────────────────────────────────
    // Physiological Pre-Speech Inhalation & Exhalation Cycle
    // ─────────────────────────────────────────────────────────
    if (isSpeaking && !bs.prevSpeaking) {
      bs.inhalationActive = true;
      bs.inhalationT = 0;
    }
    if (currentSpeechText && currentSpeechText !== bs.prevSpeechText) {
      bs.inhalationActive = true;
      bs.inhalationT = 0;
      bs.prevSpeechText = currentSpeechText;
      bs.lastSentenceChangeTime = t;
      // Natural cognitive thinking glance when beginning a new sentence
      if (isTalking) {
        bs.gazeState = 'aversion';
        bs.gazeTimer = 0;
        bs.aversionTargetX = Math.random() > 0.5 ? -0.32 : 0.28;
        bs.aversionTargetY = 0.20;
        bs.blinkPhase = 'closing';
        bs.blinkT = 0;
      }
    }
    bs.prevSpeaking = isSpeaking;

    // Phase 3: Prosodic Cadence & Autonomic Swallow Reflex
    const cadence = analyzeProsodicCadence(currentSpeechText, activeWord, t);
    bs.prosodyPitch = lerp(bs.prosodyPitch, cadence.headPitchDelta, 5.0, dt);
    bs.prosodyRoll = lerp(bs.prosodyRoll, cadence.headRollDelta, 4.0, dt);
    bs.prosodyBrow = lerp(bs.prosodyBrow, cadence.browDelta, 5.0, dt);

    const swallow = computeSwallowReflex(t, bs.lastSentenceChangeTime);
    bs.swallowDip = lerp(bs.swallowDip, swallow.swallowDip, 16.0, dt);

    if (bs.inhalationActive) {
      bs.inhalationT += dt;
      bs.breathLift = lerp(bs.breathLift, 0.038, 14, dt);
      bs.shoulderLift = lerp(bs.shoulderLift, 0.024, 12, dt);
      if (bs.inhalationT >= 0.35) {
        bs.inhalationActive = false;
      }
    } else if (isTalking) {
      // Natural exhalation slowly deflates lungs over sentence
      bs.breathLift = lerp(bs.breathLift, -0.012, 1.2, dt);
      bs.shoulderLift = lerp(bs.shoulderLift, 0.002, 2.0, dt);
    } else {
      bs.breathLift = lerp(bs.breathLift, 0, 3.0, dt);
      bs.shoulderLift = lerp(bs.shoulderLift, 0, 3.0, dt);
    }

    // ─────────────────────────────────────────────────────────
    // Contrapposto Physical Weight Shifting (Ponderatio)
    // ─────────────────────────────────────────────────────────
    bs.weightTimer += dt;
    if (bs.weightTimer >= bs.nextWeightShift) {
      bs.weightTimer = 0;
      bs.nextWeightShift = 9.0 + Math.random() * 5.0; // 9-14s natural human cycle
      // Alternate balance between left and right leg with organic variance
      bs.weightTarget = (bs.weightTarget > 0 ? -1 : 1) * (0.45 + Math.random() * 0.20);
    }
    // Smooth, heavy physical weight transfer between legs
    bs.postureWeight = lerp(bs.postureWeight, bs.weightTarget, 0.75, dt);

    // ─────────────────────────────────────────────────────────
    // 1. HIPS — lateral weight shift & Contrapposto pelvic tilt
    // ─────────────────────────────────────────────────────────
    if (vrm.humanoid) {
      const hipSway = lsin(t, 0.38, 0.012, 0.19, 0.006);  // slow idle drift
      const hipShift = isTalking ? lsin(t, 0.55, 0.010, 0.28, 0.005) : 0;
      const contrappostoHipZ = bs.postureWeight * 0.026;   // loaded hip elevates
      const contrappostoHipY = bs.postureWeight * 0.016;   // slight pelvic pivot
      const hipTargZ = hipSway + hipShift + contrappostoHipZ;
      const hipTargY = (isTalking ? lsin(t, 0.42, 0.006) : 0) + contrappostoHipY;

      bs.hipZ = lerp(bs.hipZ, hipTargZ, 1.5, dt);
      bs.hipY = lerp(bs.hipY, hipTargY, 1.2, dt);
      const hips = vrm.humanoid.getNormalizedBoneNode('hips');
      if (hips) { hips.rotation.z = bs.hipZ; hips.rotation.y = bs.hipY; }

      // Group Y bob & X lateral shift — body mass sways naturally over the engaged foot
      const bobAmt = isTalking ? 0.004 : 0.002;
      bs.groupY = lerp(bs.groupY, lsin(t, 0.48, bobAmt, 0.24, bobAmt * 0.4), 2.0, dt);
      if (groupRef.current) {
        groupRef.current.position.y = (framing?.modelOffset?.y ?? 0) + bs.groupY;
        groupRef.current.position.x = (framing?.modelOffset?.x ?? 0) + bs.postureWeight * 0.015;
      }

      // ─────────────────────────────────────────────────────
      // 2. SPINE — breathe + counter-rotate hips + Contrapposto
      // ─────────────────────────────────────────────────────
      const breatheAmt = isTalking ? 0.022 : 0.013;
      const breatheX = lsin(t, isTalking ? 1.1 : 0.85, breatheAmt, 0.43, breatheAmt * 0.3);
      const leanX = isTalking ? lsin(t, 0.65, 0.016, 0.31, 0.008) : 0;
      bs.spineX = lerp(bs.spineX, breatheX + leanX + bs.breathLift * 0.4, 2.5, dt);
      // Torso compensates for pelvic tilt to keep head and spine erect
      bs.spineZ = lerp(bs.spineZ, -bs.hipZ * 0.5 - bs.postureWeight * 0.022, 2.0, dt);
      const spine = vrm.humanoid.getNormalizedBoneNode('spine');
      if (spine) { spine.rotation.x = bs.spineX; spine.rotation.z = bs.spineZ; }

      // ─────────────────────────────────────────────────────
      // 3. CHEST — 3D bilateral ribcage expansion + lean
      // ─────────────────────────────────────────────────────
      const chestLean = isTalking ? lsin(t, 0.72, 0.018, 0.36, 0.008) : lsin(t, 0.5, 0.008);
      const chestTwist = isTalking ? lsin(t, 0.45, 0.012) : 0;
      bs.chestX = lerp(bs.chestX, breatheX * 0.6 + chestLean + bs.breathLift, 2.5, dt);
      bs.chestZ = lerp(bs.chestZ, chestTwist - bs.hipZ * 0.3 - bs.postureWeight * 0.012, 2.0, dt);
      const chest = vrm.humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        chest.rotation.x = bs.chestX;
        chest.rotation.z = bs.chestZ;
        // 3D Bilateral Thoracic Ribcage Tidal Expansion
        const ribExpand = 1.0 + (bs.breathLift > 0 ? bs.breathLift * 0.38 : bs.breathLift * 0.14);
        chest.scale.set(ribExpand, 1.0, ribExpand);
      }

      // ─────────────────────────────────────────────────────
      // 4. NECK — S-curve: semi-independent + laryngeal swallow dip
      // ─────────────────────────────────────────────────────
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const neckIdleX = lsin(t, 0.42, 0.008, 0.21, 0.004);
      const neckIdleY = lsin(t, 0.31, 0.006, 0.17, 0.003);
      const neckTargX = (isTalking
        ? (audience.isTracking ? audience.headPitch * 0.4 : my * 0.08) + lsin(t, 1.1, 0.010, 0.55, 0.005) + neckIdleX
        : (audience.isTracking ? audience.headPitch * 0.5 : my * 0.10) + neckIdleX) + bs.swallowDip * 2.5;
      const neckTargY = isTalking
        ? (audience.isTracking ? audience.headYaw * 0.4 : mx * 0.10) + lsin(t, 0.32, 0.008) + neckIdleY
        : (audience.isTracking ? audience.headYaw * 0.5 : mx * 0.14) + neckIdleY;

      bs.neckX = lerp(bs.neckX, neckTargX, 3.0, dt);
      bs.neckY = lerp(bs.neckY, neckTargY, 3.0, dt);
      const neck = vrm.humanoid.getNormalizedBoneNode('neck');
      if (neck) { neck.rotation.x = bs.neckX; neck.rotation.y = bs.neckY; }

      // ─────────────────────────────────────────────────────
      // 5. HEAD — expressive, nods + prosodic cadence tilts + VOR audience tracking
      // ─────────────────────────────────────────────────────
      let headTargX, headTargY, headTargZ;
      const audPitch = audience.isTracking ? audience.headPitch : my * 0.10;
      const audYaw = audience.isTracking ? audience.headYaw : mx * 0.12;

      if (isTalking) {
        // Nod: peaks on cadence rhythm beats
        const nodRaw = Math.sin(t * 1.2);
        const nod = nodRaw > 0.55 ? (nodRaw - 0.55) * cadence.nodForce : 0;
        // Glance: slow side look during speech (thinking)
        const glance = lsin(t, 0.33, 0.09, 0.17, 0.04);
        // Interrogative inquisitive lift on questions, downbeat emphasis
        headTargX = audPitch + nod + lsin(t, 0.52, 0.008) + bs.prosodyPitch;
        headTargY = audYaw + glance;
        // Head roll / tilt — empathy angle + cadence roll
        headTargZ = -glance * 0.35 + lsin(t, 0.28, 0.012) + bs.prosodyRoll;
      } else if (isListening) {
        // Listening: lean in slightly, tiny micro-nods showing engagement
        const microNod = lsin(t, 0.85, 0.018, 0.42, 0.010);
        headTargX = (audience.isTracking ? audience.headPitch : my * 0.18) + microNod + 0.04;  // lean forward
        headTargY = (audience.isTracking ? audience.headYaw : mx * 0.22) + lsin(t, 0.31, 0.012);
        headTargZ = lsin(t, 0.25, 0.015);
      } else {
        headTargX = (audience.isTracking ? audience.headPitch : my * 0.20) + lsin(t, 0.58, 0.012, 0.29, 0.006);
        headTargY = (audience.isTracking ? audience.headYaw : mx * 0.26) + lsin(t, 0.38, 0.010, 0.19, 0.005);
        headTargZ = lsin(t, 0.22, 0.008, 0.11, 0.004);
      }
      bs.headX = lerp(bs.headX, headTargX, 4.0, dt);
      bs.headY = lerp(bs.headY, headTargY, 4.0, dt);
      bs.headZ = lerp(bs.headZ, headTargZ, 3.5, dt);
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      if (head) { head.rotation.x = bs.headX; head.rotation.y = bs.headY; head.rotation.z = bs.headZ; }

      // Shoulder counter-rotation + breath elevation + Contrapposto shoulder tilt
      const shoulderCounterL = vrm.humanoid.getNormalizedBoneNode('leftShoulder');
      const shoulderCounterR = vrm.humanoid.getNormalizedBoneNode('rightShoulder');
      if (shoulderCounterL) {
        shoulderCounterL.rotation.z = lerp(
          shoulderCounterL.rotation.z,
          bs.headY * 0.10 + bs.chestZ * 0.5 + bs.shoulderLift - bs.postureWeight * 0.012,
          3.0, dt
        );
      }
      if (shoulderCounterR) {
        shoulderCounterR.rotation.z = lerp(
          shoulderCounterR.rotation.z,
          -bs.headY * 0.10 + bs.chestZ * 0.5 - bs.shoulderLift - bs.postureWeight * 0.012,
          3.0, dt
        );
      }

      // ─────────────────────────────────────────────────────
      // 6. ARMS — semantic co-speech gestures & resting posture
      // ─────────────────────────────────────────────────────
      let tLUAz, tLUAx, tLLAz, tLWy, tLFinger;
      let tRUAz, tRUAx, tRLAz, tRWy, tRFinger;
      let armLerp = 0.05;

      if (isTalking) {
        const intent = analyzeSpeechIntent(currentSpeechText);
        bs.activeIntent = intent;
        const mA = lsin(t, 2.6, 0.038, 1.3, 0.022);
        const mB = lsin(t, 1.8, 0.050, 0.9, 0.028);

        if (intent === 'enumerate') {
          // Enumerate / Point: right arm raises with index point beat
          tLUAz = ARM_DOWN_L;
          tLUAx = 0;
          tLLAz = 0;
          tLWy = 0;
          tLFinger = 0.70;

          tRUAz = ARM_DOWN_R + 0.62 + mB * 0.4;
          tRUAx = 0.32 + lsin(t, 2.5, 0.12);
          tRLAz = -0.58 + lsin(t, 2.5, 0.16);
          tRWy = -0.28;
          tRFinger = 0.10; // open index
          armLerp = 0.065;
        } else if (intent === 'contrast') {
          // Contrast / Balance: alternate weighing motion with open palms
          const weighOsc = Math.sin(t * 1.8) * 0.16;
          tLUAz = ARM_DOWN_L - 0.26 - weighOsc;
          tLUAx = 0.18;
          tLLAz = 0.22;
          tLWy = 0.18;
          tLFinger = 0.12;

          tRUAz = ARM_DOWN_R + 0.26 + weighOsc;
          tRUAx = 0.18;
          tRLAz = -0.22;
          tRWy = -0.18;
          tRFinger = 0.12;
          armLerp = 0.05;
        } else if (intent === 'vision') {
          // Expansive vision / growth: both arms sweep outwards wide
          tLUAz = ARM_DOWN_L - 0.38 + mA * 0.3;
          tLUAx = 0.18;
          tLLAz = 0.26;
          tLWy = 0.20;
          tLFinger = 0.06;

          tRUAz = ARM_DOWN_R + 0.38 - mA * 0.3;
          tRUAx = 0.18;
          tRLAz = -0.26;
          tRWy = -0.20;
          tRFinger = 0.06;
          armLerp = 0.048;
        } else if (intent === 'conviction') {
          // Conviction / Heart: right hand hovers near upper chest
          tLUAz = ARM_DOWN_L + 0.06;
          tLUAx = 0.04;
          tLLAz = 0.04;
          tLWy = 0;
          tLFinger = 0.65;

          tRUAz = ARM_DOWN_R + 0.52 + mB * 0.3;
          tRUAx = 0.35 + mA * 0.3;
          tRLAz = -0.74 + mA * 0.3;
          tRWy = 0.38;
          tRFinger = 0.22;
          armLerp = 0.055;
        } else if (intent === 'impact') {
          // Impact / Decisive chop beat
          tLUAz = ARM_DOWN_L;
          tLUAx = 0;
          tLLAz = 0;
          tLWy = 0;
          tLFinger = 0.70;

          tRUAz = ARM_DOWN_R + 0.60;
          tRUAx = 0.38 + lsin(t, 2.6, 0.18);
          tRLAz = -0.52 + lsin(t, 2.6, 0.22);
          tRWy = 0.18;
          tRFinger = 0.22;
          armLerp = 0.085;
        } else {
          // Conversational: realistic 3-phase cycle with natural rest periods
          const convCycle = t % 14;
          if (convCycle < 5.0) {
            // Phase 1: Right open-palm explanation
            tLUAz = ARM_DOWN_L;
            tLUAx = 0;
            tLLAz = 0;
            tLWy = 0;
            tLFinger = 0.65;

            tRUAz = ARM_DOWN_R + 0.48 + mB * 0.4;
            tRUAx = 0.26 + mA;
            tRLAz = -0.34 + mA * 0.5;
            tRWy = -0.24;
            tRFinger = 0.10 + Math.abs(mA) * 1.2;
            armLerp = 0.055;
          } else if (convCycle < 9.5) {
            // Phase 2: Open bilateral gesture
            tLUAz = ARM_DOWN_L - 0.25 + mA * 0.3;
            tLUAx = 0.14;
            tLLAz = 0.16;
            tLWy = 0.14;
            tLFinger = 0.08;

            tRUAz = ARM_DOWN_R + 0.25 - mA * 0.3;
            tRUAx = 0.14;
            tRLAz = -0.16;
            tRWy = -0.14;
            tRFinger = 0.08;
            armLerp = 0.048;
          } else {
            // Phase 3: Natural resting posture (hands relaxed at waist)
            tLUAz = ARM_DOWN_L + 0.08;
            tLUAx = 0.06;
            tLLAz = 0.08;
            tLWy = 0.04;
            tLFinger = 0.70;

            tRUAz = ARM_DOWN_R - 0.08;
            tRUAx = 0.06;
            tRLAz = -0.08;
            tRWy = -0.04;
            tRFinger = 0.70;
            armLerp = 0.040;
          }
        }
      } else {
        armLerp = 0.04;
        const POSE = {
          [CHARACTER_STATES.IDLE]: { l: [ARM_DOWN_L, 0, 0, 0, 0.75], r: [ARM_DOWN_R, 0, 0, 0, 0.75] },
          [CHARACTER_STATES.LISTENING]: { l: [ARM_DOWN_L + .05, .05, 0, .03, .65], r: [ARM_DOWN_R - .05, .05, 0, -.03, .65] },
          [CHARACTER_STATES.THINKING]: { l: [ARM_DOWN_L, 0, 0, 0, .75], r: [ARM_DOWN_R + .45, .32, -.48, .2, 1.0] },
          [CHARACTER_STATES.ANALYZING]: { l: [ARM_DOWN_L, 0, 0, 0, .60], r: [ARM_DOWN_R, .12, 0, .05, .60] },
          [CHARACTER_STATES.HAPPY]: { l: [ARM_DOWN_L - .22, .06, 0, .05, .1], r: [ARM_DOWN_R + .22, .06, 0, -.05, .1] },
          [CHARACTER_STATES.GREETING]: {
            l: [ARM_DOWN_L, 0, 0, 0, .75],
            r: [ARM_DOWN_R + 0.95 + lsin(t, 3.5, .12), .30, -.52, .2 + lsin(t, 3.5, .15), .05]
          },
          [CHARACTER_STATES.GESTURE]: { l: [ARM_DOWN_L, 0, 0, 0, .75], r: [ARM_DOWN_R + .52, .38, -.32, -.12, 1.0] },
          [CHARACTER_STATES.ENCOURAGING]: { l: [ARM_DOWN_L - .18, .1, 0, .08, .20], r: [ARM_DOWN_R + .18, .1, 0, -.08, .20] },
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

      // Lower arms (forearms)
      bs.lLAz = lerp(bs.lLAz, tLLAz, armLerp * 60, dt);
      bs.rLAz = lerp(bs.rLAz, tRLAz, armLerp * 60, dt);
      const lLA = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
      const rLA = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
      if (lLA) lLA.rotation.z = bs.lLAz;
      if (rLA) rLA.rotation.z = bs.rLAz;

      // Wrists
      bs.lWy = lerp(bs.lWy, tLWy, armLerp * 60, dt);
      bs.rWy = lerp(bs.rWy, tRWy, armLerp * 60, dt);
      const lWxTarg = isTalking ? lsin(t, 0.6, 0.08, 0.3, 0.04) - 0.1 : -0.05;
      const rWxTarg = isTalking ? lsin(t, 0.6, 0.08, 0.3, 0.04) + 0.1 : 0.05;
      bs.lWx = lerp(bs.lWx, lWxTarg, armLerp * 60, dt);
      bs.rWx = lerp(bs.rWx, rWxTarg, armLerp * 60, dt);
      const lW = vrm.humanoid.getNormalizedBoneNode('leftHand');
      const rW = vrm.humanoid.getNormalizedBoneNode('rightHand');
      if (lW) { lW.rotation.y = bs.lWy; lW.rotation.x = bs.lWx; }
      if (rW) { rW.rotation.y = bs.rWy; rW.rotation.x = bs.rWx; }

      // ─────────────────────────────────────────────────────
      // 7. FINGERS — per-phalanx curl with Phase 4 Chironomia
      // ─────────────────────────────────────────────────────
      bs.lFinger = lerp(bs.lFinger, tLFinger, armLerp * 60, dt);
      bs.rFinger = lerp(bs.rFinger, tRFinger, armLerp * 60, dt);

      const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
      const PHALANGES = ['Proximal', 'Intermediate', 'Distal'];
      [['left', bs.lFinger], ['right', bs.rFinger]].forEach(([side, curlTarget]) => {
        const curlSign = side === 'left' ? 1 : -1;
        const flutter = lsin(t, 1.9, 0.013, 0.95, 0.007) * (side === 'left' ? 1 : -1);
        FINGERS.forEach((finger, fi) => {
          PHALANGES.forEach((phalanx, pi) => {
            const bone = vrm.humanoid.getNormalizedBoneNode(`${side}${finger}${phalanx}`);
            if (!bone) return;
            if (isTalking) {
              const fPose = computeFingerPose(bs.activeIntent, finger, phalanx, side, t);
              bone.rotation.z = lerp(bone.rotation.z, fPose.curl, armLerp * 60, dt);
              if (fPose.splay !== 0) {
                bone.rotation.y = lerp(bone.rotation.y, fPose.splay, armLerp * 60, dt);
              }
            } else {
              const curlMult = [0.52, 0.78, 1.0][pi];
              const stagger = fi * 0.032;
              const goal = curlSign * (curlTarget + stagger + flutter) * curlMult;
              bone.rotation.z = lerp(bone.rotation.z, goal, armLerp * 60, dt);
            }
          });
        });
        ['Proximal', 'Intermediate', 'Distal'].forEach((phalanx, pi) => {
          const bone = vrm.humanoid.getNormalizedBoneNode(`${side}Thumb${phalanx}`);
          if (!bone) return;
          if (isTalking) {
            const tPose = computeFingerPose(bs.activeIntent, 'Thumb', phalanx, side, t);
            bone.rotation.z = lerp(bone.rotation.z, tPose.curl, armLerp * 60, dt);
            bone.rotation.y = lerp(bone.rotation.y, (side === 'left' ? 0.28 : -0.28) + tPose.splay, armLerp * 60, dt);
          } else {
            const thumbCurl = curlTarget * 0.52;
            const cm = [0.48, 0.78, 1.0][pi];
            bone.rotation.z = lerp(bone.rotation.z, curlSign * thumbCurl * cm, armLerp * 60, dt);
            bone.rotation.y = lerp(bone.rotation.y, side === 'left' ? 0.28 : -0.28, armLerp * 60, dt);
          }
        });
      });
    }

    // ─────────────────────────────────────────────────────────
    // 8. EXPRESSIONS — eyes, blink, mouth, asymmetric brows, Duchenne warmth
    // ─────────────────────────────────────────────────────────
    if (vrm.expressionManager) {
      const em = vrm.expressionManager;
      const bs2 = boneState.current;

      // ── Duchenne Warmth Modulation (zygomatic micro-smile on inspiring terms & clause rests) ──
      const inspiringTerms = /\b(welcome|thank|pleasure|passion|excited|vision|future|growth|together|proud|delighted|clarity|confidence|success|appreciate|forward|impact|excel|build|opportunity|believe|great)\b/i;
      const hasInspiringTerm = inspiringTerms.test(activeWord || '') || inspiringTerms.test(currentSpeechText || '');
      const isClauseRest = !isSpeaking && isTalking;

      let targetWarmth = 0.10;
      if (hasInspiringTerm) {
        targetWarmth = 0.36;   // genuine warm smile bloom on positive terms
      } else if (isClauseRest) {
        targetWarmth = 0.25;   // pleasant micro-smile while pausing between sentences
      } else if ([CHARACTER_STATES.HAPPY, CHARACTER_STATES.ENCOURAGING, CHARACTER_STATES.GREETING].includes(state)) {
        targetWarmth = 0.45;
      }
      bs2.warmthVal = lerp(bs2.warmthVal, targetWarmth, 2.5, dt);

      // Base emotion blend + Duchenne warmth layer
      const eTarget = STATE_EXPRESSIONS[state] || STATE_EXPRESSIONS[CHARACTER_STATES.IDLE];
      ['happy', 'angry', 'sad', 'surprised', 'relaxed'].forEach((name) => {
        let goal = eTarget[name] ?? 0;
        if (name === 'happy') goal = Math.min(1.0, goal + bs2.warmthVal);
        if (name === 'relaxed') goal = Math.min(1.0, goal + bs2.warmthVal * 0.30);
        const cur = em.getValue(name) ?? 0;
        em.setValue(name, cur + (goal - cur) * Math.min(1, 0.05 * dt * 60));
      });

      // ── Word-synchronized Lip Sync & Viseme Engine ───────
      const vm = visemeMapRef.current;
      const hasAudio = isSpeaking && (ttsAmplitude ?? 0) > 0.005;
      const isMouthActive = hasAudio || isTalking;
      const jawBone = vrm.humanoid?.getNormalizedBoneNode?.('jaw');

      if (isMouthActive) {
        // Phoneme profiling of active word
        const wv = evaluateWordVisemes(activeWord);
        const bilabialRhythm = Math.sin(t * 6.5);
        const isBilabialStop = wv.isBilabial || bilabialRhythm > 0.88;
        const bilabialDamp = isBilabialStop ? 0.06 : 1.0;

        const rawAmp = (hasAudio ? Math.max(0.28, ttsAmplitude ?? 0) : 0.40) * bilabialDamp;
        const vt = t * 6.2;

        const aaVal = rawAmp * wv.aa * (0.50 + 0.50 * Math.abs(Math.sin(vt)));
        const ohVal = rawAmp * wv.oh * (0.26 + 0.45 * Math.abs(Math.sin(vt * 1.30 + 1.1)));
        const ouVal = rawAmp * wv.ou * (0.16 + 0.35 * Math.abs(Math.sin(vt * 0.80 + 2.1)));
        const eeVal = rawAmp * wv.ee * (0.14 + 0.36 * Math.abs(Math.sin(vt * 1.65 + 3.0)));

        if (vm) {
          if (vm.aa) em.setValue(vm.aa, Math.min(1, aaVal));
          if (vm.oh) em.setValue(vm.oh, Math.min(1, ohVal));
          if (vm.ou) em.setValue(vm.ou, Math.min(1, ouVal));
          if (vm.ee) em.setValue(vm.ee, Math.min(1, eeVal));
        } else {
          for (const n of ['aa', 'Aa', 'a', 'A', 'mouthOpen', 'MouthOpen'])
            if (em.getValue(n) !== undefined) { em.setValue(n, Math.min(1, aaVal)); break; }
          for (const n of ['oh', 'Oh', 'o', 'O'])
            if (em.getValue(n) !== undefined) { em.setValue(n, Math.min(1, ohVal)); break; }
          for (const n of ['ou', 'Ou', 'u', 'U', 'mouth_u'])
            if (em.getValue(n) !== undefined) { em.setValue(n, Math.min(1, ouVal)); break; }
          for (const n of ['ee', 'Ee', 'e', 'E', 'mouth_e'])
            if (em.getValue(n) !== undefined) { em.setValue(n, Math.min(1, eeVal)); break; }
        }

        // Jaw bone: scaled rotation with word viseme opening
        const jawTarget = isBilabialStop ? 0.01 : (wv.jaw * 0.9 + aaVal * 0.12);
        bs2.jawOpen = lerp(bs2.jawOpen, jawTarget, 20, dt);
        if (jawBone) jawBone.rotation.x = bs2.jawOpen;

      } else {
        // Fade mouth closed
        if (vm) {
          for (const slot of ['aa', 'oh', 'ou', 'ee', 'ii']) {
            if (vm[slot]) em.setValue(vm[slot], (em.getValue(vm[slot]) ?? 0) * 0.76);
          }
        } else {
          for (const n of ['aa', 'Aa', 'a', 'A', 'oh', 'Oh', 'o', 'O', 'ou', 'u', 'U', 'ee', 'e', 'E', 'mouthOpen']) {
            if (em.getValue(n) !== undefined) em.setValue(n, (em.getValue(n) ?? 0) * 0.76);
          }
        }
        bs2.jawOpen = lerp(bs2.jawOpen, 0, 12, dt);
        if (jawBone) jawBone.rotation.x = bs2.jawOpen;
      }

      // ── Human Presenter Gaze Model: 70% direct camera contact, 30% cognitive glance away ──
      bs2.gazeTimer += dt;
      if (isTalking) {
        if (bs2.gazeState === 'camera') {
          if (bs2.gazeTimer >= bs2.nextGazeAversion) {
            bs2.gazeState = 'aversion';
            bs2.gazeTimer = 0;
            // 60% glance up-left (visual recall), 40% glance down-right (word retrieval)
            if (Math.random() < 0.6) {
              bs2.aversionTargetX = -0.35 + (Math.random() - 0.5) * 0.15;
              bs2.aversionTargetY = 0.22 + (Math.random() - 0.5) * 0.1;
            } else {
              bs2.aversionTargetX = 0.25 + (Math.random() - 0.5) * 0.15;
              bs2.aversionTargetY = -0.18 + (Math.random() - 0.5) * 0.1;
            }
            // Saccadic blink suppression: humans blink when breaking gaze
            bs2.blinkPhase = 'closing';
            bs2.blinkT = 0;
          }
        } else {
          // Aversion duration ~0.9 to 1.3 seconds
          if (bs2.gazeTimer >= 1.1) {
            bs2.gazeState = 'camera';
            bs2.gazeTimer = 0;
            bs2.nextGazeAversion = 3.5 + Math.random() * 4.0;
            // Blink again when returning gaze to audience
            bs2.blinkPhase = 'closing';
            bs2.blinkT = 0;
          }
        }
      } else {
        bs2.gazeState = 'camera';
      }

      // Eye look morphs
      const isAverting = bs2.gazeState === 'aversion';
      const lookLeftGoal = isAverting && bs2.aversionTargetX < -0.1 ? Math.abs(bs2.aversionTargetX) : 0;
      const lookRightGoal = isAverting && bs2.aversionTargetX > 0.1 ? bs2.aversionTargetX : 0;
      const lookUpGoal = isAverting && bs2.aversionTargetY > 0.1 ? bs2.aversionTargetY : 0;
      const lookDownGoal = isAverting && bs2.aversionTargetY < -0.1 ? Math.abs(bs2.aversionTargetY) : 0;

      for (const n of ['lookLeft']) if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, lookLeftGoal, 6.0, dt));
      for (const n of ['lookRight']) if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, lookRightGoal, 6.0, dt));
      for (const n of ['lookUp']) if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, lookUpGoal, 6.0, dt));
      for (const n of ['lookDown']) if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, lookDownGoal, 6.0, dt));

      // ── Randomised & coupled blink ─────────────────────────
      bs2.blinkT += dt;
      if (bs2.blinkPhase === 'wait' && bs2.blinkT >= bs2.nextBlink) {
        bs2.blinkPhase = 'closing';
        bs2.blinkT = 0;
        bs2.nextBlink = isTalking ? 1.8 + Math.random() * 2.5 : 2.5 + Math.random() * 4.0;
      }
      if (bs2.blinkPhase === 'closing') {
        bs2.blinkVal = Math.min(1, bs2.blinkT / 0.08);
        if (bs2.blinkT >= 0.08) { bs2.blinkPhase = 'opening'; bs2.blinkT = 0; }
      } else if (bs2.blinkPhase === 'opening') {
        bs2.blinkVal = Math.max(0, 1 - bs2.blinkT / 0.12);
        if (bs2.blinkT >= 0.12) { bs2.blinkPhase = 'wait'; bs2.blinkVal = 0; }
      }
      ['blink', 'Blink', 'blinkLeft', 'blinkRight'].forEach((n) => {
        if (em.getValue(n) !== undefined) em.setValue(n, bs2.blinkVal);
      });

      // ── Eyebrows — raise on emphasis + interrogative pitch contours with natural subtle asymmetry ──────
      const browBase = isTalking ? Math.max(0, lsin(t, 1.15, 0.38, 0.58, 0.18) + bs2.prosodyBrow) : 0;
      const browAsym = isTalking ? lsin(t, 0.72, 0.10) : 0;
      const browLeft = Math.max(0, browBase - browAsym * 0.3);
      const browRight = Math.min(1, browBase + browAsym * 0.6);

      for (const n of ['browRaiseLeft', 'browLeftUp']) {
        if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, browLeft, 3.5, dt));
      }
      for (const n of ['browRaiseRight', 'browRightUp']) {
        if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, browRight, 3.5, dt));
      }
      for (const n of ['browUp', 'browsUp', 'BrowsUp']) {
        if (em.getValue(n) !== undefined) em.setValue(n, lerp(em.getValue(n) ?? 0, browBase, 3.0, dt));
      }
    }

    // ── Eye tracking with micro-saccades (retinal tremor) + Audience VOR Lock ───
    if (vrm.lookAt) {
      const bs2 = boneState.current;
      const camY = framing?.cameraTarget?.y ?? 1.4;
      const saccadeX = Math.sin(t * 11.2) * 0.010 + Math.sin(t * 18.4) * 0.005;
      const saccadeY = Math.cos(t * 9.6) * 0.008 + Math.sin(t * 15.1) * 0.004;

      let lookX, lookY;
      if (audience.isTracking) {
        // Direct audience engagement lock with organic micro-saccades
        lookX = audience.eyeX * 1.8 + saccadeX;
        lookY = camY + audience.eyeY * 1.4 + saccadeY;
      } else if (bs2.gazeState === 'camera') {
        lookX = mouseRef.current.x * 0.6 + saccadeX;
        lookY = camY + mouseRef.current.y * 0.4 + saccadeY;
      } else {
        lookX = bs2.aversionTargetX * 1.5 + saccadeX;
        lookY = camY + bs2.aversionTargetY * 1.2 + saccadeY;
      }
      lookAtTargetRef.current.position.set(lookX, lookY, 2.0);
      vrm.lookAt.target = lookAtTargetRef.current;
    }

    vrm.update(delta);

    // Phase 4: Live Presenter Telemetry Stream
    if (onTelemetryUpdate && Math.floor(t * 10) !== Math.floor((t - dt) * 10)) {
      onTelemetryUpdate({
        gazeState: audience.isTracking ? 'Audience Eye-Contact Lock' : bs.gazeState,
        postureWeight: bs.postureWeight,
        activeWord,
        activeIntent: bs.activeIntent,
        isQuestion: cadence.isQuestion,
        isEmphasis: cadence.isEmphasis,
        warmthVal: bs.warmthVal,
        breathLift: bs.breathLift,
        isSwallowing: swallow.isSwallowing,
        studioLighting,
        audienceTracking,
        kinesics: isTalking ? bs.activeIntent : 'resting',
      });
    }
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

            // ── Material quality pass (PBR skin dermal sheen & corneal wetness) ──
            vrm.scene.traverse((obj) => {
              if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                if (obj.material) {
                  const name = (obj.name || '').toLowerCase();
                  const matName = (obj.material.name || '').toLowerCase();
                  const isSkin = name.includes('skin') || name.includes('face') ||
                    name.includes('body') || name.includes('head') ||
                    matName.includes('skin') || matName.includes('face');
                  const isHair = name.includes('hair') || matName.includes('hair');
                  const isEye = name.includes('eye') || matName.includes('eye');
                  const isMouth = name.includes('mouth') || name.includes('tooth') ||
                    name.includes('teeth') || matName.includes('mouth') ||
                    matName.includes('tooth') || matName.includes('teeth');
                  const isCloth = name.includes('cloth') || name.includes('wear') || name.includes('dress');

                  if (isSkin) {
                    // Realistic skin: slightly matte with soft dermal capillary sheen
                    obj.material.roughness = 0.64;
                    obj.material.metalness = 0.0;
                    obj.material.envMapIntensity = 0.95;
                    if ('sheen' in obj.material) {
                      obj.material.sheen = 0.40;
                      obj.material.sheenRoughness = 0.45;
                      obj.material.sheenColor = new THREE.Color('#ffd2c4');
                    }
                  } else if (isHair) {
                    // Hair: silky sheen / gloss
                    obj.material.roughness = 0.42;
                    obj.material.metalness = 0.04;
                    obj.material.envMapIntensity = 1.9;
                  } else if (isEye) {
                    // Eyes: wet tear-film corneal specular
                    obj.material.roughness = 0.02;
                    obj.material.metalness = 0.0;
                    obj.material.envMapIntensity = 3.6;
                    if ('clearcoat' in obj.material) {
                      obj.material.clearcoat = 1.0;
                      obj.material.clearcoatRoughness = 0.02;
                    }
                  } else if (isMouth) {
                    // Oral cavity & teeth: moist specular
                    obj.material.roughness = 0.14;
                    obj.material.metalness = 0.0;
                    obj.material.envMapIntensity = 2.2;
                  } else if (isCloth) {
                    // Fabric: diffuse matte
                    obj.material.roughness = 0.82;
                    obj.material.metalness = 0.0;
                    obj.material.envMapIntensity = 0.5;
                  } else {
                    // Default
                    obj.material.roughness = obj.material.roughness ?? 0.55;
                    obj.material.metalness = obj.material.metalness ?? 0.02;
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

// ── Phase 4: Dynamic Studio Lighting ─────────────────────────
function StudioLighting({ presetId = 'keynote' }) {
  const preset = STUDIO_LIGHTING_PRESETS[presetId] || STUDIO_LIGHTING_PRESETS.keynote;
  return (
    <>
      {/* Primary Key light */}
      <directionalLight
        position={preset.keyPos || [1.8, 4.0, 3.0]}
        intensity={preset.keyIntensity * 2.3}
        color={preset.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.05}
        shadow-camera-far={15}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={4}
        shadow-camera-bottom={-0.5}
        shadow-bias={-0.0002}
      />

      {/* Fill light */}
      <directionalLight
        position={preset.fillPos || [-2.8, 1.8, 1.5]}
        intensity={preset.fillIntensity * 1.5}
        color={preset.fillColor}
      />

      {/* Rim / hair light */}
      <directionalLight
        position={preset.rimPos || [-1.0, 5.5, -4.0]}
        intensity={preset.rimIntensity * 1.2}
        color={preset.rimColor}
      />

      {/* Warm skin bounce point light */}
      <pointLight
        position={[0.2, 0.5, 1.6]}
        intensity={0.45}
        color={preset.keyColor}
        distance={4}
        decay={2}
      />

      {/* Dual teleprompter catchlights */}
      <pointLight
        position={[-0.32, 0.22, 1.25]}
        intensity={preset.catchlightIntensity * 0.08}
        color={preset.catchlightColor}
        distance={2.5}
        decay={2}
      />
      <pointLight
        position={[0.32, 0.22, 1.25]}
        intensity={preset.catchlightIntensity * 0.08}
        color={preset.catchlightColor}
        distance={2.5}
        decay={2}
      />

      {/* Ambient base */}
      <ambientLight intensity={preset.ambientIntensity} color={preset.ambientColor} />
    </>
  );
}

// ── Public component ──────────────────────────────────────────
export function VRMAvatar({
  vrmUrl = '/avatar.vrm',
  state = CHARACTER_STATES.IDLE,
  ttsAmplitude = 0,
  isSpeaking = false,
  currentSpeechText = '',
  activeWord = '',
  cameraMode = 'bust',
  studioLighting = 'keynote',
  audienceTracking = false,
  onTelemetryUpdate,
  onReady,
  onError: externalOnError,
  style,
  className,
}) {
  const [vrm, setVrm] = useState(null);
  const [framing, setFraming] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleLoad = useCallback((loadedVrm) => {
    // Compute framing from the loaded VRM scene bounding box
    const f = computeFraming(loadedVrm.scene, cameraMode);
    setFraming(f);
    setVrm(loadedVrm);
    setLoading(false);
    setError(null);
    onReady?.();
  }, [cameraMode, onReady]);

  const activeStudio = STUDIO_LIGHTING_PRESETS[studioLighting] || STUDIO_LIGHTING_PRESETS.keynote;

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {/* Rich cinematic background — dynamic per studio preset */}
      <div style={{
        position: 'absolute', inset: 0,
        background: activeStudio.bgGradient
          || 'radial-gradient(ellipse at 50% 40%, #1e1245 0%, #120c30 40%, #07040f 100%)',
        borderRadius: 'inherit',
        transition: 'background 0.8s ease',
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
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.45,   // elevated for vibrant, cinematic look
          outputColorSpace: 'srgb',
          preserveDrawingBuffer: false,
        }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        {/* Dynamic Broadcast Studio Lighting */}
        <StudioLighting presetId={studioLighting} />

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

        {framing && <CameraFramer framing={framing} cameraMode={cameraMode} />}

        {vrm && framing && (
          <VRMScene
            vrm={vrm}
            framing={framing}
            state={state}
            ttsAmplitude={ttsAmplitude}
            isSpeaking={isSpeaking}
            currentSpeechText={currentSpeechText}
            activeWord={activeWord}
            studioLighting={studioLighting}
            audienceTracking={audienceTracking}
            onTelemetryUpdate={onTelemetryUpdate}
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

