import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  async function fetchLeaderboard() {
    const { data: users } = await supabase.from('users').select('id, email, balance')
    if (!users) return setLoading(false)

    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('user_id, shares, players(current_price)')
      .gt('shares', 0)

    const holdingsByUser = {}
    for (const p of portfolios ?? []) {
      holdingsByUser[p.user_id] = (holdingsByUser[p.user_id] ?? 0) + p.shares * p.players.current_price
    }

    const ranked = users
      .map(u => ({
        ...u,
        holdingsValue: holdingsByUser[u.id] ?? 0,
        totalValue: u.balance + (holdingsByUser[u.id] ?? 0),
      }))
      .sort((a, b) => b.totalValue - a.totalValue)

    setEntries(ranked)
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>

      <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-[#161a21] animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No users yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2330]">
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-10">#</th>
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">User</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Holdings</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Cash</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const isCurrentUser = entry.id === user?.id
                const plPct = ((entry.totalValue - 100000) / 100000) * 100

                return (
                  <tr
                    key={entry.id}
                    className={`border-b border-[#1e2330] last:border-0 ${isCurrentUser ? 'bg-green-500/5' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      {i === 0 ? (
                        <span className="text-yellow-400">🥇</span>
                      ) : i === 1 ? (
                        <span className="text-gray-300">🥈</span>
                      ) : i === 2 ? (
                        <span className="text-orange-400">🥉</span>
                      ) : (
                        <span className="text-gray-500 text-sm">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1e2330] flex items-center justify-center text-xs text-gray-400">
                          {entry.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${isCurrentUser ? 'text-green-400' : 'text-white'}`}>
                            {entry.email.split('@')[0]}
                            {isCurrentUser && <span className="text-xs text-gray-500 ml-1">(you)</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 hidden sm:table-cell">
                      £{entry.holdingsValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 hidden sm:table-cell">
                      £{entry.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-white">
                        £{entry.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className={`text-xs ${plPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                      </div>
                    </td>
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
