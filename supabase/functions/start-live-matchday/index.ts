import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// Returns true if it is currently 15:00–15:09 Europe/Lisbon
function isMatchdayWindow(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Lisbon',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  return h === 15 && m <= 9
}

function calcChangePct(stat: Record<string, unknown>): number {
  if (!stat.minutes || stat.minutes === 0) return -2
  let pct = 0
  pct += (stat.goals as number ?? 0) * 8
  pct += (stat.assists as number ?? 0) * 5
  const rating = Number(stat.rating ?? 0)
  if (rating >= 9.0)      pct += 6
  else if (rating >= 8.0) pct += 4
  else if (rating >= 7.0) pct += 1
  else if (rating < 6.5)  pct -= 2
  else if (rating < 6.0)  pct -= 4
  if (stat.clean_sheet) pct += 6
  const saves = stat.saves as number ?? 0
  if (saves >= 7) pct += 4
  else if (saves >= 5) pct += 2
  return Math.max(-20, Math.min(30, pct))
}

function dividendPerShare(position: string, stat: Record<string, unknown>): number {
  const mins = stat.minutes as number ?? 0
  if (mins === 0) return 0
  let d = 0.02 * (Math.min(mins, 90) / 90)
  const goals   = stat.goals   as number ?? 0
  const assists = stat.assists as number ?? 0
  const rating  = Number(stat.rating ?? 0)
  const cs      = stat.clean_sheet as boolean ?? false
  const goalRate = position === 'Forward' ? 0.20 : position === 'Midfielder' ? 0.14 : position === 'Defender' ? 0.10 : 0
  d += goals * goalRate
  d += assists * 0.08
  if ((position === 'Goalkeeper' || position === 'Defender') && cs) d += 0.12
  if (rating >= 9.0) d += 0.08
  else if (rating >= 8.0) d += 0.05
  else if (rating >= 7.0) d += 0.02
  return parseFloat(d.toFixed(4))
}

function generatePlayerStat(player: Record<string, unknown>, result: string, allPlayers: Record<string, unknown>[]) {
  const club = player.club as string
  const clubPlayers = allPlayers.filter(p => p.club === club)
  const sorted = [...clubPlayers].sort((a, b) => Number(b.current_price) - Number(a.current_price))
  const rank = sorted.findIndex(p => p.id === player.id) + 1
  const total = sorted.length
  const pctRank = rank / total
  const resultMod = result === 'win' ? 0.5 : result === 'draw' ? 0 : -0.3

  // GK chain: #1 plays 93%, #2 only if #1 out, #3 only if both out
  if (player.position === 'Goalkeeper') {
    const gks = sorted.filter(p => p.position === 'Goalkeeper')
    const gkRank = gks.findIndex(p => p.id === player.id) + 1
    let plays = false
    if (gkRank === 1) plays = Math.random() > 0.07
    else if (gkRank === 2) plays = Math.random() < 0.07          // plays only if #1 DNP
    else plays = Math.random() < 0.005                            // #3 barely ever

    if (!plays) return { goals: 0, assists: 0, saves: 0, rating: null, minutes: 0, clean_sheet: false, dnp_reason: gkRank === 1 ? 'Injured' : 'Not selected', price_change_pct: -1 }

    const saves = Math.floor(Math.random() * 8)
    const cs = result === 'win' ? Math.random() < 0.40 : result === 'draw' ? Math.random() < 0.25 : Math.random() < 0.05
    const base = 6.2 + Math.random() * 1.3 + resultMod + (cs ? 0.5 : 0)
    const rating = parseFloat(Math.max(4, Math.min(10, base)).toFixed(2))
    const stat = { goals: 0, assists: 0, saves, rating, minutes: 90, clean_sheet: cs, dnp_reason: null }
    return { ...stat, price_change_pct: calcChangePct(stat) }
  }

  // Tiered minutes
  let minutes = 0
  if (pctRank <= 0.30) {
    minutes = 90
  } else if (pctRank <= 0.65) {
    minutes = 50 + Math.floor(Math.random() * 31)
  } else {
    if (Math.random() < 0.20) minutes = 10 + Math.floor(Math.random() * 21)
    else return { goals: 0, assists: 0, saves: 0, rating: null, minutes: 0, clean_sheet: false, dnp_reason: 'Not selected', price_change_pct: -1 }
  }

  const base = 6.2 + Math.random() * 1.3 + resultMod
  const rating = parseFloat(Math.max(4, Math.min(10, base)).toFixed(2))
  let goals = 0, assists = 0, clean_sheet = false

  if (player.position === 'Forward') {
    const r = Math.random()
    if      (r < 0.42) goals = 0
    else if (r < 0.73) goals = 1
    else if (r < 0.89) goals = 2
    else               goals = 3
    assists = Math.random() < (goals > 0 ? 0.12 : 0.28) ? 1 : 0
  } else if (player.position === 'Midfielder') {
    goals   = Math.random() < 0.22 ? (Math.random() < 0.15 ? 2 : 1) : 0
    assists = Math.random() < 0.38 ? 1 : 0
  } else {
    goals   = Math.random() < 0.10 ? 1 : 0
    assists = Math.random() < 0.18 ? 1 : 0
    clean_sheet = result === 'win' ? Math.random() < 0.45 : result === 'draw' ? Math.random() < 0.30 : Math.random() < 0.05
  }

  const stat = { goals, assists, saves: 0, rating, minutes, clean_sheet, dnp_reason: null }
  return { ...stat, price_change_pct: calcChangePct(stat) }
}

