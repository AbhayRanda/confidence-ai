/**
 * CharacterScene.js  v4
 * ─────────────────────────────────────────────────────────────
 * Improvements in this version:
 *  • Step 1 — Smooth state color transitions (lerped RGB, no snap)
 *  • Step 2 — Dynamic particle system (count/speed/opacity per state)
 *             + DataStream falling particles for ANALYZING state
 *  • Step 3 — Touch / mobile support (touch parallax, mobile DPR,
 *             reduced particle counts on low-end devices)
 * ─────────────────────────────────────────────────────────────
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Float,
  Sparkles,
  ContactShadows,
  Environment,
} from '@react-three/drei';
import * as THREE from 'three';

import { CharacterMesh } from './CharacterController';
import { CHARACTER_STATES } from './CharacterAnimations';

// ── State → accent color ──────────────────────────────────────
const STATE_COLOR = {
  [CHARACTER_STATES.IDLE]:        '#50587a',
  [CHARACTER_STATES.LISTENING]:   '#22c55e',
  [CHARACTER_STATES.THINKING]:    '#f59e0b',
  [CHARACTER_STATES.ANALYZING]:   '#5b8def',
  [CHARACTER_STATES.TALKING]:     '#7c5cfc',
  [CHARACTER_STATES.HAPPY]:       '#22c55e',
  [CHARACTER_STATES.GREETING]:    '#5b8def',
  [CHARACTER_STATES.GESTURE]:     '#a78bfa',
  [CHARACTER_STATES.ENCOURAGING]: '#22c55e',
};

// ── Step 2: Particle config per state ────────────────────────
const PARTICLE_CONFIG = {
  [CHARACTER_STATES.IDLE]:        { count: 40,  speed: 0.12, opacity: 0.22, size: 1.0 },
  [CHARACTER_STATES.LISTENING]:   { count: 55,  speed: 0.20, opacity: 0.32, size: 1.1 },
  [CHARACTER_STATES.THINKING]:    { count: 35,  speed: 0.10, opacity: 0.18, size: 0.9 },
  [CHARACTER_STATES.ANALYZING]:   { count: 65,  speed: 0.35, opacity: 0.28, size: 0.8 },
  [CHARACTER_STATES.TALKING]:     { count: 70,  speed: 0.28, opacity: 0.38, size: 1.2 },
  [CHARACTER_STATES.HAPPY]:       { count: 100, speed: 0.45, opacity: 0.50, size: 1.4 },
  [CHARACTER_STATES.GREETING]:    { count: 80,  speed: 0.35, opacity: 0.42, size: 1.2 },
  [CHARACTER_STATES.GESTURE]:     { count: 60,  speed: 0.25, opacity: 0.30, size: 1.0 },
  [CHARACTER_STATES.ENCOURAGING]: { count: 90,  speed: 0.40, opacity: 0.45, size: 1.3 },
};

// ── Step 3: Mobile / low-end detection ───────────────────────
function detectMobile() {
  if (typeof window === 'undefined') return false;
  return (
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 768 ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  );
}

function detectLowEnd() {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  return cores <= 2;
}

// ── Smooth camera parallax ────────────────────────────────────
function CameraRig({ mousePosition }) {
  const { camera } = useThree();
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const tx = mousePosition.x * 0.10;
    const ty = mousePosition.y * 0.05 + 0.28;
    camera.position.x += (tx - camera.position.x) * dt * 2.2;
    camera.position.y += (ty - camera.position.y) * dt * 2.2;
    camera.lookAt(0, 0.08, 0);
  });
  return null;
}

// ── Cinematic scene lighting ──────────────────────────────────
function SceneLighting({ stateColor }) {
  const color = stateColor || '#7c5cfc';
  return (
    <>
      {/* Soft ambient */}
      <ambientLight intensity={0.28} color="#b8b0e0" />

      {/* Key light — warm front-left */}
      <directionalLight
        position={[-2.2, 3.5, 2.5]}
        intensity={1.8}
        color="#f0e8ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={25}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={4}
        shadow-camera-bottom={-1.5}
        shadow-bias={-0.0005}
      />

      {/* Fill light — cool front-right */}
      <directionalLight position={[2.8, 2.2, 1.8]} intensity={0.6} color="#b0c8ff" />

      {/* Rim / back light — state-driven accent (smoothly transitioned) */}
      <pointLight position={[0, 1.8, -3.0]} intensity={1.2} color={color} distance={7} decay={2} />

      {/* Ground bounce */}
      <pointLight position={[0, -1.2, 1.2]} intensity={0.30} color="#5b8def" distance={5} decay={2} />

      {/* Top crown light */}
      <spotLight
        position={[0, 4.5, 0.6]}
        angle={0.38}
        penumbra={0.9}
        intensity={0.65}
        color="#c0a0ff"
        target-position={[0, 0.35, 0]}
      />

      {/* Side accent — left */}
      <pointLight position={[-3.0, 0.5, 0]} intensity={0.18} color="#7c5cfc" distance={5} decay={2} />
      {/* Side accent — right */}
      <pointLight position={[ 3.0, 0.5, 0]} intensity={0.18} color="#5b8def" distance={5} decay={2} />
    </>
  );
}

