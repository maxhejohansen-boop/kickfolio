import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Navbar() {
  const { user, userRecord } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        location.pathname === to
          ? 'text-white'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="border-b border-[#1e2330] bg-[#111318] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-green-400 text-xl">⚽</span>
              <span className="font-bold text-white text-lg tracking-tight">Kickfolio</span>
            </Link>
            {user && (
              <div className="hidden sm:flex items-center gap-6">
                {navLink('/market', 'Market')}
                {navLink('/portfolio', 'Portfolio')}
                {navLink('/leaderboard', 'Leaderboard')}
                {navLink('/admin', 'Simulate')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:block text-right">
                  <div className="text-xs text-gray-500 truncate max-w-[160px]">{user.email}</div>
                  <div className="text-xs font-semibold text-green-400">
                    £{userRecord?.balance?.toLocaleString('en-GB', { minimumFractionDigits: 2 }) ?? '—'}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-400 hover:text-white border border-[#1e2330] hover:border-gray-600 rounded px-3 py-1.5 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-green-500 hover:bg-green-400 text-black font-semibold rounded px-3 py-1.5 transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
        {user && (
          <div className="sm:hidden flex gap-4 pb-2">
            {navLink('/market', 'Market')}
            {navLink('/portfolio', 'Portfolio')}
            {navLink('/leaderboard', 'Leaderboard')}
            {navLink('/admin', 'Simulate')}
          </div>
        )}
      </div>
    </nav>
  )
}
