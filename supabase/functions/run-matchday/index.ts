import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEAGUE_ID = 39
const SEASON    = 2025

// ── Types ───────────────────────────────────────────────────────────────────

const DNP_REASONS = [
  'Injury', 'Injury', 'Injury', 'Injury',
  'Knock sustained in training', 'Knock sustained in training', 'Knock sustained in training',
  'Illness', 'Illness', 'Illness',
  'Precautionary rest', 'Precautionary rest', 'Precautionary rest',
  'Fatigue', 'Fatigue',
  'Rested to regain match sharpness', 'Rested to regain match sharpness',
  'Suspension',
  'Personal reasons',
  'International duty conflict',
  'Fell out with manager',
]

interface PlayerStats {
  goals: number
  assists: number
  rating: number
  minutes: number
  saves: number
  clean_sheet: boolean
  played: boolean
  dnp_reason?: string
}

interface FixtureInfo {
  id: number
  status: string
  teams: { home: { id: number; name: string }; away: { id: number; name: string } }
  goals: { home: number; away: number }
}

interface GoalEvent {
  minute: number
  side: 'home' | 'away'
  scorer: string
  assister: string | null
}

interface SimFixture {
  home: string
  away: string
  homeGoals: number
  awayGoals: number
  events: GoalEvent[]
}

// ── Simulation ──────────────────────────────────────────────────────────────

const GAME_TEAMS = ['Liverpool', 'Manchester City', 'Chelsea', 'Arsenal', 'Tottenham', 'Manchester United']

const GOAL_WEIGHT: Record<string, number> = { Forward: 10, Midfielder: 2.5, Defender: 0.8, Goalkeeper: 0 }

function simGoals(): number {
  const r = Math.random()
  if (r < 0.12) return 0
  if (r < 0.32) return 1
  if (r < 0.56) return 2
  if (r < 0.76) return 3
  if (r < 0.90) return 4
  return 5
}

function generateSimFixtures(): SimFixture[] {
  const shuffled = [...GAME_TEAMS].sort(() => Math.random() - 0.5)
  const out: SimFixture[] = []
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    out.push({ home: shuffled[i], away: shuffled[i + 1], homeGoals: simGoals(), awayGoals: simGoals(), events: [] })
  }
  return out
}

function randomMinutes(count: number): number[] {
  const used = new Set<number>()
  while (used.size < count) used.add(Math.floor(Math.random() * 90) + 1)
  return [...used].sort((a, b) => a - b)
}

function weightedPick<T>(items: T[], weightFn: (item: T) => number): T | null {
  const weights = items.map(weightFn)
  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) return null
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}