// ── Holographic platform ──────────────────────────────────────
function HoloPlatform({ stateColor }) {
  const ring1Ref  = useRef();
  const ring2Ref  = useRef();
  const ring3Ref  = useRef();
  const beamRef   = useRef();
  const glowRef   = useRef();

  // Step 1: Smoothly transition platform color
  const currentColor = useRef(new THREE.Color(stateColor || '#7c5cfc'));
  const targetColor  = useRef(new THREE.Color(stateColor || '#7c5cfc'));

  const ringMat1 = useMemo(() => new THREE.MeshBasicMaterial({
    color: currentColor.current.clone(), transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  }), []);
  const ringMat2 = useMemo(() => new THREE.MeshBasicMaterial({
    color: currentColor.current.clone(), transparent: true, opacity: 0.30, side: THREE.DoubleSide,
  }), []);
  const ringMat3 = useMemo(() => new THREE.MeshBasicMaterial({
    color: currentColor.current.clone(), transparent: true, opacity: 0.15, side: THREE.DoubleSide,
  }), []);
  const beamMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: currentColor.current.clone(), transparent: true, opacity: 0.06, side: THREE.DoubleSide,
  }), []);
  const glowMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: currentColor.current.clone(), transparent: true, opacity: 0.12, side: THREE.DoubleSide,
  }), []);

  const diskGeo  = useMemo(() => new THREE.RingGeometry(0.28, 0.32, 64), []);
  const disk2Geo = useMemo(() => new THREE.RingGeometry(0.42, 0.44, 64), []);
  const disk3Geo = useMemo(() => new THREE.RingGeometry(0.58, 0.60, 64), []);
  const coneGeo  = useMemo(() => new THREE.CylinderGeometry(0.30, 0.01, 2.5, 32, 1, true), []);
  const baseGeo  = useMemo(() => new THREE.CircleGeometry(0.30, 64), []);

  useFrame((state, delta) => {
    const t  = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // Step 1: Lerp color toward target
    targetColor.current.set(stateColor || '#7c5cfc');
    currentColor.current.lerp(targetColor.current, 1 - Math.exp(-6 * dt));

    const c = currentColor.current;
    [ringMat1, ringMat2, ringMat3, beamMat, glowMat].forEach(m => m.color.copy(c));

    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.8;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.5;
    if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.3;
    // Beam pulse
    if (beamRef.current)  beamRef.current.material.opacity = 0.04 + Math.sin(t * 1.2) * 0.025;
    if (glowRef.current)  glowRef.current.material.opacity = 0.10 + Math.sin(t * 0.8) * 0.04;
  });

  const flatRot = useMemo(() => [-Math.PI / 2, 0, 0], []);

  // Cleanup
  useEffect(() => {
    return () => {
      [ringMat1, ringMat2, ringMat3, beamMat, glowMat,
       diskGeo, disk2Geo, disk3Geo, coneGeo, baseGeo].forEach(r => r.dispose?.());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group position={[0, -0.86, 0]}>
      {/* Glowing base disc */}
      <mesh ref={glowRef} geometry={baseGeo} material={glowMat} rotation={flatRot} />

      {/* Animated concentric rings */}
      <mesh ref={ring1Ref} geometry={diskGeo}  material={ringMat1} rotation={flatRot} />
      <mesh ref={ring2Ref} geometry={disk2Geo} material={ringMat2} rotation={flatRot} />
      <mesh ref={ring3Ref} geometry={disk3Geo} material={ringMat3} rotation={flatRot} />

      {/* Cone beam rising from platform */}
      <mesh ref={beamRef} geometry={coneGeo} material={beamMat} position={[0, 1.25, 0]} />
    </group>
  );
}

// ── Animated scan line ────────────────────────────────────────
function ScanLine({ stateColor }) {
  const ref = useRef();

  // Step 1: Smooth color transition
  const currentColor = useRef(new THREE.Color(stateColor || '#7c5cfc'));
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: currentColor.current.clone(),
    transparent: true, opacity: 0.08,
    side: THREE.DoubleSide,
  }), []);
  const geo = useMemo(() => new THREE.PlaneGeometry(1.2, 0.006), []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t  = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // Lerp color
    currentColor.current.lerp(new THREE.Color(stateColor || '#7c5cfc'), 1 - Math.exp(-6 * dt));
    mat.color.copy(currentColor.current);

    ref.current.position.y = -0.3 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 1.4;
    ref.current.material.opacity = 0.04 + Math.abs(Math.sin(t * 0.6)) * 0.06;
  });

  useEffect(() => () => { mat.dispose(); geo.dispose(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <mesh ref={ref} geometry={geo} material={mat} position={[0, 0, 0.4]} />;
}

// ── Step 2: Data Stream — falling lines for ANALYZING ─────────
function DataStream({ stateColor, active }) {
  const COUNT = 18;
  const streams = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    x:     (Math.random() - 0.5) * 1.8,
    z:     (Math.random() - 0.5) * 0.6,
    speed: 0.6 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
    len:   0.08 + Math.random() * 0.12,
    geo:   new THREE.PlaneGeometry(0.003, 0.08 + Math.random() * 0.12),
    mat:   new THREE.MeshBasicMaterial({
      color: stateColor || '#5b8def',
      transparent: true, opacity: 0,
      side: THREE.DoubleSide,
    }),
  })), []); // eslint-disable-line react-hooks/exhaustive-deps

  const refs = useRef(streams.map(() => React.createRef()));

  useFrame((state, delta) => {
    const t   = state.clock.elapsedTime;
    const dt  = Math.min(delta, 0.05);
    const col = new THREE.Color(stateColor || '#5b8def');
    streams.forEach((s, i) => {
      const mesh = refs.current[i]?.current;
      if (!mesh) return;
      s.mat.color.copy(col);
      const targetOpacity = active ? (0.15 + Math.abs(Math.sin(t * 0.8 + s.phase)) * 0.25) : 0;
      s.mat.opacity = THREE.MathUtils.lerp(s.mat.opacity, targetOpacity, 1 - Math.exp(-5 * dt));
      // Loop y position downward
      mesh.position.y = -0.9 + ((t * s.speed + s.phase) % 2.0) * 1.1;
    });
  });

  useEffect(() => () => {
    streams.forEach(s => { s.geo.dispose(); s.mat.dispose(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      {streams.map((s, i) => (
        <mesh
          key={i}
          ref={refs.current[i]}
          geometry={s.geo}
          material={s.mat}
          position={[s.x, 0, s.z]}
        />
      ))}
    </group>
  );
}

// ── Step 2: Dynamic sparkle params (lerped) ───────────────────
function DynamicSparkles({ stateColor, state, isMobile }) {
  const cfg    = PARTICLE_CONFIG[state] || PARTICLE_CONFIG[CHARACTER_STATES.IDLE];
  const reduce = isMobile ? 0.45 : 1;

  return (
    <>
      <Sparkles
        count={Math.round(cfg.count * reduce)}
        scale={[5, 5, 3]}
        size={cfg.size}
        speed={cfg.speed}
        opacity={cfg.opacity}
        color={stateColor}
        noise={0.3}
      />
      <Sparkles
        count={Math.round(cfg.count * 0.4 * reduce)}
        scale={[3.5, 4, 2.5]}
        size={cfg.size * 0.5}
        speed={cfg.speed * 1.4}
        opacity={cfg.opacity * 0.55}
        color="#a0b8ff"
        noise={0.5}
      />
    </>
  );
}


// ── Inner scene ───────────────────────────────────────────────
function InnerScene({ state, mousePosition, onReady, isMobile, audioAmplitude = 0, preset }) {
  const targetHex   = STATE_COLOR[state] || '#7c5cfc';
  const lerpedColor = useRef(new THREE.Color(targetHex));
  const [cssColor, setCssColor] = useState(targetHex);

  useEffect(() => {
    const t = setTimeout(() => onReady?.(), 850);
    return () => clearTimeout(t);
  }, [onReady]);

  // Step 1: Lerp color each frame and expose as string for Sparkles etc.
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = new THREE.Color(targetHex);
    lerpedColor.current.lerp(target, 1 - Math.exp(-5 * dt));
    const hex = '#' + lerpedColor.current.getHexString();
    setCssColor(hex);
  });

  const isAnalyzing = state === CHARACTER_STATES.ANALYZING;

  return (
    <>
      <CameraRig mousePosition={mousePosition} />
      <SceneLighting stateColor={cssColor} />

      {/* Subtle environment for specular highlights */}
      <Environment preset="night" />

      {/* Step 2: Dynamic particle field */}
      <DynamicSparkles stateColor={cssColor} state={state} isMobile={isMobile} />

      {/* Step 2: Data stream for ANALYZING state */}
      <DataStream stateColor={cssColor} active={isAnalyzing} />

      {/* Holographic platform base — Step 1: smooth color */}
      <HoloPlatform stateColor={cssColor} />

      {/* Animated scan-line overlay — Step 1: smooth color */}
      <ScanLine stateColor={cssColor} />

      {/* Soft contact shadow */}
      <ContactShadows
        position={[0, -0.86, 0]}
        opacity={0.55}
        scale={2.2}
        blur={2.5}
        far={1.2}
        color="#08080f"
      />

      {/* Character — gently floating */}
      <Float
        speed={1.4}
        rotationIntensity={0.04}
        floatIntensity={0.18}
        floatingRange={[-0.025, 0.025]}
      >
        <group position={[0, -0.42, 0]}>
          <CharacterMesh
            state={state}
            mousePosition={mousePosition}
            audioAmplitude={audioAmplitude}
            preset={preset}
          />
        </group>
      </Float>
    </>
  );
}

// ── Main exported wrapper ─────────────────────────────────────
export function CharacterScene({
  state = CHARACTER_STATES.IDLE,
  onReady,
  style,
  className,
  audioAmplitude = 0,
  preset,
}) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const canvasRef = useRef();

  // Step 3: Detect mobile once on mount
  const isMobile = useMemo(() => detectMobile(), []);
  const isLowEnd = useMemo(() => detectLowEnd(), []);

  // ── Mouse parallax ───────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePosition({
      x:  ((e.clientX - rect.left) / rect.width  - 0.5) * 2,
      y: -((e.clientY - rect.top)  / rect.height - 0.5) * 2,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePosition({ x: 0, y: 0 });
  }, []);

  // Step 3: Touch parallax support
  const handleTouchMove = useCallback((e) => {
    const rect  = canvasRef.current?.getBoundingClientRect();
    if (!rect || !e.touches.length) return;
    const touch = e.touches[0];
    setMousePosition({
      x:  ((touch.clientX - rect.left) / rect.width  - 0.5) * 2,
      y: -((touch.clientY - rect.top)  / rect.height - 0.5) * 2,
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    setMousePosition({ x: 0, y: 0 });
  }, []);

  // Step 3: DPR reduced for mobile / low-end devices
  const dpr = useMemo(() => {
    if (isLowEnd) return [0.6, 1.0];
    if (isMobile) return [0.75, 1.2];
    return [1, 1.5];
  }, [isMobile, isLowEnd]);

  return (
    <div
      ref={canvasRef}
      style={{ width: '100%', height: '100%', ...style }}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        shadows
        camera={{ position: [0, 0.28, 2.25], fov: 40, near: 0.1, far: 60 }}
        gl={{
          antialias:             !isLowEnd,
          alpha:                 true,
          powerPreference:       'high-performance',
          preserveDrawingBuffer: false,
          toneMapping:           THREE.ACESFilmicToneMapping,
          toneMappingExposure:   1.15,
        }}
        style={{ background: 'transparent' }}
        dpr={dpr}
      >
        <InnerScene
          state={state}
          mousePosition={mousePosition}
          onReady={onReady}
          isMobile={isMobile || isLowEnd}
          audioAmplitude={audioAmplitude}
          preset={preset}
        />
      </Canvas>
    </div>
  );
}

export default CharacterScene;
