/**
 * GLBAvatar.jsx
 * ─────────────────────────────────────────────────────────────
 * Real-time 3D Humanoid Avatar loaded from .GLB (Asuna 3D character).
 * Replaces Rive with a full interactive 3D model.
 *
 * Features:
 *   • Loads any standard glTF/GLB humanoid model (e.g., /asuna.glb)
 *   • Auto-framing: automatically bounds and centers the model,
 *     supporting Bust Shot, Full Body, and Close-Up camera presets.
 *   • Dynamic Animations: Smooth cross-fading across embedded clips
 *     (001Idle, 009Conversation, xxxPresentation, 002Walk, 003Run, etc.)
 *   • Reactive Lip-Sync & Morphs: Drives facial morph blendshapes
 *     (jaw open, natural blink, smiles) reacting to speech amplitude.
 *   • Mouse-tracking Parallax: Subtly orients head bone towards cursor.
 *   • Cinematic Broadcast Studio 3-point lighting + soft contact shadows.
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
import { OrbitControls, Environment, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { CHARACTER_STATES } from './CharacterAnimations';
import './GLBAvatar.css';

const DEFAULT_GLB_URL = '/asuna.glb';

// Pre-warm the cache for snappy loading
try {
  useGLTF.preload(DEFAULT_GLB_URL);
} catch {
  // Ignore in non-browser environments
}

// ── Camera Shot Configurations ───────────────────────────────
const CAMERA_PRESETS = {
  bust: {
    label: '👤 Bust',
    camYMult: 0.88,
    lookYMult: 0.82,
    distMult: 0.95,
    fov: 28,
  },
  full: {
    label: '🧍 Full',
    camYMult: 0.55,
    lookYMult: 0.50,
    distMult: 1.75,
    fov: 34,
  },
  closeup: {
    label: '🔍 Portrait',
    camYMult: 0.90,
    lookYMult: 0.88,
    distMult: 0.60,
    fov: 24,
  },
};

// ── State-to-Clip Heuristic Mapper ───────────────────────────
function mapStateToClipName(state, isSpeaking) {
  if (isSpeaking || state === CHARACTER_STATES.TALKING) {
    return '009Conversation';
  }
  switch (state) {
    case CHARACTER_STATES.GESTURE:
    case CHARACTER_STATES.ANALYZING:
    case CHARACTER_STATES.ENCOURAGING:
      return 'xxxPresentation';
    case CHARACTER_STATES.HAPPY:
    case CHARACTER_STATES.GREETING:
      return 'xxxPresentation';
    case CHARACTER_STATES.LISTENING:
    case CHARACTER_STATES.THINKING:
    case CHARACTER_STATES.IDLE:
    default:
      return '001Idle';
  }
}

// ── Model Error Boundary ─────────────────────────────────────
class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    this.props.onError?.(error?.message || 'Failed to initialize 3D character');
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ── Smooth Camera Director Controller ────────────────────────
function CameraDirector({ framing, cameraMode }) {
  const { camera } = useThree();
  const cfg = CAMERA_PRESETS[cameraMode] || CAMERA_PRESETS.bust;
  const targetPos = useRef(new THREE.Vector3(0, 1.4, 1.5));
  const targetLook = useRef(new THREE.Vector3(0, 1.3, 0));

  useEffect(() => {
    if (!framing) return;
    const height = framing.height || 1.65;
    const dist = height * cfg.distMult;
    const camY = framing.modelOffset.y + height * cfg.camYMult;
    const targY = framing.modelOffset.y + height * cfg.lookYMult;

    targetPos.current.set(0, camY, dist);
    targetLook.current.set(0, targY, 0);
    camera.fov = cfg.fov;
    camera.updateProjectionMatrix();
  }, [framing, cameraMode, cfg, camera]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    camera.position.lerp(targetPos.current, 4.0 * dt);
    camera.lookAt(targetLook.current);
  });

  return null;
}

// ── Internal 3D Character Model Renderer ─────────────────────
function CharacterModel({
  glbUrl,
  state,
  isSpeaking,
  ttsAmplitude,
  activeClipOverride,
  onLoaded,
}) {
  const { scene, animations } = useGLTF(glbUrl);
  const groupRef = useRef();
  const { pointer } = useThree();

  // Clone scene with unique skeleton bindings
  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material.roughness = Math.max(0.3, obj.material.roughness || 0.45);
          obj.material.metalness = Math.min(0.2, obj.material.metalness || 0.1);
        }
      }
    });
    return cloned;
  }, [scene]);

  // Compute framing & height offset
  const framing = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const modelOffset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    return {
      modelOffset,
      height: size.y,
      cameraTarget: new THREE.Vector3(0, size.y * 0.82, 0),
    };
  }, [clone]);

  // Notify parent on framing ready
  useEffect(() => {
    if (framing && onLoaded) {
      onLoaded({ framing, animations });
    }
  }, [framing, animations, onLoaded]);

  // Setup Animation Mixer
  const mixer = useMemo(() => new THREE.AnimationMixer(clone), [clone]);
  const actionsMap = useMemo(() => {
    const map = {};
    animations.forEach((clip) => {
      map[clip.name] = mixer.clipAction(clip);
    });
    return map;
  }, [animations, mixer]);

  const currentActionRef = useRef(null);

  // Crossfade between animations smoothly
  useEffect(() => {
    const targetClipName = activeClipOverride || mapStateToClipName(state, isSpeaking);
    const nextAction =
      actionsMap[targetClipName] ||
      actionsMap['001Idle'] ||
      Object.values(actionsMap)[0];

    if (!nextAction) return;

    if (currentActionRef.current && currentActionRef.current !== nextAction) {
      currentActionRef.current.fadeOut(0.35);
    }
    nextAction.reset().fadeIn(0.35).play();
    currentActionRef.current = nextAction;
  }, [state, isSpeaking, activeClipOverride, actionsMap]);

  // Find head & neck bones for mouse-look tracking
  const headBone = useMemo(() => clone.getObjectByName('Head_021'), [clone]);
  const neckBone = useMemo(() => clone.getObjectByName('Neck_020'), [clone]);

  // Find meshes with facial morph targets
  const morphMeshes = useMemo(() => {
    const list = [];
    clone.traverse((obj) => {
      if (obj.isMesh && obj.morphTargetInfluences && obj.morphTargetInfluences.length > 0) {
        list.push(obj);
      }
    });
    return list;
  }, [clone]);

  // Blendshape animation state refs
  const jawValRef = useRef(0);
  const blinkTimerRef = useRef(3.0);
  const blinkValRef = useRef(0);
  const smileValRef = useRef(0);

  // Main per-frame animation loop
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);

    // 1. Advance skeleton animation
    mixer.update(dt);

    // 2. Mouse tracking on head/neck
    if (headBone) {
      const targetLookX = THREE.MathUtils.clamp(-pointer.y * 0.22, -0.3, 0.3);
      const targetLookY = THREE.MathUtils.clamp(pointer.x * 0.28, -0.4, 0.4);
      headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, targetLookX, dt * 4);
      headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, targetLookY, dt * 4);
    }
    if (neckBone) {
      neckBone.rotation.y = THREE.MathUtils.lerp(neckBone.rotation.y, pointer.x * 0.1, dt * 3);
    }

    // 3. Lip-Sync & Jaw Morphs (Targets 8 and 9)
    const speakingActive = isSpeaking || ttsAmplitude > 0.05;
    let targetJaw = 0;
    if (speakingActive) {
      const time = clock.getElapsedTime();
      const syllabicPulse = Math.sin(time * 16) * 0.5 + 0.5;
      const amp = Math.max(ttsAmplitude || 0.4, 0.2);
      targetJaw = Math.min(0.85, amp * syllabicPulse * 1.1);
    }
    jawValRef.current = THREE.MathUtils.lerp(jawValRef.current, targetJaw, dt * 20);

    // 4. Natural Blinking (Targets 0 and 1)
    blinkTimerRef.current -= dt;
    if (blinkTimerRef.current <= 0) {
      blinkValRef.current = 1.0;
      blinkTimerRef.current = 2.5 + Math.random() * 3.5;
    }
    blinkValRef.current = THREE.MathUtils.lerp(blinkValRef.current, 0, dt * 14);

    // 5. Smiling (Targets 4 and 5)
    const shouldSmile = [
      CHARACTER_STATES.HAPPY,
      CHARACTER_STATES.ENCOURAGING,
      CHARACTER_STATES.GREETING,
    ].includes(state);
    smileValRef.current = THREE.MathUtils.lerp(
      smileValRef.current,
      shouldSmile ? 0.6 : 0.0,
      dt * 5
    );

    // Apply morph targets to all facial meshes
    for (let i = 0; i < morphMeshes.length; i++) {
      const influences = morphMeshes[i].morphTargetInfluences;
      if (!influences) continue;
      // Blinking: 0, 1
      if (influences.length > 1) {
        influences[0] = blinkValRef.current;
        influences[1] = blinkValRef.current;
      }
      // Smiling: 4, 5
      if (influences.length > 5) {
        influences[4] = smileValRef.current;
        influences[5] = smileValRef.current;
      }
      // Jaw Opening: 8, 9
      if (influences.length > 9) {
        influences[8] = jawValRef.current;
        influences[9] = jawValRef.current;
      }
    }
  });

  return (
    <primitive
      ref={groupRef}
      object={clone}
      position={[framing.modelOffset.x, framing.modelOffset.y, framing.modelOffset.z]}
    />
  );
}

// ── Top-level GLBAvatar Component ─────────────────────────────
export function GLBAvatar({
  glbUrl = DEFAULT_GLB_URL,
  state = CHARACTER_STATES.IDLE,
  isSpeaking = false,
  isListening = false,
  ttsAmplitude = 0,
  currentSpeechText = '',
  isComingSoon = true,
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
  const [activeClipOverride, setActiveClipOverride] = useState(null);
  const [cameraMode, setCameraMode] = useState('bust');

  const handleError = useCallback(
    (msg) => {
      setErrorMsg(msg);
      setLoading(false);
      onError?.(msg);
    },
    [onError]
  );

  const handleModelLoaded = useCallback(
    ({ framing, animations }) => {
      setFramingData(framing);
      const clipNames = animations.map((a) => a.name);
      setAvailableClips(clipNames);
      setLoading(false);
      if (onReady) onReady();
    },
    [onReady]
  );

  // Key clips to display in quick-access bar
  const highlightClips = useMemo(() => {
    const list = [
      { id: '001Idle', label: '🧘 Idle' },
      { id: '009Conversation', label: '💬 Chat' },
      { id: 'xxxPresentation', label: '🗣️ Present' },
      { id: '002Walk', label: '🚶 Walk' },
      { id: '003Run', label: '🏃 Run' },
      { id: '004Jump', label: '🦘 Jump' },
    ];
    return list.filter((item) => availableClips.includes(item.id));
  }, [availableClips]);

  return (
    <div className={`glb-avatar-root ${className}`} style={style}>
      {/* Ambient background glow */}
      <div className="glb-avatar-ambient" />

      {/* Top Director Bar (only when unlocked) */}
      {!isComingSoon && (
        <div className="glb-director-bar">
          <div className="glb-badge-tag">
            <span className="glb-live-dot" />
            <span>Asuna 3D</span>
            {isSpeaking && (
              <span className="glb-speech-wave" title="Speaking">
                <span className="glb-wave-bar" />
                <span className="glb-wave-bar" />
                <span className="glb-wave-bar" />
              </span>
            )}
          </div>

          {/* Camera Shot Selector */}
          <div className="glb-camera-group">
            {Object.entries(CAMERA_PRESETS).map(([key, val]) => (
              <button
                key={key}
                className={`glb-cam-btn${cameraMode === key ? ' glb-cam-btn--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCameraMode(key);
                }}
                title={`${val.label} Shot`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Screen */}
      {loading && !errorMsg && (
        <div className="glb-loading-overlay">
          <div className="glb-spinner" />
          <div className="glb-loading-title">Loading 3D Character…</div>
          <div className="glb-loading-sub">Initializing animations & blendshapes</div>
        </div>
      )}

      {/* Error Screen */}
      {errorMsg && (
        <div className="glb-loading-overlay">
          <span style={{ fontSize: 32 }}>⚠️</span>
          <div className="glb-loading-title">Failed to load 3D Model</div>
          <div className="glb-loading-sub">{errorMsg}</div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        className="glb-avatar-canvas"
        camera={{ position: [0, 1.4, 1.5], fov: 28 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
          outputColorSpace: 'srgb',
        }}
        dpr={Math.min(window.devicePixelRatio || 1, 2)}
      >
        {/* Studio 3-Point Lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={1.5} color="#fff6e8" castShadow />
        <directionalLight position={[-2, 2, -1]} intensity={0.8} color="#9ec5fe" />
        <pointLight position={[0, 2, 2]} intensity={0.6} color="#ffffff" />
        <directionalLight position={[0, 3, -3]} intensity={1.2} color="#f472b6" />

        {/* Environment reflections */}
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        {/* Soft Contact Shadow beneath character */}
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.5}
          scale={2.2}
          blur={1.6}
          far={2.0}
          color="#060212"
        />

        {/* Camera Director */}
        {framingData && (
          <CameraDirector framing={framingData} cameraMode={cameraMode} />
        )}

        {/* 3D Model with Animations */}
        <Suspense fallback={null}>
          <ModelErrorBoundary onError={handleError}>
            <CharacterModel
              glbUrl={glbUrl}
              state={state}
              isSpeaking={isSpeaking}
              ttsAmplitude={ttsAmplitude}
              activeClipOverride={activeClipOverride}
              onLoaded={handleModelLoaded}
            />
          </ModelErrorBoundary>
        </Suspense>

        {/* Smooth OrbitControls (disabled when coming soon) */}
        <OrbitControls
          enabled={!isComingSoon}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3.2}
          maxPolarAngle={Math.PI / 1.8}
          target={
            framingData
              ? [framingData.cameraTarget.x, framingData.cameraTarget.y, framingData.cameraTarget.z]
              : [0, 1.3, 0]
          }
          autoRotate={false}
        />
      </Canvas>

      {/* Bottom Animation Selector Bar (only when unlocked) */}
      {!isComingSoon && highlightClips.length > 0 && (
        <div className="glb-anim-bar" onClick={(e) => e.stopPropagation()}>
          <span className="glb-anim-label">Motion:</span>
          <button
            className={`glb-anim-pill${activeClipOverride === null ? ' glb-anim-pill--active' : ''}`}
            onClick={() => setActiveClipOverride(null)}
            title="Automatically sync motion to AI conversation state"
          >
            ⚡ Auto Sync
          </button>
          {highlightClips.map((clip) => (
            <button
              key={clip.id}
              className={`glb-anim-pill${activeClipOverride === clip.id ? ' glb-anim-pill--active' : ''}`}
              onClick={() => setActiveClipOverride(clip.id)}
            >
              {clip.label}
            </button>
          ))}
        </div>
      )}

      {/* Frosted Glass Coming Soon Overlay */}
      {isComingSoon && (
        <div className="glb-locked-backdrop" onClick={(e) => e.stopPropagation()}>
          <div className="glb-locked-card">
            <div className="glb-locked-glow-accent" />

            <div className="glb-locked-icon-badge">
              <svg
                className="glb-lock-svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <span className="glb-locked-status-tag">
              🔒 Coming Soon • v2.0
            </span>

            <h3 className="glb-locked-title">Asuna 3D Character</h3>

            <p className="glb-locked-desc">
              Advanced 3D humanoid mentoring is currently in development. Interactive controls and speech reactions will unlock in the upcoming release.
            </p>

            <div className="glb-locked-features">
              <span className="glb-feature-chip">✨ High-Poly 3D Mesh</span>
              <span className="glb-feature-chip">🎙️ Sync Audio Visemes</span>
              <span className="glb-feature-chip">⚡ 15 Motion States</span>
            </div>

            {onSwitchAvatar && (
              <button
                className="glb-switch-back-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwitchAvatar();
                }}
              >
                <span>🔄 Switch to Active Avatar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GLBAvatar;
