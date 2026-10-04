import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Resources.css";

// ─────────────────────────────────────────────────────────────
// Skill data
// ─────────────────────────────────────────────────────────────
const TIPS = [
  {
    id: "eye", icon: "👁️", title: "Eye Contact", category: "Body Language", categoryKey: "body",
    color: "#7c5cfc", glow: "rgba(124,92,252,0.18)",
    desc: "Build trust and connection through deliberate gaze",
    importance: "Eye contact is the fastest trust signal. Speakers who maintain it are rated up to 40% more credible by their audiences.",
    tips: [
      { text: "Maintain eye contact 50–70% of the time while speaking", level: "Beginner" },
      { text: "Use the triangle method: left eye → right eye → mouth",  level: "Beginner" },
      { text: "Return to eye contact naturally after glancing away",     level: "Beginner" },
      { text: "Do not stare — blink naturally every 3–5 seconds",       level: "Intermediate" },
      { text: "In groups, rotate eye contact to each person for 3–5 s", level: "Advanced" },
    ],
    exercises: [
      { text: "30-second drill: hold eye contact while reciting a topic",   time: "30 s"  },
      { text: "Record yourself — count times you look away per minute",      time: "5 min" },
      { text: "Mirror practice: hold your own gaze for 2 minutes daily",     time: "2 min" },
    ],
  },
  {
    id: "posture", icon: "🧍", title: "Posture", category: "Body Language", categoryKey: "body",
    color: "#5b8def", glow: "rgba(91,141,239,0.18)",
    desc: "Project confidence through powerful body language",
    importance: "Your body speaks before you do. Standing tall activates a feedback loop — good posture literally boosts testosterone and lowers cortisol.",
    tips: [
      { text: "Keep your spine straight and elongated",                              level: "Beginner"     },
      { text: "Pull shoulders back gently and relax them down",                      level: "Beginner"     },
      { text: "Open your chest — avoid crossing arms",                               level: "Beginner"     },
      { text: "Keep weight distributed evenly on both feet",                         level: "Intermediate" },
      { text: "Practice power poses for 2 minutes before high-stakes talks",         level: "Advanced"     },
    ],
    exercises: [
      { text: "Wall test: stand against a wall with head, shoulders, heels touching", time: "2 min" },
      { text: "Mirror check: speak a topic while watching your posture",              time: "5 min" },
      { text: "Movement drill: walk and talk — feel natural momentum",                time: "3 min" },
    ],
  },
  {
    id: "facial", icon: "😊", title: "Facial Expression", category: "Body Language", categoryKey: "body",
    color: "#22c55e", glow: "rgba(34,197,94,0.18)",
    desc: "Engage your audience with authentic expressions",
    importance: "A genuine smile is contagious. It activates mirror neurons in listeners, creating an immediate emotional bond.",
    tips: [
      { text: "Smile softly even when listening — not just when speaking",    level: "Beginner"     },
      { text: "Relax your eyelids and forehead muscles consciously",          level: "Beginner"     },
      { text: "Match your expression to your message for authenticity",       level: "Intermediate" },
      { text: "Avoid the 'neutral resting face' trap during presentations",   level: "Intermediate" },
      { text: "Use micro-expressions intentionally to punctuate key points",  level: "Advanced"     },
    ],
    exercises: [
      { text: "Smile mirror check: hold a natural smile for 10 seconds",  time: "30 s"  },
      { text: "Record with smile vs without — notice the difference",      time: "5 min" },
      { text: "Expression variety: practice 5 emotions in 60 seconds",     time: "1 min" },
    ],
  },
  {
    id: "speech", icon: "🎤", title: "Speech & Voice", category: "Voice", categoryKey: "voice",
    color: "#f59e0b", glow: "rgba(245,158,11,0.18)",
    desc: "Speak with clarity, authority and confidence",
    importance: "Clear, well-paced speech ensures your message lands. Filler words erode authority — every 'um' or 'uh' signals uncertainty.",
    tips: [
      { text: "Aim for 120–150 words per minute — record to calibrate",   level: "Beginner"     },
      { text: "Pause deliberately instead of filling with 'um' or 'uh'",  level: "Beginner"     },
      { text: "Vary your tone and pitch to emphasize key words",           level: "Intermediate" },
      { text: "Breathe from your diaphragm before and during speaking",   level: "Intermediate" },
      { text: "Use strategic silence — pauses command attention",          level: "Advanced"     },
    ],
    exercises: [
      { text: "Count your filler words per minute on a recorded 2-min talk", time: "2 min" },
      { text: "Read a passage aloud at 3 different speeds back-to-back",      time: "5 min" },
      { text: "Tongue twisters daily for sharp diction and articulation",     time: "2 min" },
    ],
  },
  {
    id: "gestures", icon: "🤝", title: "Hand Gestures", category: "Body Language", categoryKey: "body",
    color: "#ec4899", glow: "rgba(236,72,153,0.18)",
    desc: "Amplify your words with purposeful hand movement",
    importance: "Gestures increase information retention in listeners by up to 33%. The right gesture at the right moment anchors your message.",
    tips: [
      { text: "Keep hands visible at all times — hide them and you hide intent",  level: "Beginner"     },
      { text: "Use open palms to signal honesty and openness",                     level: "Beginner"     },
      { text: "Avoid pointing fingers — use flat hand gestures instead",           level: "Intermediate" },
      { text: "Gesture within the 'power box': waist to shoulder width",           level: "Intermediate" },
      { text: "Sync gestures to words — don't gesture before or after",            level: "Advanced"     },
    ],
    exercises: [
      { text: "Speak a 60-second topic with hands completely still — feel the tension", time: "1 min" },
      { text: "Re-record it with deliberate open-palm gestures — compare",               time: "2 min" },
      { text: "Mirror a TED Talk speaker for 5 minutes, mirroring only gestures",       time: "5 min" },
    ],
  },
  {
    id: "mindset", icon: "🧠", title: "Mindset & Breathing", category: "Mind", categoryKey: "mind",
    color: "#14b8a6", glow: "rgba(20,184,166,0.18)",
    desc: "Calm your nerves and build unshakeable inner confidence",
    importance: "Confidence is a skill, not a personality trait. Controlled breathing activates the parasympathetic nervous system, lowering anxiety in under 60 seconds.",
    tips: [
      { text: "Accept nervousness as excitement — reframe the signal",                   level: "Beginner"     },
      { text: "4-7-8 breathing: inhale 4 s, hold 7 s, exhale 8 s",                     level: "Beginner"     },
      { text: "Visualize a successful outcome for 2 minutes before speaking",            level: "Intermediate" },
      { text: "Focus on giving value — shift attention from yourself to audience",       level: "Intermediate" },
      { text: "Build a 'confidence anchor' — a specific memory of peak performance",    level: "Advanced"     },
    ],
    exercises: [
      { text: "4-7-8 breath cycle: 3 rounds before any high-stakes moment",               time: "1 min" },
      { text: "Visualization: close eyes, picture the room, your posture, the applause",  time: "2 min" },
      { text: "Gratitude journaling: list 3 past wins before practice sessions",           time: "3 min" },
    ],
  },
];

