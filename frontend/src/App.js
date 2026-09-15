import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOTP from "./pages/VerifyOTP";
import Dashboard from "./pages/Dashboard";
import AIDashboard from "./pages/AIDashboard";
import Resources from "./pages/Resources";
import VideoAnalytics from "./pages/VideoAnalytics";
import LiveAvatarChat from "./pages/LiveAvatarChat";
import { UserOnboardingModal } from "./components/UserOnboardingModal";
import { useUserProfile } from "./hooks/useUserProfile";

const PUBLIC_ROUTES = ["/login", "/signup", "/verify"];

function AppShell() {
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.some((r) => location.pathname.startsWith(r));
  const isLoggedIn = !!localStorage.getItem("token");
  const { hasProfile } = useUserProfile();
  const [onboardingDone, setOnboardingDone] = useState(false);

  if (isPublic) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<VerifyOTP />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
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
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai" element={<AIDashboard />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/video/:id" element={<VideoAnalytics />} />
          <Route path="/live" element={<LiveAvatarChat />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