function generateTeamMatchStats(
  players: Array<{ id: string; position: string; name: string; current_price: number }>,
  teamGoals: number,
  opponentGoals: number,
  side: 'home' | 'away',
): { stats: Map<string, PlayerStats>; events: GoalEvent[] } {
  const cleanSheet = opponentGoals === 0
  const won = teamGoals > opponentGoals
  const lost = teamGoals < opponentGoals
  const resultMod = won ? 0.3 : lost ? -0.25 : 0

  // Separate GKs (handled specially) from outfield
  const gks      = [...players].filter(p => p.position === 'Goalkeeper').sort((a, b) => b.current_price - a.current_price)
  const outfield = [...players].filter(p => p.position !== 'Goalkeeper').sort((a, b) => b.current_price - a.current_price)
  const total = outfield.length
  const starCutoff  = Math.ceil(total * 0.35)  // top 35% = stars (90 min)
  const squadCutoff = Math.ceil(total * 0.70)  // next 35% = squad (50-80 min)
  // bottom 30% = fringe/youth (rare 10-30 min cameos)

  function dnpReason() { return DNP_REASONS[Math.floor(Math.random() * DNP_REASONS.length)] }

  function pickMinutes(rank: number): number {
    if (rank < starCutoff)  return 90
    if (rank < squadCutoff) return Math.floor(Math.random() * 31) + 50
    return Math.random() > 0.8 ? Math.floor(Math.random() * 21) + 10 : 0
  }

  type Squad = { id: string; position: string; plays: boolean; minutes: number; dnp_reason?: string }

  // GK logic: #1 plays unless DNP'd, #2 only if #1 out, #3 only if #1 and #2 both out
  const gkSquad: Squad[] = []
  let gkSlotFilled = false
  for (let i = 0; i < gks.length; i++) {
    const gk = gks[i]
    if (gkSlotFilled) {
      gkSquad.push({ id: gk.id, position: 'Goalkeeper', plays: false, minutes: 0, dnp_reason: 'Not selected' })
      continue
    }
    // #1 GK: 7% DNP chance; #2+: only called up if previous is out (already handled), so same DNP roll but they can be dropped too
    const dnpChance = i === 0 ? 0.07 : 0.10
    if (Math.random() < dnpChance) {
      gkSquad.push({ id: gk.id, position: 'Goalkeeper', plays: false, minutes: 0, dnp_reason: dnpReason() })
    } else {
      gkSquad.push({ id: gk.id, position: 'Goalkeeper', plays: true, minutes: 90 })
      gkSlotFilled = true
    }
  }

  // Outfield logic: tiered by price
  const outfieldSquad: Squad[] = outfield.map((p, rank) => {
    const isfringe = rank >= squadCutoff
    if (isfringe && pickMinutes(rank) === 0) {
      return { id: p.id, position: p.position, plays: false, minutes: 0, dnp_reason: dnpReason() }
    }
    const dnp = rank < squadCutoff ? Math.random() < 0.08 : Math.random() < 0.25
    if (dnp) return { id: p.id, position: p.position, plays: false, minutes: 0, dnp_reason: dnpReason() }
    const mins = pickMinutes(rank)
    return { id: p.id, position: p.position, plays: mins > 0, minutes: mins }
  })

  const squad: Squad[] = [...gkSquad, ...outfieldSquad]

  const nameMap = new Map(players.map(p => [p.id, p.name]))
  const active = squad.filter(p => p.plays)
  const activeOutfield = active.filter(p => p.position !== 'Goalkeeper')

  // Distribute goals — each goal assigned to a player by weighted random
  const goalTally: Record<string, number> = {}
  const assistTally: Record<string, number> = {}
  for (const p of active) { goalTally[p.id] = 0; assistTally[p.id] = 0 }

  const rawEvents: { scorerName: string; assisterName: string | null }[] = []

  for (let i = 0; i < teamGoals; i++) {
    const scorer = weightedPick(activeOutfield, p => GOAL_WEIGHT[p.position] ?? 0)
    if (!scorer) continue
    goalTally[scorer.id]++
    let assisterName: string | null = null
    if (Math.random() > 0.2) {
      const assistCandidates = active.filter(p => p.id !== scorer.id)
      const assister = weightedPick(assistCandidates, p => GOAL_WEIGHT[p.position] ?? 0.3)
      if (assister) { assistTally[assister.id]++; assisterName = nameMap.get(assister.id) ?? null }
    }
    rawEvents.push({ scorerName: nameMap.get(scorer.id) ?? scorer.id, assisterName })
  }

  const minutes = randomMinutes(rawEvents.length)
  const events: GoalEvent[] = rawEvents.map((e, i) => ({ minute: minutes[i], side, scorer: e.scorerName, assister: e.assisterName }))

  // GK saves: baseline + extra per opponent goal (they faced more shots)
  const gk = active.find(p => p.position === 'Goalkeeper')
  const saveTally: Record<string, number> = {}
  for (const p of active) saveTally[p.id] = 0
  if (gk) saveTally[gk.id] = Math.floor(Math.random() * 3) + opponentGoals

  // Goal bonus tables — scaled so hat-tricks push into 9s, 4 goals guarantees 10.0
  const GOAL_BONUS: Record<string, number[]> = {
    Forward:    [0, 1.5, 3.0, 4.5, 6.0],
    Midfielder: [0, 1.3, 2.8, 4.2, 5.8],
    Defender:   [0, 1.8, 3.5, 5.0, 6.5],
    Goalkeeper: [0, 0,   0,   0,   0  ],
  }
  const ASSIST_BONUS: Record<string, number> = {
    Forward: 0.8, Midfielder: 0.7, Defender: 0.6, Goalkeeper: 0,
  }

  // Build final stats
  const result = new Map<string, PlayerStats>()
  for (const p of squad) {
    if (!p.plays) {
      result.set(p.id, { goals: 0, assists: 0, rating: 0, minutes: 0, saves: 0, clean_sheet: false, played: false, dnp_reason: p.dnp_reason })
      continue
    }
    const g = goalTally[p.id] ?? 0
    const a = assistTally[p.id] ?? 0
    const s = saveTally[p.id] ?? 0
    const cs = (p.position === 'Goalkeeper' || p.position === 'Defender') ? cleanSheet : false

    // Base: floor lifted so solid contributors naturally reach 7.0+
    const base = 6.2 + Math.random() * 1.3 + resultMod
    const bonuses = p.position === 'Goalkeeper'
      ? s * 0.12 + (cs ? 0.9 : opponentGoals * -0.15)
      : (GOAL_BONUS[p.position]?.[Math.min(g, 4)] ?? 0)
        + a * (ASSIST_BONUS[p.position] ?? 0.6)
        + (cs ? 0.5 : 0)

    const rating = parseFloat(Math.min(10, Math.max(4.5, base + bonuses)).toFixed(1))
    result.set(p.id, { goals: g, assists: a, rating, minutes: p.minutes, saves: s, clean_sheet: cs, played: true })
  }
  return { stats: result, events }
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
  if (!stats.played) return -2
  let pct = 0
  pct += stats.goals   * 8
  pct += stats.assists * 5
  if (stats.rating >= 9.0)       pct += 6
  else if (stats.rating >= 8.0)  pct += 4
  else if (stats.rating >= 7.0)  pct += 1
  else if (stats.rating < 6.5)   pct -= 2
  else if (stats.rating < 6.0)   pct -= 4
  if (stats.clean_sheet) pct += 6
  if (stats.saves >= 7)  pct += 4
  else if (stats.saves >= 5) pct += 2
  return Math.max(-20, Math.min(30, pct))
}

