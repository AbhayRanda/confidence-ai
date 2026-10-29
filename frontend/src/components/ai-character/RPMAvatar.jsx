/**
 * RPMAvatar.jsx
 * ─────────────────────────────────────────────────────────────
 * Realistic Humanoid Avatar powered by Ready Player Me (RPM) GLB models.
 * Replaces the anime Asuna GLB with a professional, realistic human coach.
 *
 * Features:
 *   • Loads any Ready Player Me .glb URL (CDN or local)
 *   • Correct RPM/Mixamo skeleton bone names (Hips, Spine, Head, etc.)
 *   • ARKit / Oculus Viseme morph targets for accurate lip-sync
 *   • Natural blinking, smiling, breathing, and head-tracking
 *   • Premium studio 3-point lighting setup
 *   • Unlocked by default — no "Coming Soon" gate
 * ─────────────────────────────────────────────────────────────
 */

import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
  Suspense,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
} from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { CHARACTER_STATES } from './CharacterAnimations';
import './GLBAvatar.css';

// ── Known public Ready Player Me avatar URLs ──────────────────
// ?morphTargets=ARKit,Oculus%20Visemes  → adds lip-sync blendshapes
// ?textureSizeLimit=1024                → faster load, smaller download
export const RPM_AVATARS = {
  female_pro: 'https://models.readyplayer.me/638df693d72bffc6fa17943c.glb?morphTargets=ARKit,Oculus%20Visemes&textureSizeLimit=1024',
  female_casual: 'https://models.readyplayer.me/64fe985bed76d4a88c9d2b32.glb?morphTargets=ARKit,Oculus%20Visemes&textureSizeLimit=1024',
  male_pro: 'https://models.readyplayer.me/6460d4fde4cdce71a1cb3600.glb?morphTargets=ARKit,Oculus%20Visemes&textureSizeLimit=1024',
};

const DEFAULT_RPM_URL = RPM_AVATARS.female_pro;

// ── ARKit / Oculus Viseme morph target names (RPM standard) ──
const MORPH = {
  jawOpen: 'jawOpen',
  mouthSmileLeft: 'mouthSmileLeft',
  mouthSmileRight: 'mouthSmileRight',
  eyeBlinkLeft: 'eyeBlinkLeft',
  eyeBlinkRight: 'eyeBlinkRight',
  browInnerUp: 'browInnerUp',
  browOuterUpLeft: 'browOuterUpLeft',
  browOuterUpRight: 'browOuterUpRight',
  viseme_aa: 'viseme_aa',
  viseme_E: 'viseme_E',
  viseme_I: 'viseme_I',
  viseme_O: 'viseme_O',
  viseme_U: 'viseme_U',
  viseme_PP: 'viseme_PP',
};

const VISEME_CYCLE = [
  MORPH.viseme_aa, MORPH.viseme_E, MORPH.viseme_O,
  MORPH.viseme_I, MORPH.viseme_U, MORPH.viseme_PP,
];

// ── Camera Presets ────────────────────────────────────────────
const CAMERA_PRESETS = {
  bust: {
    label: '👤 Bust',
    camYMult: 0.88,
    lookYMult: 0.80,
    distMult: 0.90,
    fov: 26,
  },
  full: {
    label: '🧍 Full',
    camYMult: 0.50,
    lookYMult: 0.48,
    distMult: 1.60,
    fov: 30,
  },
  closeup: {
    label: '🔍 Close-Up',
    camYMult: 0.95,
    lookYMult: 0.92,
    distMult: 0.55,
    fov: 22,
  },
};

// ── State → Animation priority list ───────────────────────────
function mapStateToAnimation(state, isSpeaking) {
  if (isSpeaking || state === CHARACTER_STATES.TALKING) {
    return ['Talking', 'Conversation', 'Standing Arguing', 'Idle'];
  }
  switch (state) {
    case CHARACTER_STATES.GESTURE:
    case CHARACTER_STATES.ANALYZING:
    case CHARACTER_STATES.ENCOURAGING:
      return ['Presentation', 'Standing Arguing', 'Talking', 'Idle'];
    case CHARACTER_STATES.HAPPY:
      return ['Happy', 'Cheering', 'Clapping', 'Idle'];
    case CHARACTER_STATES.GREETING:
      return ['Waving', 'Greeting', 'Happy', 'Idle'];
    case CHARACTER_STATES.LISTENING:
    case CHARACTER_STATES.THINKING:
    case CHARACTER_STATES.IDLE:
    default:
      return ['Idle', 'BreathingIdle', 'Standing', null];
  }
}