function eventText(name: string, stat: Record<string, unknown>, newPrice: number): string | null {
  const p = `→ £${newPrice.toFixed(2)}`
  const chg = stat.price_change_pct as number
  if ((stat.goals as number) >= 2) return `${name} bags a brace! ⚽⚽ +${chg.toFixed(1)}% ${p}`
  if ((stat.goals as number) === 1) return `${name} scores! ⚽ ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${p}`
  if ((stat.assists as number) >= 1) return `${name} with the assist 🎯 ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${p}`
  if (stat.clean_sheet && (stat.rating as number) >= 7.5) return `${name} clean sheet 🧱 ${p}`
  if ((stat.rating as number) >= 8.5) return `${name} outstanding ⭐ ${p}`
  if ((stat.saves as number) >= 6) return `${name} heroics — ${stat.saves} saves 🧤 ${p}`
  if (chg <= -5 && (stat.minutes as number) > 0) return `${name} poor performance ▼ ${chg.toFixed(1)}% ${p}`
  return null
}

async function runLiveMatchday(matchday: number, players: Record<string, unknown>[]) {
  // Generate all stats upfront
  const clubs = [...new Set(players.map(p => p.club as string))]
  const clubResults: Record<string, string> = {}
  for (const c of clubs) {
    const r = Math.random()
    clubResults[c] = r < 0.45 ? 'win' : r < 0.70 ? 'draw' : 'loss'
  }

  const allStats = players.map(player => ({
    player,
    stat: generatePlayerStat(player, clubResults[player.club as string], players),
  }))

  // Shuffle for random reveal order
  allStats.sort(() => Math.random() - 0.5)

  // 5 waves × 60 s = 5 min
  const WAVES = 5
  const waveSize = Math.ceil(allStats.length / WAVES)

  for (let wave = 0; wave < WAVES; wave++) {
    if (wave > 0) await delay(60_000)

    const batch = allStats.slice(wave * waveSize, (wave + 1) * waveSize)
    console.log(`[Live] Wave ${wave + 1}/${WAVES}: ${batch.length} players`)

    const inserts: Promise<unknown>[] = []

    for (const { player, stat } of batch) {
      const oldPrice = Number(player.current_price)
      const chg = stat.price_change_pct as number
      const newPrice = parseFloat(Math.max(0.5, oldPrice * (1 + chg / 100)).toFixed(2))

      inserts.push(
        supabase.from('players').update({ current_price: newPrice }).eq('id', player.id)
      )
      inserts.push(
        supabase.from('matchday_stats').insert({
          player_id: player.id,
          matchday,
          goals: stat.goals,
          assists: stat.assists,
          saves: stat.saves,
          rating: (stat.minutes as number) > 0 ? stat.rating : null,
          minutes: stat.minutes,
          clean_sheet: stat.clean_sheet ?? false,
          dnp_reason: stat.dnp_reason ?? null,
          price_change_pct: chg,
        })
      )
      inserts.push(
        supabase.from('live_ticks').insert({
          player_id: player.id,
          price: newPrice,
          price_change_pct: chg,
          event_text: eventText(player.name as string, { ...stat, price_change_pct: chg }, newPrice),
        })
      )
    }

    await Promise.all(inserts)
  }

  // Wait out the remaining window
  await delay(60_000)

  // Finalize
  const { data: finalPlayers } = await supabase.from('players').select('id, current_price')
  if (finalPlayers?.length) {
    await supabase.from('price_history').insert(
      finalPlayers.map((p: Record<string, unknown>) => ({
        player_id: p.id,
        price: p.current_price,
        matchday,
      }))
    )
  }

  await supabase.from('matchday_tracker').update({ current_matchday: matchday }).eq('id', 1)
  await supabase.from('matchday_status').update({ status: 'completed' }).eq('id', 1)

  // Pay dividends
  const { data: portfolios } = await supabase.from('portfolios').select('user_id, player_id, shares').gt('shares', 0)
  if (portfolios?.length) {
    const byPlayer = new Map<string, { user_id: string; shares: number }[]>()
    for (const p of portfolios) {
      if (!byPlayer.has(p.player_id)) byPlayer.set(p.player_id, [])
      byPlayer.get(p.player_id)!.push({ user_id: p.user_id, shares: p.shares })
    }
    const playerPositions = new Map(players.map(p => [p.id as string, p.position as string]))
    const statsByPlayer = new Map(allStats.map(({ player, stat }) => [player.id as string, { ...stat, position: player.position as string }]))
    const userTotals = new Map<string, number>()
    const divInserts: Record<string, unknown>[] = []

    for (const [playerId, holders] of byPlayer) {
      const stat = statsByPlayer.get(playerId)
      if (!stat || (stat.minutes as number) === 0) continue
      const pos = playerPositions.get(playerId) ?? 'Midfielder'
      const dpShare = dividendPerShare(pos, stat)
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
        if (u) await supabase.from('users').update({ balance: (u as any).balance + total }).eq('id', userId)
      }
    }
  }

  console.log(`[Live] Matchday ${matchday} completed.`)
}

