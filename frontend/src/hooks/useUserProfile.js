/**
 * useUserProfile.js
 * ─────────────────────────────────────────────────────────────
 * Manages the user's profile, persisted in the DATABASE via
 * GET /profile and PUT /profile endpoints.
 *
 * Strategy:
 *   - On mount: load from localStorage immediately (instant UX),
 *     then fetch from backend and update (source of truth).
 *   - On save: write to backend + update localStorage as cache.
 *   - Falls back gracefully to localStorage if backend is down.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY   = 'confidence_ai_profile';
const PROFILE_EVENT = 'confidence_ai_profile_change';
const API_BASE      = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event(PROFILE_EVENT));
  } catch {}
}

/** Build a plain-English context string to inject into AI system prompts. */
export function buildProfilePrompt(profile) {
  if (!profile) return '';

  const goalLabels = {
    interview:  'job interview preparation (technical & behavioral)',
    speaking:   'public speaking and presentations',
    leadership: 'leadership communication and executive presence',
    casual:     'general confidence and everyday communication',
  };

  const levelLabels = {
    beginner:     'beginner (just starting out)',
    intermediate: 'intermediate (some experience)',
    advanced:     'advanced (experienced, looking to refine)',
  };

  const weaknessLabels = {
    filler_words:  'filler words (um, uh, like)',
    eye_contact:   'eye contact',
    posture:       'posture and body language',
    speaking_pace: 'speaking pace (too fast or slow)',
    nervousness:   'nervousness and anxiety',
    clarity:       'clarity and articulation',
    confidence:    'overall confidence',
  };

  const lines = [`\n--- User Profile ---`, `Name: ${profile.name}`];
  if (profile.profession) lines.push(`Profession: ${profile.profession}${profile.industry ? ` (${profile.industry})` : ''}`);
  if (profile.goal)        lines.push(`Primary goal: ${goalLabels[profile.goal] || profile.goal}`);
  if (profile.experienceLevel) lines.push(`Experience level: ${levelLabels[profile.experienceLevel] || profile.experienceLevel}`);
  if (profile.weaknesses?.length) {
    const wList = profile.weaknesses.map(w => weaknessLabels[w] || w).join(', ');
    lines.push(`Areas to improve: ${wList}`);
  }
  lines.push(
    `Personalization rules:`,
    `  - Address the user as "${profile.name}" occasionally (not every message).`,
    `  - Tailor all advice to their profession and goal.`,
    `  - Focus feedback on their stated weak areas first.`,
    `--- End Profile ---\n`,
  );
  return lines.join('\n');
}

export function useUserProfile() {
  const [profile, setProfile] = useState(() => readLocal());
  const [syncing, setSyncing] = useState(false);

  // Fetch profile from backend on mount (source of truth)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSyncing(true);
    fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.name) {
          const synced = {
            name: data.name, profession: data.profession || '',
            industry: data.industry || '', goal: data.goal || '',
            experienceLevel: data.experienceLevel || '',
            weaknesses: data.weaknesses || [],
          };
          writeLocal(synced);
          setProfile(synced);
        }
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, []);

  useEffect(() => {
    const handler = () => setProfile(readLocal());
    window.addEventListener(PROFILE_EVENT, handler);
    return () => window.removeEventListener(PROFILE_EVENT, handler);
  }, []);

  const saveProfile = useCallback(async (data) => {
    const merged = { ...readLocal(), ...data };
    writeLocal(merged);
    setProfile(merged);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch(`${API_BASE}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            name: merged.name, profession: merged.profession,
            industry: merged.industry, goal: merged.goal,
            experienceLevel: merged.experienceLevel,
            weaknesses: merged.weaknesses || [],
          }),
        });
      } catch {}
    }
  }, []);

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  }, []);

  return {
    profile,
    syncing,
    hasProfile:    profile !== null && !!profile.name,
    saveProfile,
    clearProfile,
    profilePrompt: buildProfilePrompt(profile),
  };
}

export default useUserProfile;