// ── Camera Director ────────────────────────────────────────────
function CameraDirector({ framing, cameraMode }) {
  const { camera } = useThree();
  const cfg = CAMERA_PRESETS[cameraMode] || CAMERA_PRESETS.bust;
  const targetPos = useRef(new THREE.Vector3(0, 1.5, 1.4));
  const targetLook = useRef(new THREE.Vector3(0, 1.3, 0));

  useEffect(() => {
    if (!framing) return;
    const h = framing.height || 1.70;
    const dist = h * cfg.distMult;
    const camY = framing.modelOffset.y + h * cfg.camYMult;
    const tarY = framing.modelOffset.y + h * cfg.lookYMult;
    targetPos.current.set(0, camY, dist);
    targetLook.current.set(0, tarY, 0);
    camera.fov = cfg.fov;
    camera.updateProjectionMatrix();
  }, [framing, cameraMode, cfg, camera]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    camera.position.lerp(targetPos.current, 4.5 * dt);
    camera.lookAt(targetLook.current);
  });

  return null;
}

// ── Helper: set a named morph target across all meshes ─────────
function setMorph(meshes, morphDict, name, value) {
  const idx = morphDict[name];
  if (idx === undefined) return;
  for (const m of meshes) {
    if (m.morphTargetInfluences && m.morphTargetInfluences.length > idx) {
      m.morphTargetInfluences[idx] = THREE.MathUtils.clamp(value, 0, 1);
    }
  }
}

