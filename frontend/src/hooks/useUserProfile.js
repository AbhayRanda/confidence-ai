/**
 * useUserProfile.js
 * ─────────────────────────────────────────────────────────────
 * Manages the user's onboarding profile stored in localStorage.
 *
 * Profile shape:
 *   {
 *     name:            string   — user's first name
 *     profession:      string   — e.g. "Software Engineer"
 *     industry:        string   — e.g. "Technology"
 *     goal:            string   — "interview" | "speaking" | "leadership" | "casual"
 *     experienceLevel: string   — "beginner" | "intermediate" | "advanced"
 *     weaknesses:      string[] — e.g. ["filler_words", "eye_contact"]
 *   }
 *
 * Usage:
 *   const { profile, saveProfile, clearProfile, hasProfile } = useUserProfile();
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'confidence_ai_profile';
const PROFILE_EVENT = 'confidence_ai_profile_change';

/** Read raw profile from localStorage (or null). */
function readProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

  const lines = [
    `\n--- User Profile ---`,
    `Name: ${profile.name}`,
  ];

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
  const [profile, setProfile] = useState(() => readProfile());

  // Listen for changes from other components (e.g. modal saving profile)
  useEffect(() => {
    const handler = () => setProfile(readProfile());
    window.addEventListener(PROFILE_EVENT, handler);
    return () => window.removeEventListener(PROFILE_EVENT, handler);
  }, []);

  const saveProfile = useCallback((data) => {
    const merged = { ...readProfile(), ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    setProfile(merged);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  }, []);

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  }, []);

  return {
    profile,
    hasProfile: profile !== null,
    saveProfile,
    clearProfile,
    profilePrompt: buildProfilePrompt(profile),
  };
}

export default useUserProfile;
