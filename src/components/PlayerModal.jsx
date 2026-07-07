import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTutorial } from '../lib/TutorialContext'
import { GRADE_META, STAKE_PCT } from '../lib/gradeCalc'

const SCOUT_COST = 500
const SEND_SCOUT_COST = 150

export default function PlayerModal({ player, onClose, onTrade, defaultMode = 'buy', showActionsTab = false, gradeData = null, isLive = false, liveChangePct = null, liveMatchStats = null, onScoutUpdate }) {
  const { user, userRecord, refreshUserRecord } = useAuth()
  const tutorial = useTutorial()
  const [priceByMatchday, setPriceByMatchday] = useState({})
  const [priceChart, setPriceChart] = useState([])   // { label, matchday, price, type, goals, assists, rating, minutes, changePct, event }
  const [allStats, setAllStats] = useState([])
  const [shares, setShares] = useState(1)
  const [holding, setHolding] = useState(null)
  const [tradeMode, setTradeMode] = useState(defaultMode)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [activeTab, setActiveTab] = useState(showActionsTab ? 'actions' : 'overview')
  const [scoutInfo, setScoutInfo] = useState(null)
  const [scoutLoading, setScoutLoading] = useState(false)
  const [scoutMessage, setScoutMessage] = useState(null)
  const [currentMatchday, setCurrentMatchday] = useState(0)
  const [occupiedScouts, setOccupiedScouts] = useState(0)

  // Limit order state
  const [limitOrders, setLimitOrders] = useState([])
  const [limitType, setLimitType] = useState('buy')
  const [limitShares, setLimitShares] = useState(1)
  const [limitPrice, setLimitPrice] = useState('')
  const [limitLoading, setLimitLoading] = useState(false)
  const [limitMessage, setLimitMessage] = useState(null)

  useEffect(() => {
    fetchData()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [player.id])

  // Subscribe to stats, live ticks, and player price changes for real-time chart updates
  useEffect(() => {
    const ch = supabase
      .channel(`modal-player-${player.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'matchday_stats',
        filter: `player_id=eq.${player.id}`,
      }, ({ new: row }) => {
        setAllStats(prev => {
          if (prev.some(s => s.matchday === row.matchday)) return prev
          return [row, ...prev]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matchday_stats',
        filter: `player_id=eq.${player.id}`,
      }, ({ new: row }) => {
        setAllStats(prev => prev.map(s => s.matchday === row.matchday ? row : s))
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'live_ticks',
        filter: `player_id=eq.${player.id}`,
      }, ({ new: tick }) => {
        setPriceChart(prev => {
          const history = prev.filter(p => p.type === 'history')
          const lastMD = history.length > 0 ? Math.max(...history.map(p => p.matchday)) : 0
          return [...history, {
            label: 'Live',
            matchday: lastMD + 1,
            price: Number(tick.price),
            type: 'live',
            goals: null, assists: null, rating: null, minutes: null,
            changePct: Number(tick.price_change_pct),
            event: tick.event_text,
          }]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'players',
        filter: `id=eq.${player.id}`,
      }, ({ new: row }) => {
        // Tip-triggered price drop — only update "current" when no live match is running
        setPriceChart(prev => {
          if (prev.some(p => p.type === 'live')) return prev
          const history = prev.filter(p => p.type === 'history')
          const lastMD = history.length > 0 ? Math.max(...history.map(p => p.matchday)) : 0
          return [...history, {
            label: 'Now',
            matchday: lastMD + 0.5,
            price: Number(row.current_price),
            type: 'current',
            goals: null, assists: null, rating: null, minutes: null, changePct: null, event: null,
          }]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [player.id])

  async function fetchData() {
    const [historyRes, holdingRes, statsRes, limitRes, scoutRes, mdRes, pendingScoutsRes] = await Promise.all([
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
      showActionsTab && user
        ? supabase
            .from('limit_orders')
            .select('*')
            .eq('user_id', user.id)
            .eq('player_id', player.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('player_scouts').select('*').eq('user_id', user.id).eq('player_id', player.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('matchday_tracker').select('current_matchday').eq('id', 1).maybeSingle(),
      user
        ? supabase.from('player_scouts').select('player_id').eq('user_id', user.id).eq('scout_type', 'sent')
        : Promise.resolve({ data: [] }),
    ])

    const priceMap = Object.fromEntries(
      (historyRes.data ?? []).map(p => [p.matchday, p.price])
    )
    setPriceByMatchday(priceMap)
    setHolding(holdingRes.data)
    setLimitOrders(limitRes.data ?? [])
    setScoutInfo(scoutRes.data)
    setCurrentMatchday(mdRes.data?.current_matchday ?? 0)
    setOccupiedScouts((pendingScoutsRes.data ?? []).length)

    const stats = statsRes.data ?? []
    setAllStats(stats)

    // Build price chart: all historical matchday prices + current price as final point
    const historyPoints = (historyRes.data ?? []).map(h => {
      const s = stats.find(st => st.matchday === h.matchday)
      return {
        label: `MD${h.matchday}`,
        matchday: h.matchday,
        price: Number(h.price),
        type: 'history',
        goals: s?.goals ?? null,
        assists: s?.assists ?? null,
        saves: s?.saves ?? null,
        rating: s?.rating ?? null,
        minutes: s?.minutes ?? null,
        clean_sheet: s?.clean_sheet ?? false,
        dnp_reason: s?.dnp_reason ?? null,
        changePct: s ? Number(s.price_change_pct) : null,
        event: null,
      }
    })
    const lastMD = historyPoints.length > 0 ? Math.max(...historyPoints.map(p => p.matchday)) : 0
    const currentPoint = {
      label: historyPoints.length > 0 ? 'Now' : 'Start',
      matchday: lastMD + 0.5,
      price: Number(player.current_price),
      type: 'current',
      goals: null, assists: null, saves: null, rating: null, minutes: null,
      clean_sheet: false, dnp_reason: null, changePct: null, event: null,
    }
    setPriceChart([...historyPoints, currentPoint])
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
        tutorial?.onTradeCompleted()
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

  async function handlePlaceLimitOrder() {
    if (!user) return
    const qty = parseInt(limitShares, 10)
    const price = parseFloat(limitPrice)
    if (!qty || qty < 1 || !price || price <= 0) {
      setLimitMessage({ type: 'error', text: 'Enter valid shares and target price.' })
      return
    }

    setLimitLoading(true)
    setLimitMessage(null)

    try {
      const { error } = await supabase.from('limit_orders').insert({
        user_id: user.id,
        player_id: player.id,
        order_type: limitType,
        shares: qty,
        target_price: parseFloat(price.toFixed(2)),
      })
      if (error) throw error

      setLimitMessage({ type: 'success', text: `${limitType === 'buy' ? 'Buy' : 'Sell'} limit @ £${price.toFixed(2)} placed` })
      setLimitShares(1)
      setLimitPrice('')
      await fetchData()
    } catch (err) {
      setLimitMessage({ type: 'error', text: err.message })
    } finally {
      setLimitLoading(false)
    }
  }

  async function handleCancelLimitOrder(orderId) {
    await supabase.from('limit_orders').update({ status: 'cancelled' }).eq('id', orderId)
    await fetchData()
  }

  // ─── Scout helpers ────────────────────────────────────────────
  const scoutRevealed = scoutInfo?.scout_type === 'instant' ||
    (scoutInfo?.scout_type === 'sent' && scoutInfo.reveals_at_matchday != null && scoutInfo.reveals_at_matchday <= currentMatchday)
  const scoutPending = scoutInfo?.scout_type === 'sent' && !scoutRevealed

  const maxScouts = userRecord?.max_scouts ?? 3
  const availableScouts = Math.max(0, maxScouts - occupiedScouts)
  const scoutsFull = availableScouts === 0

  async function handleScoutNow() {
    if (!user || !userRecord) return
    if (userRecord.balance < SCOUT_COST) {
      setScoutMessage({ type: 'error', text: `Need £${SCOUT_COST} to scout instantly.` })
      return
    }
    if (scoutsFull) {
      setScoutMessage({ type: 'error', text: `All ${maxScouts} scouts are busy. Wait for one to return.` })
      return
    }
    setScoutLoading(true); setScoutMessage(null)
    try {
      await supabase.from('users').update({ balance: userRecord.balance - SCOUT_COST }).eq('id', user.id)
      const { data, error } = await supabase
        .from('player_scouts')
        .upsert({ user_id: user.id, player_id: player.id, scout_type: 'instant', reveals_at_matchday: null }, { onConflict: 'user_id,player_id' })
        .select().single()
      if (error) throw error
      setScoutInfo(data)
      onScoutUpdate?.(player.id, data)
      await refreshUserRecord()
    } catch (err) {
      setScoutMessage({ type: 'error', text: err.message })
    } finally {
      setScoutLoading(false)
    }
  }

  async function handleSendScouts() {
    if (!user || !userRecord) return
    if (userRecord.balance < SEND_SCOUT_COST) {
      setScoutMessage({ type: 'error', text: `Need £${SEND_SCOUT_COST} to send scouts.` })
      return
    }
    if (scoutsFull) {
      setScoutMessage({ type: 'error', text: `All ${maxScouts} scouts are busy. Wait for one to return after next matchday.` })
      return
    }
    setScoutLoading(true); setScoutMessage(null)
    try {
      await supabase.from('users').update({ balance: userRecord.balance - SEND_SCOUT_COST }).eq('id', user.id)
      const { data, error } = await supabase
        .from('player_scouts')
        .upsert({ user_id: user.id, player_id: player.id, scout_type: 'sent', reveals_at_matchday: currentMatchday + 1 }, { onConflict: 'user_id,player_id' })
        .select().single()
      if (error) throw error
      setScoutInfo(data)
      setOccupiedScouts(n => n + 1)
      onScoutUpdate?.(player.id, data)
      await refreshUserRecord()
    } catch (err) {
      setScoutMessage({ type: 'error', text: err.message })
    } finally {
      setScoutLoading(false)
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

  const lastStat = allStats[0] ?? null
  const lastChangePct = lastStat ? Number(lastStat.price_change_pct) : 0
  const lastChangeAmt = lastChangePct !== 0
    ? player.current_price - player.current_price / (1 + lastChangePct / 100)
    : 0

  // Price at the end of the most recent completed matchday — used to compute
  // overall change = live change + any accumulated prior-matchday change.
  const prevMatchdayPrice = (() => {
    const keys = Object.keys(priceByMatchday).map(Number)
    if (keys.length === 0) return null
    return priceByMatchday[Math.max(...keys)]
  })()
  const overallChangePct = isLive && liveChangePct != null && prevMatchdayPrice != null
    ? ((player.current_price - prevMatchdayPrice) / prevMatchdayPrice) * 100
    : null

  const PriceTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const prevPrice = (() => {
      const idx = priceChart.indexOf(d)
      if (idx <= 0) return null
      return priceChart[idx - 1].price
    })()
    const changeAmt = prevPrice != null ? d.price - prevPrice : null
    const changePct = prevPrice != null ? ((d.price - prevPrice) / prevPrice) * 100 : null

    return (
      <div className="bg-[#161a21] border border-[#1e2330] rounded-lg px-3 py-2.5 text-xs space-y-1 min-w-[150px]">
        <div className="flex items-center gap-2">
          {d.type === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />}
          <span className="text-gray-400 font-medium">{d.label}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Price</span>
          <span className="text-white font-semibold">£{Number(d.price).toFixed(2)}</span>
        </div>
        {changePct != null && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Change</span>
            <span className={changePct > 0 ? 'text-green-400' : changePct < 0 ? 'text-red-400' : 'text-gray-500'}>
              {changePct > 0 ? '+' : ''}£{Math.abs(changeAmt).toFixed(2)} ({changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%)
            </span>
          </div>
        )}
        {d.type === 'history' && d.minutes != null && d.minutes > 0 && (
          <div className="border-t border-[#1e2330] pt-1 space-y-1">
            {d.rating != null && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Rating</span>
                <span className="text-white">{Number(d.rating).toFixed(1)}</span>
              </div>
            )}
            {isGK ? (
              <>
                {d.saves != null && <div className="flex justify-between gap-4"><span className="text-gray-500">Saves</span><span className="text-white">{d.saves}</span></div>}
                <div className="flex justify-between gap-4"><span className="text-gray-500">Clean sheet</span><span className={d.clean_sheet ? 'text-green-400' : 'text-gray-400'}>{d.clean_sheet ? 'Yes' : 'No'}</span></div>
              </>
            ) : (
              <>
                {d.goals != null && <div className="flex justify-between gap-4"><span className="text-gray-500">Goals</span><span className="text-white">{d.goals}</span></div>}
                {d.assists != null && <div className="flex justify-between gap-4"><span className="text-gray-500">Assists</span><span className="text-white">{d.assists}</span></div>}
              </>
            )}
          </div>
        )}
        {d.type === 'history' && d.minutes === 0 && (
          <div className="border-t border-[#1e2330] pt-1">
            <span className="text-orange-400">Did not play{d.dnp_reason ? ` — ${d.dnp_reason}` : ''}</span>
          </div>
        )}
        {d.event && (
          <div className="border-t border-[#1e2330] pt-1 text-gray-300 italic">{d.event}</div>
        )}
      </div>
    )
  }

  const priceValues = priceChart.map(p => p.price).filter(Boolean)
  const priceMin = priceValues.length ? Math.max(0, Math.min(...priceValues) * 0.93) : 0
  const priceMax = priceValues.length ? Math.max(...priceValues) * 1.07 : 10
  const priceUp = priceValues.length >= 2 && priceValues[priceValues.length - 1] >= priceValues[0]

  const gradeBreakdown = gradeData && (() => {
    // Locked state: not scouted at all
    if (!scoutRevealed) {
      return (
        <div className="bg-[#1a1f28] border border-[#1e2330] rounded-xl p-4">
          {scoutPending ? (
            <div className="text-center py-1">
              <div className="text-3xl mb-2">⏱</div>
              <div className="text-white font-semibold text-sm mb-1">Scouts en route</div>
              <div className="text-xs text-gray-500">Report arrives after matchday {scoutInfo.reveals_at_matchday}</div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-lg font-bold w-9 h-9 flex items-center justify-center rounded-lg bg-[#1e2330] text-gray-600">?</span>
                <div>
                  <div className="text-white font-semibold text-sm">Grade hidden</div>
                  <div className="text-xs text-gray-500 mt-0.5">Scout to reveal this player's value assessment</div>
                </div>
              </div>
              {!user ? (
                <div className="text-xs text-gray-500 text-center py-1">
                  <a href="/login" className="text-green-400 hover:underline">Sign in</a> to scout players
                </div>
              ) : (
                <>
                  {/* Scout capacity indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: maxScouts }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                            i < occupiedScouts
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-500'
                              : 'bg-[#1e2330] border border-[#2a3040] text-gray-600'
                          }`}
                        >
                          {i < occupiedScouts ? '●' : '○'}
                        </div>
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${scoutsFull ? 'text-red-400' : 'text-gray-500'}`}>
                      {scoutsFull ? 'All scouts busy' : `${availableScouts}/${maxScouts} scouts free`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSendScouts}
                      disabled={scoutLoading || scoutsFull || (userRecord?.balance ?? 0) < SEND_SCOUT_COST}
                      className="py-3 rounded-lg border border-[#1e2330] hover:border-gray-500 text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
                    >
                      <div className="text-sm font-medium text-gray-300 group-hover:text-white group-disabled:text-gray-600">Send scouts</div>
                      <div className="text-xs text-gray-600 mt-0.5">£{SEND_SCOUT_COST} · next matchday</div>
                    </button>
                    <button
                      onClick={handleScoutNow}
                      disabled={scoutLoading || scoutsFull || (userRecord?.balance ?? 0) < SCOUT_COST}
                      className="py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="text-sm font-medium text-amber-400">Scout now</div>
                      <div className="text-xs text-amber-600 mt-0.5">£{SCOUT_COST} · instant</div>
                    </button>
                  </div>
                  {scoutsFull && (
                    <div className="mt-2 text-xs text-center text-amber-500/70">
                      Scouts return after next matchday
                    </div>
                  )}
                </>
              )}
              {scoutMessage && (
                <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${scoutMessage.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                  {scoutMessage.text}
                </div>
              )}
            </>
          )}
        </div>
      )
    }

    // Revealed state: normal grade breakdown
    const meta = GRADE_META[gradeData.grade]
    const liveBalance = userRecord?.balance ?? 0
    const suggested = gradeData.grade !== 'D' && liveBalance > 0
      ? liveBalance * STAKE_PCT[gradeData.grade]
      : 0
    const diff = gradeData.priceDiff
    return (
      <div className="bg-[#1a1f28] border border-[#1e2330] rounded-xl p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`text-xs font-bold px-2 py-1 rounded ${meta.pillClass}`}>{gradeData.grade}</span>
          <span className="text-white font-semibold text-sm">{meta.label}</span>
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Current price</span>
            <span className="text-white font-medium">£{Number(player.current_price).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Expected price</span>
            <span className={`font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              £{gradeData.expectedPrice.toFixed(2)}
              <span className="ml-1 opacity-70">({diff >= 0 ? '+' : ''}{diff.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Availability (last {gradeData.matchdays} MD)</span>
            <span className={`font-medium ${gradeData.minutesPct >= 0.8 ? 'text-green-400' : gradeData.minutesPct < 0.4 ? 'text-red-400' : 'text-gray-300'}`}>
              {Math.round(gradeData.minutesPct * 100)}%
            </span>
          </div>
          {suggested >= 1 && (
            <div className="flex justify-between items-center pt-2 border-t border-[#1e2330]">
              <span className="text-gray-500">Suggested stake ({Math.round(STAKE_PCT[gradeData.grade] * 100)}% of cash)</span>
              <span className="text-green-400 font-semibold">£{suggested.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    )
  })()

  const overviewContent = (
    <div className="space-y-5">

      {/* Live match stats — shown when modal opened from the live page */}
      {isLive && liveMatchStats && liveMatchStats.minutes > 0 && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Live this match</span>
            {liveMatchStats.rating != null && (
              <span className={`ml-auto text-sm font-bold ${
                liveMatchStats.rating >= 8 ? 'text-green-400' : liveMatchStats.rating >= 7 ? 'text-gray-200' : liveMatchStats.rating >= 6 ? 'text-orange-400' : 'text-red-400'
              }`}>{Number(liveMatchStats.rating).toFixed(1)} rating</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatPill label="Minutes" value={`${liveMatchStats.minutes}'`} />
            {isGK ? (
              <>
                <StatPill label="Saves" value={liveMatchStats.saves ?? 0} />
                <StatPill label="Clean sheet" value={liveMatchStats.clean_sheet ? '✓' : '✗'} highlight={liveMatchStats.clean_sheet} />
              </>
            ) : (
              <>
                <StatPill label="Goals" value={liveMatchStats.goals ?? 0} highlight={(liveMatchStats.goals ?? 0) > 0} />
                <StatPill label="Assists" value={liveMatchStats.assists ?? 0} highlight={(liveMatchStats.assists ?? 0) > 0} />
              </>
            )}
          </div>
          {liveChangePct != null && (
            <div className="mt-3 pt-3 border-t border-red-500/10 flex justify-between items-center text-xs">
              <span className="text-gray-600">Price movement this match</span>
              <span className={`font-bold ${liveChangePct > 0 ? 'text-green-400' : liveChangePct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                {liveChangePct > 0 ? '+' : ''}{Number(liveChangePct).toFixed(2)}%
                <span className="text-gray-600 font-normal ml-1">
                  (£{Math.abs(player.current_price - player.current_price / (1 + liveChangePct / 100)).toFixed(2)})
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {gradeBreakdown}
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

      {priceChart.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Share price history</span>
            {priceChart.some(p => p.type === 'live') && (
              <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#8892a4', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[priceMin, priceMax]}
                  tick={{ fill: '#8892a4', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickFormatter={v => `£${Number(v).toFixed(0)}`}
                />
                <Tooltip content={<PriceTooltip />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={priceUp ? '#22c55e' : '#f87171'}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload, key } = props
                    if (payload.type === 'live') {
                      return <circle key={key} cx={cx} cy={cy} r={5} fill="#f87171" stroke="#111318" strokeWidth={2} />
                    }
                    if (payload.type === 'current') {
                      return <circle key={key} cx={cx} cy={cy} r={5} fill={priceUp ? '#22c55e' : '#f87171'} stroke="#111318" strokeWidth={2} />
                    }
                    if (payload.minutes === 0) {
                      return <circle key={key} cx={cx} cy={cy} r={3} fill="#fb923c" stroke="none" />
                    }
                    return <circle key={key} cx={cx} cy={cy} r={3} fill={priceUp ? '#22c55e' : '#f87171'} stroke="none" />
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="h-20 flex items-center justify-center text-xs text-gray-600">
          No price data yet
        </div>
      )}

      {!showActionsTab && holding && holding.shares > 0 && (
        <HoldingSummary holding={holding} player={player} />
      )}

      {!showActionsTab && user && (
        <TradeSection
          tradeMode={tradeMode}
          setTradeMode={setTradeMode}
          shares={shares}
          setShares={setShares}
          totalCost={totalCost}
          loading={loading}
          message={message}
          handleTrade={handleTrade}
          userRecord={userRecord}
          holding={holding}
          currentPrice={player.current_price}
        />
      )}

      {!showActionsTab && !user && (
        <div className="text-center text-gray-500 text-sm py-4">
          <a href="/login" className="text-green-400 hover:underline">Sign in</a> to trade
        </div>
      )}
    </div>
  )

  const actionsContent = (
    <div className="space-y-5">
      {holding && holding.shares > 0 && (
        <HoldingSummary holding={holding} player={player} />
      )}

      {user ? (
        <TradeSection
          tradeMode={tradeMode}
          setTradeMode={setTradeMode}
          shares={shares}
          setShares={setShares}
          totalCost={totalCost}
          loading={loading}
          message={message}
          handleTrade={handleTrade}
          userRecord={userRecord}
          holding={holding}
          currentPrice={player.current_price}
        />
      ) : (
        <div className="text-center text-gray-500 text-sm py-4">
          <a href="/login" className="text-green-400 hover:underline">Sign in</a> to trade
        </div>
      )}

      {/* Limit orders */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-[#1e2330]" />
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Limit Orders</span>
          <div className="h-px flex-1 bg-[#1e2330]" />
        </div>

        {/* Pending orders list */}
        {limitOrders.length > 0 && (
          <div className="space-y-2 mb-4">
            {limitOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between bg-[#161a21] border border-[#1e2330] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${order.order_type === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {order.order_type === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="text-sm text-white">{order.shares} share{order.shares !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-gray-500">@ £{Number(order.target_price).toFixed(2)}</span>
                </div>
                <button
                  onClick={() => handleCancelLimitOrder(order.id)}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New limit order form */}
        {user && (
          <div className="space-y-3">
            <div className="flex rounded-lg overflow-hidden border border-[#1e2330]">
              <button
                onClick={() => setLimitType('buy')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${limitType === 'buy' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'}`}
              >
                Buy limit
              </button>
              <button
                onClick={() => setLimitType('sell')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${limitType === 'sell' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
              >
                Sell limit
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">£</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={limitPrice}
                  onChange={e => setLimitPrice(e.target.value)}
                  placeholder="Target price"
                  className="w-full bg-[#161a21] border border-[#1e2330] rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
              <input
                type="number"
                min="1"
                value={limitShares}
                onChange={e => setLimitShares(e.target.value)}
                placeholder="Shares"
                className="w-24 bg-[#161a21] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
              />
              <button
                onClick={handlePlaceLimitOrder}
                disabled={limitLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e2330] hover:bg-[#252d3d] text-white transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {limitLoading ? '...' : 'Place order'}
              </button>
            </div>

            <div className="text-xs text-gray-600">
              {limitType === 'buy'
                ? 'Triggers when price falls to or below your target.'
                : 'Triggers when price rises to or above your target.'}
            </div>

            {limitMessage && (
              <div className={`text-sm rounded-lg px-3 py-2 ${limitMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {limitMessage.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#111318] border border-[#1e2330] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2330]">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-[#1e2330] overflow-hidden flex-shrink-0 flex items-center justify-center">
              {player.image_url ? (
                <img src={player.image_url} alt={player.name} className="w-full h-full object-cover object-top" onError={e => { e.target.style.display = 'none' }} />
              ) : (
                <span className="text-gray-500 text-2xl font-semibold">{player.name[0]}</span>
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{player.name}</h2>
              <div className="text-sm text-gray-500 mt-0.5">{player.club} · {player.position}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">£{Number(player.current_price).toFixed(2)}</div>

              {isLive && liveChangePct != null ? (
                <div className="mt-1 space-y-0.5">
                  {/* Live change for this match */}
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                    <span className={`text-sm font-bold ${liveChangePct > 0 ? 'text-green-400' : liveChangePct < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {liveChangePct > 0 ? '+' : ''}{Number(liveChangePct).toFixed(1)}% this match
                    </span>
                  </div>
                  {/* Overall change from prev matchday price */}
                  {overallChangePct != null && Math.abs(overallChangePct - liveChangePct) > 0.05 && (
                    <div className={`text-xs ${overallChangePct > 0 ? 'text-green-400/60' : overallChangePct < 0 ? 'text-red-400/60' : 'text-gray-600'}`}>
                      {overallChangePct > 0 ? '+' : ''}{overallChangePct.toFixed(1)}% since last MD
                    </div>
                  )}
                </div>
              ) : lastChangePct !== 0 ? (
                <div className={`text-xs font-medium mt-0.5 ${lastChangePct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {lastChangePct > 0 ? '+' : ''}£{Math.abs(lastChangeAmt).toFixed(2)} ({lastChangePct > 0 ? '+' : ''}{lastChangePct.toFixed(1)}%) last match
                </div>
              ) : (
                <div className="text-xs text-gray-500">per share</div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-2">✕</button>
          </div>
        </div>

        {/* Tabs (portfolio only) */}
        {showActionsTab && (
          <div className="flex border-b border-[#1e2330]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-green-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'actions' ? 'border-green-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
              Actions
            </button>
          </div>
        )}

        <div className="p-5">
          {showActionsTab
            ? activeTab === 'overview' ? overviewContent : actionsContent
            : overviewContent}
        </div>
      </div>
    </div>
  )
}

function HoldingSummary({ holding, player }) {
  return (
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
  )
}

function TradeSection({ tradeMode, setTradeMode, shares, setShares, totalCost, loading, message, handleTrade, userRecord, holding, currentPrice }) {
  const qty = parseInt(shares, 10) || 0
  const isSell = tradeMode === 'sell'
  const avgBuy = holding?.avg_buy_price ?? 0
  const costBasis = avgBuy * qty
  const proceeds = currentPrice * qty
  const pl = proceeds - costBasis
  const plPct = costBasis > 0 ? (pl / costBasis) * 100 : 0

  return (
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
        <div className="flex-1 flex gap-2">
          <input
            type="number"
            min="1"
            max={isSell && holding?.shares > 0 ? holding.shares : undefined}
            value={shares}
            onChange={e => {
              const val = parseInt(e.target.value, 10)
              if (isSell && holding?.shares > 0 && val > holding.shares) {
                setShares(holding.shares)
              } else {
                setShares(e.target.value)
              }
            }}
            className="flex-1 bg-[#161a21] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
            placeholder="Shares"
          />
          {isSell && holding?.shares > 0 && (
            <button
              onClick={() => setShares(holding.shares)}
              className="px-3 py-2 rounded-lg text-xs text-green-400 hover:text-green-300 font-medium bg-[#161a21] border border-[#1e2330] whitespace-nowrap"
            >
              Max
            </button>
          )}
        </div>
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

      {isSell && holding?.shares > 0 && qty > 0 && (
        <div className="bg-[#161a21] border border-[#1e2330] rounded-lg px-4 py-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Bought at</span>
            <span className="text-white">£{avgBuy.toFixed(2)} × {qty} = £{costBasis.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Selling at</span>
            <span className="text-white">£{currentPrice.toFixed(2)} × {qty} = £{proceeds.toFixed(2)}</span>
          </div>
          <div className="border-t border-[#1e2330] pt-1.5 flex justify-between font-medium">
            <span className="text-gray-500">{pl >= 0 ? 'Profit' : 'Loss'}</span>
            <span className={pl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {pl >= 0 ? '+' : ''}£{Math.abs(pl).toFixed(2)} ({pl >= 0 ? '+' : ''}{plPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

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