// ── Main 3D Model Renderer ─────────────────────────────────────
function RPMCharacterModel({ glbUrl, state, isSpeaking, ttsAmplitude, onLoaded }) {
  const { scene, animations } = useGLTF(glbUrl);
  const groupRef = useRef();
  const { pointer } = useThree();

  // Clone scene with unique skeleton bindings
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          if (obj.material.roughness !== undefined)
            obj.material.roughness = Math.max(0.35, obj.material.roughness);
          if (obj.material.metalness !== undefined)
            obj.material.metalness = Math.min(0.15, obj.material.metalness);
          if (obj.material.envMapIntensity !== undefined)
            obj.material.envMapIntensity = 1.2;
        }
      }
    });
    return c;
  }, [scene]);

  // Auto-framing: center and compute height
  const framing = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const modelOffset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    return { modelOffset, height: size.y, cameraTarget: new THREE.Vector3(0, size.y * 0.80, 0) };
  }, [clone]);

  useEffect(() => {
    if (framing && onLoaded) onLoaded({ framing, animations });
  }, [framing, animations, onLoaded]);

  // Animation mixer
  const mixer = useMemo(() => new THREE.AnimationMixer(clone), [clone]);
  const actionsMap = useMemo(() => {
    const map = {};
    animations.forEach((clip) => { map[clip.name] = mixer.clipAction(clip); });
    return map;
  }, [animations, mixer]);

  const currentActionRef = useRef(null);

  useEffect(() => {
    const priorities = mapStateToAnimation(state, isSpeaking);
    let nextAction = null;
    for (const name of priorities) {
      if (!name) break;
      const found = Object.entries(actionsMap).find(([k]) =>
        k.toLowerCase().includes(name.toLowerCase())
      );
      if (found) { nextAction = found[1]; break; }
    }
    if (!nextAction) nextAction = Object.values(actionsMap)[0];
    if (!nextAction) return;
    if (currentActionRef.current && currentActionRef.current !== nextAction) {
      currentActionRef.current.fadeOut(0.4);
    }
    nextAction.reset().fadeIn(0.4).play();
    currentActionRef.current = nextAction;
  }, [state, isSpeaking, actionsMap]);

  // Bone refs for head tracking
  const headBone = useMemo(() =>
    clone.getObjectByName('Head') || clone.getObjectByName('head'), [clone]);
  const neckBone = useMemo(() =>
    clone.getObjectByName('Neck') || clone.getObjectByName('neck'), [clone]);
  const spineBone = useMemo(() =>
    clone.getObjectByName('Spine1') || clone.getObjectByName('Spine'), [clone]);

  // Morph target meshes and dictionary
  const morphMeshes = useMemo(() => {
    const list = [];
    clone.traverse((obj) => {
      if (obj.isMesh && obj.morphTargetInfluences?.length > 0) list.push(obj);
    });
    return list;
  }, [clone]);

  const morphDict = useMemo(() => {
    const dict = {};
    for (const mesh of morphMeshes) {
      if (!mesh.morphTargetDictionary) continue;
      Object.entries(mesh.morphTargetDictionary).forEach(([name, idx]) => {
        dict[name] = idx;
      });
    }
    return dict;
  }, [morphMeshes]);

  // Animation state refs
  const jawValRef = useRef(0);
  const blinkTimerRef = useRef(2.5 + Math.random() * 2);
  const blinkLeftRef = useRef(0);
  const blinkRightRef = useRef(0);
  const smileRef = useRef(0);
  const browRef = useRef(0);
  const visemePhaseRef = useRef(0);
  const visemeTimerRef = useRef(0);
  const visemeIdxRef = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);

    // 1. Skeleton animation
    mixer.update(dt);

    // 2. Head tracking
    if (headBone) {
      const tx = THREE.MathUtils.clamp(-pointer.y * 0.18, -0.25, 0.25);
      const ty = THREE.MathUtils.clamp(pointer.x * 0.22, -0.35, 0.35);
      headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, tx, dt * 4.5);
      headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, ty, dt * 4.5);
    }
    if (neckBone) {
      neckBone.rotation.y = THREE.MathUtils.lerp(neckBone.rotation.y, pointer.x * 0.08, dt * 3);
    }
    if (spineBone) {
      const breathe = Math.sin(clock.getElapsedTime() * 0.8) * 0.005;
      spineBone.rotation.x = THREE.MathUtils.lerp(spineBone.rotation.x, breathe, dt * 2);
    }

    // 3. Lip-sync / Viseme
    const speaking = isSpeaking || ttsAmplitude > 0.04;
    if (speaking) {
      const amp = Math.max(ttsAmplitude || 0.35, 0.15);
      const time = clock.getElapsedTime();
      const jawTarget = Math.min(0.75, amp * (0.5 + 0.5 * Math.sin(time * 14)));
      jawValRef.current = THREE.MathUtils.lerp(jawValRef.current, jawTarget, dt * 18);

      visemeTimerRef.current -= dt;
      if (visemeTimerRef.current <= 0) {
        visemeTimerRef.current = 0.08 + Math.random() * 0.12;
        visemeIdxRef.current = (visemeIdxRef.current + 1) % VISEME_CYCLE.length;
      }
      visemePhaseRef.current = THREE.MathUtils.lerp(visemePhaseRef.current, amp * 0.7, dt * 12);
    } else {
      jawValRef.current = THREE.MathUtils.lerp(jawValRef.current, 0, dt * 14);
      visemePhaseRef.current = THREE.MathUtils.lerp(visemePhaseRef.current, 0, dt * 10);
    }

    // 4. Blinking
    blinkTimerRef.current -= dt;
    if (blinkTimerRef.current <= 0) {
      blinkLeftRef.current = 1.0;
      blinkRightRef.current = 1.0;
      blinkTimerRef.current = 2.0 + Math.random() * 4.0;
    }
    blinkLeftRef.current = THREE.MathUtils.lerp(blinkLeftRef.current, 0, dt * 18);
    blinkRightRef.current = THREE.MathUtils.lerp(blinkRightRef.current, 0, dt * 18);

    // 5. Emotional expressions
    const smiling = [CHARACTER_STATES.HAPPY, CHARACTER_STATES.ENCOURAGING, CHARACTER_STATES.GREETING].includes(state);
    const attentive = state === CHARACTER_STATES.LISTENING || state === CHARACTER_STATES.THINKING;
    smileRef.current = THREE.MathUtils.lerp(smileRef.current, smiling ? 0.65 : 0.0, dt * 4);
    browRef.current = THREE.MathUtils.lerp(browRef.current, attentive ? 0.45 : 0.0, dt * 3);

    // 6. Apply morphs
    setMorph(morphMeshes, morphDict, MORPH.jawOpen, jawValRef.current);
    setMorph(morphMeshes, morphDict, MORPH.eyeBlinkLeft, blinkLeftRef.current);
    setMorph(morphMeshes, morphDict, MORPH.eyeBlinkRight, blinkRightRef.current);
    setMorph(morphMeshes, morphDict, MORPH.mouthSmileLeft, smileRef.current);
    setMorph(morphMeshes, morphDict, MORPH.mouthSmileRight, smileRef.current);
    setMorph(morphMeshes, morphDict, MORPH.browInnerUp, browRef.current);
    setMorph(morphMeshes, morphDict, MORPH.browOuterUpLeft, browRef.current * 0.6);
    setMorph(morphMeshes, morphDict, MORPH.browOuterUpRight, browRef.current * 0.6);

    VISEME_CYCLE.forEach((vName, i) => {
      const isActive = (i === visemeIdxRef.current) && speaking;
      setMorph(morphMeshes, morphDict, vName, isActive ? visemePhaseRef.current : 0);
    });
  });

  return (
    <primitive
      ref={groupRef}
      object={clone}
      position={[framing.modelOffset.x, framing.modelOffset.y, framing.modelOffset.z]}
    />
  );
}

