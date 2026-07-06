import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTutorial } from '../lib/TutorialContext'
import MatchdayPill from './MatchdayPill'

export default function Navbar() {
  const { user, userRecord } = useAuth()
  const { startTutorial } = useTutorial() ?? {}
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        location.pathname === to ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="border-b border-[#1e2330] bg-[#111318] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-14">
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

          {/* Countdown — always visible, pinned to center of navbar */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block">
            <MatchdayPill channelId="matchday-pill-center" />
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div ref={menuRef} className="relative">
                {/* Balance / user area — click to open menu */}
                <button
                  data-tutorial="balance"
                  onClick={() => setMenuOpen(m => !m)}
                  className="hidden sm:flex flex-col items-end text-right cursor-pointer group"
                >
                  <span className="text-xs text-gray-500 truncate max-w-[160px] group-hover:text-gray-300 transition-colors">
                    {user.email}
                  </span>
                  <span className="text-xs font-semibold text-green-400 group-hover:text-green-300 transition-colors flex items-center gap-1">
                    £{userRecord?.balance?.toLocaleString('en-GB', { minimumFractionDigits: 2 }) ?? '—'}
                    <svg className={`w-3 h-3 text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </span>
                </button>

                {/* Mobile: just a sign-out icon */}
                <button
                  onClick={() => setMenuOpen(m => !m)}
                  className="sm:hidden text-xs text-gray-400 hover:text-white border border-[#1e2330] hover:border-gray-600 rounded px-3 py-1.5 transition-colors"
                >
                  Menu
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-[#111318] border border-[#1e2330] rounded-xl shadow-xl py-1 z-[200]">
                    <div className="px-4 py-2.5 border-b border-[#1e2330]">
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      <div className="text-sm font-semibold text-green-400 mt-0.5">
                        £{userRecord?.balance?.toLocaleString('en-GB', { minimumFractionDigits: 2 }) ?? '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => { startTutorial?.(); setMenuOpen(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[#1a1f28] flex items-center gap-2.5 transition-colors"
                    >
                      <span className="text-base">⚽</span>
                      Take the tour again
                    </button>
                    <div className="h-px bg-[#1e2330] mx-3 my-1" />
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[#1a1f28] transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
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
          <div className="sm:hidden flex items-center justify-between pb-2">
            <div className="flex gap-4">
              {navLink('/market', 'Market')}
              {navLink('/portfolio', 'Portfolio')}
              {navLink('/leaderboard', 'Leaderboard')}
              {navLink('/admin', 'Simulate')}
            </div>
            <MatchdayPill channelId="matchday-pill-mobile" />
          </div>
        )}
      </div>
    </nav>
  )
}
