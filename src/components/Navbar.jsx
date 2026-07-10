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
  const [portfolioValue, setPortfolioValue] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const prevBalanceRef = useRef(null)
  const [deltaPop, setDeltaPop] = useState(null) // { full, current, fading }
  const tickerRef = useRef(null)

  // Animate a delta chip when balance changes
  useEffect(() => {
    if (!userRecord) return
    const newBal = Number(userRecord.balance ?? 0)

    if (prevBalanceRef.current !== null) {
      const delta = newBal - prevBalanceRef.current
      if (Math.abs(delta) >= 0.01) {
        if (tickerRef.current) clearInterval(tickerRef.current)

        const totalMs = 1600
        const intervalMs = 16
        const steps = totalMs / intervalMs
        let step = 0

        setDeltaPop({ full: delta, current: delta, fading: false })

        tickerRef.current = setInterval(() => {
          step++
          const progress = step / steps
          if (progress >= 1) {
            clearInterval(tickerRef.current)
            tickerRef.current = null
            setDeltaPop(prev => prev ? { ...prev, current: 0, fading: true } : null)
            setTimeout(() => setDeltaPop(null), 350)
            return
          }
          // quadratic ease-out: starts fast, slows to 0
          const remaining = 1 - Math.pow(progress, 2)
          setDeltaPop({ full: delta, current: delta * remaining, fading: false })
        }, intervalMs)
      }
    }

    prevBalanceRef.current = newBal
  }, [userRecord?.balance])

  useEffect(() => () => { if (tickerRef.current) clearInterval(tickerRef.current) }, [])

  useEffect(() => {
    if (!user) { setPortfolioValue(0); return }
    supabase
      .from('portfolios')
      .select('shares, players(current_price)')
      .eq('user_id', user.id)
      .gt('shares', 0)
      .then(({ data }) => {
        const val = (data ?? []).reduce((s, h) => s + h.shares * Number(h.players.current_price), 0)
        setPortfolioValue(val)
      })
  }, [user?.id, userRecord?.balance])

  useEffect(() => {
    if (!user) { setUnreadCount(0); return }
    supabase
      .from('inbox_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))

    const ch = supabase.channel('navbar-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_messages', filter: `user_id=eq.${user.id}` },
        () => {
          supabase
            .from('inbox_messages')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false)
            .then(({ count }) => setUnreadCount(count ?? 0))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

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

  const navLink = (to, label, badge) => (
    <Link
      to={to}
      className={`relative text-sm font-medium transition-colors ${
        location.pathname === to ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
      {badge > 0 && (
        <span className="absolute -top-2.5 -right-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 leading-none ring-2 ring-[#111318]">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )

  return (
    <nav className="border-b border-[#1e2330] bg-[#111318] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-green-400 text-xl">⚽</span>
              <span className="font-bold text-white text-lg tracking-tight">Kickfolio</span>
            </Link>
            {user && (
              <div className="hidden sm:flex items-center gap-6">
                {navLink('/inbox', 'Inbox', unreadCount)}
                {navLink('/market', 'Market')}
                {navLink('/portfolio', 'Portfolio')}
                {navLink('/scouting', 'Scouting')}
                {navLink('/leaderboard', 'Leaderboard')}
                {navLink('/admin', 'Simulate')}
              </div>
            )}
          </div>

          {/* Pill — flex item between nav links and wallet, never overlaps */}
          <div className="hidden sm:block flex-shrink-0">
            <MatchdayPill channelId="matchday-pill-center" />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {user ? (
              <div ref={menuRef} className="relative">
                {/* Balance / user area — click to open menu */}
                <div className="relative">
                  {deltaPop && (
                    <div
                      style={{ opacity: deltaPop.fading ? 0 : 1, transition: 'opacity 0.35s ease' }}
                      className={`absolute right-0 bottom-full mb-1.5 text-[11px] font-bold tabular-nums whitespace-nowrap px-2.5 py-0.5 rounded-full pointer-events-none select-none ${
                        deltaPop.full > 0
                          ? 'text-green-400 bg-green-500/15 border border-green-500/30'
                          : 'text-red-400 bg-red-500/15 border border-red-500/30'
                      }`}
                    >
                      {deltaPop.full > 0 ? '+' : '−'}£{Math.abs(deltaPop.current).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                  <button
                    data-tutorial="balance"
                    onClick={() => setMenuOpen(m => !m)}
                    className="hidden sm:flex flex-col items-end text-right cursor-pointer group"
                  >
                    <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors flex items-center gap-1">
                      Cash
                      <svg className={`w-3 h-3 text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </span>
                    <span className="text-sm font-bold text-white group-hover:text-green-300 transition-colors tabular-nums">
                      £{userRecord ? (userRecord.balance ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </span>
                  </button>
                </div>

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
                      <div className="text-xs text-gray-500 truncate mb-2">{user.email}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Cash</span>
                          <span className="text-sm font-bold text-white tabular-nums">
                            £{(userRecord?.balance ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Portfolio</span>
                          <span className="text-xs font-medium text-gray-400 tabular-nums">
                            £{portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-[#1e2330]">
                          <span className="text-xs text-gray-500">Total</span>
                          <span className="text-xs font-semibold text-gray-300 tabular-nums">
                            £{userRecord ? ((userRecord.balance ?? 0) + portfolioValue).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </span>
                        </div>
                        {userRecord && (() => {
                          const pl = (userRecord.balance ?? 0) + portfolioValue - 100_000
                          const pct = (pl / 100_000) * 100
                          return (
                            <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-[#1e2330]">
                              <span className="text-xs text-gray-500">Lifetime P&L</span>
                              <div className="text-right">
                                <span className={`text-xs font-bold tabular-nums ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pl >= 0 ? '+' : ''}£{pl.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className={`block text-[10px] tabular-nums ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          )
                        })()}
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
              {navLink('/inbox', 'Inbox', unreadCount)}
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
