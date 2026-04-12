import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOTP from "./pages/VerifyOTP";
import Dashboard from "./pages/Dashboard";
import AIDashboard from "./pages/AIDashboard";
import Resources from "./pages/Resources";
import VideoAnalytics from "./pages/VideoAnalytics";

const PUBLIC_ROUTES = ["/login", "/signup", "/verify"];

function AppShell() {
  const location = useLocation();
  const isPublic = PUBLIC_ROUTES.some((r) => location.pathname.startsWith(r));
  const isLoggedIn = !!localStorage.getItem("user");

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
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7f8fc" }}>
      <Navbar />
      <div style={{ flex: 1, overflow: "auto" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai" element={<AIDashboard />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/video/:id" element={<VideoAnalytics />} />
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