const CATEGORIES = [
  { key: "all",   label: "All Skills" },
  { key: "body",  label: "Body Language" },
  { key: "voice", label: "Voice" },
  { key: "mind",  label: "Mind" },
  { key: "saved", label: "Saved", icon: "🔖" },
];

const LEVEL_COLORS = {
  Beginner:     { bg: "rgba(34,197,94,0.12)",  color: "#22c55e" },
  Intermediate: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  Advanced:     { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
};

const MASTERY_LEVELS = [
  { name: "Novice",       min: 0,   color: "#94a3b8" },
  { name: "Apprentice",   min: 34,  color: "#60a5fa" },
  { name: "Practitioner", min: 67,  color: "#a78bfa" },
  { name: "Master",       min: 100, color: "#f59e0b" },
];

const XP_PER_EXERCISE = 20;

const PATH_STEPS = [
  { step: "01", title: "Learn",   desc: "Read tips and understand the why behind each technique",    icon: "📚", color: "#7c5cfc", storageKey: null },
  { step: "02", title: "Record",  desc: "Practice with the AI video recorder in the Practice Room",  icon: "🎬", color: "#5b8def", storageKey: "confidence_ai_has_recorded" },
  { step: "03", title: "Analyze", desc: "Get AI confidence scores and detailed feedback",             icon: "📊", color: "#22c55e", storageKey: "confidence_ai_has_score" },
  { step: "04", title: "Master",  desc: "Build consistent habits and real, lasting confidence",      icon: "🏆", color: "#f59e0b", storageKey: null },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function getMasteryLevel(pct) {
  for (let i = MASTERY_LEVELS.length - 1; i >= 0; i--) {
    if (pct >= MASTERY_LEVELS[i].min) return MASTERY_LEVELS[i];
  }
  return MASTERY_LEVELS[0];
}

function todayKey() { return new Date().toDateString(); }

function getDailyChallenge() {
  const ALL = TIPS.flatMap(t =>
    t.exercises.map((ex, i) => ({ ...ex, skillId: t.id, skillTitle: t.title, skillIcon: t.icon, skillColor: t.color, exIdx: i }))
  );
  const key = todayKey();
  let hash = 0;
  for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return ALL[hash % ALL.length];
}

function getMidnightCountdown() {
  const now = new Date();
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function computeStreak() {
  const saved = loadLS("res_streak", { lastDate: null, count: 0 });
  const today = todayKey();
  if (!saved.lastDate) { const n = { lastDate: today, count: 1 }; saveLS("res_streak", n); return 1; }
  const diffDays = Math.round((new Date(today) - new Date(saved.lastDate)) / 86400000);
  if (diffDays === 0) return saved.count;
  const count = diffDays === 1 ? saved.count + 1 : 1;
  saveLS("res_streak", { lastDate: today, count });
  return count;
}

// Simple in-view hook
function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** SVG circular progress ring */
function CircularRing({ pct, color, size = 52 }) {
  const sw = 3, r = (size - sw * 2) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }} />
    </svg>
  );
}

