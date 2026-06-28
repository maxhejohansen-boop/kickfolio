import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/PlayerCard'

const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender', 'Goalkeeper']

const TEAMS = [
  { label: 'All',      club: 'All' },
  { label: 'Arsenal',  club: 'Arsenal' },
  { label: 'Chelsea',  club: 'Chelsea' },
  { label: 'Liverpool',club: 'Liverpool' },
  { label: 'Man City', club: 'Manchester City' },
  { label: 'Man Utd',  club: 'Manchester United' },
  { label: 'Spurs',    club: 'Tottenham' },
]

const SORT_OPTIONS = [
  { label: 'Price',   key: 'current_price' },
  { label: 'Change',  key: 'changePct' },
  { label: 'Goals',   key: 'goals' },
  { label: 'Assists', key: 'assists' },
  { label: 'Rating',  key: 'rating' },
  { label: 'Saves',   key: 'saves' },
]

export default function Market() {
  const [players, setPlayers] = useState([])
  const [statsMap, setStatsMap] = useState({})
  const [appsMap, setAppsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [teamFilter, setTeamFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [matchday, setMatchday] = useState(0)
  const [sortKey, setSortKey] = useState('changePct')
  const [sortDir, setSortDir] = useState(-1)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [playersRes, trackerRes] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('matchday_tracker').select('current_matchday').eq('id', 1).single(),
    ])
    const currentMatchday = trackerRes.data?.current_matchday ?? 0
    setMatchday(currentMatchday)

    const allPlayers = playersRes.data ?? []
    setPlayers(allPlayers)

    const [latestRes, appsRes] = await Promise.all([
      currentMatchday > 0
        ? supabase.from('matchday_stats').select('*').eq('matchday', currentMatchday)
        : Promise.resolve({ data: [] }),
      supabase.from('matchday_stats').select('player_id').gt('minutes', 0),
    ])

    const map = {}
    for (const s of (latestRes.data ?? [])) map[s.player_id] = s
    setStatsMap(map)

    const appsCount = {}
    for (const r of (appsRes.data ?? [])) {
      appsCount[r.player_id] = (appsCount[r.player_id] ?? 0) + 1
    }
    setAppsMap(appsCount)

    setLoading(false)
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(-1) }
  }

  const filtered = players
    .filter(p => {
      const matchPos  = filter === 'All' || p.position === filter
      const matchTeam = teamFilter === 'All' || p.club === teamFilter
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.club.toLowerCase().includes(search.toLowerCase())
      return matchPos && matchTeam && matchSearch
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
        <div>
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

      <div className="flex flex-wrap gap-2 mb-3 overflow-x-auto pb-1">
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

      <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-1">
        {TEAMS.map(({ label, club }) => (
          <button
            key={club}
            onClick={() => setTeamFilter(club)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              teamFilter === club
                ? 'bg-blue-500 text-white'
                : 'bg-[#111318] border border-[#1e2330] text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {SORT_OPTIONS.map(opt => {
          const active = sortKey === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                active
                  ? 'bg-[#1e2330] text-white border border-gray-600'
                  : 'bg-[#111318] border border-[#1e2330] text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
              {active && <span>{sortDir === -1 ? '↓' : '↑'}</span>}
            </button>
          )
        })}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(player => (
            <PlayerCard key={player.id} player={player} latestStats={statsMap[player.id] ?? null} appearances={appsMap[player.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  )
}
