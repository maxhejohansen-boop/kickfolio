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

function pickInterview(matchday: number, change: number, bestPlayer: string) {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
  const outlets  = ['BBC Sport', 'Sky Sports', 'The Athletic', 'TalkSport', 'Evening Standard']
  const pundits  = ['Gary Lineker', 'Jamie Carragher', 'Roy Keane', 'Alan Shearer', 'Micah Richards']
  const sponsors = ['SportAnalytics Ltd', 'FanZone Media', 'MatchTrack Pro', 'DataSport UK']
  const outlet   = pick(outlets)
  const pundit   = pick(pundits)
  const sponsor  = pick(sponsors)
  const fee      = pick([150, 200, 250, 300])
  const isUp     = change >= 0

  const scenarios = [
    {
      sender: sponsor, subject: `Sponsorship offer: ${sponsor}`,
      body: `${sponsor} has been tracking your performance and wants to feature your approach in their latest campaign.\n\nThey're offering a flat fee of £${fee} for a brief quote about your investment philosophy.`,
      question: `${sponsor} wants a quote for their campaign. Do you accept?`,
      options: [
        { id: 'a', label: 'Accept the deal',  text: `"Happy to help — we always enjoy sharing our process with the wider community."`, effect: { type: 'balance', amount: fee } },
        { id: 'b', label: 'Negotiate upward', text: `"We'd consider it for £${Math.round(fee * 1.6)}, but not a penny less."`,          effect: { type: 'balance_gamble', success_chance: 0.45, amount: Math.round(fee * 1.6) } },
        { id: 'c', label: 'Decline politely', text: `"We appreciate the offer, but prefer to keep a low profile right now."`,           effect: { type: 'none' } },
      ],
    },
    {
      sender: outlet, subject: `${outlet} wants a comment`,
      body: `${outlet} is putting together a feature on matchday ${matchday}'s standout portfolio managers. ${isUp ? 'Your portfolio movement caught their eye.' : 'They want to capture a range of voices after a volatile matchday.'}\n\nA journalist is waiting for your statement.`,
      question: isUp ? `Your portfolio had a strong matchday. What's behind it?` : `It was a tough matchday for many investors. How are you reading the market?`,
      options: isUp ? [
        { id: 'a', label: 'Credit your scouting', text: `"Good scouting is the foundation. We do our homework before every matchday."`,   effect: { type: 'none' } },
        { id: 'b', label: 'Stay humble',           text: `"It was a positive matchday, but the season is long. We stay focused."`,          effect: { type: 'none' } },
        { id: 'c', label: 'Take the credit',       text: `"We predicted this. The data doesn't lie — we read it better than most."`,       effect: { type: 'none' } },
      ] : [
        { id: 'a', label: 'Back your process', text: `"The market has cycles. We back our process and stay patient."`,               effect: { type: 'none' } },
        { id: 'b', label: 'Deflect',           text: `"We'll review the numbers carefully. No public statement today."`,             effect: { type: 'none' } },
        { id: 'c', label: 'Own it',            text: `"We got it wrong this matchday. We'll learn from it and come back stronger."`, effect: { type: 'none' } },
      ],
    },
    {
      sender: 'Match of the Day', subject: `${pundit} challenges your strategy`,
      body: `During a recent broadcast, ${pundit} sparked debate by dismissing football portfolio investing as "dressed-up gambling with no real skill involved."\n\nA producer has reached out with a £${fee} appearance fee if you agree to respond live on air.`,
      question: `${pundit} says player investing is "just gambling in a suit." How do you respond?`,
      options: [
        { id: 'a', label: 'Appear & defend it',  text: `"${pundit} is entitled to his view. I'd invite him to look at the numbers behind a good scouting network."`, effect: { type: 'balance', amount: fee } },
        { id: 'b', label: 'Decline',             text: `"No comment. We let our portfolio performance speak for itself."`,                                            effect: { type: 'none' } },
        { id: 'c', label: 'Hit back online',     text: `"Respectfully, ${pundit} spent 20 years kicking a ball. Maybe stick to that."`,                              effect: { type: 'none' } },
      ],
    },
    {
      sender: 'Transfer Daily', subject: `Transfer rumour: are you buying ${bestPlayer || 'a star player'}?`,
      body: `Transfer Daily is running an exclusive suggesting you are preparing a significant position on ${bestPlayer || 'a leading Premier League player'} ahead of next matchday.\n\nThe speculation is already moving their share price. Their journalist is requesting a response.`,
      question: `Reports link you to ${bestPlayer || 'a top player'}. Is there any truth to it?`,
      options: [
        { id: 'a', label: 'Confirm interest', text: `"${bestPlayer || 'The player'} is someone we have been monitoring closely. No further comment."`, effect: { type: 'none' } },
        { id: 'b', label: 'Flat denial',      text: `"We have no interest in that position at this time. The report is inaccurate."`,                  effect: { type: 'none' } },
        { id: 'c', label: 'No comment',       text: `"We never comment on potential portfolio moves before they're made."`,                             effect: { type: 'none' } },
      ],
    },
    {
      sender: 'The Athletic', subject: `Insider trading allegation — your response?`,
      body: `The Athletic's investigative desk has received a tip suggesting your recent trades may have been made on non-public information.\n\nThey're giving you the opportunity to respond before publishing. The journalist stresses this does not imply wrongdoing.`,
      question: `The Athletic is asking about "unusual trading patterns" in your recent matchdays. How do you respond?`,
      options: [
        { id: 'a', label: 'Deny any wrongdoing',   text: `"Our trades are entirely based on publicly available data and our own scouting network. We have nothing to hide."`, effect: { type: 'none' } },
        { id: 'b', label: 'Threaten legal action', text: `"This allegation is defamatory. Our legal team will be in touch before any publication."`,                          effect: { type: 'none' } },
        { id: 'c', label: 'Refuse to engage',      text: `"We don't respond to fishing expeditions. Publish what you like."`,                                               effect: { type: 'none' } },
      ],
    },
  ]
  return pick(scenarios)
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

  // Rating computed AFTER goals/assists so scorers always get high ratings
  const GOAL_BONUS = goals >= 3 ? 4.0 : goals === 2 ? 2.5 : goals === 1 ? 1.5 : 0
  const ASSIST_BONUS = assists * 0.7
  const CS_BONUS = clean_sheet ? 0.4 : 0
  const base = 6.0 + Math.random() * 1.4 + resultMod + GOAL_BONUS + ASSIST_BONUS + CS_BONUS
  // Hard floors: can't score 3 and get a 6; can't assist and get below 6.8
  const floor = goals >= 3 ? 9.2 : goals >= 2 ? 8.2 : goals >= 1 ? 7.0 : assists >= 1 ? 6.8 : 4.0
  const rating = parseFloat(Math.max(floor, Math.min(10, base)).toFixed(2))

  const stat = { goals, assists, saves: 0, rating, minutes, clean_sheet, dnp_reason: null }
  return { ...stat, price_change_pct: calcChangePct(stat) }
}

