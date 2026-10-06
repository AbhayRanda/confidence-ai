import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Auth.css";

/**
 * GoogleCallback — handles the redirect from our backend after Google OAuth.
 *
 * URL shape (set by /auth/google/callback in main.py):
 *   /auth/callback?token=<jwt>&email=<email>&avatar=<url>&profile=<json>
 *
 * On success: stores token + user data in localStorage → navigates to /dashboard
 * On error:   shows a friendly message with a link back to /login
 */
function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token   = searchParams.get("token");
    const email   = searchParams.get("email");
    const avatar  = searchParams.get("avatar");
    const profile = searchParams.get("profile");
    const error   = searchParams.get("error");

    if (error) {
      const messages = {
        google_denied:          "You cancelled the Google sign-in.",
        token_exchange_failed:  "Failed to authenticate with Google. Please try again.",
        incomplete_profile:     "Google did not return your profile. Please try again.",
        network_error:          "A network error occurred. Please check your connection.",
        db_error:               "A server error occurred. Please try again in a moment.",
      };
      setErrorMsg(messages[error] || "Authentication failed. Please try again.");
      return;
    }

    if (!token || !email) {
      setErrorMsg("Invalid authentication response. Please try again.");
      return;
    }

    // Store credentials in localStorage (same keys used by the rest of the app)
    localStorage.setItem("token", token);
    localStorage.setItem("user", email);
    if (avatar) {
      localStorage.setItem("avatar", avatar);
    }
    if (profile) {
      try {
        const profileData = JSON.parse(decodeURIComponent(profile));
        localStorage.setItem("userProfile", JSON.stringify(profileData));
      } catch {
        // Profile parse failed — not critical, user can set it up in onboarding
      }
    }

    // Brief delay so the spinner feels intentional, not a flash
    setTimeout(() => navigate("/dashboard", { replace: true }), 600);
  }, [searchParams, navigate]);

  if (errorMsg) {
    return (
      <div className="auth-page" style={{ justifyContent: "center" }}>
        <div className="auth-otp-box" style={{ maxWidth: 400 }}>
          <div className="auth-otp-icon">❌</div>
          <h2 className="auth-otp-title">Sign-in Failed</h2>
          <p className="auth-otp-label">{errorMsg}</p>
          <button
            className="auth-submit"
            onClick={() => navigate("/login", { replace: true })}
            style={{ marginTop: 20 }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "4px solid rgba(124,92,252,0.2)",
          borderTopColor: "#7c5cfc",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 20px",
        }} />
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
          Signing you in with Google...
        </p>
      </div>
    </div>
  );
}

export default GoogleCallback;