/** Pure-SVG radar chart (3 axes: body / voice / mind) */
function RadarChart({ scores }) {
  const SIZE = 170, CX = 85, CY = 85, R = 60;
  const LABELS = ["Body", "Voice", "Mind"];
  const KEYS   = ["body", "voice", "mind"];
  const ANGLES = [270, 30, 150]; // top, bottom-right, bottom-left

  const pt = (angleDeg, r) => ({
    x: CX + r * Math.cos(angleDeg * Math.PI / 180),
    y: CY + r * Math.sin(angleDeg * Math.PI / 180),
  });

  const dataPts = KEYS.map((k, i) => pt(ANGLES[i], R * (scores[k] || 0) / 100));
  const dataStr = dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="res-radar">
      {[0.25, 0.5, 0.75, 1].map(lvl => (
        <polygon key={lvl}
          points={ANGLES.map(a => { const p = pt(a, R * lvl); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {ANGLES.map((a, i) => { const p = pt(a, R); return <line key={i} x1={CX} y1={CY} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />; })}
      <polygon points={dataStr} fill="rgba(124,92,252,0.18)" stroke="#7c5cfc" strokeWidth={2} />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={4}
          fill="#7c5cfc" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
      ))}
      {ANGLES.map((a, i) => { const p = pt(a, R + 18); return (
        <text key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fill="rgba(255,255,255,0.45)" fontFamily="inherit">{LABELS[i]}</text>
      ); })}
    </svg>
  );
}

/** CSS-only confetti burst (10 pieces, pre-computed directions) */
function ConfettiBurst({ active }) {
  if (!active) return null;
  return (
    <span className="confetti-wrap" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className="confetti-piece" style={{ "--ci": i }} />
      ))}
    </span>
  );
}

