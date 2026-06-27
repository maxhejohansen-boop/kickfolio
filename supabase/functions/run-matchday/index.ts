import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEAGUE_ID = 39
const SEASON    = 2025

// ── Types ───────────────────────────────────────────────────────────────────

interface PlayerStats {
  goals: number
  assists: number
  rating: number
  minutes: number
  saves: number
  clean_sheet: boolean
  played: boolean
}

interface FixtureInfo {
  id: number
  status: string
  teams: { home: { id: number; name: string }; away: { id: number; name: string } }
  goals: { home: number; away: number }
}

// ── Simulation ──────────────────────────────────────────────────────────────

function generateSimulatedStats(position: string): PlayerStats {
  const plays = Math.random() > 0.12
  if (!plays) return { goals: 0, assists: 0, rating: 0, minutes: 0, saves: 0, clean_sheet: false, played: false }

  const minutes = Math.random() > 0.2 ? 90 : Math.floor(Math.random() * 55 + 30)

  if (position === 'Goalkeeper') {
    const saves      = Math.floor(Math.random() * 7)
    const clean_sheet = Math.random() > 0.52
    const base       = 5.8 + Math.random() * 2.2
    const rating     = parseFloat(Math.min(10, base + saves * 0.07 + (clean_sheet ? 0.4 : -0.15)).toFixed(1))
    return { goals: 0, assists: 0, rating, minutes, saves, clean_sheet, played: true }
  }

  if (position === 'Defender') {
    const goals       = Math.random() < 0.07 ? 1 : 0
    const assists     = Math.random() < 0.10 ? 1 : 0
    const clean_sheet = Math.random() > 0.52
    const base        = 5.8 + Math.random() * 2.2
    const rating      = parseFloat(Math.min(10, base + goals * 0.7 + assists * 0.3 + (clean_sheet ? 0.3 : -0.1)).toFixed(1))
    return { goals, assists, rating, minutes, saves: 0, clean_sheet, played: true }
  }

  if (position === 'Midfielder') {
    const goals   = Math.random() < 0.14 ? (Math.random() < 0.2 ? 2 : 1) : 0
    const assists  = Math.random() < 0.22 ? (Math.random() < 0.15 ? 2 : 1) : 0
    const base     = 5.8 + Math.random() * 2.5
    const rating   = parseFloat(Math.min(10, base + goals * 0.5 + assists * 0.25).toFixed(1))
    return { goals, assists, rating, minutes, saves: 0, clean_sheet: false, played: true }
  }

  // Forward
  const goals   = Math.random() < 0.35 ? (Math.random() < 0.3 ? (Math.random() < 0.15 ? 3 : 2) : 1) : 0
  const assists  = Math.random() < 0.18 ? 1 : 0
  const base     = 5.8 + Math.random() * 2.5
  const rating   = parseFloat(Math.min(10, base + goals * 0.65 + assists * 0.25).toFixed(1))
  return { goals, assists, rating, minutes, saves: 0, clean_sheet: false, played: true }
}

// ── API-Football helpers ─────────────────────────────────────────────────────

async function apiFetch(path: string, apiKey: string) {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' },
  })
  if (!res.ok) throw new Error(`API-Football ${path} → ${res.status}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`)
  }
  return json.response
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae')
    .replace(/[-_.]/g, ' ').replace(/\s+/g, ' ').trim()
}

function namesMatch(ourName: string, apiName: string): boolean {
  const a = normaliseName(ourName)
  const b = normaliseName(apiName)
  if (a === b) return true
  const aWords = a.split(' '), bWords = b.split(' ')
  const aLast = aWords[aWords.length - 1], bLast = bWords[bWords.length - 1]
  if (aLast === bLast && aLast.length > 3 && aWords[0][0] === bWords[0][0]) return true
  if (a.includes(b) || b.includes(a)) return true
  if ([...aWords].reverse().join(' ') === b) return true
  return false
}

function cleanSheetMap(fixture: FixtureInfo): Map<number, boolean> {
  const { home, away } = fixture.goals
  return new Map([
    [fixture.teams.home.id, away === 0],
    [fixture.teams.away.id, home === 0],
  ])
}

// ── Price change formula (shared) ────────────────────────────────────────────

