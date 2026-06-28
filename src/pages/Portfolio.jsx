import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import PlayerModal from '../components/PlayerModal'

const TEAMS = [
  { label: 'All',      club: 'All' },
  { label: 'Arsenal',  club: 'Arsenal' },
  { label: 'Chelsea',  club: 'Chelsea' },
  { label: 'Liverpool',club: 'Liverpool' },
  { label: 'Man City', club: 'Manchester City' },
  { label: 'Man Utd',  club: 'Manchester United' },
  { label: 'Spurs',    club: 'Tottenham' },
]

export default function Portfolio() {
  const { user, userRecord, refreshUserRecord } = useAuth()
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [teamFilter, setTeamFilter] = useState('All')

  useEffect(() => {
    if (user) fetchHoldings()
  }, [user])

  async function fetchHoldings() {
    const { data } = await supabase
      .from('portfolios')
      .select('*, players(*)')
      .eq('user_id', user.id)
      .gt('shares', 0)
    setHoldings(data ?? [])
    setLoading(false)
  }

  function openModal(player) {
    setSelectedPlayer(player)
  }

  const currentValue = holdings.reduce(
    (sum, h) => sum + h.shares * h.players.current_price,
    0
  )
  const totalInvested = holdings.reduce(
    (sum, h) => sum + h.shares * h.avg_buy_price,
    0
  )
  const totalPL = currentValue - totalInvested
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0
  const availableCash = userRecord?.balance ?? 0

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">
          <Link to="/login" className="text-green-400 hover:underline">Sign in</Link> to view your portfolio
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Portfolio</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Invested" value={`£${totalInvested.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <StatCard label="Current Value" value={`£${currentValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <StatCard
          label="Total P&L"
          value={`${totalPL >= 0 ? '+' : ''}£${totalPL.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`}
          color={totalPL >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatCard label="Available Cash" value={`£${availableCash.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#161a21] border border-[#1e2330] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>You don't own any players yet. Head to the Market to start investing.</p>
          <Link to="/market" className="text-green-400 hover:underline text-sm mt-2 block">
            Go to Market →
          </Link>
        </div>
      ) : (
        <>
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

        <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2330]">
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Player</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Shares</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Avg Buy</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Current</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden md:table-cell">Invested</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Value</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">P&L</th>
              </tr>
            </thead>
            <tbody>
              {[...holdings]
              .filter(h => teamFilter === 'All' || h.players.club === teamFilter)
              .sort((a, b) => {
                const plA = a.shares * a.players.current_price - a.shares * a.avg_buy_price
                const plB = b.shares * b.players.current_price - b.shares * b.avg_buy_price
                return plB - plA
              }).map((h) => {
                const currentVal = h.shares * h.players.current_price
                const costBasis = h.shares * h.avg_buy_price
                const pl = currentVal - costBasis
                const plPct = costBasis > 0 ? (pl / costBasis) * 100 : 0

                return (
                  <tr
                    key={h.id}
                    className="border-b border-[#1e2330] last:border-0 hover:bg-[#161a21] cursor-pointer transition-colors"
                    onClick={() => openModal(h.players)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1e2330] overflow-hidden flex-shrink-0">
                          {h.players.image_url && (
                            <img src={h.players.image_url} alt={h.players.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                          )}
                        </div>
                        <div>
                          <div className="text-sm text-white font-medium">{h.players.name}</div>
                          <div className="text-xs text-gray-500">{h.players.club} · {h.players.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">{h.shares}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 hidden sm:table-cell">£{Number(h.avg_buy_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-white">£{Number(h.players.current_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 hidden md:table-cell">£{costBasis.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-white">£{currentVal.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pl >= 0 ? '+' : ''}£{pl.toFixed(2)}
                      <div className="text-xs opacity-70">
                        {plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          showActionsTab
          onClose={() => setSelectedPlayer(null)}
          onTrade={() => { fetchHoldings(); refreshUserRecord() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${color} opacity-70`}>{sub}</div>}
    </div>
  )
}
