import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Market from './pages/Market'
import Portfolio from './pages/Portfolio'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PitchBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-[0.08]"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1200 800"
      >
        {/* Pitch outline */}
        <rect x="60" y="60" width="1080" height="680" fill="none" stroke="#39ff6a" strokeWidth="2" />

        {/* Halfway line */}
        <line x1="600" y1="60" x2="600" y2="740" stroke="#39ff6a" strokeWidth="2" />

        {/* Centre circle */}
        <circle cx="600" cy="400" r="100" fill="none" stroke="#39ff6a" strokeWidth="2" />
        <circle cx="600" cy="400" r="3" fill="#39ff6a" />

        {/* Left penalty area */}
        <rect x="60" y="240" width="160" height="320" fill="none" stroke="#39ff6a" strokeWidth="2" />
        {/* Left 6-yard box */}
        <rect x="60" y="325" width="55" height="150" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        {/* Left penalty spot */}
        <circle cx="168" cy="400" r="2.5" fill="#39ff6a" />
        {/* Left penalty arc */}
        <path d="M 220 340 A 75 75 0 0 1 220 460" fill="none" stroke="#39ff6a" strokeWidth="1.5" />

        {/* Right penalty area */}
        <rect x="980" y="240" width="160" height="320" fill="none" stroke="#39ff6a" strokeWidth="2" />
        {/* Right 6-yard box */}
        <rect x="1085" y="325" width="55" height="150" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        {/* Right penalty spot */}
        <circle cx="1032" cy="400" r="2.5" fill="#39ff6a" />
        {/* Right penalty arc */}
        <path d="M 980 340 A 75 75 0 0 0 980 460" fill="none" stroke="#39ff6a" strokeWidth="1.5" />

        {/* Corner arcs */}
        <path d="M 60 80 A 20 20 0 0 1 80 60" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <path d="M 1120 60 A 20 20 0 0 1 1140 80" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <path d="M 60 720 A 20 20 0 0 0 80 740" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <path d="M 1120 740 A 20 20 0 0 0 1140 720" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-[#0a0b0e] relative">
      <PitchBackground />
      <div className="relative" style={{ zIndex: 1 }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/market" element={<Market />} />
        <Route path="/portfolio" element={
          <ProtectedRoute><Portfolio /></ProtectedRoute>
        } />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
