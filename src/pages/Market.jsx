import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import PlayerCard from '../components/PlayerCard'
import { calcGrade, GRADE_META } from '../lib/gradeCalc'

const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender', 'Goalkeeper']

const SORT_OPTIONS = [
  { label: 'Price',   key: 'current_price' },
  { label: 'Change',  key: 'changePct' },
  { label: 'Goals',   key: 'goals' },
  { label: 'Assists', key: 'assists' },
  { label: 'Rating',  key: 'rating' },
]

const GRADE_CHIPS = [
  { value: 'All',       label: 'All',        active: 'bg-[#1e2330] text-white border border-gray-600' },
  { value: 'Unscouted', label: 'Unscouted',  active: 'bg-[#1e2330] text-gray-300 border border-gray-500' },
  { value: 'A',         label: 'Strong Buy', active: 'bg-green-500 text-black' },
  { value: 'B',         label: 'Buy',        active: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  { value: 'C',         label: 'Fair Value', active: 'bg-[#1e2330] text-gray-200 border border-gray-500' },
  { value: 'D',         label: 'Overvalued', active: 'bg-red-500/10 text-red-400 border border-red-500/20' },
]

export default function Market() {
  const { userRecord, user } = useAuth()
  const [players, setPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [appsMap, setAppsMap] = useState({})
  const [historyMap, setHistoryMap] = useState({})
  const [last5Map, setLast5Map] = useState({})
  const [gradeFilter, setGradeFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [matchday, setMatchday] = useState(0)
  const [sortKey, setSortKey] = useState('changePct')
  const [sortDir, setSortDir] = useState(-1)
  const [scoutsMap, setScoutsMap] = useState({})

  useEffect(() => {
    fetchAll()
  }, [user?.id])

  async function fetchAll() {
    const [playersRes, trackerRes] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('matchday_tracker').select('current_matchday').eq('id', 1).single(),
    ])
    const currentMatchday = trackerRes.data?.current_matchday ?? 0
    setMatchday(currentMatchday)

    const allPlayers = playersRes.data ?? []
    setPlayers(allPlayers)

    const [latestRes, appsRes, historyRes, last5Res, scoutsRes] = await Promise.all([
      currentMatchday > 0
        ? supabase.from('matchday_stats').select('*').eq('matchday', currentMatchday)
        : Promise.resolve({ data: [] }),
      supabase.from('matchday_stats').select('player_id').gt('minutes', 0),
      supabase.from('price_history').select('player_id, price, matchday').order('matchday', { ascending: true }),
      currentMatchday > 0
        ? supabase
            .from('matchday_stats')
            .select('player_id, matchday, goals, assists, rating, minutes, saves, clean_sheet')
            .gte('matchday', Math.max(1, currentMatchday - 4))
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('player_scouts').select('*').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    const map = {}
    for (const s of (latestRes.data ?? [])) map[s.player_id] = s
    setStatsMap(map)

    const appsCount = {}
    for (const r of (appsRes.data ?? [])) {
      appsCount[r.player_id] = (appsCount[r.player_id] ?? 0) + 1
    }
    setAppsMap(appsCount)

    const hMap = {}
    for (const r of (historyRes.data ?? [])) {
      if (!hMap[r.player_id]) hMap[r.player_id] = []
      hMap[r.player_id].push({ price: r.price, matchday: r.matchday })
    }
    setHistoryMap(hMap)

    const l5 = {}
    for (const r of (last5Res.data ?? [])) {
      if (!l5[r.player_id]) l5[r.player_id] = []
      l5[r.player_id].push(r)
    }
    setLast5Map(l5)

    const sm = {}
    for (const s of (scoutsRes.data ?? [])) sm[s.player_id] = s
    setScoutsMap(sm)

    setLoading(false)
  }

  function handleScoutUpdate(playerId, scoutRecord) {
    setScoutsMap(m => ({ ...m, [playerId]: scoutRecord }))
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(-1) }
  }

  function clearFilters() {
    setFilter('All')
    setGradeFilter('All')
    setSearch('')
    setSortKey('changePct')
    setSortDir(-1)
  }

  const filtersActive = filter !== 'All' || gradeFilter !== 'All' || search !== '' || sortKey !== 'changePct'

  const balance = userRecord?.balance ?? 0

  // A player's scout is revealed only when instant-scouted, or sent-scouts has matured
  function isScoutRevealed(playerId) {
    const s = scoutsMap[playerId]
    if (!s) return false
    if (s.scout_type === 'instant') return true
    return s.scout_type === 'sent' && s.reveals_at_matchday != null && s.reveals_at_matchday <= matchday
  }

  // Only compute grades for scouted players — unscouted players have no grade
  const gradeMap = {}
  for (const p of players) {
    if (!isScoutRevealed(p.id)) continue
    const g = calcGrade(p, last5Map[p.id], historyMap[p.id], balance)
    if (g) gradeMap[p.id] = g
  }

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, Unscouted: 0 }
  for (const p of players) {
    if (!isScoutRevealed(p.id)) gradeCounts.Unscouted++
    else if (gradeMap[p.id]) gradeCounts[gradeMap[p.id].grade]++
  }

  const filtered = players
    .filter(p => {
      const matchPos    = filter === 'All' || p.position === filter
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.club.toLowerCase().includes(search.toLowerCase())
      const scouted     = isScoutRevealed(p.id)
      const matchGrade  = gradeFilter === 'All'
        || (gradeFilter === 'Unscouted' && !scouted)
        || (gradeFilter !== 'Unscouted' && scouted && gradeMap[p.id]?.grade === gradeFilter)
      return matchPos && matchSearch && matchGrade
    })
    .map(p => {
      const s = statsMap[p.id] ?? null
      return {
        ...p,
        changePct: s?.price_change_pct ?? 0,
        goals:     s?.goals   ?? 0,
        assists:   s?.assists  ?? 0,
        rating:    s?.rating   ?? 0,
        saves:     s?.saves    ?? 0,
      }
    })
    .sort((a, b) => sortDir * (b[sortKey] - a[sortKey]))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div data-tutorial="matchday-info">
          <h1 className="text-2xl font-bold text-white">Market</h1>
          <p className="text-sm text-gray-500 mt-0.5">Matchday {matchday} · {players.length} players</p>
          <p className="text-xs text-gray-600 mt-0.5">Starting prices based on 2024/25 season stats</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players or clubs..."
          className="bg-[#111318] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600 w-full sm:w-64"
        />
      </div>

      <div data-tutorial="market-filters" className="flex items-center gap-3 mb-6">
        {/* Scrollable chips */}
        <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 pb-0.5">
          {/* Grade filter — always visible once user is logged in */}
          {user && GRADE_CHIPS.map(({ value, label, active }) => {
            const count = value === 'All' ? null : gradeCounts[value] ?? 0
            // hide A/B/C/D chips if no players scouted yet
            if (['A','B','C','D'].includes(value) && Object.keys(gradeMap).length === 0) return null
            return (
              <button
                key={value}
                onClick={() => setGradeFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  gradeFilter === value
                    ? active
                    : 'bg-[#111318] border border-[#1e2330] text-gray-400 hover:text-white'
                }`}
              >
                {label}{count != null && count > 0 ? ` (${count})` : ''}
              </button>
            )
          })}
          {user && <span className="w-px h-4 bg-[#1e2330] shrink-0 mx-1" />}

          {/* Position filter */}
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setFilter(pos)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === pos
                  ? 'bg-green-500 text-black'
                  : 'bg-[#111318] border border-[#1e2330] text-gray-400 hover:text-white'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Sort dropdown + clear */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={`${sortKey}:${sortDir}`}
            onChange={e => {
              const [key, dir] = e.target.value.split(':')
              setSortKey(key)
              setSortDir(parseInt(dir))
            }}
            className="bg-[#111318] border border-[#1e2330] text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-500 cursor-pointer"
          >
            {SORT_OPTIONS.flatMap(opt => [
              <option key={`${opt.key}:-1`} value={`${opt.key}:-1`}>Sort: {opt.label} ↓</option>,
              <option key={`${opt.key}:1`}  value={`${opt.key}:1`}>Sort: {opt.label} ↑</option>,
            ])}
          </select>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-white border border-[#1e2330] hover:border-gray-600 transition-colors whitespace-nowrap"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-[#161a21] border border-[#1e2330] rounded-lg p-4 h-36 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-16">No players found</div>
      ) : (
        <div data-tutorial="market-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((player, i) => (
            <PlayerCard
              key={player.id}
              player={player}
              latestStats={statsMap[player.id] ?? null}
              appearances={appsMap[player.id] ?? 0}
              priceHistory={historyMap[player.id] ?? []}
              gradeData={gradeMap[player.id] ?? null}
              scoutInfo={scoutsMap[player.id] ?? null}
              currentMatchday={matchday}
              onScoutUpdate={handleScoutUpdate}
              tutorialTarget={i === 0 ? 'player-card' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