// ─── HTTP handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = new URL(req.url)
    const force = url.searchParams.get('force') === 'true'

    // Time gate: cron fires at both 14:00 and 15:00 UTC; function checks Lisbon clock
    if (!force && !isMatchdayWindow()) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Not 15:00 Lisbon time' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Idempotency: bail if already live (unless forced)
    const { data: status } = await supabase.from('matchday_status').select('status').eq('id', 1).single()
    if (!force && status?.status === 'live') {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Already live' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Get next matchday number
    const { data: tracker } = await supabase.from('matchday_tracker').select('current_matchday').eq('id', 1).single()
    const matchday = (tracker?.current_matchday ?? 0) + 1

    // Fetch players
    const { data: players } = await supabase.from('players').select('*')
    if (!players?.length) throw new Error('No players found')

    // Mark live & clear old ticks
    const now = new Date()
    await supabase.from('matchday_status').upsert({
      id: 1, status: 'live', matchday_number: matchday,
      started_at: now.toISOString(),
      ends_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    })
    await supabase.from('live_ticks').delete().gte('created_at', '2000-01-01')

    // Run the 5-minute matchday (blocks for ~300 s — pg_net is fire-and-forget so that's fine)
    await runLiveMatchday(matchday, players)

    return new Response(
      JSON.stringify({ ok: true, matchday }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[Live] Fatal:', err)
    await supabase.from('matchday_status').update({ status: 'scheduled' }).eq('id', 1)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
