import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function PlayerModal({ player, onClose, onTrade, defaultMode = 'buy' }) {
  const { user, userRecord, refreshUserRecord } = useAuth()
  const [priceByMatchday, setPriceByMatchday] = useState({})
  const [recentChart, setRecentChart] = useState([])
  const [allStats, setAllStats] = useState([])
  const [shares, setShares] = useState(1)
  const [holding, setHolding] = useState(null)
  const [tradeMode, setTradeMode] = useState(defaultMode)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchData()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [player.id])

  async function fetchData() {
    const [historyRes, holdingRes, statsRes] = await Promise.all([
      supabase
        .from('price_history')
        .select('price, matchday')
        .eq('player_id', player.id)
        .order('matchday', { ascending: true }),
      user
        ? supabase
            .from('portfolios')
            .select('shares, avg_buy_price')
            .eq('user_id', user.id)
            .eq('player_id', player.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('matchday_stats')
        .select('*')
        .eq('player_id', player.id)
        .order('matchday', { ascending: false }),
    ])

    const priceMap = Object.fromEntries(
      (historyRes.data ?? []).map(p => [p.matchday, p.price])
    )
    setPriceByMatchday(priceMap)
    setHolding(holdingRes.data)

    const stats = statsRes.data ?? []
    setAllStats(stats)

    const last5 = [...stats].slice(0, 5).reverse()
    setRecentChart(last5.map(s => ({
      matchday: s.matchday,
      rating: s.rating ?? 0,
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
      saves: s.saves ?? 0,
      clean_sheet: s.clean_sheet ?? false,
      minutes: s.minutes ?? 0,
      price: priceMap[s.matchday] ?? null,
    })))
  }

  async function handleTrade() {
    if (!user) return
    const qty = parseInt(shares, 10)
    if (!qty || qty < 1) return

    setLoading(true)
    setMessage(null)

    try {
      if (tradeMode === 'buy') {
        const cost = qty * player.current_price
        if (cost > userRecord.balance) {
          setMessage({ type: 'error', text: 'Insufficient balance.' })
          return
        }

        const newBalance = userRecord.balance - cost
        const existingShares = holding?.shares ?? 0
        const existingAvg = holding?.avg_buy_price ?? 0
        const newShares = existingShares + qty
        const newAvg = existingShares === 0
          ? player.current_price
          : ((existingAvg * existingShares) + (player.current_price * qty)) / newShares

        const { error: balErr } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', user.id)
        if (balErr) throw balErr

        const { error: portErr } = await supabase
          .from('portfolios')
          .upsert({
            user_id: user.id,
            player_id: player.id,
            shares: newShares,
            avg_buy_price: parseFloat(newAvg.toFixed(2)),
          }, { onConflict: 'user_id,player_id' })
        if (portErr) throw portErr

        setMessage({ type: 'success', text: `Bought ${qty} share${qty > 1 ? 's' : ''} for £${cost.toFixed(2)}` })
      } else {
        const currentShares = holding?.shares ?? 0
        if (qty > currentShares) {
          setMessage({ type: 'error', text: "You don't have enough shares." })
          return
        }

        const proceeds = qty * player.current_price
        const newBalance = userRecord.balance + proceeds
        const newShares = currentShares - qty

        const { error: balErr } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', user.id)
        if (balErr) throw balErr

        if (newShares === 0) {
          await supabase
            .from('portfolios')
            .delete()
            .eq('user_id', user.id)
            .eq('player_id', player.id)
        } else {
          const { error: portErr } = await supabase
            .from('portfolios')
            .update({ shares: newShares })
            .eq('user_id', user.id)
            .eq('player_id', player.id)
          if (portErr) throw portErr
        }

        setMessage({ type: 'success', text: `Sold ${qty} share${qty > 1 ? 's' : ''} for £${proceeds.toFixed(2)}` })
      }

      await refreshUserRecord()
      await fetchData()
      onTrade?.()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const isGK = player.position === 'Goalkeeper'
  const played = allStats.filter(s => s.minutes > 0)
  const appearances = played.length
  const totalGoals = allStats.reduce((s, r) => s + (r.goals || 0), 0)
  const totalAssists = allStats.reduce((s, r) => s + (r.assists || 0), 0)
  const totalSaves = allStats.reduce((s, r) => s + (r.saves || 0), 0)
  const cleanSheets = allStats.filter(s => s.clean_sheet).length
  const avgRating = played.length > 0
    ? played.reduce((s, r) => s + (r.rating || 0), 0) / played.length
    : 0

  const totalCost = (parseInt(shares, 10) || 0) * player.current_price

  const PerformanceTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-[#161a21] border border-[#1e2330] rounded-lg px-3 py-2.5 text-xs space-y-1 min-w-[130px]">
        <div className="text-gray-400 font-medium">Matchday {d.matchday}</div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Rating</span>
          <span className="text-white font-semibold">{Number(d.rating).toFixed(1)}</span>
        </div>
        {isGK ? (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Saves</span>
              <span className="text-white">{d.saves}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Clean sheet</span>
              <span className={d.clean_sheet ? 'text-green-400' : 'text-gray-400'}>{d.clean_sheet ? 'Yes' : 'No'}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Goals</span>
              <span className="text-white">{d.goals}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Assists</span>
              <span className="text-white">{d.assists}</span>
            </div>
          </>
        )}
        {d.price != null && (
          <div className="flex justify-between gap-4 pt-1 border-t border-[#1e2330]">
            <span className="text-gray-500">Share price</span>
            <span className="text-green-400 font-semibold">£{Number(d.price).toFixed(2)}</span>
          </div>
        )}
      </div>
    )
  }

  const ratingMin = recentChart.length ? Math.max(0, Math.min(...recentChart.map(d => d.rating)) - 1) : 0
  const ratingMax = recentChart.length ? Math.min(10, Math.max(...recentChart.map(d => d.rating)) + 1) : 10

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#111318] border border-[#1e2330] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2330]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1e2330] overflow-hidden">
              {player.image_url && (
                <img src={player.image_url} alt={player.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{player.name}</h2>
              <div className="text-sm text-gray-500">{player.club} · {player.position}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">£{Number(player.current_price).toFixed(2)}</div>
              <div className="text-xs text-gray-500">per share</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-2">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Season stats */}
          <div className="grid grid-cols-4 gap-3">
            <StatPill label="Apps" value={appearances} />
            {isGK ? (
              <>
                <StatPill label="Saves" value={totalSaves} />
                <StatPill label="Clean sheets" value={cleanSheets} />
              </>
            ) : (
              <>
                <StatPill label="Goals" value={totalGoals} />
                <StatPill label="Assists" value={totalAssists} />
              </>
            )}
            <StatPill label="Avg rating" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} highlight />
          </div>

          {/* Performance chart */}
          {recentChart.length > 0 ? (
            <div>
              <div className="text-xs text-gray-500 mb-2 font-medium">Last {recentChart.length} games · Rating</div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                    <XAxis
                      dataKey="matchday"
                      tick={{ fill: '#8892a4', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => `MD${v}`}
                    />
                    <YAxis
                      domain={[ratingMin, ratingMax]}
                      tick={{ fill: '#8892a4', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <ReferenceLine y={6} stroke="#1e2330" strokeDasharray="4 4" />
                    <Tooltip content={<PerformanceTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="rating"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#4ade80' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-xs text-gray-600">
              No match data yet
            </div>
          )}

          {/* Holding summary */}
          {holding && holding.shares > 0 && (
            <div className="p-3 bg-[#161a21] border border-[#1e2330] rounded-lg grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-500">Shares</div>
                <div className="text-sm font-semibold text-white">{holding.shares}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Avg Buy</div>
                <div className="text-sm font-semibold text-white">£{Number(holding.avg_buy_price).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">P&L</div>
                <div className={`text-sm font-semibold ${player.current_price >= holding.avg_buy_price ? 'text-green-400' : 'text-red-400'}`}>
                  {player.current_price >= holding.avg_buy_price ? '+' : ''}
                  £{((player.current_price - holding.avg_buy_price) * holding.shares).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Trade UI */}
          {user ? (
            <div className="space-y-3">
              <div className="flex rounded-lg overflow-hidden border border-[#1e2330]">
                <button
                  onClick={() => setTradeMode('buy')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${tradeMode === 'buy' ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setTradeMode('sell')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${tradeMode === 'sell' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Sell
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  className="flex-1 bg-[#161a21] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
                  placeholder="Shares"
                />
                <button
                  onClick={handleTrade}
                  disabled={loading}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                    tradeMode === 'buy'
                      ? 'bg-green-500 hover:bg-green-400 text-black'
                      : 'bg-red-500 hover:bg-red-400 text-white'
                  }`}
                >
                  {loading ? '...' : tradeMode === 'buy' ? `Buy · £${totalCost.toFixed(2)}` : `Sell · £${totalCost.toFixed(2)}`}
                </button>
              </div>

              {message && (
                <div className={`text-sm rounded-lg px-3 py-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {message.text}
                </div>
              )}

              <div className="text-xs text-gray-500 flex justify-between">
                <span>Balance: £{userRecord?.balance?.toLocaleString('en-GB', { minimumFractionDigits: 2 }) ?? '—'}</span>
                {holding?.shares > 0 && <span>Holding: {holding.shares} shares</span>}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">
              <a href="/login" className="text-green-400 hover:underline">Sign in</a> to trade
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, highlight }) {
  return (
    <div className="bg-[#161a21] border border-[#1e2330] rounded-lg p-3 text-center">
      <div className={`text-lg font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
