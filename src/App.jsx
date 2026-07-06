import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { TutorialProvider } from './lib/TutorialContext'
import TutorialOverlay from './components/TutorialOverlay'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Market from './pages/Market'
import Portfolio from './pages/Portfolio'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import Live from './pages/Live'
import ErrorBoundary from './components/ErrorBoundary'

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
        width="100%" height="100%"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-[0.08]"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1200 800"
      >
        <rect x="60" y="60" width="1080" height="680" fill="none" stroke="#39ff6a" strokeWidth="2" />
        <line x1="600" y1="60" x2="600" y2="740" stroke="#39ff6a" strokeWidth="2" />
        <circle cx="600" cy="400" r="100" fill="none" stroke="#39ff6a" strokeWidth="2" />
        <circle cx="600" cy="400" r="3" fill="#39ff6a" />
        <rect x="60" y="240" width="160" height="320" fill="none" stroke="#39ff6a" strokeWidth="2" />
        <rect x="60" y="325" width="55" height="150" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <circle cx="168" cy="400" r="2.5" fill="#39ff6a" />
        <path d="M 220 340 A 75 75 0 0 1 220 460" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <rect x="980" y="240" width="160" height="320" fill="none" stroke="#39ff6a" strokeWidth="2" />
        <rect x="1085" y="325" width="55" height="150" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <circle cx="1032" cy="400" r="2.5" fill="#39ff6a" />
        <path d="M 980 340 A 75 75 0 0 0 980 460" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <path d="M 60 80 A 20 20 0 0 1 80 60" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <path d="M 1120 60 A 20 20 0 0 1 1140 80" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <path d="M 60 720 A 20 20 0 0 0 80 740" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
        <path d="M 1120 740 A 20 20 0 0 0 1140 720" fill="none" stroke="#39ff6a" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Root: show Landing for logged-out, redirect logged-in to market
  if (location.pathname === '/') {
    if (loading) return <div className="min-h-screen bg-[#0a0b0e]" />
    if (!user) return <Landing />
    return <Navigate to="/market" replace />
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] relative">
      <PitchBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <Navbar />
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/signup"   element={<Signup />} />
          <Route path="/market"   element={<Market />} />
          <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin"    element={<Admin />} />
          <Route path="/live"     element={<Live />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TutorialOverlay />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <TutorialProvider>
            <AppRoutes />
          </TutorialProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
