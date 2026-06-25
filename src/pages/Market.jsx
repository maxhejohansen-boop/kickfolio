import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PlayerCard from '../components/PlayerCard'

const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender', 'Goalkeeper']

export default function Market() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [matchday, setMatchday] = useState(0)

  useEffect(() => {
    fetchPlayers()
    fetchMatchday()
  }, [])

  async function fetchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .order('current_price', { ascending: false })
    setPlayers(data ?? [])
    setLoading(false)
  }

  async function fetchMatchday() {
    const { data } = await supabase.from('matchday_tracker').select('current_matchday').eq('id', 1).single()
    setMatchday(data?.current_matchday ?? 0)
  }

  const filtered = players.filter(p => {
    const matchPos = filter === 'All' || p.position === filter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.club.toLowerCase().includes(search.toLowerCase())
    return matchPos && matchSearch
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Market</h1>
          <p className="text-sm text-gray-500 mt-0.5">Matchday {matchday} · {players.length} players</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players or clubs..."
          className="bg-[#111318] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600 w-full sm:w-64"
        />
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  )
}