// ── Error Boundary ─────────────────────────────────────────────
class ModelErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    // Suppress React dev-mode overlay for expected network errors
    // (fetch fails are caught here; they'll show in dev overlay but are harmless)
    const msg = error?.message || '';
    const isNetworkError = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS');
    if (!isNetworkError) {
      console.error('[RPMAvatar] Unexpected 3D error:', error, info);
    }
    this.props.onError?.(msg || '3D model failed to load');
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ── RPMAvatar — Top-Level Export ───────────────────────────────
export function RPMAvatar({
  glbUrl = DEFAULT_RPM_URL,
  state = CHARACTER_STATES.IDLE,
  isSpeaking = false,
  isListening = false,
  ttsAmplitude = 0,
  onSwitchAvatar,
  onReady,
  onError,
  className = '',
  style = {},
}) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [framingData, setFramingData] = useState(null);
  const [availableClips, setAvailableClips] = useState([]);
  const [cameraMode, setCameraMode] = useState('bust');
  // Track whether we can even attempt to fetch the CDN model
  const [canLoad, setCanLoad] = useState(false);

  // ── Connectivity pre-check ─────────────────────────────────
  // Test reachability of the RPM CDN before mounting useGLTF.
  // This prevents the React dev overlay from firing for a simple offline error.
  useEffect(() => {
    let cancelled = false;

    // Fast-fail if browser reports offline
    if (!navigator.onLine) {
      setErrorMsg('No internet connection — RPM avatar requires online access.');
      setLoading(false);
      onError?.('No internet connection');
      return;
    }

    // HEAD request to confirm CDN is reachable
    const baseUrl = glbUrl.split('?')[0];
    fetch(baseUrl, { method: 'HEAD', mode: 'no-cors' })
      .then(() => {
        if (!cancelled) setCanLoad(true);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg('Could not reach Ready Player Me CDN. Check your internet connection.');
          setLoading(false);
          onError?.('CDN unreachable');
        }
      });

    return () => { cancelled = true; };
  }, [glbUrl, onError]);

  const handleError = useCallback((msg) => {
    setErrorMsg(msg || 'Failed to load 3D model');
    setLoading(false);
    onError?.(msg);
  }, [onError]);

  const handleModelLoaded = useCallback(({ framing, animations }) => {
    setFramingData(framing);
    setAvailableClips(animations.map((a) => a.name));
    setLoading(false);
    onReady?.();
  }, [onReady]);

  return (
    <div className={`glb-avatar-root ${className}`} style={style}>
      <div className="glb-avatar-ambient" />

      {/* Top bar */}
      <div className="glb-director-bar">
        <div className="glb-badge-tag">
          <span className="glb-live-dot" />
          <span>AI Coach · Realistic</span>
          {isSpeaking && (
            <span className="glb-speech-wave" title="Speaking">
              <span className="glb-wave-bar" />
              <span className="glb-wave-bar" />
              <span className="glb-wave-bar" />
            </span>
          )}
          {isListening && !isSpeaking && (
            <span style={{ fontSize: 11, marginLeft: 6, color: '#22c55e', fontWeight: 600 }}>
              👂 Listening
            </span>
          )}
        </div>
        <div className="glb-camera-group">
          {Object.entries(CAMERA_PRESETS).map(([key, val]) => (
            <button
              key={key}
              className={`glb-cam-btn${cameraMode === key ? ' glb-cam-btn--active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setCameraMode(key); }}
              title={`${val.label} Shot`}
            >
              {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && !errorMsg && (
        <div className="glb-loading-overlay">
          <div className="glb-spinner" />
          <div className="glb-loading-title">Loading Human Coach…</div>
          <div className="glb-loading-sub">Fetching realistic 3D model</div>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="glb-loading-overlay">
          <span style={{ fontSize: 36 }}>⚠️</span>
          <div className="glb-loading-title">Could Not Load Model</div>
          <div className="glb-loading-sub">{errorMsg}</div>
          {onSwitchAvatar && (
            <button className="glb-switch-back-btn" style={{ marginTop: 14 }}
              onClick={(e) => { e.stopPropagation(); onSwitchAvatar(); }}>
              ↩ Switch to VRM Avatar
            </button>
          )}
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        className="glb-avatar-canvas"
        camera={{ position: [0, 1.5, 1.4], fov: 26 }}
        gl={{
          antialias: true, alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
          outputColorSpace: 'srgb',
        }}
        dpr={Math.min(window.devicePixelRatio || 1, 2)}
      >
        {/* Premium 3-point studio lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[1.5, 3.5, 2]} intensity={1.8} color="#fff4de" castShadow />
        <directionalLight position={[-2, 2, 1]} intensity={0.75} color="#b8d4ff" />
        <directionalLight position={[0, 2.5, -3]} intensity={0.9} color="#c084fc" />
        <pointLight position={[0, -0.5, 1.5]} intensity={0.3} color="#fde68a" />

        <Suspense fallback={null}>
          <Environment preset="studio" />
        </Suspense>

        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.45}
          scale={2.5}
          blur={1.8}
          far={2.2}
          color="#050210"
        />

        {framingData && <CameraDirector framing={framingData} cameraMode={cameraMode} />}

        {/* Only mount model loader after connectivity is confirmed */}
        {canLoad && (
          <Suspense fallback={null}>
            <ModelErrorBoundary onError={handleError}>
              <RPMCharacterModel
                glbUrl={glbUrl}
                state={state}
                isSpeaking={isSpeaking}
                ttsAmplitude={ttsAmplitude}
                onLoaded={handleModelLoaded}
              />
            </ModelErrorBoundary>
          </Suspense>
        )}

        <OrbitControls
          enabled={!loading && !errorMsg}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 1.7}
          target={framingData ? [framingData.cameraTarget.x, framingData.cameraTarget.y, framingData.cameraTarget.z] : [0, 1.3, 0]}
          autoRotate={false}
        />
      </Canvas>

      {!loading && !errorMsg && availableClips.length > 0 && (
        <div className="glb-anim-bar" onClick={(e) => e.stopPropagation()}>
          <span className="glb-anim-label">Animations:</span>
          <span className="glb-anim-pill glb-anim-pill--active">
            ⚡ {availableClips.length} clips loaded
          </span>
        </div>
      )}
    </div>
  );
}

export default RPMAvatar;
