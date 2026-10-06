import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import Navbar from "./components/Navbar";
import PageLoader from "./components/PageLoader";
// Auth pages are small — keep them eager so login feels instant
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOTP from "./pages/VerifyOTP";
import GoogleCallback from "./pages/GoogleCallback";
import { UserOnboardingModal } from "./components/UserOnboardingModal";
import { useUserProfile } from "./hooks/useUserProfile";
import { ThemeProvider } from "./context/ThemeContext";

// ── Code-split heavy pages ────────────────────────────────────
// Each lazy() call creates a separate JS chunk fetched on first visit,
// cutting the initial bundle by ~100 KB+.
const Dashboard     = lazy(() => import("./pages/Dashboard"));
const AIDashboard   = lazy(() => import("./pages/AIDashboard"));
const Resources     = lazy(() => import("./pages/Resources"));
const VideoAnalytics = lazy(() => import("./pages/VideoAnalytics"));
const LiveAvatarChat = lazy(() => import("./pages/LiveAvatarChat"));

const PUBLIC_ROUTES = ["/login", "/signup", "/verify", "/auth/callback"];

// ── Inner shell (needs router context for useNavigate) ────────
function AppShell() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const isPublic  = PUBLIC_ROUTES.some((r) => location.pathname.startsWith(r));
  const isLoggedIn = !!localStorage.getItem("token");
  const { hasProfile } = useUserProfile();
  const [onboardingDone, setOnboardingDone] = useState(false);

  // ── 401 / session-expired handler ──────────────────────────
  // apiFetch() in src/utils/api.js fires this event when any request
  // receives a 401 Unauthorized response, so we redirect to /login
  // automatically from a single place instead of in every page.
  const handleAuthExpired = useCallback(() => {
    toast.error("Your session has expired. Please sign in again.", {
      toastId: "session-expired", // prevent duplicate toasts
      position: "top-center",
      autoClose: 4000,
    });
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, [handleAuthExpired]);

  if (isPublic) {
    return (
      <Routes>
        <Route path="/login"         element={<Login />} />
        <Route path="/signup"        element={<Signup />} />
        <Route path="/verify"        element={<VerifyOTP />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />
        <Route path="*"              element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      {/* Onboarding modal — shown once to new users */}
      {!hasProfile && !onboardingDone && (
        <UserOnboardingModal onComplete={() => setOnboardingDone(true)} />
      )}
      <Navbar />
      <div className="app-content">
        {/* Suspense wraps lazy routes — PageLoader shows during chunk fetch */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"           element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/ai"         element={<AIDashboard />} />
            <Route path="/resources"  element={<Resources />} />
            <Route path="/video/:id"  element={<VideoAnalytics />} />
            <Route path="/live"       element={<LiveAvatarChat />} />
            <Route path="*"           element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppShell />
        {/* Single ToastContainer for the whole app */}
        <ToastContainer
          theme="dark"
          position="top-right"
          autoClose={3500}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss={false}
          pauseOnHover
        />
      </Router>
    </ThemeProvider>
  );
}

export default App;
