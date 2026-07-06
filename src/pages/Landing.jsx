import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/PlayerCard'
import { GRADE_META } from '../lib/gradeCalc'

const GRADE_DESCRIPTIONS = {
  A: 'Expected price 15%+ above current market',
  B: 'Expected price 8–15% above market',
  C: 'Market is pricing accurately',
  D: 'Expected price below market value',
}

const HOW_STEPS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    ),
    title: 'Pick your players',
    text: 'Browse 155+ Premier League players across all top clubs. Every player has a live share price.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.519l2.74-1.22m0 0-5.94-2.28m5.94 2.28-2.28 5.941" />
      </svg>
    ),
    title: 'Track performance',
    text: 'After every matchday, prices move based on goals, assists, ratings and minutes played. Bloomberg terminal, but for football.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
      </svg>
    ),
    title: 'Beat the market',
    text: 'Grow your £100,000 into more. Compete with other traders on the global leaderboard.',
  },
]

function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(28px)'
    el.style.transition = `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])
  return <div ref={ref} className={className}>{children}</div>
}

function PitchSVG() {
  return (
    <svg
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
      style={{ opacity: 0.06 }}
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
  )
}

export default function Landing() {
  const [previewPlayers, setPreviewPlayers] = useState([])
  const [historyMap, setHistoryMap] = useState({})
  const [matchday, setMatchday] = useState(null)

  useEffect(() => {
    async function fetchPreview() {
      const [playersRes, trackerRes] = await Promise.all([
        supabase.from('players').select('*').order('current_price', { ascending: false }).limit(4),
        supabase.from('matchday_tracker').select('current_matchday').eq('id', 1).single(),
      ])
      const players = playersRes.data ?? []
      setPreviewPlayers(players)
      setMatchday(trackerRes.data?.current_matchday ?? 0)

      if (players.length > 0) {
        const { data: history } = await supabase
          .from('price_history')
          .select('player_id, price, matchday')
          .in('player_id', players.map(p => p.id))
          .order('matchday', { ascending: true })
        const hMap = {}
        for (const r of (history ?? [])) {
          if (!hMap[r.player_id]) hMap[r.player_id] = []
          hMap[r.player_id].push({ price: r.price, matchday: r.matchday })
        }
        setHistoryMap(hMap)
      }
    }
    fetchPreview()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white">

      {/* ─── Fixed nav ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0b0e]/80 backdrop-blur-sm border-b border-white/5">
        <span className="font-black text-lg tracking-tight">⚽ Kickfolio</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors px-3 py-1.5">
            Sign In
          </Link>
          <Link to="/signup" className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg px-4 py-2 text-sm transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden pt-16">
        {/* Pitch background */}
        <div className="absolute inset-0 pointer-events-none">
          <PitchSVG />
        </div>
        {/* Bottom fade to body bg */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0a0b0e] to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto" style={{ animation: 'heroFadeUp 0.9s ease forwards' }}>
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-green-400 text-xs font-semibold mb-8 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live Premier League market
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-[1.05] tracking-tight">
            Trade football players<br />
            <span className="text-green-400">like stocks</span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Buy shares in your favourite Premier League players. Watch their prices rise and fall based on real match performance. Compete on the leaderboard.
          </p>

          <Link
            to="/signup"
            className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl px-8 py-4 text-lg transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/25"
          >
            Start with £100,000
          </Link>
          <p className="text-gray-600 text-sm mt-4">Free · No credit card · Play in your browser</p>
        </div>

        <div className="absolute bottom-8 text-gray-700" style={{ animation: 'bounce 2s infinite' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">How it works</h2>
          <p className="text-gray-500">Three steps to becoming a top trader</p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_STEPS.map((step, i) => (
            <FadeIn key={step.title} delay={i * 100}>
              <div className="bg-[#111318] border border-[#1e2330] rounded-2xl p-6 h-full">
                <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-5">
                  {step.icon}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Live market preview ─── */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-[#1e2330]">
        <FadeIn className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm font-semibold">Live market</span>
            {matchday !== null && (
              <span className="text-gray-600 text-sm">· Matchday {matchday}</span>
            )}
          </div>
          <h2 className="text-3xl font-black text-white">See who's trending</h2>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {previewPlayers.length > 0 ? previewPlayers.map((player, i) => (
            <FadeIn key={player.id} delay={i * 80}>
              <PlayerCard
                player={player}
                latestStats={null}
                appearances={0}
                priceHistory={historyMap[player.id] ?? []}
                gradeData={null}
              />
            </FadeIn>
          )) : Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#161a21] border border-[#1e2330] rounded-lg p-4 h-44 animate-pulse" />
          ))}
        </div>

        <FadeIn delay={360} className="text-center mt-8">
          <Link to="/market" className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
            Browse all 155+ players →
          </Link>
        </FadeIn>
      </section>

      {/* ─── Grade explainer ─── */}
      <section className="max-w-4xl mx-auto px-6 py-24 border-t border-[#1e2330]">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Buy smart, not blind</h2>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
            Every player is graded from A to D based on their recent form vs current market price. Never guess again — let the numbers guide you.
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(GRADE_META).map(([grade, meta], i) => (
            <FadeIn key={grade} delay={i * 80}>
              <div className="bg-[#111318] border border-[#1e2330] rounded-2xl p-5 text-center">
                <span className={`inline-block text-xl font-black px-3 py-1 rounded-lg mb-3 ${meta.pillClass}`}>
                  {grade}
                </span>
                <div className={`text-sm font-bold mb-1.5 ${meta.textClass}`}>{meta.label}</div>
                <div className="text-xs text-gray-600 leading-relaxed">{GRADE_DESCRIPTIONS[grade]}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-28 border-t border-[#1e2330]">
        <FadeIn className="text-center px-6">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Ready to trade?</h2>
          <p className="text-gray-500 text-lg mb-10">Sign up in 30 seconds. Start with £100,000. Beat your friends.</p>
          <Link
            to="/signup"
            className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl px-10 py-5 text-xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/25"
          >
            Get Started
          </Link>
        </FadeIn>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#1e2330] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-5">
            <span className="font-bold text-gray-500">⚽ Kickfolio</span>
            <a href="#" className="hover:text-gray-400 transition-colors">About</a>
            <a href="#" className="hover:text-gray-400 transition-colors">How Prices Move</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Contact</a>
          </div>
          <div>Made by Max Johansen</div>
        </div>
      </footer>

    </div>
  )
}
