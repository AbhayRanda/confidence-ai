/**
 * useLiveVision.js
 * ─────────────────────────────────────────────────────────────
 * Custom React hook managing live webcam stream and client-side
 * vision analysis using Google MediaPipe Tasks Vision (WASM).
 *
 * Capabilities (all running 100% in-browser, zero subscriptions):
 *   • FaceLandmarker  — 478-point face mesh, smile detection,
 *                       eye gaze/contact, head pose (pitch/yaw/roll)
 *   • GestureRecognizer — hand gesture classification
 *                        (Thumb_Up, Open_Palm, Victory, Pointing_Up, etc.)
 *   • ObjectDetector  — detect everyday objects (phone, cup, etc.)
 *
 * Usage:
 *   const vision = useLiveVision({ enabled, videoRef, canvasRef });
 *
 *   vision.isReady          — all models loaded
 *   vision.isLoading        — models are loading
 *   vision.error            — error string if loading failed
 *   vision.faceData         — { smiling, eyeContact, headPose, blendshapes }
 *   vision.gesture          — { name, score } or null
 *   vision.detectedObjects  — [{ label, score, box: {x,y,w,h} }]
 *   vision.fps              — current processing FPS
 *   vision.startDetection() — begin RAF loop
 *   vision.stopDetection()  — stop RAF loop
 *   vision.drawOverlays()   — render HUD to canvasRef
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ── MediaPipe WASM CDN base (pinned to match installed package version 0.10.17) ──
const VISION_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';

// ── Smile detection config ───────────────────────────────────
const SMILE_THRESHOLD       = 0.35;
const EYE_CONTACT_THRESHOLD = 0.25; // blendshape: eyeLookOutLeft/Right low

// ── Gesture labels we care about ─────────────────────────────
const GESTURE_LABELS = {
  Thumb_Up:    '👍 Thumbs Up',
  Thumb_Down:  '👎 Thumbs Down',
  Open_Palm:   '✋ Open Palm',
  Closed_Fist: '✊ Fist',
  Victory:     '✌️ Victory',
  Pointing_Up: '☝️ Pointing Up',
  ILoveYou:    '🤟 I Love You',
};

// ── HUD drawing colors ───────────────────────────────────────
const HUD_COLORS = {
  facePoint:  'rgba(124, 92, 252, 0.5)',
  faceLine:   'rgba(124, 92, 252, 0.15)',
  gestureBox: 'rgba(34, 197, 94, 0.8)',
  objectBox:  'rgba(91, 141, 239, 0.8)',
  text:       '#f0f2ff',
  textBg:     'rgba(0, 0, 0, 0.6)',
};

export function useLiveVision({ enabled = true, videoRef, canvasRef } = {}) {
  const [isReady,   setIsReady]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState(null);
  const [faceData,  setFaceData]  = useState(null);
  const [gesture,   setGesture]   = useState(null);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [fps,       setFps]       = useState(0);

  // Internal refs
  const faceLandmarkerRef     = useRef(null);
  const gestureRecognizerRef  = useRef(null);
  const objectDetectorRef     = useRef(null);
  const rafIdRef              = useRef(null);
  const lastFrameTimeRef      = useRef(0);
  const fpsCounterRef         = useRef({ frames: 0, lastTick: 0 });
  const runningRef            = useRef(false);
  const visionModuleRef       = useRef(null);

  // ── Load MediaPipe WASM models ─────────────────────────────
  const loadModels = useCallback(async () => {
    if (isReady || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import to keep initial bundle small
      const vision = await import('@mediapipe/tasks-vision');
      visionModuleRef.current = vision;

      const { FilesetResolver, FaceLandmarker, GestureRecognizer, ObjectDetector } = vision;

      const fileset = await FilesetResolver.forVisionTasks(VISION_WASM_CDN);

      // Helper to try GPU first, then fallback to CPU if GPU initialization fails
      const createWithFallback = async (ModelClass, options) => {
        try {
          return await ModelClass.createFromOptions(fileset, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'GPU' },
          });
        } catch (gpuErr) {
          console.warn(`[useLiveVision] GPU delegate failed for ${ModelClass.name || 'model'}, falling back to CPU:`, gpuErr);
          return await ModelClass.createFromOptions(fileset, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'CPU' },
          });
        }
      };

      // Load models with fallback
      const [faceLandmarker, gestureRecognizer, objectDetector] = await Promise.all([
        createWithFallback(FaceLandmarker, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        }),
        createWithFallback(GestureRecognizer, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        }),
        createWithFallback(ObjectDetector, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
          },
          runningMode: 'VIDEO',
          maxResults: 5,
          scoreThreshold: 0.35,
        }),
      ]);

      faceLandmarkerRef.current    = faceLandmarker;
      gestureRecognizerRef.current = gestureRecognizer;
      objectDetectorRef.current    = objectDetector;

      setIsReady(true);
      setIsLoading(false);
    } catch (err) {
      console.error('[useLiveVision] Model loading error:', err);
      setError(err.message || 'Failed to load vision models');
      setIsLoading(false);
    }
  }, [isReady, isLoading]);

  // ── Extract face data from blendshapes & landmarks ─────────
  const parseFaceResult = useCallback((result) => {
    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return null;
    }

    const landmarks  = result.faceLandmarks[0];
    const blendshapes = result.faceBlendshapes?.[0]?.categories || [];

    // Build blendshape map
    const bsMap = {};
    for (const bs of blendshapes) {
      bsMap[bs.categoryName] = bs.score;
    }

    // Smile detection: average of mouthSmileLeft + mouthSmileRight
    const smileL  = bsMap['mouthSmileLeft']  || 0;
    const smileR  = bsMap['mouthSmileRight'] || 0;
    const smiling = (smileL + smileR) / 2 > SMILE_THRESHOLD;

    // Eye contact: if eyes are looking straight (low outward/upward gaze)
    const lookOutL = bsMap['eyeLookOutLeft']   || 0;
    const lookOutR = bsMap['eyeLookOutRight']  || 0;
    const lookUpL  = bsMap['eyeLookUpLeft']    || 0;
    const lookUpR  = bsMap['eyeLookUpRight']   || 0;
    const lookDnL  = bsMap['eyeLookDownLeft']  || 0;
    const lookDnR  = bsMap['eyeLookDownRight'] || 0;
    const gazeDeviation = Math.max(lookOutL, lookOutR, lookUpL, lookUpR, lookDnL, lookDnR);
    const eyeContact    = gazeDeviation < EYE_CONTACT_THRESHOLD;

    // Head pose from transformation matrix (if available)
    let headPose = { pitch: 0, yaw: 0, roll: 0 };
    if (result.facialTransformationMatrixes?.length > 0) {
      const m = result.facialTransformationMatrixes[0]?.data;
      if (m && m.length >= 12) {
        headPose = {
          pitch: Math.asin(-m[6])  * (180 / Math.PI),
          yaw:   Math.atan2(m[2], m[10]) * (180 / Math.PI),
          roll:  Math.atan2(m[4], m[5])  * (180 / Math.PI),
        };
      }
    }

    // Mouth open (for UI display)
    const jawOpen  = bsMap['jawOpen'] || 0;
    const mouthOpen = jawOpen > 0.15;

    return {
      smiling,
      eyeContact,
      headPose,
      mouthOpen,
      jawOpen,
      smileScore: (smileL + smileR) / 2,
      gazeDeviation,
      landmarks,
      blendshapes: bsMap,
    };
  }, []);

  // ── Parse gesture result ───────────────────────────────────
  const parseGestureResult = useCallback((result) => {
    if (!result || !result.gestures || result.gestures.length === 0) {
      return null;
    }

    const topGesture = result.gestures[0]?.[0];
    if (!topGesture || topGesture.categoryName === 'None') return null;

    return {
      name:      topGesture.categoryName,
      label:     GESTURE_LABELS[topGesture.categoryName] || topGesture.categoryName,
      score:     topGesture.score,
      landmarks: result.landmarks?.[0] || [],
    };
  }, []);

  // ── Parse object detection result ──────────────────────────
  const parseObjectResult = useCallback((result) => {
    if (!result || !result.detections || result.detections.length === 0) {
      return [];
    }

    return result.detections.map((det) => ({
      label:  det.categories?.[0]?.categoryName || 'unknown',
      score:  det.categories?.[0]?.score || 0,
      box: {
        x:     det.boundingBox?.originX || 0,
        y:     det.boundingBox?.originY || 0,
        width: det.boundingBox?.width   || 0,
        height:det.boundingBox?.height  || 0,
      },
    }));
  }, []);

  // ── Draw HUD overlays onto canvas ──────────────────────────
  const drawOverlays = useCallback(({ face, gestureData, objects, showFaceMesh = true, showGesture = true, showObjects = true } = {}) => {
    const canvas = canvasRef?.current;
    const video  = videoRef?.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Face mesh landmarks
    if (showFaceMesh && face?.landmarks) {
      ctx.fillStyle = HUD_COLORS.facePoint;
      for (const lm of face.landmarks) {
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Gesture hand landmarks
    if (showGesture && gestureData?.landmarks) {
      ctx.strokeStyle = HUD_COLORS.gestureBox;
      ctx.lineWidth   = 2;
      for (const lm of gestureData.landmarks) {
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Gesture label pill
      if (gestureData.label) {
        const text  = gestureData.label;
        ctx.font    = 'bold 14px Inter, sans-serif';
        const tw    = ctx.measureText(text).width;
        const px    = canvas.width - tw - 24;
        const py    = 20;
        ctx.fillStyle = HUD_COLORS.textBg;
        ctx.beginPath();
        ctx.roundRect(px - 8, py - 4, tw + 16, 24, 8);
        ctx.fill();
        ctx.fillStyle = HUD_COLORS.gestureBox;
        ctx.fillText(text, px, py + 14);
      }
    }

    // Object bounding boxes
    if (showObjects && objects?.length > 0) {
      ctx.strokeStyle = HUD_COLORS.objectBox;
      ctx.lineWidth   = 2;
      ctx.font        = '12px Inter, sans-serif';

      for (const obj of objects) {
        const { x, y, width, height } = obj.box;
        ctx.strokeRect(x, y, width, height);

        // Label
        const label = `${obj.label} ${(obj.score * 100).toFixed(0)}%`;
        const tw    = ctx.measureText(label).width;
        ctx.fillStyle = HUD_COLORS.textBg;
        ctx.fillRect(x, y - 20, tw + 12, 20);
        ctx.fillStyle = HUD_COLORS.objectBox;
        ctx.fillText(label, x + 6, y - 5);
      }
    }
  }, [canvasRef, videoRef]);

  // ── Main detection loop (RAF) ──────────────────────────────
  const processFrame = useCallback(() => {
    if (!runningRef.current) return;

    const video = videoRef?.current;
    if (!video || video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();

    // Throttle to ~15 FPS for performance (every ~66ms)
    if (now - lastFrameTimeRef.current < 60) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastFrameTimeRef.current = now;

    // FPS counter
    fpsCounterRef.current.frames++;
    if (now - fpsCounterRef.current.lastTick >= 1000) {
      setFps(fpsCounterRef.current.frames);
      fpsCounterRef.current.frames  = 0;
      fpsCounterRef.current.lastTick = now;
    }

    try {
      // Run face landmarker
      let faceResult = null;
      if (faceLandmarkerRef.current) {
        const raw = faceLandmarkerRef.current.detectForVideo(video, now);
        faceResult = parseFaceResult(raw);
        setFaceData(faceResult);
      }

      // Run gesture recognizer
      let gestureResult = null;
      if (gestureRecognizerRef.current) {
        const raw = gestureRecognizerRef.current.recognizeForVideo(video, now);
        gestureResult = parseGestureResult(raw);
        setGesture(gestureResult);
      }

      // Run object detector (every 3rd frame to save perf)
      if (objectDetectorRef.current && fpsCounterRef.current.frames % 3 === 0) {
        const raw = objectDetectorRef.current.detectForVideo(video, now);
        const objects = parseObjectResult(raw);
        setDetectedObjects(objects);

        // Draw overlays
        drawOverlays({ face: faceResult, gestureData: gestureResult, objects });
      } else {
        // Still draw face/gesture overlays even when skipping objects
        drawOverlays({ face: faceResult, gestureData: gestureResult, objects: detectedObjects });
      }
    } catch (err) {
      // Silently continue — transient frame errors are normal
      if (process.env.NODE_ENV === 'development') {
        console.debug('[useLiveVision] Frame processing warning:', err.message);
      }
    }

    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, parseFaceResult, parseGestureResult, parseObjectResult, drawOverlays, detectedObjects]);

  // ── Start / stop detection ─────────────────────────────────
  const startDetection = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current           = true;
    lastFrameTimeRef.current     = 0;
    fpsCounterRef.current        = { frames: 0, lastTick: performance.now() };
    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stopDetection = useCallback(() => {
    runningRef.current = false;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setFps(0);
  }, []);

  // ── Auto-load models when enabled ──────────────────────────
  useEffect(() => {
    if (enabled && !isReady && !isLoading && !error) {
      loadModels();
    }
  }, [enabled, isReady, isLoading, error, loadModels]);

  // ── Auto-start detection when ready and video is streaming ─
  useEffect(() => {
    if (isReady && enabled) {
      startDetection();
    } else {
      stopDetection();
    }
    return () => stopDetection();
  }, [isReady, enabled, startDetection, stopDetection]);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      stopDetection();
      faceLandmarkerRef.current?.close();
      gestureRecognizerRef.current?.close();
      objectDetectorRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isReady,
    isLoading,
    error,
    faceData,
    gesture,
    detectedObjects,
    fps,
    startDetection,
    stopDetection,
    loadModels,
    drawOverlays,
  };
}

export default useLiveVision;
