import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  Smile,
  Activity,
  Mic,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Play,
  TrendingUp,
  Cpu,
  Award,
} from "lucide-react";
import "./Landing.css";

export default function Landing() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleStart = () => {
    if (token) {
      navigate("/dashboard");
    } else {
      navigate("/signup");
    }
  };

  return (
    <div className="landing-page">
      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <Link to="/" className="landing-brand">
            <div className="landing-brand-icon">
              <Sparkles size={20} className="landing-sparkle" />
            </div>
            <span className="landing-brand-text">Confidence AI</span>
          </Link>

          <nav className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#drills">Practice Modes</a>
            <a href="#testimonials">Testimonials</a>
          </nav>

          <div className="landing-nav-actions">
            {token ? (
              <Link to="/dashboard" className="landing-btn landing-btn--primary">
                Open Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="landing-btn landing-btn--text">
                  Sign In
                </Link>
                <Link to="/signup" className="landing-btn landing-btn--primary">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-backdrop" />
        <div className="landing-container landing-hero-content">
          <div className="landing-pill">
            <Sparkles size={14} />
            <span>Next-Generation AI Personality & Communication Coach</span>
          </div>

          <h1 className="landing-title">
            Master Every Room.<br />
            <span className="landing-title-gradient">Speak With Complete Confidence.</span>
          </h1>

          <p className="landing-subtitle">
            AI-driven video analysis that tracks your gaze, facial expressions, body posture,
            and vocal pacing in real-time. Practice presentations and interviews with our interactive
            3D avatar coach.
          </p>

          <div className="landing-hero-cta">
            <button onClick={handleStart} className="landing-btn-hero-primary">
              Start Free Assessment <ArrowRight size={18} />
            </button>
            <a href="#how-it-works" className="landing-btn-hero-secondary">
              <Play size={16} fill="currentColor" /> See How It Works
            </a>
          </div>

          {/* Social Proof Stats Bar */}
          <div className="landing-stats-grid">
            <div className="landing-stat-card">
              <div className="landing-stat-num">98.4%</div>
              <div className="landing-stat-label">User Confidence Increase</div>
            </div>
            <div className="landing-stat-card">
              <div className="landing-stat-num">6-Axis</div>
              <div className="landing-stat-label">Real-Time Biometric Tracking</div>
            </div>
            <div className="landing-stat-card">
              <div className="landing-stat-num">&lt; 0.2s</div>
              <div className="landing-stat-label">Feedback Latency</div>
            </div>
            <div className="landing-stat-card">
              <div className="landing-stat-num">3D VRM</div>
              <div className="landing-stat-label">Interactive Humanoid Mentor</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Comprehensive Communication Analysis</h2>
            <p className="landing-section-desc">
              Objective biometric metrics paired with empathetic AI guidance to elevate your presence.
            </p>
          </div>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: "rgba(124, 92, 252, 0.15)", color: "#a78bfa" }}>
                <Eye size={24} />
              </div>
              <h3 className="landing-feature-name">Gaze & Eye Contact Estimation</h3>
              <p className="landing-feature-text">
                Calculates direct camera gaze engagement percentages and highlights moments where eye contact drifted.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                <Activity size={24} />
              </div>
              <h3 className="landing-feature-name">Posture & Gesture Detection</h3>
              <p className="landing-feature-text">
                Evaluates shoulder leveling, spine alignment, and expressive hand gestures using 33 skeletal landmark points.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                <Smile size={24} />
              </div>
              <h3 className="landing-feature-name">Warmth & Expression Recognition</h3>
              <p className="landing-feature-text">
                Monitors natural micro-expressions and smiling frequency to ensure your delivery feels approachable and engaging.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
                <Mic size={24} />
              </div>
              <h3 className="landing-feature-name">Vocal Cadence & Filler Analysis</h3>
              <p className="landing-feature-text">
                Counts hesitation sounds like "um" and "uh", clocks your exact words-per-minute, and identifies unnatural pauses.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: "rgba(236, 72, 153, 0.15)", color: "#f472b6" }}>
                <Cpu size={24} />
              </div>
              <h3 className="landing-feature-name">3D Avatar Personality Coach</h3>
              <p className="landing-feature-text">
                Conduct live voice conversations with our 3D VRM humanoid mentor with natural lip-sync, phonemes, and empathetic cues.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#c084fc" }}>
                <TrendingUp size={24} />
              </div>
              <h3 className="landing-feature-name">Actionable 7-Day Growth Plans</h3>
              <p className="landing-feature-text">
                Receive personalized daily exercises, improved speech scripts, and strength/weakness matrices after each practice run.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="landing-section landing-section--alt">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">How Confidence AI Works</h2>
            <p className="landing-section-desc">
              Three seamless steps from video recording to measurable communication mastery.
            </p>
          </div>

          <div className="landing-steps-grid">
            <div className="landing-step-card">
              <div className="landing-step-badge">Step 1</div>
              <h3 className="landing-step-title">Record or Upload</h3>
              <p className="landing-step-text">
                Record a 30 to 60-second response in your browser or upload an existing presentation clip.
              </p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-badge">Step 2</div>
              <h3 className="landing-step-title">Multi-Modal AI Pipeline</h3>
              <p className="landing-step-text">
                Computer vision models analyze every frame while Whisper transcribes and parses your speech cadence.
              </p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-badge">Step 3</div>
              <h3 className="landing-step-title">Review & Refine</h3>
              <p className="landing-step-text">
                Explore second-by-second timeline insights, practice targeted drills, and watch your confidence score compound.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Practice Drills Banner */}
      <section id="drills" className="landing-section">
        <div className="landing-container">
          <div className="landing-cta-banner">
            <div className="landing-cta-content">
              <h2 className="landing-cta-title">Ready to Elevate Your Communication?</h2>
              <p className="landing-cta-desc">
                Join thousands of professionals, students, and public speakers building genuine executive presence.
              </p>
              <div className="landing-cta-features">
                <span><CheckCircle2 size={16} /> Free Forever Tier</span>
                <span><ShieldCheck size={16} /> Private & Encrypted</span>
                <span><Award size={16} /> Science-Backed Scoring</span>
              </div>
              <button onClick={handleStart} className="landing-btn-hero-primary" style={{ marginTop: "24px" }}>
                Create Your Account Now <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-content">
          <div className="landing-footer-brand">
            <div className="landing-brand-text">Confidence AI</div>
            <p className="landing-footer-sub">
              Empowering individuals to communicate authentically, clearly, and boldly.
            </p>
          </div>
          <div className="landing-footer-copyright">
            © {new Date().getFullYear()} Confidence AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