/** Daily challenge widget */
function DailyChallenge() {
  const challenge = useMemo(getDailyChallenge, []);
  const [done, setDone] = useState(() => {
    const s = loadLS("res_daily_done", { date: null, done: false });
    return s.date === todayKey() && s.done;
  });
  const [countdown, setCountdown] = useState(getMidnightCountdown);
  const [burst, setBurst] = useState(false);
  const [ref, inView] = useInView(0.1);

  useEffect(() => {
    const id = setInterval(() => setCountdown(getMidnightCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  function handleComplete() {
    if (done) return;
    setDone(true); setBurst(true);
    saveLS("res_daily_done", { date: todayKey(), done: true });
    setTimeout(() => setBurst(false), 1100);
  }

  return (
    <div ref={ref} className={`res-daily${inView ? " res-daily--visible" : ""}${done ? " res-daily--done" : ""}`}>
      <div className="res-daily-glow" />
      <div className="res-daily-left">
        <div className="res-daily-badge">
          <span className="res-daily-badge-dot" />
          Daily Challenge
        </div>
        <div className="res-daily-meta">
          <span className="res-daily-skill-icon">{challenge.skillIcon}</span>
          <span className="res-daily-skill-name">{challenge.skillTitle}</span>
        </div>
        <p className="res-daily-text">{challenge.text}</p>
        <div className="res-daily-footer">
          <span className="res-daily-time">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {challenge.time}
          </span>
          <span className="res-daily-xp">+{XP_PER_EXERCISE} XP</span>
        </div>
      </div>
      <div className="res-daily-right">
        <div className="res-daily-countdown">
          <div className="res-daily-countdown-label">Next challenge in</div>
          <div className="res-daily-countdown-time">{countdown}</div>
        </div>
        <div style={{ position: "relative" }}>
          <button
            className={`res-daily-btn${done ? " res-daily-btn--done" : ""}`}
            onClick={handleComplete} disabled={done} id="daily-challenge-btn"
            aria-label={done ? "Daily challenge completed" : "Mark daily challenge as complete"}
          >
            {done ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Completed!
              </>
            ) : "Mark Complete"}
          </button>
          <ConfettiBurst active={burst} />
        </div>
      </div>
    </div>
  );
}

/** Progress dashboard: radar chart + stats + skill icons */
function ProgressDashboard({ exerciseDone, streak }) {
  const [ref, inView] = useInView(0.05);

  const scores = useMemo(() => {
    const catMap = { body: [], voice: [], mind: [] };
    TIPS.forEach(t => catMap[t.categoryKey]?.push(t));
    const catScore = tips => {
      const done = tips.reduce((a, t) => a + Object.values(exerciseDone[t.id] || {}).filter(Boolean).length, 0);
      const max  = tips.reduce((a, t) => a + t.exercises.length, 0);
      return max ? Math.round((done / max) * 100) : 0;
    };
    return { body: catScore(catMap.body), voice: catScore(catMap.voice), mind: catScore(catMap.mind) };
  }, [exerciseDone]);

  const totalDone = useMemo(() =>
    Object.values(exerciseDone).reduce((a, ex) => a + Object.values(ex).filter(Boolean).length, 0),
  [exerciseDone]);

  const totalPossible = useMemo(() => TIPS.reduce((a, t) => a + t.exercises.length, 0), []);
  const overallPct = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;

  return (
    <div ref={ref} className={`res-dashboard${inView ? " res-dashboard--visible" : ""}`}>
      {/* Radar */}
      <div className="res-dashboard-radar">
        <RadarChart scores={scores} />
        <div className="res-dashboard-radar-label">Skill Radar</div>
      </div>

      {/* Stats */}
      <div className="res-dashboard-stats">
        <div className="res-dashboard-stat-item">
          <div className="res-dashboard-stat-value" style={{ color: "#f59e0b" }}>{streak}</div>
          <div className="res-dashboard-stat-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Day Streak
          </div>
        </div>
        <div className="res-dashboard-divider" />
        <div className="res-dashboard-stat-item">
          <div className="res-dashboard-stat-value" style={{ color: "#7c5cfc" }}>{totalDone}</div>
          <div className="res-dashboard-stat-label">Exercises Done</div>
        </div>
        <div className="res-dashboard-divider" />
        <div className="res-dashboard-stat-item">
          <div className="res-dashboard-stat-value" style={{ color: "#22c55e" }}>{overallPct}%</div>
          <div className="res-dashboard-stat-label">Overall Progress</div>
        </div>
      </div>

      {/* Skill icons row */}
      <div className="res-dashboard-skills">
        <div className="res-dashboard-skills-label">Skills Progress</div>
        <div className="res-dashboard-skills-row">
          {TIPS.map(t => {
            const done = Object.values(exerciseDone[t.id] || {}).filter(Boolean).length;
            const pct  = Math.round((done / t.exercises.length) * 100);
            return (
              <div key={t.id} className="res-dashboard-skill-dot" title={`${t.title}: ${pct}%`}>
                <div style={{ position: "relative", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CircularRing pct={pct} color={t.color} size={40} />
                  <span style={{ fontSize: 16, position: "relative", zIndex: 1 }}>{t.icon}</span>
                </div>
                <span className="res-dashboard-skill-name" style={{ color: t.color }}>
                  {t.title.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Skill card with tilt, bookmark, progress ring & mastery badge */
function SkillCard({ tip, index, onClick, exerciseDone, bookmarks, onToggleBookmark }) {
  const ref  = useRef(null);
  const raf  = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      el.style.setProperty("--tx", `${(x * 10).toFixed(2)}deg`);
      el.style.setProperty("--ty", `${(-y * 10).toFixed(2)}deg`);
      el.style.setProperty("--sx", `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--sy", `${((y + 0.5) * 100).toFixed(1)}%`);
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.style.setProperty("--tx", "0deg");
    el.style.setProperty("--ty", "0deg");
  }, []);

  const exDone       = exerciseDone[tip.id] || {};
  const doneCount    = Object.values(exDone).filter(Boolean).length;
  const pct          = Math.round((doneCount / tip.exercises.length) * 100);
  const mastery      = getMasteryLevel(pct);
  const isBookmarked = bookmarks.includes(tip.id);

  return (
    <div
      ref={ref}
      className={`res-tip-card${inView ? " res-tip-card--visible" : ""}${isBookmarked ? " res-tip-card--bookmarked" : ""}`}
      style={{ transitionDelay: `${index * 0.06}s`, "--accent": tip.color }}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      id={`skill-card-${tip.id}`}
      aria-label={`${tip.title}: ${pct}% complete. Click to view guide.`}
    >
      {/* Cursor spotlight */}
      <div className="res-tip-spotlight" />

      {/* Bookmark */}
      <button
        className={`res-tip-bookmark${isBookmarked ? " res-tip-bookmark--active" : ""}`}
        onClick={(e) => { e.stopPropagation(); onToggleBookmark(tip.id); }}
        aria-label={isBookmarked ? `Remove ${tip.title} from saved` : `Save ${tip.title}`}
        style={isBookmarked ? { color: tip.color, borderColor: `${tip.color}50`, background: `${tip.color}18` } : {}}
      >
        <svg width="12" height="12" viewBox="0 0 24 24"
          fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Icon + progress ring */}
      <div style={{ position: "relative", width: 52, height: 52, marginBottom: 14, flexShrink: 0 }}>
        <div className="res-tip-icon-bg" style={{ background: tip.glow, border: `1px solid ${tip.color}30` }}>
          <span className="res-tip-icon">{tip.icon}</span>
        </div>
        <CircularRing pct={pct} color={tip.color} size={52} />
      </div>

      {/* Category + mastery */}
      <div className="res-tip-mastery-row">
        <span className="res-tip-category" style={{ color: tip.color }}>{tip.category}</span>
        <span className="res-tip-mastery-badge" style={{ color: mastery.color, background: `${mastery.color}18` }}>
          {mastery.name}
        </span>
      </div>

      <h3 className="res-tip-title">{tip.title}</h3>
      <p className="res-tip-desc">{tip.desc}</p>

      {/* Mini progress bar */}
      <div className="res-tip-progress-bar">
        <div className="res-tip-progress-fill" style={{ width: `${pct}%`, background: tip.color }} />
      </div>

      <div className="res-tip-footer">
        <span className="res-tip-meta">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {doneCount}/{tip.exercises.length} done
        </span>
        <span className="res-tip-link" style={{ color: tip.color }}>
          View guide
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/** Learning path step */
function PathStep({ p, index, done }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref}
      className={`res-path-step${inView ? " res-path-step--visible" : ""}${done ? " res-path-step--done" : ""}`}
      style={{ transitionDelay: `${0.15 + index * 0.07}s` }}>
      <div className="res-path-step-icon" style={{ background: `${p.color}18`, border: `1px solid ${p.color}30` }}>
        <span style={{ fontSize: "22px" }}>{p.icon}</span>
        {done && (
          <span className="res-path-step-check" style={{ background: p.color }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>
      <div className="res-path-step-num" style={{ color: p.color }}>{p.step}</div>
      <div className="res-path-step-title">{p.title}</div>
      <div className="res-path-step-desc">{p.desc}</div>
    </div>
  );
}

/** Modal with exercise checklist, confetti, focus trap, progress bar */
function Modal({ tip, onClose, onPractice, exerciseDone, onToggleExercise }) {
  const overlayRef  = useRef(null);
  const closeBtnRef = useRef(null);
  const [burstIdx, setBurstIdx] = useState(null);

  // Escape + focus trap
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        const modal = overlayRef.current?.querySelector(".res-modal");
        if (!modal) return;
        const focusables = Array.from(
          modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
        ).filter(el => !el.disabled);
        if (!focusables.length) return;
        const [first, last] = [focusables[0], focusables[focusables.length - 1]];
        if (e.shiftKey && document.activeElement === first)      { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const exDone    = exerciseDone[tip.id] || {};
  const doneCount = Object.values(exDone).filter(Boolean).length;
  const pct       = Math.round((doneCount / tip.exercises.length) * 100);

  function handleExerciseToggle(idx) {
    const wasOff = !exDone[idx];
    onToggleExercise(tip.id, idx);
    if (wasOff) { setBurstIdx(idx); setTimeout(() => setBurstIdx(null), 1100); }
  }

  return (
    <div className="res-overlay animate-fadeIn" ref={overlayRef}
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="res-modal animate-fadeUp" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="res-modal-header" style={{ borderBottom: `2px solid ${tip.color}30` }}>
          <div className="res-modal-title-row">
            <div className="res-modal-icon-wrap" style={{ background: tip.glow, border: `1px solid ${tip.color}40` }}>
              <span style={{ fontSize: "22px" }}>{tip.icon}</span>
            </div>
            <div>
              <h2 className="res-modal-title" id="modal-title">{tip.title} Guide</h2>
              <span className="res-modal-category-tag" style={{ color: tip.color, background: tip.glow }}>
                {tip.category}
              </span>
            </div>
          </div>
          <button ref={closeBtnRef} onClick={onClose} className="res-modal-close" aria-label="Close modal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Skill progress bar */}
        <div className="res-modal-progress-wrap">
          <div className="res-modal-progress-label">
            <span>Skill Progress</span>
            <span style={{ color: tip.color, fontWeight: 700 }}>{pct}% complete</span>
          </div>
          <div className="res-modal-progress-track">
            <div className="res-modal-progress-fill" style={{ width: `${pct}%`, background: tip.color }} />
          </div>
        </div>

        {/* Importance callout */}
        <p className="res-modal-importance" style={{ borderLeft: `3px solid ${tip.color}` }}>
          {tip.importance}
        </p>

        {/* Key tips */}
        <div className="res-modal-section">
          <div className="res-modal-section-title">Key Tips</div>
          {tip.tips.map((t, i) => (
            <div key={i} className="res-modal-item">
              <span className="res-modal-bullet" style={{ background: tip.color }} />
              <span className="res-modal-item-text">{t.text}</span>
              <span className="res-modal-level-badge"
                style={{ background: LEVEL_COLORS[t.level].bg, color: LEVEL_COLORS[t.level].color }}>
                {t.level}
              </span>
            </div>
          ))}
        </div>

        {/* Exercise checklist */}
        <div className="res-modal-section">
          <div className="res-modal-section-title">Practice Exercises</div>
          {tip.exercises.map((ex, i) => {
            const isDone = !!exDone[i];
            return (
              <div key={i}
                className={`res-modal-exercise-row${isDone ? " res-modal-exercise-row--done" : ""}`}
                style={{ position: "relative" }}>
                <button
                  className={`res-modal-checkbox${isDone ? " res-modal-checkbox--checked" : ""}`}
                  style={isDone
                    ? { background: tip.color, borderColor: tip.color }
                    : { borderColor: `${tip.color}55` }}
                  onClick={() => handleExerciseToggle(i)}
                  aria-label={isDone ? `Uncheck: ${ex.text}` : `Check off: ${ex.text}`}
                >
                  {isDone && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className="res-modal-item-text">{ex.text}</span>
                <span className="res-modal-time-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {ex.time}
                </span>
                {burstIdx === i && <ConfettiBurst active />}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <button className="res-modal-cta"
          style={{ background: `linear-gradient(135deg, ${tip.color} 0%, ${tip.color}bb 100%)` }}
          onClick={onPractice} id={`practice-now-${tip.id}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Practice Now in AI Room
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
function Resources() {
  const navigate = useNavigate();
  const [activeTip,      setActiveTip]    = useState(null);
  const [activeCategory, setCategory]     = useState("all");
  const [search,         setSearch]       = useState("");
  const [exerciseDone,   setExerciseDone] = useState(() => loadLS("res_exercises", {}));
  const [bookmarks,      setBookmarks]    = useState(() => loadLS("res_bookmarks",  []));
  const [streak]                          = useState(computeStreak);

  // Path done flags
  const pathDone = PATH_STEPS.map(p => p.storageKey ? !!localStorage.getItem(p.storageKey) : false);
  pathDone[0] = Object.values(exerciseDone).some(ex => Object.values(ex).some(Boolean));

  const totalXP = useMemo(() =>
    Object.values(exerciseDone).reduce(
      (a, ex) => a + Object.values(ex).filter(Boolean).length * XP_PER_EXERCISE, 0
    ), [exerciseDone]);

  const handleToggleExercise = useCallback((skillId, exIdx) => {
    setExerciseDone(prev => {
      const s = { ...(prev[skillId] || {}) };
      s[exIdx] = !s[exIdx];
      const next = { ...prev, [skillId]: s };
      saveLS("res_exercises", next);
      return next;
    });
  }, []);

  const handleToggleBookmark = useCallback((tipId) => {
    setBookmarks(prev => {
      const next = prev.includes(tipId) ? prev.filter(id => id !== tipId) : [...prev, tipId];
      saveLS("res_bookmarks", next);
      return next;
    });
  }, []);

  const handlePractice = useCallback(() => { setActiveTip(null); navigate("/ai"); }, [navigate]);

  const filtered = TIPS.filter(t => {
    if (activeCategory === "saved") return bookmarks.includes(t.id);
    const matchCat = activeCategory === "all" || t.categoryKey === activeCategory;
    const q = search.trim().toLowerCase();
    const matchSrc = !q ||
      t.title.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q);
    return matchCat && matchSrc;
  });

  return (
    <div className="res-page">
      {activeTip && (
        <Modal tip={activeTip} onClose={() => setActiveTip(null)} onPractice={handlePractice}
          exerciseDone={exerciseDone} onToggleExercise={handleToggleExercise} />
      )}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="res-hero">
        <div className="res-hero-bg" />
        <div className="res-hero-content animate-fadeUp">
          <div className="res-hero-badge">Learning Resources</div>
          <h1 className="res-hero-title">
            Personality Development<br />
            <span className="res-hero-title-accent">Mastery Guide</span>
          </h1>
          <p className="res-hero-sub">
            Master 6 pillars of confident communication. Track your XP, complete daily challenges,
            and build genuine confidence — one exercise at a time.
          </p>
          <div className="res-hero-actions">
            <button onClick={() => navigate("/ai")} className="res-hero-btn" id="start-practice-resources-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Practicing Now
            </button>
            <div className="res-hero-stats">
              <span className="res-hero-stat"><strong>{TIPS.length}</strong> Skills</span>
              <span className="res-hero-stat-divider" />
              <span className="res-hero-stat">
                <strong style={{ color: "#f59e0b" }}>{totalXP}</strong> XP Earned
              </span>
              <span className="res-hero-stat-divider" />
              <span className="res-hero-stat">
                <strong>{TIPS.reduce((a, t) => a + t.exercises.length, 0)}</strong> Exercises
              </span>
            </div>
          </div>
        </div>

        {/* Orbiting skill icons */}
        <div className="res-hero-orbit-wrap" aria-hidden="true">
          <div className="res-hero-orbit-ring" />
          <div className="res-hero-orbit-center">🧠</div>
          {TIPS.map((t, i) => (
            <div key={t.id} className="res-hero-orbit-item" style={{ animationDelay: `${-(i * 2)}s` }}>
              <span className="res-hero-orbit-icon"
                style={{ background: t.glow, border: `1px solid ${t.color}55`, boxShadow: `0 0 10px ${t.color}40` }}>
                {t.icon}
              </span>
            </div>
          ))}
        </div>

        <div className="res-hero-orb res-hero-orb-1" />
        <div className="res-hero-orb res-hero-orb-2" />
      </div>

      <div className="res-content">

        {/* ── Progress dashboard ─────────────────────────────── */}
        <ProgressDashboard exerciseDone={exerciseDone} streak={streak} />

        {/* ── Daily challenge ────────────────────────────────── */}
        <DailyChallenge />

        {/* ── Search + filter bar ────────────────────────────── */}
        <div className="res-controls animate-fadeUp">
          <div className="res-search-wrap">
            <svg className="res-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" className="res-search" placeholder="Search skills…" value={search}
              onChange={e => setSearch(e.target.value)} id="resources-search" aria-label="Search skills" />
            {search && (
              <button className="res-search-clear" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
            )}
          </div>
          <div className="res-filter-tabs" role="tablist" aria-label="Filter skills by category">
            {CATEGORIES.map(cat => (
              <button key={cat.key}
                className={`res-filter-tab${activeCategory === cat.key ? " res-filter-tab--active" : ""}`}
                onClick={() => setCategory(cat.key)} id={`filter-${cat.key}`}
                role="tab" aria-selected={activeCategory === cat.key}>
                {cat.icon && <span aria-hidden="true">{cat.icon}</span>}
                {cat.label}
                <span className="res-filter-count">
                  {cat.key === "all" ? TIPS.length
                    : cat.key === "saved" ? bookmarks.length
                    : TIPS.filter(t => t.categoryKey === cat.key).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Section header ─────────────────────────────────── */}
        <div className="res-section-header">
          <h2 className="res-section-title">Core Skills</h2>
          <span className="res-section-sub">
            {filtered.length === 0
              ? "No skills match your search"
              : `${filtered.length} skill${filtered.length !== 1 ? "s" : ""} — click any card to expand`}
          </span>
        </div>

        {/* ── Skills grid ─────────────────────────────────────── */}
        {filtered.length > 0 ? (
          <div className="res-tips-grid">
            {filtered.map((tip, i) => (
              <SkillCard key={tip.id} tip={tip} index={i} onClick={() => setActiveTip(tip)}
                exerciseDone={exerciseDone} bookmarks={bookmarks} onToggleBookmark={handleToggleBookmark} />
            ))}
          </div>
        ) : (
          <div className="res-empty">
            <span className="res-empty-icon">🔍</span>
            <p className="res-empty-title">No skills found</p>
            <p className="res-empty-sub">Try a different search term or category</p>
            <button className="res-empty-reset" onClick={() => { setSearch(""); setCategory("all"); }}>
              Reset filters
            </button>
          </div>
        )}

        {/* ── Learning path ───────────────────────────────────── */}
        <div className="res-path-card">
          <div className="res-path-header">
            <h2 className="res-path-title">Your Learning Path</h2>
            <span className="res-path-badge">{pathDone.filter(Boolean).length} / {PATH_STEPS.length} Done</span>
          </div>
          <div className="res-path-progress-bar">
            <div className="res-path-progress-fill"
              style={{ width: `${(pathDone.filter(Boolean).length / PATH_STEPS.length) * 100}%` }} />
          </div>
          <div className="res-path-grid">
            {PATH_STEPS.map((p, i) => <PathStep key={p.step} p={p} index={i} done={pathDone[i]} />)}
          </div>
        </div>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <div className="res-cta animate-fadeUp">
          <div className="res-cta-bg" />
          <div className="res-cta-content">
            <h3 className="res-cta-title">Ready to put it into practice?</h3>
            <p className="res-cta-sub">
              Record a session and get instant AI feedback on your confidence score.
            </p>
          </div>
          <div className="res-cta-buttons">
            <button onClick={() => navigate("/ai")} className="res-cta-btn res-cta-btn--primary" id="go-to-practice-btn">
              AI Practice Room
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <button onClick={() => navigate("/live")} className="res-cta-btn" id="go-to-live-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.21 11.9 19.79 19.79 0 0 1 1.14 3.27 2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Live Call
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Resources;