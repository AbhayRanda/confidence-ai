/**
 * UserOnboardingModal.js
 * ─────────────────────────────────────────────────────────────
 * Multi-step onboarding modal shown to first-time users.
 *
 * Steps:
 *   1 — Who are you?     (name + profession + industry)
 *   2 — What's your goal? (goal card picker)
 *   3 — Experience level  (level picker + weakness checkboxes)
 *
 * On completion, saves profile via useUserProfile.saveProfile().
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import './UserOnboardingModal.css';

// ── Data ──────────────────────────────────────────────────────

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Marketing',
  'Sales', 'Legal', 'Engineering', 'Design', 'HR / Recruiting',
  'Consulting', 'Entrepreneurship', 'Student', 'Other',
];

const GOALS = [
  {
    id: 'interview',
    icon: '💼',
    label: 'Job Interviews',
    desc: 'Nail behavioral & technical interviews with confidence',
  },
  {
    id: 'speaking',
    icon: '🎤',
    label: 'Public Speaking',
    desc: 'Own the stage — presentations, talks, pitches',
  },
  {
    id: 'leadership',
    icon: '🚀',
    label: 'Leadership',
    desc: 'Executive presence, team communication, influence',
  },
  {
    id: 'casual',
    icon: '💬',
    label: 'Everyday Confidence',
    desc: 'Conversations, networking, social situations',
  },
];

const LEVELS = [
  { id: 'beginner',     icon: '🌱', label: 'Beginner',     desc: 'Just starting my journey' },
  { id: 'intermediate', icon: '📈', label: 'Intermediate',  desc: 'Some experience, looking to level up' },
  { id: 'advanced',     icon: '⭐', label: 'Advanced',      desc: 'Experienced, refining the details' },
];

const WEAKNESSES = [
  { id: 'filler_words',  icon: '🗣️', label: 'Filler words (um, uh, like)' },
  { id: 'eye_contact',   icon: '👁️', label: 'Eye contact' },
  { id: 'posture',       icon: '🧍', label: 'Posture & body language' },
  { id: 'speaking_pace', icon: '⏱️', label: 'Speaking pace' },
  { id: 'nervousness',   icon: '😰', label: 'Nervousness & anxiety' },
  { id: 'clarity',       icon: '📢', label: 'Clarity & articulation' },
  { id: 'confidence',    icon: '💪', label: 'Overall confidence' },
];

const TOTAL_STEPS = 3;

// ── Step components ───────────────────────────────────────────

function Step1({ data, onChange }) {
  return (
    <div className="onb-step">
      <div className="onb-step-icon">👋</div>
      <h2 className="onb-step-title">Let's get to know you</h2>
      <p className="onb-step-desc">
        Your coach will use this to personalize every session just for you.
      </p>

      <div className="onb-field-group">
        <label className="onb-label">Your first name *</label>
        <input
          id="onb-name"
          className="onb-input"
          type="text"
          placeholder="e.g. Alex"
          value={data.name}
          onChange={e => onChange('name', e.target.value)}
          autoFocus
          maxLength={40}
        />
      </div>

      <div className="onb-field-group">
        <label className="onb-label">Your profession / role</label>
        <input
          id="onb-profession"
          className="onb-input"
          type="text"
          placeholder="e.g. Software Engineer, Marketing Manager, Student…"
          value={data.profession}
          onChange={e => onChange('profession', e.target.value)}
          maxLength={80}
        />
      </div>

      <div className="onb-field-group">
        <label className="onb-label">Industry</label>
        <select
          id="onb-industry"
          className="onb-select"
          value={data.industry}
          onChange={e => onChange('industry', e.target.value)}
        >
          <option value="">Select your industry…</option>
          {INDUSTRIES.map(ind => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Step2({ data, onChange }) {
  return (
    <div className="onb-step">
      <div className="onb-step-icon">🎯</div>
      <h2 className="onb-step-title">What's your main goal?</h2>
      <p className="onb-step-desc">
        Your coach will focus coaching sessions around this objective.
      </p>

      <div className="onb-goal-grid">
        {GOALS.map(goal => (
          <button
            key={goal.id}
            id={`onb-goal-${goal.id}`}
            className={`onb-goal-card${data.goal === goal.id ? ' onb-goal-card--active' : ''}`}
            onClick={() => onChange('goal', goal.id)}
            type="button"
          >
            <span className="onb-goal-icon">{goal.icon}</span>
            <span className="onb-goal-label">{goal.label}</span>
            <span className="onb-goal-desc">{goal.desc}</span>
            {data.goal === goal.id && <span className="onb-goal-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step3({ data, onChange, onToggleWeakness }) {
  return (
    <div className="onb-step">
      <div className="onb-step-icon">📊</div>
      <h2 className="onb-step-title">Your experience level</h2>
      <p className="onb-step-desc">
        Be honest — your coach adapts difficulty and advice to match.
      </p>

      <div className="onb-level-row">
        {LEVELS.map(lvl => (
          <button
            key={lvl.id}
            id={`onb-level-${lvl.id}`}
            className={`onb-level-card${data.experienceLevel === lvl.id ? ' onb-level-card--active' : ''}`}
            onClick={() => onChange('experienceLevel', lvl.id)}
            type="button"
          >
            <span className="onb-level-icon">{lvl.icon}</span>
            <span className="onb-level-label">{lvl.label}</span>
            <span className="onb-level-desc">{lvl.desc}</span>
          </button>
        ))}
      </div>

      <div className="onb-field-group" style={{ marginTop: 24 }}>
        <label className="onb-label">What do you most want to improve? <span style={{ opacity: 0.5 }}>(pick all that apply)</span></label>
        <div className="onb-weakness-grid">
          {WEAKNESSES.map(w => {
            const active = data.weaknesses.includes(w.id);
            return (
              <button
                key={w.id}
                id={`onb-weakness-${w.id}`}
                className={`onb-weakness-chip${active ? ' onb-weakness-chip--active' : ''}`}
                onClick={() => onToggleWeakness(w.id)}
                type="button"
              >
                <span>{w.icon}</span> {w.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────

export function UserOnboardingModal({ onComplete }) {
  const { saveProfile } = useUserProfile();

  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '',
    profession: '',
    industry: '',
    goal: '',
    experienceLevel: '',
    weaknesses: [],
  });

  const setField = useCallback((key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleWeakness = useCallback((id) => {
    setData(prev => ({
      ...prev,
      weaknesses: prev.weaknesses.includes(id)
        ? prev.weaknesses.filter(w => w !== id)
        : [...prev.weaknesses, id],
    }));
  }, []);

  // Validation per step
  const canProceed = () => {
    if (step === 1) return data.name.trim().length >= 2;
    if (step === 2) return data.goal !== '';
    if (step === 3) return data.experienceLevel !== '';
    return false;
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      saveProfile(data);
      onComplete?.();
    }
  };

  const handleBack = () => setStep(s => s - 1);

  // Skip (minimal profile — name defaults to "there")
  const handleSkip = () => {
    saveProfile({ name: 'there', profession: '', industry: '', goal: 'casual', experienceLevel: 'beginner', weaknesses: [] });
    onComplete?.();
  };

  return (
    <div className="onb-overlay">
      <div className="onb-modal">
        {/* Header */}
        <div className="onb-header">
          <div className="onb-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L22 8.5v7L12 22 2 15.5v-7L12 2Z" fill="url(#onbLogoGrad)" />
              <defs>
                <linearGradient id="onbLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c5cfc"/>
                  <stop offset="100%" stopColor="#5b8def"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="onb-header-title">ConfidenceAI</span>
          <span className="onb-header-sub">Quick Setup</span>
        </div>

        {/* Step progress */}
        <div className="onb-progress">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <React.Fragment key={i}>
              <div className={`onb-progress-dot${i + 1 <= step ? ' onb-progress-dot--done' : ''}${i + 1 === step ? ' onb-progress-dot--active' : ''}`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div className={`onb-progress-line${i + 1 < step ? ' onb-progress-line--done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="onb-content">
          {step === 1 && <Step1 data={data} onChange={setField} />}
          {step === 2 && <Step2 data={data} onChange={setField} />}
          {step === 3 && <Step3 data={data} onChange={setField} onToggleWeakness={toggleWeakness} />}
        </div>

        {/* Footer */}
        <div className="onb-footer">
          <div className="onb-footer-left">
            {step > 1 ? (
              <button className="onb-btn-back" onClick={handleBack} type="button">
                ← Back
              </button>
            ) : (
              <button className="onb-btn-skip" onClick={handleSkip} type="button">
                Skip for now
              </button>
            )}
          </div>
          <button
            id="onb-next-btn"
            className={`onb-btn-primary${canProceed() ? '' : ' onb-btn-primary--disabled'}`}
            onClick={handleNext}
            disabled={!canProceed()}
            type="button"
          >
            {step < TOTAL_STEPS ? 'Continue →' : '🚀 Start Coaching!'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserOnboardingModal;
