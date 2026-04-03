import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOTP from "./pages/VerifyOTP";
import Dashboard from "./pages/Dashboard";
import AIDashboard from "./pages/AIDashboard";
import Resources from "./pages/Resources";
import VideoAnalytics from "./pages/VideoAnalytics";
import DashboardLayout from "./components/layout/DashboardLayout";

function AppWrapper() {
  const location = useLocation();

  const isAuthRoute = ["/", "/login", "/verify", "/signup"].includes(location.pathname);

  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-white">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<VerifyOTP />} />
        </Routes>
      </div>
    );
  }

  // Dashboard layout for everything else
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ai" element={<AIDashboard />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/video/:id" element={<VideoAnalytics />} />
        
        {/* We map /reports mapping to Dashboard for now if they click it in the sidebar */}
        <Route path="/reports" element={<Dashboard />} />
        <Route path="/settings" element={<Resources />} />
      </Routes>
    </DashboardLayout>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;