function calcChangePct(stats: PlayerStats): number {
  if (!stats.played) return -1
  let pct = 0
  pct += stats.goals   * 5
  pct += stats.assists * 3
  if (stats.rating >= 8.0)      pct += 3
  else if (stats.rating >= 7.0) pct += 1
  else if (stats.rating < 6.0)  pct -= 3
  if (stats.clean_sheet) pct += 4
  if (stats.saves >= 5)  pct += 2
  return Math.max(-15, Math.min(15, pct))
}

// ── Edge Function ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let body: any = {}
    try { body = await req.json() } catch { /* no body */ }
    const targetMatchday: number | null = body.matchday ? parseInt(body.matchday) : null
    const dryRun   = body.dry_run  ?? false
    const simulate = body.simulate ?? false

    // ── 1. Current matchday ─────────────────────────────────────────────────
    const { data: tracker } = await supabase
      .from('matchday_tracker').select('current_matchday').eq('id', 1).single()
    const currentMatchday = tracker?.current_matchday ?? 0
    const matchday = targetMatchday ?? currentMatchday + 1

    if (matchday > 38) return json({ message: 'Season complete — all 38 matchdays processed.' })

    // ── 2. Build stat map ───────────────────────────────────────────────────
    const apiStatMap = new Map<string, PlayerStats>()
    let fixtureCount = 0

    if (!simulate) {
      const apiKey = Deno.env.get('API_FOOTBALL_KEY')
      if (!apiKey) throw new Error('API_FOOTBALL_KEY secret not set')

      const round = `Regular Season - ${matchday}`
      const fixturesRaw = await apiFetch(
        `/fixtures?league=${LEAGUE_ID}&season=${SEASON}&round=${encodeURIComponent(round)}`, apiKey,
      )
      if (!fixturesRaw || fixturesRaw.length === 0) return json({ message: `No fixtures found for ${round}` })

      const fixtures: FixtureInfo[] = fixturesRaw.map((f: any) => ({
        id: f.fixture.id, status: f.fixture.status.short,
        teams: { home: f.teams.home, away: f.teams.away },
        goals: { home: f.goals.home ?? 0, away: f.goals.away ?? 0 },
      }))

      const unfinished = fixtures.filter(f => !['FT','AET','PEN'].includes(f.status))
      if (unfinished.length > 0) {
        return json({ message: `Round ${matchday} not fully finished`, unfinished: unfinished.map(f => `${f.teams.home.name} v ${f.teams.away.name} [${f.status}]`) })
      }
      fixtureCount = fixtures.length

      await Promise.all(fixtures.map(async (fixture) => {
        const csMap = cleanSheetMap(fixture)
        const playersRaw = await apiFetch(`/fixtures/players?fixture=${fixture.id}`, apiKey)
        for (const teamData of (playersRaw ?? [])) {
          const keptCleanSheet = csMap.get(teamData.team.id) ?? false
          for (const entry of (teamData.players ?? [])) {
            const stats = entry.statistics?.[0]
            if (!stats) continue
            const minutes = stats.games?.minutes ?? 0
            apiStatMap.set(normaliseName(entry.player.name), {
              goals: stats.goals?.total ?? 0, assists: stats.goals?.assists ?? 0,
              rating: parseFloat(stats.games?.rating ?? '0') || 0,
              minutes, saves: stats.goals?.saves ?? 0,
              clean_sheet: minutes > 0 && keptCleanSheet, played: minutes > 0,
            })
          }
        }
      }))
    }

    // ── 3. Load players ─────────────────────────────────────────────────────
    const { data: players, error: playersError } = await supabase
      .from('players').select('id, name, position, current_price')
    if (playersError) throw playersError

    const priceHistoryInserts: any[] = []
    const statsInserts: any[]        = []
    const priceUpdates: any[]        = []
    const matchLog: any[]            = []

    for (const player of (players as any[])) {
      let stats: PlayerStats

      if (simulate) {
        stats = generateSimulatedStats(player.position)
      } else {
        let matched: PlayerStats | null = null
        for (const [normApiName, ps] of apiStatMap) {
          if (namesMatch(player.name, normApiName)) { matched = ps; break }
        }
        stats = matched ?? { goals: 0, assists: 0, rating: 0, minutes: 0, saves: 0, clean_sheet: false, played: false }
      }

      const changePct = calcChangePct(stats)
      const newPrice  = parseFloat(Math.max(1, player.current_price * (1 + changePct / 100)).toFixed(2))

      priceHistoryInserts.push({ player_id: player.id, price: newPrice, matchday })
      statsInserts.push({
        player_id: player.id, matchday,
        goals: stats.goals, assists: stats.assists,
        rating: stats.played ? stats.rating : 0,
        minutes: stats.minutes, saves: stats.saves,
        clean_sheet: stats.clean_sheet, price_change_pct: changePct,
      })
      priceUpdates.push({ id: player.id, current_price: newPrice })
      matchLog.push({
        player: player.name, position: player.position,
        played: stats.played, goals: stats.goals, assists: stats.assists,
        rating: stats.rating, saves: stats.saves, clean_sheet: stats.clean_sheet,
        changePct, oldPrice: player.current_price, newPrice,
      })
    }

    if (dryRun) return json({ dry_run: true, simulate, matchday, log: matchLog })

    // ── 4. Write to database ────────────────────────────────────────────────
    const { error: phError } = await supabase.from('price_history').insert(priceHistoryInserts)
    if (phError) throw phError

    const { error: msError } = await supabase.from('matchday_stats').insert(statsInserts)
    if (msError) throw msError

    for (const u of priceUpdates) {
      await supabase.from('players').update({ current_price: u.current_price }).eq('id', u.id)
    }

    await supabase.from('matchday_tracker').update({ current_matchday: matchday }).eq('id', 1)

    // ── 5. Process pending limit orders ─────────────────────────────────────
    const newPriceMap = new Map(priceUpdates.map((u: any) => [u.id, u.current_price]))
    const { data: pendingOrders } = await supabase.from('limit_orders').select('*').eq('status', 'pending')

    for (const order of (pendingOrders ?? [])) {
      const newPrice = newPriceMap.get(order.player_id)
      if (newPrice == null) continue
      const shouldFill =
        (order.order_type === 'buy'  && newPrice <= order.target_price) ||
        (order.order_type === 'sell' && newPrice >= order.target_price)
      if (!shouldFill) continue
      try {
        if (order.order_type === 'buy') {
          const { data: userRow } = await supabase.from('users').select('balance').eq('id', order.user_id).single()
          const cost = order.shares * newPrice
          if (!userRow || userRow.balance < cost) { await supabase.from('limit_orders').update({ status: 'cancelled' }).eq('id', order.id); continue }
          const { data: holding } = await supabase.from('portfolios').select('shares, avg_buy_price').eq('user_id', order.user_id).eq('player_id', order.player_id).maybeSingle()
          const existingShares = holding?.shares ?? 0
          const newShares = existingShares + order.shares
          const newAvg = existingShares === 0 ? newPrice : ((holding.avg_buy_price * existingShares) + (newPrice * order.shares)) / newShares
          await supabase.from('users').update({ balance: userRow.balance - cost }).eq('id', order.user_id)
          await supabase.from('portfolios').upsert({ user_id: order.user_id, player_id: order.player_id, shares: newShares, avg_buy_price: parseFloat(newAvg.toFixed(2)) }, { onConflict: 'user_id,player_id' })
        } else {
          const { data: holding } = await supabase.from('portfolios').select('shares').eq('user_id', order.user_id).eq('player_id', order.player_id).maybeSingle()
          if (!holding || holding.shares < order.shares) { await supabase.from('limit_orders').update({ status: 'cancelled' }).eq('id', order.id); continue }
          const { data: userRow } = await supabase.from('users').select('balance').eq('id', order.user_id).single()
          const proceeds = order.shares * newPrice
          const newShares = holding.shares - order.shares
          await supabase.from('users').update({ balance: userRow.balance + proceeds }).eq('id', order.user_id)
          if (newShares === 0) { await supabase.from('portfolios').delete().eq('user_id', order.user_id).eq('player_id', order.player_id) }
          else { await supabase.from('portfolios').update({ shares: newShares }).eq('user_id', order.user_id).eq('player_id', order.player_id) }
        }
        await supabase.from('limit_orders').update({ status: 'filled', filled_at: new Date().toISOString() }).eq('id', order.id)
      } catch (err) { console.error(`limit order ${order.id} failed:`, err) }
    }

    return json({ success: true, matchday, simulate, fixtures: fixtureCount, log: matchLog })

  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
