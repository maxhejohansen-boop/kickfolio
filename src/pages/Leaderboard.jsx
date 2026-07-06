import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STARTING_BALANCE = 100_000
const FILTERS = ['Total value', 'Earnings']

function fmt(n) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Total value')

  useEffect(() => { fetchLeaderboard() }, [])

  async function fetchLeaderboard() {
    const [usersRes, portfoliosRes] = await Promise.all([
      supabase.from('users').select('id, email, balance'),
      supabase.from('portfolios').select('user_id, shares, players(current_price)').gt('shares', 0),
    ])

    const users = usersRes.data ?? []
    const holdingsByUser = {}
    for (const p of portfoliosRes.data ?? []) {
      holdingsByUser[p.user_id] = (holdingsByUser[p.user_id] ?? 0) + p.shares * p.players.current_price
    }

    const ranked = users.map(u => {
      const holdingsValue = holdingsByUser[u.id] ?? 0
      const totalValue = u.balance + holdingsValue
      const earnings = totalValue - STARTING_BALANCE
      return { ...u, holdingsValue, totalValue, earnings }
    })

    setEntries(ranked)
    setLoading(false)
  }

  const sorted = [...entries].sort((a, b) =>
    filter === 'Earnings' ? b.earnings - a.earnings : b.totalValue - a.totalValue
  )

  return (
    <div data-tutorial="leaderboard-table" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <div className="flex gap-1.5 bg-[#111318] border border-[#1e2330] rounded-lg p-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
                filter === f ? 'bg-[#1e2330] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-[#161a21] animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No users yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2330]">
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-10">#</th>
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">User</th>
                {filter === 'Total value' ? (
                  <>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Holdings</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Cash</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Total value</th>
                  </>
                ) : (
                  <>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Portfolio</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Earnings</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => {
                const isCurrentUser = entry.id === user?.id
                const earningsPct = (entry.earnings / STARTING_BALANCE) * 100

                return (
                  <tr
                    key={entry.id}
                    className={`border-b border-[#1e2330] last:border-0 ${isCurrentUser ? 'bg-green-500/5' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      {i === 0 ? <span>🥇</span>
                        : i === 1 ? <span>🥈</span>
                        : i === 2 ? <span>🥉</span>
                        : <span className="text-gray-500 text-sm">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1e2330] flex items-center justify-center text-xs text-gray-400">
                          {entry.email[0].toUpperCase()}
                        </div>
                        <div className={`text-sm font-medium ${isCurrentUser ? 'text-green-400' : 'text-white'}`}>
                          {entry.email.split('@')[0]}
                          {isCurrentUser && <span className="text-xs text-gray-500 ml-1">(you)</span>}
                        </div>
                      </div>
                    </td>

                    {filter === 'Total value' ? (
                      <>
                        <td className="px-4 py-3 text-right text-sm text-gray-400 hidden sm:table-cell">
                          £{fmt(entry.holdingsValue)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-400 hidden sm:table-cell">
                          £{fmt(entry.balance)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-white">£{fmt(entry.totalValue)}</div>
                          <div className={`text-xs ${earningsPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {earningsPct >= 0 ? '+' : ''}{earningsPct.toFixed(1)}%
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-sm text-gray-400 hidden sm:table-cell">
                          £{fmt(entry.holdingsValue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={`text-sm font-semibold ${entry.earnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {entry.earnings >= 0 ? '+' : ''}£{fmt(Math.abs(entry.earnings))}
                          </div>
                          <div className={`text-xs ${earningsPct >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                            {earningsPct >= 0 ? '+' : ''}{earningsPct.toFixed(1)}%
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
