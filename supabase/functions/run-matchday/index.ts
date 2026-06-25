import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEAGUE_ID = 39   // Premier League
const SEASON    = 2025 // 2025/26 season

// ── API-Football helpers ────────────────────────────────────────────────────

async function apiFetch(path: string, apiKey: string) {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: {
      'x-apisports-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })
  if (!res.ok) throw new Error(`API-Football ${path} → ${res.status}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`)
  }
  return json.response
}

// ── Name normalisation for fuzzy matching ───────────────────────────────────

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents
    .replace(/ø/g, 'o')         // ø → o
    .replace(/æ/g, 'ae')        // æ → ae
    .replace(/[-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Returns true if the two names plausibly refer to the same player. */
function namesMatch(ourName: string, apiName: string): boolean {
  const a = normaliseName(ourName)
  const b = normaliseName(apiName)
  if (a === b) return true

  const aWords = a.split(' ')
  const bWords = b.split(' ')

  // Last-name match (both have ≥2 words and last words equal)
  const aLast = aWords[aWords.length - 1]
  const bLast = bWords[bWords.length - 1]
  if (aLast === bLast && aLast.length > 3) {
    // Confirm with first initial or first name overlap
    if (aWords[0][0] === bWords[0][0]) return true
  }

  // One is a substring of the other (handles "Alisson" ↔ "Alisson Becker")
  if (a.includes(b) || b.includes(a)) return true

  // Reversed-token match: "Son Heung-min" ↔ "Heung-Min Son"
  const aRev = [...aWords].reverse().join(' ')
  if (aRev === b) return true

  return false
}

// ── Clean-sheet detection ───────────────────────────────────────────────────

/** Build a map of teamId → didKeepCleanSheet for this fixture. */
function cleanSheetMap(fixture: FixtureInfo): Map<number, boolean> {
  const { home, away } = fixture.goals
  return new Map([
    [fixture.teams.home.id, away === 0],
    [fixture.teams.away.id, home === 0],
  ])
}

// ── Types ───────────────────────────────────────────────────────────────────

interface FixtureInfo {
  id: number
  status: string // "FT" | "NS" | etc.
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number; away: number }
}

interface PlayerStats {
  goals: number
  assists: number
  rating: number
  minutes: number
  saves: number
  clean_sheet: boolean
  played: boolean
}

// ── Edge Function ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY')
    if (!apiKey) throw new Error('API_FOOTBALL_KEY secret not set')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Optional request body: { matchday?: number, dry_run?: boolean }
    let targetMatchday: number | null = null
    let dryRun = false
    try {
      const body = await req.json()
      if (body.matchday) targetMatchday = parseInt(body.matchday)
      if (body.dry_run)  dryRun = true
    } catch { /* no body is fine */ }

    // ── 1. Determine which matchday to process ──────────────────────────────
    const { data: tracker } = await supabase
      .from('matchday_tracker')
      .select('current_matchday')
      .eq('id', 1)
      .single()

    const currentMatchday = tracker?.current_matchday ?? 0
    const matchday = targetMatchday ?? currentMatchday + 1

    if (matchday > 38) {
      return new Response(
        JSON.stringify({ message: 'Season complete — all 38 matchdays processed.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Fetch Premier League fixtures for this round ─────────────────────
    const round = `Regular Season - ${matchday}`
    const fixturesRaw = await apiFetch(
      `/fixtures?league=${LEAGUE_ID}&season=${SEASON}&round=${encodeURIComponent(round)}`,
      apiKey,
    )

    if (!fixturesRaw || fixturesRaw.length === 0) {
      return new Response(
        JSON.stringify({ message: `No fixtures found for ${round}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const fixtures: FixtureInfo[] = fixturesRaw.map((f: any) => ({
      id:     f.fixture.id,
      status: f.fixture.status.short,
      teams:  { home: f.teams.home, away: f.teams.away },
      goals:  { home: f.goals.home ?? 0, away: f.goals.away ?? 0 },
    }))

    // Guard: all fixtures must be finished
    const unfinished = fixtures.filter(f => f.status !== 'FT' && f.status !== 'AET' && f.status !== 'PEN')
    if (unfinished.length > 0) {
      return new Response(
        JSON.stringify({
          message: `Round ${matchday} not fully finished yet`,
          unfinished: unfinished.map(f => `${f.teams.home.name} v ${f.teams.away.name} [${f.status}]`),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. Fetch player stats for every fixture (parallel) ──────────────────
    // Map: normalised player name → PlayerStats
    const apiStatMap = new Map<string, PlayerStats>()

    await Promise.all(
      fixtures.map(async (fixture) => {
        const csMap = cleanSheetMap(fixture)
        const playersRaw = await apiFetch(`/fixtures/players?fixture=${fixture.id}`, apiKey)

        for (const teamData of (playersRaw ?? [])) {
          const teamId: number = teamData.team.id
          const keptCleanSheet = csMap.get(teamId) ?? false

          for (const entry of (teamData.players ?? [])) {
            const apiName: string = entry.player.name
            const stats = entry.statistics?.[0]
            if (!stats) continue

            const minutes = stats.games?.minutes ?? 0
            const rating  = parseFloat(stats.games?.rating ?? '0') || 0
            const goals   = stats.goals?.total ?? 0
            const assists = stats.goals?.assists ?? 0
            const saves   = stats.goals?.saves ?? 0

            const normKey = normaliseName(apiName)
            apiStatMap.set(normKey, {
              goals,
              assists,
              rating,
              minutes,
              saves,
              clean_sheet: minutes > 0 && keptCleanSheet,
              played: minutes > 0,
            })
          }
        }
      }),
    )

    // ── 4. Load our players and match against the API stat map ──────────────
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, position, current_price')
    if (playersError) throw playersError

    const priceHistoryInserts: any[] = []
    const statsInserts: any[]        = []
    const priceUpdates: any[]        = []
    const matchLog: any[]            = []

    for (const player of (players as any[])) {
      // Find matching API entry
      let matched: PlayerStats | null = null
      for (const [normApiName, ps] of apiStatMap) {
        if (namesMatch(player.name, normApiName)) {
          matched = ps
          break
        }
      }

      const stats: PlayerStats = matched ?? {
        goals: 0, assists: 0, rating: 0,
        minutes: 0, saves: 0, clean_sheet: false, played: false,
      }

      // Price change calculation
      let changePct = 0
      if (!stats.played) {
        changePct = -1  // DNP penalty
      } else {
        changePct += stats.goals   * 5
        changePct += stats.assists * 3
        if (stats.rating >= 8.0) changePct += 3
        else if (stats.rating >= 7.0) changePct += 1
        else if (stats.rating < 6.0) changePct -= 3
        if (stats.clean_sheet) changePct += 4
        if (stats.saves >= 5)  changePct += 2
      }
      changePct = Math.max(-15, Math.min(15, changePct))

      const newPrice = parseFloat(
        Math.max(1, player.current_price * (1 + changePct / 100)).toFixed(2),
      )

      priceHistoryInserts.push({ player_id: player.id, price: newPrice, matchday })
      statsInserts.push({
        player_id:        player.id,
        matchday,
        goals:            stats.goals,
        assists:          stats.assists,
        rating:           stats.played ? stats.rating : 0,
        minutes:          stats.minutes,
        saves:            stats.saves,
        clean_sheet:      stats.clean_sheet,
        price_change_pct: changePct,
      })
      priceUpdates.push({ id: player.id, current_price: newPrice })
      matchLog.push({
        player:     player.name,
        matched:    !!matched,
        goals:      stats.goals,
        assists:    stats.assists,
        rating:     stats.rating,
        minutes:    stats.minutes,
        changePct,
        newPrice,
      })
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, matchday, log: matchLog }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5. Write to database ────────────────────────────────────────────────
    const { error: phError } = await supabase.from('price_history').insert(priceHistoryInserts)
    if (phError) throw phError

    const { error: msError } = await supabase.from('matchday_stats').insert(statsInserts)
    if (msError) throw msError

    for (const u of priceUpdates) {
      await supabase.from('players').update({ current_price: u.current_price }).eq('id', u.id)
    }

    await supabase.from('matchday_tracker').update({ current_matchday: matchday }).eq('id', 1)

    return new Response(
      JSON.stringify({ success: true, matchday, fixtures: fixtures.length, log: matchLog }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
