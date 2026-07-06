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

    const floor = p.position === 'Goalkeeper' ? 4.5
      : g >= 3 ? 9.2 : g >= 2 ? 8.2 : g >= 1 ? 7.0 : a >= 1 ? 6.8 : 4.5
    const rating = parseFloat(Math.min(10, Math.max(floor, base + bonuses)).toFixed(1))
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

// ── Interview scenarios ──────────────────────────────────────────────────────

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
    // — Sponsorship deal (always has a balance reward)
    {
      sender: sponsor, subject: `Sponsorship offer: ${sponsor}`,
      body: `${sponsor} has been tracking your performance this season and wants to feature your approach in their latest campaign.\n\nThey believe your strategy would resonate with their audience of football finance enthusiasts.\n\nThey're offering a flat fee of £${fee} for a brief quote about your investment philosophy.`,
      question: `${sponsor} wants a quote for their campaign. Do you accept?`,
      options: [
        { id: 'a', label: 'Accept the deal',    text: `"Happy to help — we always enjoy sharing our process with the wider community."`, effect: { type: 'balance', amount: fee } },
        { id: 'b', label: 'Negotiate upward',   text: `"We'd consider it for £${Math.round(fee * 1.6)}, but not a penny less."`,          effect: { type: 'balance_gamble', success_chance: 0.45, amount: Math.round(fee * 1.6) } },
        { id: 'c', label: 'Decline politely',   text: `"We appreciate the offer, but prefer to keep a low profile right now."`,           effect: { type: 'none' } },
      ],
    },
    // — Post-matchday interview (flavour only)
    {
      sender: outlet, subject: `${outlet} wants a comment`,
      body: `${outlet} is putting together a feature on matchday ${matchday}'s standout portfolio managers. ${isUp ? 'Your portfolio movement this week caught their eye.' : 'They want to capture a range of voices after a volatile matchday.'}\n\nA journalist is waiting for your statement.`,
      question: isUp
        ? `Your portfolio had a strong matchday. What's behind it?`
        : `It was a tough matchday for many investors. How are you reading the market?`,
      options: isUp ? [
        { id: 'a', label: 'Credit your scouting', text: `"Good scouting is the foundation. We do our homework before every matchday."`,  effect: { type: 'none' } },
        { id: 'b', label: 'Stay humble',           text: `"It was a positive matchday, but the season is long. We stay focused."`,         effect: { type: 'none' } },
        { id: 'c', label: 'Take the credit',       text: `"We predicted this. The data doesn't lie — we just read it better than most."`, effect: { type: 'none' } },
      ] : [
        { id: 'a', label: 'Back your process',  text: `"The market has cycles. We back our process and stay patient."`,               effect: { type: 'none' } },
        { id: 'b', label: 'Deflect',            text: `"We'll review the numbers carefully. No public statement today."`,             effect: { type: 'none' } },
        { id: 'c', label: 'Own it',             text: `"We got it wrong this matchday. We'll learn from it and come back stronger."`, effect: { type: 'none' } },
      ],
    },
    // — Pundit debate (appearance fee)
    {
      sender: 'Match of the Day', subject: `${pundit} challenges your strategy`,
      body: `During a recent broadcast, ${pundit} sparked debate by dismissing football portfolio investing as "dressed-up gambling with no real skill involved."\n\nA producer has reached out — they've offered a £${fee} appearance fee if you agree to respond live on air.`,
      question: `${pundit} says player investing is "just gambling in a suit." How do you respond?`,
      options: [
        { id: 'a', label: 'Appear & defend it',  text: `"${pundit} is entitled to his view. I'd invite him to look at the numbers behind a good scouting network."`,    effect: { type: 'balance', amount: fee } },
        { id: 'b', label: 'Decline the segment', text: `"No comment. We let our portfolio performance speak for itself."`,                                                effect: { type: 'none' } },
        { id: 'c', label: 'Respond online',       text: `"Respectfully, ${pundit} spent 20 years kicking a ball. Maybe stick to that kind of analysis."`,               effect: { type: 'none' } },
      ],
    },
    // — Transfer rumour
    {
      sender: 'Transfer Daily', subject: `Transfer rumour: are you buying ${bestPlayer || 'a star player'}?`,
      body: `Transfer Daily is running an exclusive suggesting you are preparing a significant position on ${bestPlayer || 'a leading Premier League player'} ahead of next matchday.\n\nThe speculation is already moving their share price. Their journalist is requesting an official response.`,
      question: `Reports link you to ${bestPlayer || 'a top player'}. Is there any truth to it?`,
      options: [
        { id: 'a', label: 'Confirm interest',  text: `"${bestPlayer || 'The player in question'} is someone we have been monitoring closely. No further comment."`, effect: { type: 'none' } },
        { id: 'b', label: 'Flat denial',       text: `"We have no interest in that position at this time. The report is inaccurate."`,                              effect: { type: 'none' } },
        { id: 'c', label: 'No comment',        text: `"We never comment on potential portfolio moves before they're made."`,                                        effect: { type: 'none' } },
      ],
    },
    // — Insider tip accusation
    {
      sender: 'The Athletic', subject: `Insider trading allegation — your response?`,
      body: `The Athletic's investigative desk has received a tip suggesting your recent trades may have been made on non-public information.\n\nThey're giving you the opportunity to respond before publishing. The journalist stresses this is standard practice and does not imply wrongdoing.`,
      question: `The Athletic is asking about "unusual trading patterns" in your recent matchdays. How do you respond?`,
      options: [
        { id: 'a', label: 'Deny any wrongdoing',  text: `"Our trades are entirely based on publicly available data and our own scouting network. We have nothing to hide."`, effect: { type: 'none' } },
        { id: 'b', label: 'Threaten legal action', text: `"This allegation is defamatory. Our legal team will be in touch before any publication."`,                          effect: { type: 'none' } },
        { id: 'c', label: 'Refuse to engage',     text: `"We don't respond to fishing expeditions. Publish what you like."`,                                                effect: { type: 'none' } },
      ],
    },
  ]

  return pick(scenarios)
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
    const { data: portfolios } = await supabase.from('portfolios').select('user_id, player_id, shares, avg_buy_price').gt('shares', 0)
    const userDividendTotals = new Map<string, number>()
    if (portfolios?.length) {
      const byPlayer = new Map<string, { user_id: string; shares: number }[]>()
      for (const p of (portfolios as any[])) {
        if (!byPlayer.has(p.player_id)) byPlayer.set(p.player_id, [])
        byPlayer.get(p.player_id)!.push({ user_id: p.user_id, shares: p.shares })
      }
      const playerPositions = new Map((players as any[]).map(p => [p.id, p.position]))
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
          userDividendTotals.set(user_id, (userDividendTotals.get(user_id) ?? 0) + total)
          divInserts.push({ user_id, player_id: playerId, matchday, shares, dividend_per_share: dpShare, total_payment: total })
        }
      }
      if (divInserts.length) {
        await supabase.from('dividend_payments').insert(divInserts)
        for (const [userId, total] of userDividendTotals) {
          const { data: u } = await supabase.from('users').select('balance').eq('id', userId).single()
          if (u) await supabase.from('users').update({ balance: u.balance + total }).eq('id', userId)
        }
      }
    }

    // ── 7. Scouting focuses ─────────────────────────────────────────────────
    const { data: activeFocuses } = await supabase.from('scouting_focuses').select('*').eq('active', true)
    if (activeFocuses?.length) {
      const userFocusMap = new Map<string, any[]>()
      for (const f of activeFocuses) {
        if (!userFocusMap.has(f.user_id)) userFocusMap.set(f.user_id, [])
        userFocusMap.get(f.user_id)!.push(f)
      }

      for (const [userId, userFocuses] of userFocusMap) {
        const { data: allScouts }  = await supabase.from('player_scouts').select('player_id, scout_type, reveals_at_matchday').eq('user_id', userId)
        const { data: uRow }       = await supabase.from('users').select('balance, max_scouts').eq('id', userId).single()
        const maxScouts = (uRow as any)?.max_scouts ?? 3
        const pendingCount = (allScouts ?? []).filter((s: any) => s.scout_type === 'sent' && s.reveals_at_matchday != null && s.reveals_at_matchday > matchday).length
        const availableSlots = Math.max(0, maxScouts - pendingCount)
        if (availableSlots === 0) continue

        const scoutedSet = new Set((allScouts ?? []).map((s: any) => s.player_id))
        const totalCost = userFocuses.reduce((s, f) => s + Number(f.cost_per_matchday), 0)
        const newScouts: any[] = []

        for (const focus of userFocuses) {
          for (const p of (players as any[])) {
            if (newScouts.length >= availableSlots) break
            if (scoutedSet.has(p.id)) continue
            if (focus.position && p.position !== focus.position) continue
            if (focus.club     && p.club     !== focus.club)     continue
            if (focus.max_price != null && Number(p.current_price) > Number(focus.max_price)) continue
            if (focus.min_price != null && Number(p.current_price) < Number(focus.min_price)) continue
            if (newScouts.find(s => s.player_id === p.id)) continue
            scoutedSet.add(p.id)
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

    // ── 8. Inbox messages ────────────────────────────────────────────────────────
    const { data: allUsers } = await supabase.from('users').select('id, balance')
    const playerMap = new Map((players as any[]).map((p: any) => [p.id, p]))
    const inboxMessages: any[] = []

    // News: top performers (sent to all users)
    const topStats = [...statsInserts]
      .filter((s: any) => s.minutes > 0 && (s.goals >= 1 || s.rating >= 8.0))
      .sort((a: any, b: any) => (b.goals * 3 + b.assists + b.rating) - (a.goals * 3 + a.assists + a.rating))
      .slice(0, 3)

    for (const stat of topStats) {
      const p = playerMap.get(stat.player_id)
      if (!p) continue
      const g = stat.goals ?? 0
      const a = stat.assists ?? 0
      const r = Number(stat.rating ?? 0)
      let subject = '', body = ''
      if (g >= 3) {
        subject = `Hat-trick hero: ${p.name} bags three for ${p.club}`
        body = `Dear Manager,\n\n${p.name} delivered an unforgettable performance for ${p.club} in Matchday ${matchday}, scoring a sensational hat-trick.\n\nMATCHDAY ${matchday} STATS\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nMarket analysts are already tipping ${p.name} shares as a strong buy. Their price has moved accordingly — those holding shares will have seen significant gains today.\n\n"The goals will come when you work hard," said ${p.name.split(' ')[0]}. "I'm just focused on helping the team."\n\n— Sports Desk, Kickfolio`
      } else if (g === 2) {
        subject = `Brace: ${p.name} doubles up in MD${matchday}`
        body = `Dear Manager,\n\n${p.name} was the standout performer on Matchday ${matchday}, registering a brace for ${p.club}.\n\nMATCHDAY ${matchday} STATS\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nShare prices reacted immediately. Investors who spotted ${p.name}'s potential early continue to reap the rewards.\n\n— Sports Desk, Kickfolio`
      } else if (g === 1) {
        subject = `${p.name} on target as ${p.club} impress`
        body = `Dear Manager,\n\nMATCHDAY ${matchday} REPORT\n\n${p.name} continued their impressive form, finding the net for ${p.club}.\n\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nConsistent output like this is what long-term investors look for.\n\n— Sports Desk, Kickfolio`
      } else {
        subject = `${p.name} stars for ${p.club} despite blank`
        body = `Dear Manager,\n\nYou don't need to score to dominate. ${p.name} delivered a superb ${r.toFixed(1)}/10 display for ${p.club} in Matchday ${matchday} — one of the highest ratings of the round.\n\n  Goals:   0\n  Assists: ${a}\n  Rating:  ${r.toFixed(1)}/10\n\nThis kind of performance drives share prices just as effectively as goals. Investors are taking note.\n\n— Sports Desk, Kickfolio`
      }
      const preview = `${p.name} rated ${r.toFixed(1)} — ${g}G ${a}A in Matchday ${matchday}`
      for (const u of (allUsers ?? [])) {
        inboxMessages.push({ user_id: u.id, type: 'news', sender: 'Sports Desk', subject, preview, body, metadata: { player_id: stat.player_id, matchday } })
      }
    }

    // Insider tips (random, ~60% accurate, sent to all users)
    const tipPool = [...statsInserts].filter((s: any) => s.minutes > 0).sort(() => Math.random() - 0.5).slice(0, 3)
    const tipSenders = ['Deep Throat', 'Anonymous', 'A Friend', 'Reliable Source']
    for (const stat of tipPool.slice(0, 2)) {
      const p = playerMap.get(stat.player_id)
      if (!p) continue
      const isAccurate = Math.random() > 0.4
      const sender = tipSenders[Math.floor(Math.random() * tipSenders.length)]
      const positiveHints = [
        `Word from inside ${p.club}'s training ground: ${p.name} has been absolutely electric in sessions this week. Sources close to the camp suggest the coaching staff are particularly happy with their sharpness. Could be one to watch.`,
        `A contact with access to ${p.club} tells me ${p.name} has been putting in extra hours. When this player is motivated like this, performances tend to follow. Take it as you will.`,
        `Hearing very interesting things about ${p.name}. My source says they looked sharp, focused, and hungry. Might be worth taking a position before next matchday.`,
      ]
      const negativeHints = [
        `${p.name} reportedly nursing a knock. The club are staying quiet but our source suggests they might not be at full fitness. Consider your exposure carefully.`,
        `Word is ${p.name} has dropped down the pecking order at ${p.club}. A new setup might limit their opportunities. Not confirmed — worth monitoring.`,
        `Off-field distractions for ${p.name} this week. Nothing confirmed from the club, but our contact suggests things aren't fully settled.`,
      ]
      const hints = isAccurate ? positiveHints : negativeHints
      const tipBody = hints[Math.floor(Math.random() * hints.length)]
      for (const u of (allUsers ?? [])) {
        inboxMessages.push({
          user_id: u.id, type: 'tip', sender,
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
      const p = playerMap.get(scout.player_id)
      if (!p) continue
      const stat = statsInserts.find((s: any) => s.player_id === scout.player_id)
      const g = stat?.goals ?? 0
      const a = stat?.assists ?? 0
      const r = Number(stat?.rating ?? 0)
      const price = Number(p.current_price ?? 0)
      const gradeLabel = price < 3 ? 'Strong Buy' : price < 6 ? 'Buy' : price < 10 ? 'Hold' : 'Overvalued'
      const gradeRec = price < 3
        ? 'Our scouts believe this player is significantly undervalued. We strongly recommend acquiring shares before the market catches on.'
        : price < 6
        ? 'A solid acquisition at current prices. Consistent output and good value.'
        : price < 10
        ? 'Trading close to fair value. Buy only if you have conviction in their future output.'
        : 'Currently at a premium. Exercise caution unless you expect exceptional upcoming performance.'
      const body = `Dear Manager,\n\nOur scouting team has completed their assessment of ${p.name}, ${p.position} at ${p.club}.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCOUT REPORT — MATCHDAY ${matchday}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPLAYER:   ${p.name}\nPOSITION: ${p.position}\nCLUB:     ${p.club}\n\nMATCHDAY PERFORMANCE\n  Goals:   ${g}\n  Assists: ${a}\n  Rating:  ${r > 0 ? r.toFixed(1) + '/10' : 'Did not play'}\n\nOVERALL ASSESSMENT: ${gradeLabel}\nCurrent Price: £${price.toFixed(2)}\n\nRECOMMENDATION\n${gradeRec}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nBest regards,\nHead of Scouting\nKickfolio`
      inboxMessages.push({
        user_id: scout.user_id, type: 'scout_report', sender: 'Head Scout',
        subject: `Scout Report: ${p.name} (${p.club})`,
        preview: `${p.name} (${p.position}, ${p.club}) — ${gradeLabel} at £${price.toFixed(2)}`,
        body, metadata: { player_id: scout.player_id, matchday },
      })
    }

    // Bills: one per user with active focuses
    if (activeFocuses?.length) {
      const userFocusBillMap = new Map<string, any[]>()
      for (const f of activeFocuses) {
        if (!userFocusBillMap.has(f.user_id)) userFocusBillMap.set(f.user_id, [])
        userFocusBillMap.get(f.user_id)!.push(f)
      }
      for (const [userId, focuses] of userFocusBillMap) {
        const totalCost = focuses.reduce((s: number, f: any) => s + Number(f.cost_per_matchday), 0)
        if (totalCost <= 0) continue
        const uRow = (allUsers ?? []).find((u: any) => u.id === userId)
        const balance = uRow ? Number((uRow as any).balance) : 0
        const focusLines = focuses.map((f: any) => `  • ${f.name} — £${Number(f.cost_per_matchday).toFixed(2)}/MD`).join('\n')
        const body = `Dear Manager,\n\nPlease find your scouting invoice for Matchday ${matchday}.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nACTIVE FOCUS FEES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${focusLines}\n\nTOTAL DEDUCTED: £${totalCost.toFixed(2)}\nREMAINING BALANCE: £${balance.toFixed(2)}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nThank you for using Kickfolio's scouting network.\n\nRegards,\nFinance Department\nKickfolio HQ`
        inboxMessages.push({
          user_id: userId, type: 'bill', sender: 'Finance Department',
          subject: `Scout Bill — Matchday ${matchday}`,
          preview: `£${totalCost.toFixed(2)} deducted for ${focuses.length} active focus(es) on MD${matchday}`,
          body, metadata: { matchday, totalCost, focusCount: focuses.length },
        })
      }
    }

    if (inboxMessages.length) await supabase.from('inbox_messages').insert(inboxMessages)

    // ── 9. Portfolio summaries (one per user with holdings) ──────────────────
    const oldPriceMap = new Map((players as any[]).map((p: any) => [p.id, Number(p.current_price)]))
    const newPriceMap = new Map(priceUpdates.map((u: any) => [u.id, Number(u.current_price)]))

    if (portfolios?.length) {
      const userPortfolioMap = new Map<string, any[]>()
      for (const h of (portfolios as any[])) {
        if (!userPortfolioMap.has(h.user_id)) userPortfolioMap.set(h.user_id, [])
        userPortfolioMap.get(h.user_id)!.push(h)
      }

      const summaryMessages: any[] = []

      for (const [userId, holdings] of userPortfolioMap) {
        let valueBefore = 0, valueAfter = 0, invested = 0
        let bestRating = -1, bestName = ''
        const rows: string[] = []

        for (const h of holdings) {
          const p = playerMap.get(h.player_id) as any
          if (!p) continue
          const stat  = statsInserts.find((s: any) => s.player_id === h.player_id)
          const g     = stat?.goals   ?? 0
          const a     = stat?.assists ?? 0
          const r     = Number(stat?.rating ?? 0)
          const mins  = stat?.minutes ?? 0
          const oldPx = oldPriceMap.get(h.player_id) ?? Number(p.current_price)
          const newPx = newPriceMap.get(h.player_id) ?? oldPx
          const posAbbr = p.position === 'Forward' ? 'FWD' : p.position === 'Midfielder' ? 'MID' : p.position === 'Defender' ? 'DEF' : ' GK'
          const statsStr = mins === 0 ? 'DNP            ' : `${g}G ${a}A  ★${r.toFixed(1)}`.padEnd(15)
          const chg = newPx - oldPx
          const chgStr = (chg >= 0 ? '+' : '') + '£' + Math.abs(chg).toFixed(2)
          rows.push(`  ${p.name.padEnd(23).slice(0, 23)} ${posAbbr}  ${statsStr}  ${chgStr}/share`)

          valueBefore += h.shares * oldPx
          valueAfter  += h.shares * newPx
          invested    += h.shares * Number(h.avg_buy_price ?? oldPx)
          if (r > bestRating && mins > 0) { bestRating = r; bestName = p.name }
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
        body += `YOUR PLAYERS\n\n`
        body += rows.join('\n')
        body += `\n\nMATCHDAY P&L\n\n`
        body += `  Value before:  £${fmt(valueBefore)}\n`
        body += `  Value after:   £${fmt(valueAfter)}\n`
        body += `  Change:        ${sign(change)}£${fmt(Math.abs(change))} (${sign(changePct)}${changePct.toFixed(2)}%)\n\n`
        body += `OVERALL P&L\n\n`
        body += `  Total invested: £${fmt(invested)}\n`
        body += `  Portfolio value: £${fmt(valueAfter)}\n`
        body += `  Net P&L:        ${sign(totalPL)}£${fmt(Math.abs(totalPL))} (${sign(totalPct)}${totalPct.toFixed(1)}%)`
        if (divs > 0) body += `\n  Dividends MD${matchday}: +£${divs.toFixed(2)}`
        if (bestName) body += `\n\nStar player: ${bestName}  ★ ${bestRating.toFixed(1)}`

        const preview = `${sign(change)}£${Math.abs(change).toFixed(2)} (${sign(changePct)}${changePct.toFixed(2)}%) this matchday  ·  ${holdings.length} player${holdings.length === 1 ? '' : 's'} held`

        summaryMessages.push({
          user_id: userId, type: 'news', sender: 'Portfolio Desk',
          subject: `MD${matchday} Portfolio Summary`,
          preview, body,
          metadata: { matchday, valueBefore, valueAfter, change, invested, dividends: divs },
        })

        // 60% chance of an interview request alongside the portfolio summary
        if (Math.random() < 0.6) {
          const iv = pickInterview(matchday, change, bestName)
          summaryMessages.push({
            user_id: userId, type: 'interview', sender: iv.sender,
            subject: iv.subject,
            preview: iv.question,
            body: iv.body,
            metadata: {
              question: iv.question,
              options: iv.options,
              responded: false,
              chosen_option: null,
              matchday,
            },
          })
        }
      }

      if (summaryMessages.length) await supabase.from('inbox_messages').insert(summaryMessages)
    }

    return json({ success: true, matchday, simulate, simFixtures, apiFixtures: fixtureCount, log: matchLog })

  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
