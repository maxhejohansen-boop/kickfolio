import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import PlayerModal from '../components/PlayerModal'

const SORT_OPTIONS = ['Biggest movers', 'By club', 'My portfolio']

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function FlashPrice({ price, changeDir }) {
  const [flash, setFlash] = useState(null)
  const prev = useRef(price)

  useEffect(() => {
    if (price !== prev.current) {
      setFlash(changeDir)
      prev.current = price
      const t = setTimeout(() => setFlash(null), 900)
      return () => clearTimeout(t)
    }
  }, [price, changeDir])

  return (
    <span
      className={`font-bold transition-colors ${
        flash === 'up'   ? 'live-flash-green' :
        flash === 'down' ? 'live-flash-red'   : 'text-white'
      }`}
    >
      £{Number(price).toFixed(2)}
    </span>
  )
}

function LivePlayerCard({ player, stats, livePrice, changePct, onClick }) {
  const isUp   = (changePct ?? 0) > 0
  const isDown = (changePct ?? 0) < 0
  const hasStats = stats !== null

  return (
    <div
      onClick={onClick}
      className="bg-[#111318] border border-[#1e2330] hover:border-gray-600 rounded-lg p-3 cursor-pointer transition-all hover:bg-[#161a21]"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#1e2330] overflow-hidden flex-shrink-0">
            {player.image_url
              ? <img src={player.image_url} alt={player.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }}/>
              : <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">{player.name[0]}</div>
            }
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{player.name}</div>
            <div className="text-gray-600 text-[10px]">{player.club}</div>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1e2330] ${
          player.position === 'Forward'    ? 'text-orange-400' :
          player.position === 'Midfielder' ? 'text-blue-400'   :
          player.position === 'Defender'   ? 'text-purple-400' : 'text-yellow-400'
        }`}>
          {player.position === 'Goalkeeper' ? 'GK' : player.position.slice(0, 3).toUpperCase()}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div className="text-lg leading-tight">
          <FlashPrice price={livePrice ?? player.current_price} changeDir={isUp ? 'up' : isDown ? 'down' : null}/>
        </div>
        {changePct !== undefined && changePct !== null ? (
          <span className={`text-xs font-semibold ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-500'}`}>
            {isUp ? '+' : ''}{Number(changePct).toFixed(1)}%
          </span>
        ) : (
          <span className="text-[10px] text-gray-700 italic">pending…</span>
        )}
      </div>

      {hasStats && (
        <div className="mt-2 pt-2 border-t border-[#1e2330] grid grid-cols-3 gap-1 text-center">
          {stats.minutes === 0 ? (
            <div className="col-span-3 text-[10px] text-orange-400">DNP — {stats.dnp_reason}</div>
          ) : player.position !== 'Goalkeeper' ? (
            <>
              <Stat label="G" value={stats.goals}/>
              <Stat label="A" value={stats.assists}/>
              <Stat label="⭐" value={stats.rating?.toFixed(1) ?? '—'}/>
            </>
          ) : (
            <>
              <Stat label="Sv" value={stats.saves}/>
              <Stat label="CS" value={stats.clean_sheet ? '✓' : '✗'} color={stats.clean_sheet ? 'text-green-400' : 'text-gray-500'}/>
              <Stat label="⭐" value={stats.rating?.toFixed(1) ?? '—'}/>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }) {
  return (
    <div>
      <div className={`text-xs font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-gray-600">{label}</div>
    </div>
  )
}

function MatchdaySummary({ players, liveChanges, livePrices, liveStats, matchdayNumber }) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

  // Players with resolved change data
  const withChange = players
    .map(p => ({ ...p, changePct: liveChanges[p.id] ?? 0, livePrice: livePrices[p.id] ?? p.current_price }))
    .filter(p => liveChanges[p.id] !== undefined)

  const gainers = [...withChange].sort((a, b) => b.changePct - a.changePct).slice(0, 4).filter(p => p.changePct > 0)
  const losers  = [...withChange].sort((a, b) => a.changePct - b.changePct).slice(0, 4).filter(p => p.changePct < 0)

  // Man of the match: highest rating among players who actually played
  const motm = Object.entries(liveStats)
    .filter(([, s]) => s.minutes > 0 && s.rating != null)
    .sort(([, a], [, b]) => b.rating - a.rating)[0]

  const motmPlayer = motm ? playerMap[motm[0]] : null
  const motmStats  = motm ? motm[1] : null

  const totalGoals   = Object.values(liveStats).reduce((s, r) => s + (r.goals ?? 0), 0)
  const totalPlayed  = Object.values(liveStats).filter(r => r.minutes > 0).length
  const totalDNP     = Object.values(liveStats).filter(r => r.minutes === 0).length

  return (
    <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden mb-4">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1e2330] flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">Matchday {matchdayNumber} — Final</h2>
          <p className="text-gray-600 text-xs mt-0.5">{totalPlayed} players played · {totalGoals} goals · {totalDNP} DNP</p>
        </div>
        <Link to="/market" className="text-xs bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
          View market →
        </Link>
      </div>

      <div className="p-5 space-y-5">
        {/* Man of the match */}
        {motmPlayer && motmStats && (
          <div className="bg-[#0d1117] rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="text-yellow-400 text-lg flex-shrink-0">⭐</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-yellow-400/70 font-semibold uppercase tracking-wider mb-0.5">Man of the match</div>
              <div className="text-white font-semibold text-sm truncate">{motmPlayer.name}
                <span className="text-gray-600 font-normal ml-1.5 text-xs">{motmPlayer.club}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {motmPlayer.position === 'Goalkeeper'
                  ? `${motmStats.saves ?? 0} saves${motmStats.clean_sheet ? ' · Clean sheet' : ''} · ${Number(motmStats.rating).toFixed(1)} rating`
                  : `${motmStats.goals ?? 0}G ${motmStats.assists ?? 0}A · ${Number(motmStats.rating).toFixed(1)} rating`
                }
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-sm font-bold ${(liveChanges[motmPlayer.id] ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(liveChanges[motmPlayer.id] ?? 0) >= 0 ? '+' : ''}{Number(liveChanges[motmPlayer.id] ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600">£{Number(livePrices[motmPlayer.id] ?? motmPlayer.current_price).toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Movers */}
        <div className="grid grid-cols-2 gap-3">
          {/* Gainers */}
          <div>
            <div className="text-[10px] text-green-400/70 font-semibold uppercase tracking-wider mb-2">Top gains</div>
            <div className="space-y-2">
              {gainers.length === 0 && <p className="text-xs text-gray-700 italic">None</p>}
              {gainers.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-white font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-600 truncate">{p.club}</div>
                  </div>
                  <span className="text-xs font-bold text-green-400 flex-shrink-0">+{Number(p.changePct).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Losers */}
          <div>
            <div className="text-[10px] text-red-400/70 font-semibold uppercase tracking-wider mb-2">Top drops</div>
            <div className="space-y-2">
              {losers.length === 0 && <p className="text-xs text-gray-700 italic">None</p>}
              {losers.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-white font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-600 truncate">{p.club}</div>
                  </div>
                  <span className="text-xs font-bold text-red-400 flex-shrink-0">{Number(p.changePct).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Live() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [matchdayStatus, setMatchdayStatus] = useState(null)
  const [players, setPlayers] = useState([])
  const [liveStats, setLiveStats]   = useState({})   // player_id → matchday_stats row
  const [livePrices, setLivePrices] = useState({})   // player_id → price
  const [liveChanges, setLiveChanges] = useState({}) // player_id → change_pct
  const [events, setEvents] = useState([])            // live feed
  const [portfolio, setPortfolio] = useState(new Set())
  const [sort, setSort] = useState('Biggest movers')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [tick, setTick] = useState(Date.now())

  // ─── Fetch initial data ─────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [statusRes, playersRes] = await Promise.all([
        supabase.from('matchday_status').select('*').eq('id', 1).single(),
        supabase.from('players').select('*').order('current_price', { ascending: false }),
      ])

      const status = statusRes.data
      setMatchdayStatus(status)
      setPlayers(playersRes.data ?? [])

      if (!status?.matchday_number) return

      // Load existing stats + ticks for this matchday session
      const [statsRes, ticksRes] = await Promise.all([
        supabase.from('matchday_stats').select('*').eq('matchday', status.matchday_number),
        supabase.from('live_ticks').select('*, players(name)').order('created_at', { ascending: false }).limit(100),
      ])

      const sMap = {}
      for (const s of (statsRes.data ?? [])) sMap[s.player_id] = s
      setLiveStats(sMap)

      const pMap = {}, cMap = {}
      for (const t of (ticksRes.data ?? [])) {
        pMap[t.player_id] = t.price
        cMap[t.player_id] = t.price_change_pct
      }
      setLivePrices(pMap)
      setLiveChanges(cMap)

      const feed = (ticksRes.data ?? [])
        .filter(t => t.event_text)
        .map(t => ({ id: t.id, text: t.event_text, time: t.created_at, player_id: t.player_id }))
      setEvents(feed)
    }
    load()
  }, [])

  // Load user portfolio
  useEffect(() => {
    if (!user) return
    supabase.from('portfolios').select('player_id').eq('user_id', user.id).gt('shares', 0)
      .then(({ data }) => setPortfolio(new Set((data ?? []).map(r => r.player_id))))
  }, [user])

  // ─── Realtime subscriptions ─────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel('live-matchday-page')

      // matchday_status changes (go live, complete)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matchday_status', filter: 'id=eq.1'
      }, ({ new: row }) => {
        setMatchdayStatus(row)
      })

      // new live_tick → update price + feed
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'live_ticks'
      }, ({ new: tick }) => {
        setLivePrices(m => ({ ...m, [tick.player_id]: tick.price }))
        setLiveChanges(m => ({ ...m, [tick.player_id]: tick.price_change_pct }))
        if (tick.event_text) {
          setEvents(ev => [{ id: tick.id, text: tick.event_text, time: tick.created_at, player_id: tick.player_id }, ...ev].slice(0, 80))
        }
      })

      // matchday_stats INSERT → show player's revealed stats
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'matchday_stats'
      }, ({ new: row }) => {
        setLiveStats(m => ({ ...m, [row.player_id]: row }))
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // 1-second ticker for countdown
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ─── Status — flip to completed client-side the moment the clock hits 0 ───
  const dbStatus  = matchdayStatus?.status
  const endsAt    = matchdayStatus?.ends_at ? new Date(matchdayStatus.ends_at) : null
  const startedAt = matchdayStatus?.started_at ? new Date(matchdayStatus.started_at) : null
  const remainingMs = dbStatus === 'live' && endsAt ? Math.max(0, endsAt - Date.now()) : 0
  const isLive      = dbStatus === 'live' && remainingMs > 0
  const isCompleted = dbStatus === 'completed' || (dbStatus === 'live' && endsAt != null && remainingMs === 0)

  // Scale real 300s window → 90 match minutes
  const elapsedSecs  = isLive && startedAt ? Math.max(0, (Date.now() - startedAt.getTime()) / 1000) : 0
  const matchMinute  = Math.min(90, Math.floor(elapsedSecs * 90 / 300))

  // ─── Sorting ────────────────────────────────────────────────
  const sorted = isLive
    ? // Live: hide explicit DNPs, pin owned players at top, sort rest by rating
      [...players]
        .filter(p => {
          const s = liveStats[p.id]
          return !s || s.minutes > 0   // keep players with no stats yet or who played
        })
        .sort((a, b) => {
          const aOwned = portfolio.has(a.id) ? 1 : 0
          const bOwned = portfolio.has(b.id) ? 1 : 0
          if (aOwned !== bOwned) return bOwned - aOwned
          const aRating = liveStats[a.id]?.rating ?? -1
          const bRating = liveStats[b.id]?.rating ?? -1
          return bRating - aRating
        })
    : // Completed: user-controlled filter
      [...players]
        .filter(p => sort !== 'My portfolio' || portfolio.has(p.id))
        .sort((a, b) => {
          const aDnp = liveStats[a.id]?.minutes === 0 ? 1 : 0
          const bDnp = liveStats[b.id]?.minutes === 0 ? 1 : 0
          if (aDnp !== bDnp) return aDnp - bDnp
          if (sort === 'By club') return a.club.localeCompare(b.club) || a.name.localeCompare(b.name)
          if (sort === 'Biggest movers') {
            const ca = Math.abs(liveChanges[a.id] ?? 0)
            const cb = Math.abs(liveChanges[b.id] ?? 0)
            return cb - ca
          }
          return 0
        })

  return (
    <div className="min-h-screen bg-[#0a0b0e]">

      {/* ─── Header ─── */}
      <div className={`sticky top-14 z-40 border-b ${isLive ? 'border-red-500/20 bg-[#0d0505]/95' : 'border-[#1e2330] bg-[#0a0b0e]/95'} backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isLive && <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"/>}
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">
                Matchday {matchdayStatus?.matchday_number ?? '—'}
                {isLive && <span className="text-red-400 ml-2">· LIVE</span>}
                {isCompleted && <span className="text-gray-500 ml-2">· Completed</span>}
                {!isLive && !isCompleted && <span className="text-gray-500 ml-2">· Not live yet</span>}
              </h1>
              {isLive && (
                <p className="text-xs text-red-400/70 flex items-center gap-2">
                  <span className="font-bold text-red-400 tabular-nums">{matchMinute}'</span>
                  <span className="text-red-400/40">·</span>
                  <span>{fmt(remainingMs)} remaining</span>
                </p>
              )}
            </div>
          </div>

          {isLive ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              {user && portfolio.size > 0 && <span className="text-green-500/70 font-medium">Your players pinned</span>}
              {user && portfolio.size > 0 && <span>·</span>}
              <span>Sorted by rating</span>
            </div>
          ) : (
            <div className="flex bg-[#111318] border border-[#1e2330] rounded-lg p-1 gap-0.5">
              {SORT_OPTIONS.filter(opt => opt !== 'My portfolio' || user).map(opt => (
                <button
                  key={opt}
                  onClick={() => setSort(opt)}
                  className={`text-xs font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                    sort === opt
                      ? 'bg-white/10 text-white'
                      : 'text-gray-500 hover:text-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Not live placeholder ─── */}
      {!isLive && !isCompleted && (
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">⚽</div>
          <h2 className="text-white text-2xl font-bold mb-2">No active matchday</h2>
          <p className="text-gray-500 mb-6">The next matchday kicks off at 15:00 Lisbon time.</p>
          <Link to="/market" className="text-green-400 hover:text-green-300 text-sm font-medium">← Back to Market</Link>
        </div>
      )}

      {/* ─── LIVE layout: card grid + feed sidebar ─── */}
      {isLive && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-4">

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sorted.map(player => (
                  <LivePlayerCard
                    key={player.id}
                    player={player}
                    stats={liveStats[player.id] ?? null}
                    livePrice={livePrices[player.id]}
                    changePct={liveChanges[player.id]}
                    onClick={() => setSelectedPlayer(player)}
                  />
                ))}
              </div>
            </div>

            <div className="lg:w-80 flex-shrink-0">
              <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden sticky top-28">
                <div className="px-4 py-3 border-b border-[#1e2330] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>
                  <span className="text-white text-sm font-semibold">Live feed</span>
                  <span className="text-gray-600 text-xs ml-auto">{events.length} events</span>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                  {events.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-600 text-sm">Waiting for first events…</div>
                  ) : events.map((ev, i) => (
                    <div key={ev.id ?? i} className="px-4 py-2.5 border-b border-[#161a21] hover:bg-[#161a21] transition-colors">
                      <div className="text-[10px] text-gray-600 mb-0.5">
                        {new Date(ev.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-xs text-gray-300 leading-snug">{ev.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── COMPLETED layout: summary + results table ─── */}
      {isCompleted && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

          {Object.keys(liveStats).length > 0 && (
            <MatchdaySummary
              players={players}
              liveChanges={liveChanges}
              livePrices={livePrices}
              liveStats={liveStats}
              matchdayNumber={matchdayStatus?.matchday_number}
            />
          )}

          {/* Full results table */}
          {players.length > 0 && (
            <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1e2330]">
                <span className="text-white text-sm font-semibold">Full results</span>
                <span className="text-gray-600 text-xs ml-2">{sorted.length} players</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2330]">
                      <th className="text-left text-xs text-gray-600 font-medium px-4 py-2.5">Player</th>
                      <th className="text-center text-xs text-gray-600 font-medium px-3 py-2.5 w-10">Min</th>
                      <th className="text-center text-xs text-gray-600 font-medium px-3 py-2.5 w-12">Stat 1</th>
                      <th className="text-center text-xs text-gray-600 font-medium px-3 py-2.5 w-12">Stat 2</th>
                      <th className="text-center text-xs text-gray-600 font-medium px-3 py-2.5 w-14">Rating</th>
                      <th className="text-right text-xs text-gray-600 font-medium px-4 py-2.5 w-20">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((player, idx) => {
                        const stats        = liveStats[player.id]
                        const change       = liveChanges[player.id] ?? 0
                        const isGK         = player.position === 'Goalkeeper'
                        const played       = stats && stats.minutes > 0
                        const owned        = portfolio.has(player.id)
                        const prevClub     = idx > 0 ? sorted[idx - 1].club : null
                        const showClubHdr  = sort === 'By club' && player.club !== prevClub

                        return [
                          showClubHdr && (
                            <tr key={`club-${player.club}`}>
                              <td colSpan={6} className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600 bg-[#0d0f13]">
                                {player.club}
                              </td>
                            </tr>
                          ),
                          (
                          <tr
                            key={player.id}
                            onClick={() => setSelectedPlayer(player)}
                            className={`border-b border-[#161a21] last:border-0 cursor-pointer hover:bg-[#161a21] transition-colors ${owned ? 'bg-green-500/[0.03]' : ''}`}
                          >
                            {/* Player */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[#1e2330] overflow-hidden flex-shrink-0">
                                  {player.image_url
                                    ? <img src={player.image_url} alt={player.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }}/>
                                    : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">{player.name[0]}</div>
                                  }
                                </div>
                                <div className="min-w-0">
                                  <div className={`font-medium truncate ${owned ? 'text-green-400' : 'text-white'}`}>{player.name}</div>
                                  <div className="text-[10px] text-gray-600">{player.club} · {isGK ? 'GK' : player.position?.slice(0,3)}</div>
                                </div>
                              </div>
                            </td>

                            {/* Minutes */}
                            <td className="px-3 py-2.5 text-center">
                              {stats
                                ? played
                                  ? <span className="text-gray-400 text-xs tabular-nums">{stats.minutes}'</span>
                                  : <span className="text-orange-400/70 text-[10px]">DNP</span>
                                : <span className="text-gray-700 text-xs">—</span>
                              }
                            </td>

                            {/* Stat 1: Goals / Saves */}
                            <td className="px-3 py-2.5 text-center">
                              {stats && played ? (
                                isGK
                                  ? <span className="text-gray-300 text-xs tabular-nums">{stats.saves ?? 0}<span className="text-gray-600 text-[9px] ml-0.5">sv</span></span>
                                  : <span className="text-gray-300 text-xs tabular-nums">{stats.goals ?? 0}<span className="text-gray-600 text-[9px] ml-0.5">g</span></span>
                              ) : <span className="text-gray-700 text-xs">—</span>}
                            </td>

                            {/* Stat 2: Assists / Clean sheet */}
                            <td className="px-3 py-2.5 text-center">
                              {stats && played ? (
                                isGK
                                  ? <span className={`text-xs font-medium ${stats.clean_sheet ? 'text-green-400' : 'text-gray-600'}`}>{stats.clean_sheet ? 'CS' : '—'}</span>
                                  : <span className="text-gray-300 text-xs tabular-nums">{stats.assists ?? 0}<span className="text-gray-600 text-[9px] ml-0.5">a</span></span>
                              ) : <span className="text-gray-700 text-xs">—</span>}
                            </td>

                            {/* Rating */}
                            <td className="px-3 py-2.5 text-center">
                              {stats && played && stats.rating != null ? (
                                <span className={`text-xs font-semibold tabular-nums ${
                                  stats.rating >= 8 ? 'text-green-400' : stats.rating >= 7 ? 'text-gray-300' : stats.rating >= 6 ? 'text-orange-400' : 'text-red-400'
                                }`}>{Number(stats.rating).toFixed(1)}</span>
                              ) : <span className="text-gray-700 text-xs">—</span>}
                            </td>

                            {/* Change */}
                            <td className="px-4 py-2.5 text-right">
                              <span className={`text-xs font-bold tabular-nums ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                {change > 0 ? '+' : ''}{Number(change).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                          )
                        ].filter(Boolean)
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trading modal */}
      {selectedPlayer && (
        <PlayerModal
          player={{ ...selectedPlayer, current_price: livePrices[selectedPlayer.id] ?? selectedPlayer.current_price }}
          onClose={() => setSelectedPlayer(null)}
          onTrade={() => {}}
          isLive={isLive}
          liveChangePct={liveChanges[selectedPlayer.id] ?? null}
          liveMatchStats={liveStats[selectedPlayer.id] ?? null}
        />
      )}
    </div>
  )
}
