import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SORT_KEYS = { G: 'goals', A: 'assists', Rating: 'rating', Old: 'oldPrice', New: 'newPrice', Change: 'changePct' }

function getResult(row) {
  const f = row.fixture
  if (!f) return null
  const isHome = row.club === f.home
  const myGoals  = isHome ? f.homeGoals : f.awayGoals
  const oppGoals = isHome ? f.awayGoals : f.homeGoals
  const label = myGoals > oppGoals ? 'W' : myGoals < oppGoals ? 'L' : 'D'
  return { label, score: `${myGoals}–${oppGoals}`, outcome: label }
}

function buildEventsFromLog(fixture, log) {
  // Derive goal timeline from player stats when fixture.events isn't available
  const used = new Set()
  function nextMinute() {
    let m
    do { m = Math.floor(Math.random() * 90) + 1 } while (used.has(m))
    used.add(m)
    return m
  }
  const events = []
  for (const row of log) {
    if (!row.played || row.goals === 0) continue
    const side = row.club === fixture.home ? 'home' : row.club === fixture.away ? 'away' : null
    if (!side) continue
    for (let i = 0; i < row.goals; i++) {
      events.push({ side, scorer: row.player, assister: null, minute: nextMinute() })
    }
  }
  return events.sort((a, b) => a.minute - b.minute)
}

