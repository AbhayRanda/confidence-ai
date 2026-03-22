import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOTP from "./pages/VerifyOTP";
import Dashboard from "./pages/Dashboard";
import AIDashboard from "./pages/AIDashboard";
import Resources from "./pages/Resources";
import VideoAnalytics from "./pages/VideoAnalytics";
function AppWrapper() {
  const location = useLocation();

  const hideNavbarRoutes = ["/", "/login", "/verify", "/signup"];
  const shouldShowNavbar = !hideNavbarRoutes.includes(location.pathname);
  return (
      <div style={styles.page}>
        {shouldShowNavbar && <Navbar />}

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<VerifyOTP />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai" element={<AIDashboard />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/video/:id" element={<VideoAnalytics />} />
        </Routes>
      </div>
  );
}
function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
  },
};

export default App;