// wave 0→4 maps to match minutes 1-18, 19-36, 37-54, 55-72, 73-90
function waveMinute(wave: number): number {
  const lo = wave * 18 + 1
  const hi = Math.min(90, (wave + 1) * 18)
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

function eventText(name: string, stat: Record<string, unknown>, newPrice: number, wave: number, minute: number): string | null {
  const p = `→ £${newPrice.toFixed(2)}`
  const chg = stat.price_change_pct as number
  const min = `${minute}'`
  const goals  = stat.goals  as number ?? 0
  const assists = stat.assists as number ?? 0
  if (goals >= 3)  return `${name} hat-trick! ⚽⚽⚽ ${min} ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${p}`
  if (goals >= 2)  return `${name} brace! ⚽⚽ ${min} ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${p}`
  if (goals === 1) return `${name} scores! ⚽ ${min} ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${p}`
  if (assists >= 1) return `${name} assist 🎯 ${min} ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${p}`
  // clean sheet only announced at final whistle (last wave)
  if (stat.clean_sheet && (stat.rating as number) >= 7.5 && wave === 4) return `${name} clean sheet 🧱 90' ${p}`
  if ((stat.rating as number) >= 8.5) return `${name} outstanding performance ⭐ ${min} ${p}`
  if ((stat.saves as number) >= 6)    return `${name} heroics — ${stat.saves} saves 🧤 ${min} ${p}`
  if (chg <= -5 && (stat.minutes as number) > 0) return `${name} poor showing ▼ ${chg.toFixed(1)}% ${min} ${p}`
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
      const minute = waveMinute(wave)

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
          event_text: eventText(player.name as string, { ...stat, price_change_pct: chg }, newPrice, wave, minute),
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
  const { data: portfolios } = await supabase.from('portfolios').select('user_id, player_id, shares, avg_buy_price').gt('shares', 0)
  const userDividendTotals = new Map<string, number>()
  if (portfolios?.length) {
    const byPlayer = new Map<string, { user_id: string; shares: number }[]>()
    for (const p of portfolios) {
      if (!byPlayer.has(p.player_id)) byPlayer.set(p.player_id, [])
      byPlayer.get(p.player_id)!.push({ user_id: p.user_id, shares: p.shares })
    }
    const playerPositions = new Map(players.map(p => [p.id as string, p.position as string]))
    const statsByPlayer = new Map(allStats.map(({ player, stat }) => [player.id as string, { ...stat, position: player.position as string }]))
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
        userDividendTotals.set(user_id, (userDividendTotals.get(user_id) ?? 0) + total)
        divInserts.push({ user_id, player_id: playerId, matchday, shares, dividend_per_share: dpShare, total_payment: total })
      }
    }
    if (divInserts.length) {
      await supabase.from('dividend_payments').insert(divInserts)
      for (const [userId, total] of userDividendTotals) {
        const { data: u } = await supabase.from('users').select('balance').eq('id', userId).single()
        if (u) await supabase.from('users').update({ balance: (u as any).balance + total }).eq('id', userId)
      }
    }
  }

  // Process scouting focuses
  const { data: activeFocuses } = await supabase.from('scouting_focuses').select('*').eq('active', true)
  if (activeFocuses?.length) {
    const userFocusMap = new Map<string, any[]>()
    for (const f of activeFocuses) {
      if (!userFocusMap.has(f.user_id)) userFocusMap.set(f.user_id, [])
      userFocusMap.get(f.user_id)!.push(f)
    }

    for (const [userId, userFocuses] of userFocusMap) {
      const { data: allScouts } = await supabase.from('player_scouts').select('player_id, scout_type, reveals_at_matchday').eq('user_id', userId)
      const { data: uRow }      = await supabase.from('users').select('balance, max_scouts').eq('id', userId).single()
      const maxScouts = (uRow as any)?.max_scouts ?? 3
      const pendingCount = (allScouts ?? []).filter((s: any) => s.scout_type === 'sent' && s.reveals_at_matchday != null && s.reveals_at_matchday > matchday).length
      const availableSlots = Math.max(0, maxScouts - pendingCount)
      if (availableSlots === 0) continue

      const scoutedSet = new Set((allScouts ?? []).map((s: any) => s.player_id))
      const totalCost = userFocuses.reduce((s: number, f: any) => s + Number(f.cost_per_matchday), 0)
      const newScouts: any[] = []

      for (const focus of userFocuses) {
        for (const p of players) {
          if (newScouts.length >= availableSlots) break
          if (scoutedSet.has(p.id)) continue
          if (focus.position && p.position !== focus.position) continue
          if (focus.club     && p.club     !== focus.club)     continue
          if (focus.max_price != null && Number(p.current_price) > Number(focus.max_price)) continue
          if (focus.min_price != null && Number(p.current_price) < Number(focus.min_price)) continue
          if (newScouts.find((s: any) => s.player_id === p.id)) continue
          scoutedSet.add(p.id as string)
          newScouts.push({ user_id: userId, player_id: p.id, scout_type: 'sent', reveals_at_matchday: matchday + 1 })
        }
        if (newScouts.length >= availableSlots) break
      }

      if (newScouts.length) {
        await supabase.from('player_scouts').upsert(newScouts, { onConflict: 'user_id,player_id', ignoreDuplicates: true })
      }
      if (uRow) await supabase.from('users').update({ balance: Math.max(0, (uRow as any).balance - totalCost) }).eq('id', userId)
    }
  }

  // Inbox messages
  const { data: allUsers } = await supabase.from('users').select('id, balance')
  const playerMap = new Map(players.map((p: any) => [p.id as string, p]))
  const inboxMessages: Record<string, unknown>[] = []
  const statsArray = allStats.map(({ player, stat }: any) => ({ player_id: player.id, ...stat }))

  // News: top performers
  const topStats = statsArray
    .filter((s: any) => (s.minutes ?? 0) > 0 && ((s.goals ?? 0) >= 1 || (s.rating ?? 0) >= 8.0))
    .sort((a: any, b: any) => ((b.goals ?? 0) * 3 + (b.assists ?? 0) + (b.rating ?? 0)) - ((a.goals ?? 0) * 3 + (a.assists ?? 0) + (a.rating ?? 0)))
    .slice(0, 3)

  for (const stat of topStats) {
    const p = playerMap.get(stat.player_id) as any
    if (!p) continue
    const g = stat.goals ?? 0
    const a = stat.assists ?? 0
    const r = Number(stat.rating ?? 0)
    let subject = '', body = ''
    if (g >= 3) {
      subject = `Hat-trick hero: ${p.name} bags three for ${p.club}`
      body = `Dear Manager,\n\n${p.name} delivered an unforgettable performance for ${p.club} in Matchday ${matchday}, scoring a sensational hat-trick.\n\nMATCHDAY ${matchday} STATS\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nMarket analysts are already tipping ${p.name} shares as a strong buy. Those holding shares will have seen significant gains today.\n\n— Sports Desk, Kickfolio`
    } else if (g === 2) {
      subject = `Brace: ${p.name} doubles up in MD${matchday}`
      body = `Dear Manager,\n\n${p.name} was the standout performer on Matchday ${matchday}, registering a brace for ${p.club}.\n\nMATCHDAY ${matchday} STATS\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nInvestors who spotted ${p.name}'s potential early continue to reap the rewards.\n\n— Sports Desk, Kickfolio`
    } else if (g === 1) {
      subject = `${p.name} on target as ${p.club} impress`
      body = `Dear Manager,\n\nMATCHDAY ${matchday} REPORT\n\n${p.name} continued their impressive form, finding the net for ${p.club}.\n\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nConsistent output like this is what long-term investors look for.\n\n— Sports Desk, Kickfolio`
    } else {
      subject = `${p.name} stars for ${p.club} despite blank`
      body = `Dear Manager,\n\nYou don't need to score to dominate. ${p.name} delivered a superb ${r.toFixed(1)}/10 display for ${p.club} in Matchday ${matchday}.\n\n  Goals:   0\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nThis kind of performance drives share prices just as effectively as goals.\n\n— Sports Desk, Kickfolio`
    }
    const preview = `${p.name} rated ${r.toFixed(1)} — ${g}G ${a}A in Matchday ${matchday}`
    for (const u of (allUsers ?? [])) {
      inboxMessages.push({ user_id: (u as any).id, type: 'news', sender: 'Sports Desk', subject, preview, body, metadata: { player_id: stat.player_id, matchday } })
    }
  }

  // Insider tips
  const tipPool = statsArray.filter((s: any) => (s.minutes ?? 0) > 0).sort(() => Math.random() - 0.5).slice(0, 3)
  const tipSenders = ['Deep Throat', 'Anonymous', 'A Friend', 'Reliable Source']
  for (const stat of tipPool.slice(0, 2)) {
    const p = playerMap.get(stat.player_id) as any
    if (!p) continue
    const isAccurate = Math.random() > 0.4
    const sender = tipSenders[Math.floor(Math.random() * tipSenders.length)]
    const positiveHints = [
      `Word from inside ${p.club}'s training ground: ${p.name} has been absolutely electric in sessions this week. Could be one to watch next matchday.`,
      `A contact with access to ${p.club} tells me ${p.name} has been putting in extra hours. When this player is motivated like this, performances tend to follow.`,
    ]
    const negativeHints = [
      `${p.name} reportedly nursing a knock. The club are staying quiet but our source suggests they might not be at full fitness.`,
      `Word is ${p.name} has dropped down the pecking order at ${p.club}. A new setup might limit their opportunities going forward.`,
    ]
    const hints = isAccurate ? positiveHints : negativeHints
    const tipBody = hints[Math.floor(Math.random() * hints.length)]
    for (const u of (allUsers ?? [])) {
      inboxMessages.push({
        user_id: (u as any).id, type: 'tip', sender,
        subject: `Re: ${p.name} — matchday ${matchday + 1}`,
        preview: tipBody.slice(0, 100) + '...',
        body: tipBody + '\n\n— [Identity withheld]\n\nDelete this message after reading.',
        metadata: { player_id: stat.player_id, accurate: isAccurate },
      })
    }
  }

  // Scout reports: scouts revealing this matchday
  const { data: revealingScouts } = await supabase
    .from('player_scouts').select('user_id, player_id').eq('scout_type', 'sent').eq('reveals_at_matchday', matchday)
  for (const scout of (revealingScouts ?? [])) {
    const p = playerMap.get((scout as any).player_id) as any
    if (!p) continue
    const stat = statsArray.find((s: any) => s.player_id === (scout as any).player_id)
    const g = stat?.goals ?? 0
    const a = stat?.assists ?? 0
    const r = Number(stat?.rating ?? 0)
    const price = Number(p.current_price ?? 0)
    const gradeLabel = price < 3 ? 'Strong Buy' : price < 6 ? 'Buy' : price < 10 ? 'Hold' : 'Overvalued'
    const gradeRec = price < 3
      ? 'Our scouts believe this player is significantly undervalued. We strongly recommend acquiring shares.'
      : price < 6 ? 'A solid acquisition at current prices. Consistent output and good value.'
      : price < 10 ? 'Trading close to fair value. Buy only if you have conviction.'
      : 'Currently at a premium. Exercise caution unless you expect exceptional performance.'
    const body = `Dear Manager,\n\nOur scouting team has completed their assessment of ${p.name}, ${p.position} at ${p.club}.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCOUT REPORT — MATCHDAY ${matchday}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPLAYER:   ${p.name}\nPOSITION: ${p.position}\nCLUB:     ${p.club}\n\nMATCHDAY PERFORMANCE\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r > 0 ? r.toFixed(1) + '/10' : 'Did not play'}\n\nOVERALL ASSESSMENT: ${gradeLabel}\nCurrent Price: £${price.toFixed(2)}\n\nRECOMMENDATION\n${gradeRec}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nBest regards,\nHead of Scouting\nKickfolio`
    inboxMessages.push({
      user_id: (scout as any).user_id, type: 'scout_report', sender: 'Head Scout',
      subject: `Scout Report: ${p.name} (${p.club})`,
      preview: `${p.name} (${p.position}, ${p.club}) — ${gradeLabel} at £${price.toFixed(2)}`,
      body, metadata: { player_id: (scout as any).player_id, matchday },
    })
  }

  // Bills: active focuses
  if (activeFocuses?.length) {
    const userFocusBillMap = new Map<string, any[]>()
    for (const f of activeFocuses) {
      if (!userFocusBillMap.has(f.user_id)) userFocusBillMap.set(f.user_id, [])
      userFocusBillMap.get(f.user_id)!.push(f)
    }
    for (const [userId, focuses] of userFocusBillMap) {
      const totalCost = focuses.reduce((s: number, f: any) => s + Number(f.cost_per_matchday), 0)
      if (totalCost <= 0) continue
      const uRow = (allUsers ?? []).find((u: any) => u.id === userId) as any
      const balance = uRow ? Number(uRow.balance) : 0
      const focusLines = focuses.map((f: any) => `  • ${f.name} — £${Number(f.cost_per_matchday).toFixed(2)}/MD`).join('\n')
      const body = `Dear Manager,\n\nPlease find your scouting invoice for Matchday ${matchday}.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nACTIVE FOCUS FEES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${focusLines}\n\nTOTAL DEDUCTED: £${totalCost.toFixed(2)}\nREMAINING BALANCE: £${balance.toFixed(2)}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nRegards,\nFinance Department\nKickfolio HQ`
      inboxMessages.push({
        user_id: userId, type: 'bill', sender: 'Finance Department',
        subject: `Scout Bill — Matchday ${matchday}`,
        preview: `£${totalCost.toFixed(2)} deducted for ${focuses.length} active focus(es) on MD${matchday}`,
        body, metadata: { matchday, totalCost, focusCount: focuses.length },
      })
    }
  }

  if (inboxMessages.length) await supabase.from('inbox_messages').insert(inboxMessages)

  // Portfolio summaries
  if (portfolios?.length) {
    const playerMap = new Map(players.map((p: any) => [p.id as string, p]))
    const statsByPlayer2 = new Map(allStats.map(({ player, stat }: any) => [player.id as string, stat]))
    const userPortfolioMap = new Map<string, any[]>()
    for (const h of portfolios) {
      if (!userPortfolioMap.has(h.user_id)) userPortfolioMap.set(h.user_id, [])
      userPortfolioMap.get(h.user_id)!.push(h)
    }
    const { data: finalPrices } = await supabase.from('players').select('id, current_price')
    const newPriceMap = new Map((finalPrices ?? []).map((p: any) => [p.id, Number(p.current_price)]))
    const summaryMessages: Record<string, unknown>[] = []

    for (const [userId, holdings] of userPortfolioMap) {
      let valueBefore = 0, valueAfter = 0, invested = 0
      let bestRating = -1, bestName = ''
      const rows: string[] = []

      for (const h of holdings) {
        const p = playerMap.get(h.player_id) as any
        if (!p) continue
        const stat    = statsByPlayer2.get(h.player_id as string) as any
        const g       = stat?.goals   ?? 0
        const a       = stat?.assists ?? 0
        const r       = Number(stat?.rating ?? 0)
        const mins    = Number(stat?.minutes ?? 0)
        const oldPx   = Number(p.current_price ?? 0)
        const newPx   = newPriceMap.get(h.player_id as string) ?? oldPx
        const posAbbr = (p.position as string) === 'Forward' ? 'FWD' : (p.position as string) === 'Midfielder' ? 'MID' : (p.position as string) === 'Defender' ? 'DEF' : ' GK'
        const statsStr = mins === 0 ? 'DNP            ' : `${g}G ${a}A  ★${r.toFixed(1)}`.padEnd(15)
        const chg = newPx - oldPx
        const chgStr = (chg >= 0 ? '+' : '') + '£' + Math.abs(chg).toFixed(2)
        rows.push(`  ${(p.name as string).padEnd(23).slice(0, 23)} ${posAbbr}  ${statsStr}  ${chgStr}/share`)
        valueBefore += (h.shares as number) * oldPx
        valueAfter  += (h.shares as number) * newPx
        invested    += (h.shares as number) * Number(h.avg_buy_price ?? oldPx)
        if (r > bestRating && mins > 0) { bestRating = r; bestName = p.name as string }
      }

      const change    = valueAfter - valueBefore
      const changePct = valueBefore > 0 ? (change / valueBefore) * 100 : 0
      const totalPL   = valueAfter - invested
      const totalPct  = invested > 0 ? (totalPL / invested) * 100 : 0
      const divs      = userDividendTotals.get(userId) ?? 0
      const sign      = (n: number) => n >= 0 ? '+' : ''
      const fmt       = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      let body = `MATCHDAY ${matchday} · PORTFOLIO SUMMARY\n`
      body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
      body += `YOUR PLAYERS\n\n` + rows.join('\n')
      body += `\n\nMATCHDAY P&L\n\n`
      body += `  Value before:  £${fmt(valueBefore)}\n`
      body += `  Value after:   £${fmt(valueAfter)}\n`
      body += `  Change:        ${sign(change)}£${fmt(Math.abs(change))} (${sign(changePct)}${changePct.toFixed(2)}%)\n\n`
      body += `OVERALL P&L\n\n`
      body += `  Total invested:  £${fmt(invested)}\n`
      body += `  Portfolio value: £${fmt(valueAfter)}\n`
      body += `  Net P&L:         ${sign(totalPL)}£${fmt(Math.abs(totalPL))} (${sign(totalPct)}${totalPct.toFixed(1)}%)`
      if (divs > 0) body += `\n  Dividends MD${matchday}: +£${divs.toFixed(2)}`
      if (bestName) body += `\n\nStar player: ${bestName}  ★ ${bestRating.toFixed(1)}`

      const preview = `${sign(change)}£${Math.abs(change).toFixed(2)} (${sign(changePct)}${changePct.toFixed(2)}%) this matchday  ·  ${holdings.length} player${holdings.length === 1 ? '' : 's'} held`

      summaryMessages.push({
        user_id: userId, type: 'news', sender: 'Portfolio Desk',
        subject: `MD${matchday} Portfolio Summary`,
        preview, body,
        metadata: { matchday, valueBefore, valueAfter, change, invested, dividends: divs },
      })

      if (Math.random() < 0.6) {
        const iv = pickInterview(matchday, change, bestName)
        summaryMessages.push({
          user_id: userId, type: 'interview', sender: iv.sender,
          subject: iv.subject, preview: iv.question, body: iv.body,
          metadata: { question: iv.question, options: iv.options, responded: false, chosen_option: null, matchday },
        })
      }
    }
    if (summaryMessages.length) await supabase.from('inbox_messages').insert(summaryMessages)
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