function MatchModal({ fixture, log, onClose }) {
  const overlayRef = useRef(null)
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const events = fixture.events?.length > 0
    ? fixture.events
    : buildEventsFromLog(fixture, log)

  const homeWon = fixture.homeGoals > fixture.awayGoals
  const awayWon = fixture.awayGoals > fixture.homeGoals

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-[#111318] border border-[#1e2330] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-300 transition-colors text-lg leading-none">✕</button>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-right">
              <div className={`text-sm font-bold leading-tight ${homeWon ? 'text-white' : 'text-gray-500'}`}>{fixture.home}</div>
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className={`text-3xl font-black tabular-nums ${homeWon ? 'text-white' : 'text-gray-500'}`}>{fixture.homeGoals}</span>
              <span className="text-gray-700 text-lg font-light">–</span>
              <span className={`text-3xl font-black tabular-nums ${awayWon ? 'text-white' : 'text-gray-500'}`}>{fixture.awayGoals}</span>
            </div>
            <div className="text-left">
              <div className={`text-sm font-bold leading-tight ${awayWon ? 'text-white' : 'text-gray-500'}`}>{fixture.away}</div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-600 mt-3">
            {homeWon ? `${fixture.home} win` : awayWon ? `${fixture.away} win` : 'Draw'}
          </p>
        </div>

        <div className="border-t border-[#1e2330]" />

        {/* Column labels */}
        <div className="grid grid-cols-[1fr_36px_1fr] px-4 pt-3 pb-1 text-[10px] text-gray-700 uppercase tracking-widest gap-1">
          <span className="text-right">{fixture.home}</span>
          <span />
          <span className="text-left">{fixture.away}</span>
        </div>

        {/* Timeline */}
        <div className="px-4 pb-5">
          {events.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-6">No goals scored</p>
          ) : (
            events.map((ev, i) => {
              const isHome = ev.side === 'home'
              return (
                <div key={i} className="grid grid-cols-[1fr_36px_1fr] items-start gap-1 py-2 border-b border-[#1a1f28] last:border-0">
                  <div className={`text-right ${isHome ? '' : 'invisible'}`}>
                    <span className="text-sm text-white font-semibold">{ev.scorer}</span>
                    {ev.assister && <div className="text-xs text-gray-500 mt-0.5">{ev.assister} <span className="text-gray-700">(A)</span></div>}
                  </div>
                  <div className="flex flex-col items-center pt-0.5 gap-0.5">
                    <span className="text-[10px] text-gray-600 tabular-nums leading-none">{ev.minute}'</span>
                    <span className="text-sm leading-none">⚽</span>
                  </div>
                  <div className={`text-left ${!isHome ? '' : 'invisible'}`}>
                    <span className="text-sm text-white font-semibold">{ev.scorer}</span>
                    {ev.assister && <div className="text-xs text-gray-500 mt-0.5"><span className="text-gray-700">(A)</span> {ev.assister}</div>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const { user, loading } = useAuth()
  const [matchday, setMatchday] = useState(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kickfolio_last_matchday') ?? 'null') } catch { return null }
  })
  const [error, setError] = useState(null)
  const [ownedNames, setOwnedNames] = useState(new Set())
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState(0)
  const [activeFixture, setActiveFixture] = useState(null)

  useEffect(() => {
    fetchMatchday()
    if (user) fetchOwned()
  }, [user])

  async function fetchOwned() {
    const { data } = await supabase
      .from('portfolios').select('players(name)').eq('user_id', user.id).gt('shares', 0)
    setOwnedNames(new Set((data ?? []).map(h => h.players.name)))
  }

  async function fetchMatchday() {
    const { data } = await supabase
      .from('matchday_tracker').select('current_matchday').eq('id', 1).single()
    setMatchday(data?.current_matchday ?? 0)
  }

  async function runSimulation() {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('run-matchday', { body: { simulate: true } })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setResult(data)
      setMatchday(data.matchday)
      localStorage.setItem('kickfolio_last_matchday', JSON.stringify(data))
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  function handleSort(col) {
    if (sortCol !== col) { setSortCol(col); setSortDir(1) }
    else if (sortDir === 1) setSortDir(-1)
    else { setSortCol(null); setSortDir(0) }
  }

  function sortIcon(col) {
    if (sortCol !== col) return <span className="opacity-20 ml-0.5">↕</span>
    return <span className="ml-0.5 text-white">{sortDir === 1 ? '↓' : '↑'}</span>
  }

  const sortedLog = result ? [...result.log].sort((a, b) => {
    if (sortCol) {
      const k = SORT_KEYS[sortCol]
      return sortDir === 1 ? b[k] - a[k] : a[k] - b[k]
    }
    const aO = ownedNames.has(a.player) ? 1 : 0
    const bO = ownedNames.has(b.player) ? 1 : 0
    return bO !== aO ? bO - aO : b.changePct - a.changePct
  }) : []

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const nextMatchday = matchday != null ? matchday + 1 : '...'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {activeFixture && <MatchModal fixture={activeFixture} log={sortedLog} onClose={() => setActiveFixture(null)} />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-white">Simulate</h1>
          <p className="text-xs text-gray-500 mt-0.5">Matchday {matchday ?? '—'} complete · next up MD {nextMatchday}</p>
        </div>
        <button
          onClick={runSimulation}
          disabled={running || matchday == null}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-lg px-6 py-2.5 text-sm transition-colors"
        >
          {running ? 'Simulating…' : `Run MD ${nextMatchday}`}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_repeat(5,auto)] items-center px-4 py-2.5 gap-3 border-b border-[#1e2330] text-xs text-gray-600">
            <span className="w-14">Result</span>
            <span>Player</span>
            {Object.keys(SORT_KEYS).map(col => (
              <button key={col} onClick={() => handleSort(col)}
                className="hover:text-gray-400 transition-colors select-none tabular-nums w-10 text-right">
                {col}{sortIcon(col)}
              </button>
            ))}
          </div>

          {/* Player rows */}
          {sortedLog.map(row => {
            const isOwned = ownedNames.has(row.player)
            const res = getResult(row)
            const resultColor = !res ? 'text-gray-600' :
              res.outcome === 'W' ? 'text-green-400' :
              res.outcome === 'L' ? 'text-red-400' : 'text-gray-400'

            return (
              <div
                key={row.player}
                className={`grid grid-cols-[auto_1fr_repeat(5,auto)] items-center px-4 py-3 gap-3 border-b border-[#1e2330] last:border-0 text-sm ${isOwned ? 'bg-green-500/[0.03]' : ''}`}
              >
                {/* Result badge */}
                <button
                  onClick={() => { if (row.fixture) setActiveFixture(row.fixture) }}
                  className={`w-14 flex items-center gap-1 font-mono text-xs font-semibold hover:opacity-70 transition-opacity ${resultColor}`}
                >
                  {res ? <><span>{res.label}</span><span className="text-gray-600 font-normal">{res.score}</span></> : <span className="text-gray-700">—</span>}
                </button>

                {/* Player info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-medium truncate ${isOwned ? 'text-white' : 'text-gray-300'}`}>{row.player}</span>
                    {isOwned && <span className="text-[10px] bg-green-500/20 text-green-400 rounded px-1 py-0.5 leading-none shrink-0">owned</span>}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5 truncate">
                    {row.club} · {row.position}
                    {!row.played && <span className="text-orange-500/70"> · DNP — {row.dnpReason}</span>}
                  </div>
                </div>

                {/* Stats */}
                <span className="text-gray-400 tabular-nums w-10 text-right">{row.goals}</span>
                <span className="text-gray-400 tabular-nums w-10 text-right">{row.assists}</span>
                <span className={`tabular-nums w-10 text-right ${!row.played ? 'text-gray-700' : row.rating >= 7.0 ? 'text-green-400' : row.rating >= 6.5 ? 'text-orange-400' : 'text-red-400'}`}>
                  {row.played ? Number(row.rating).toFixed(1) : '—'}
                </span>
                <span className="text-gray-600 tabular-nums w-14 text-right hidden sm:block">£{Number(row.newPrice).toFixed(2)}</span>
                <span className={`tabular-nums w-12 text-right font-medium ${row.changePct > 0 ? 'text-green-400' : row.changePct < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                  {row.changePct > 0 ? '+' : ''}{row.changePct.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