// ── Dividends ────────────────────────────────────────────────────────────────

function dividendPerShare(position: string, stat: { goals: number; assists: number; minutes: number; rating: number; clean_sheet: boolean; saves: number }): number {
  if (stat.minutes === 0) return 0
  let d = 0.02 * (Math.min(stat.minutes, 90) / 90)
  const goalRate = position === 'Forward' ? 0.20 : position === 'Midfielder' ? 0.14 : position === 'Defender' ? 0.10 : 0
  d += stat.goals * goalRate
  d += stat.assists * 0.08
  if ((position === 'Goalkeeper' || position === 'Defender') && stat.clean_sheet) d += 0.12
  const r = stat.rating ?? 0
  if (r >= 9.0) d += 0.08
  else if (r >= 8.0) d += 0.05
  else if (r >= 7.0) d += 0.02
  return parseFloat(d.toFixed(4))
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
      .from('players').select('id, name, club, position, current_price')
    if (playersError) throw playersError

    // Generate sim fixtures and pre-build per-player stats map
    const simFixtures: SimFixture[] = simulate ? generateSimFixtures() : []
    const simStatsMap = new Map<string, PlayerStats>()

    if (simulate) {
      const byClub = new Map<string, Array<{ id: string; position: string; name: string; current_price: number }>>()
      for (const p of (players as any[])) {
        if (!byClub.has(p.club)) byClub.set(p.club, [])
        byClub.get(p.club)!.push({ id: p.id, position: p.position, name: p.name, current_price: p.current_price })
      }
      for (const f of simFixtures) {
        const home = generateTeamMatchStats(byClub.get(f.home) ?? [], f.homeGoals, f.awayGoals, 'home')
        const away = generateTeamMatchStats(byClub.get(f.away) ?? [], f.awayGoals, f.homeGoals, 'away')
        for (const [id, s] of home.stats) simStatsMap.set(id, s)
        for (const [id, s] of away.stats) simStatsMap.set(id, s)
        f.events = [...home.events, ...away.events].sort((a, b) => a.minute - b.minute)
      }
    }

    const priceHistoryInserts: any[] = []
    const statsInserts: any[]        = []
    const priceUpdates: any[]        = []
    const matchLog: any[]            = []

    for (const player of (players as any[])) {
      let stats: PlayerStats

      if (simulate) {
        stats = simStatsMap.get(player.id) ?? { goals: 0, assists: 0, rating: 0, minutes: 0, saves: 0, clean_sheet: false, played: false }
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
        dnp_reason: stats.played ? null : (stats.dnp_reason ?? 'Unknown'),
      })
      priceUpdates.push({ id: player.id, current_price: newPrice })
      if (stats.played) {
        const playerFixture = simFixtures.find(f => f.home === player.club || f.away === player.club) ?? null
        matchLog.push({
          player: player.name, club: player.club, position: player.position,
          played: true, goals: stats.goals, assists: stats.assists,
          rating: stats.rating, saves: stats.saves, clean_sheet: stats.clean_sheet,
          minutes: stats.minutes,
          changePct, oldPrice: player.current_price, newPrice,
          fixture: playerFixture,
        })
      }
    }

    if (dryRun) return json({ dry_run: true, simulate, matchday, simFixtures, log: matchLog })

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

    // ── 6. Dividends ────────────────────────────────────────────────────────
    const { data: portfolios } = await supabase.from('portfolios').select('user_id, player_id, shares').gt('shares', 0)
    if (portfolios?.length) {
      const byPlayer = new Map<string, { user_id: string; shares: number }[]>()
      for (const p of (portfolios as any[])) {
        if (!byPlayer.has(p.player_id)) byPlayer.set(p.player_id, [])
        byPlayer.get(p.player_id)!.push({ user_id: p.user_id, shares: p.shares })
      }
      const playerPositions = new Map((players as any[]).map(p => [p.id, p.position]))
      const userTotals = new Map<string, number>()
      const divInserts: any[] = []

      for (const [playerId, holders] of byPlayer) {
        const entry = statsInserts.find((s: any) => s.player_id === playerId)
        if (!entry || entry.minutes === 0) continue
        const pos = playerPositions.get(playerId) ?? 'Midfielder'
        const dpShare = dividendPerShare(pos, entry)
        if (dpShare <= 0) continue
        for (const { user_id, shares } of holders) {
          const total = parseFloat((dpShare * shares).toFixed(2))
          if (total <= 0) continue
          userTotals.set(user_id, (userTotals.get(user_id) ?? 0) + total)
          divInserts.push({ user_id, player_id: playerId, matchday, shares, dividend_per_share: dpShare, total_payment: total })
        }
      }
      if (divInserts.length) {
        await supabase.from('dividend_payments').insert(divInserts)
        for (const [userId, total] of userTotals) {
          const { data: u } = await supabase.from('users').select('balance').eq('id', userId).single()
          if (u) await supabase.from('users').update({ balance: u.balance + total }).eq('id', userId)
        }
      }
    }

    return json({ success: true, matchday, simulate, simFixtures, apiFixtures: fixtureCount, log: matchLog })

  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
