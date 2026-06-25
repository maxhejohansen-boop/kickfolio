// Generates a SQL file with 2025/26 season data. Run: node generate_sql.cjs > season_seed.sql

let seed = 42
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff
  return (seed >>> 0) / 0xffffffff
}
function randBetween(a, b) { return a + rand() * (b - a) }
function randInt(a, b) { return Math.floor(randBetween(a, b + 1)) }
function pick(arr) { return arr[randInt(0, arr.length - 1)] }

const players = [
  { id: '4a0a5a00-5b35-4183-84fd-ff4c03ab5919', name: 'Mohamed Salah', position: 'Forward', startPrice: 85, apps: 35, goals: 29, assists: 16, avgRating: 7.9, ratingSD: 0.9, missedMDs: [14, 22, 37] },
  { id: 'adb34d1c-c385-4c3f-b7fe-b03b2b9527a2', name: 'Erling Haaland', position: 'Forward', startPrice: 95, apps: 32, goals: 33, assists: 7, avgRating: 8.2, ratingSD: 1.1, missedMDs: [8, 9, 19, 20, 28, 33] },
  { id: '3427f1dc-42c2-44c4-971b-ce5d54357f71', name: 'Cole Palmer', position: 'Forward', startPrice: 72, apps: 37, goals: 24, assists: 16, avgRating: 7.7, ratingSD: 0.9, missedMDs: [31] },
  { id: '9ac987ad-d871-4d19-94e4-58e95f4e9b31', name: 'Bukayo Saka', position: 'Forward', startPrice: 78, apps: 30, goals: 18, assists: 13, avgRating: 7.6, ratingSD: 0.9, missedMDs: [11, 12, 13, 23, 24, 34, 35, 36] },
  { id: '31d2b6f4-fb1f-4d87-ba68-d5512b1f6dc3', name: 'Son Heung-min', position: 'Forward', startPrice: 65, apps: 34, goals: 16, assists: 9, avgRating: 7.1, ratingSD: 0.9, missedMDs: [6, 17, 29, 38] },
  { id: '35558541-f709-4366-9f19-43c6061d06bb', name: 'Kevin De Bruyne', position: 'Midfielder', startPrice: 82, apps: 26, goals: 8, assists: 15, avgRating: 7.5, ratingSD: 1.0, missedMDs: [1, 2, 3, 4, 16, 17, 25, 26, 30, 31, 35, 36] },
  { id: '885332d7-f17e-4505-b371-17be96d52870', name: 'Martin Ødegaard', position: 'Midfielder', startPrice: 70, apps: 33, goals: 12, assists: 13, avgRating: 7.4, ratingSD: 0.8, missedMDs: [7, 18, 28, 36, 37] },
  { id: 'c388512a-c7d9-417d-ab93-9fcef2823a7f', name: 'Bruno Fernandes', position: 'Midfielder', startPrice: 68, apps: 36, goals: 14, assists: 11, avgRating: 7.2, ratingSD: 1.0, missedMDs: [10, 26] },
  { id: 'ca0fd402-87a6-4750-b4d8-297129f3c49d', name: 'Declan Rice', position: 'Midfielder', startPrice: 66, apps: 35, goals: 7, assists: 6, avgRating: 7.1, ratingSD: 0.7, missedMDs: [15, 30, 33] },
  { id: '89e8a809-9bc4-478e-ac77-1d144f3ef1d9', name: 'Phil Foden', position: 'Midfielder', startPrice: 74, apps: 32, goals: 15, assists: 10, avgRating: 7.3, ratingSD: 1.0, missedMDs: [5, 6, 21, 27, 32, 36] },
  { id: '3278247f-093f-4f5c-aa9b-dcef03462a97', name: 'Trent Alexander-Arnold', position: 'Midfielder', startPrice: 69, apps: 34, goals: 5, assists: 13, avgRating: 7.2, ratingSD: 0.8, missedMDs: [3, 19, 29, 38] },
  { id: '7ad2c9d8-53c9-494a-a674-e0888f780899', name: 'Virgil van Dijk', position: 'Defender', startPrice: 60, apps: 36, goals: 3, assists: 2, avgRating: 7.3, ratingSD: 0.6, cleanSheetRate: 0.45, missedMDs: [20, 35] },
  { id: '28414ecb-a326-48ca-8161-5fc1b2ca6026', name: 'William Saliba', position: 'Defender', startPrice: 58, apps: 37, goals: 2, assists: 1, avgRating: 7.5, ratingSD: 0.6, cleanSheetRate: 0.50, missedMDs: [22] },
  { id: 'c7e61e01-7d38-4baa-8182-a35b49b94de8', name: 'Ruben Dias', position: 'Defender', startPrice: 57, apps: 33, goals: 2, assists: 1, avgRating: 7.2, ratingSD: 0.7, cleanSheetRate: 0.42, missedMDs: [4, 13, 24, 34, 37] },
  { id: 'ecf396dd-ba97-483c-be59-af7a0e395056', name: 'Reece James', position: 'Defender', startPrice: 52, apps: 24, goals: 2, assists: 5, avgRating: 7.1, ratingSD: 0.9, cleanSheetRate: 0.38, missedMDs: [1, 2, 3, 7, 8, 9, 10, 25, 26, 27, 30, 31, 36, 37] },
  { id: '56ef6b65-a523-42d2-abf5-84b8c29b9525', name: 'Pedro Porro', position: 'Defender', startPrice: 48, apps: 35, goals: 4, assists: 8, avgRating: 7.0, ratingSD: 0.8, cleanSheetRate: 0.35, missedMDs: [14, 23, 32] },
  { id: '65e4caab-71e8-441a-9c07-74cf538addf0', name: 'Alisson Becker', position: 'Goalkeeper', startPrice: 55, apps: 34, goals: 0, assists: 0, avgRating: 7.3, ratingSD: 0.8, cleanSheetRate: 0.45, avgSaves: 4.2, missedMDs: [16, 17, 26, 38] },
  { id: 'b4c518cb-5c88-4d73-9e75-e32f9e34783d', name: 'Ederson', position: 'Goalkeeper', startPrice: 53, apps: 30, goals: 0, assists: 0, avgRating: 7.0, ratingSD: 0.8, cleanSheetRate: 0.40, avgSaves: 3.5, missedMDs: [5, 6, 7, 19, 20, 21, 33, 34] },
  { id: 'fbc85524-51d8-4746-b766-640b10b5c9df', name: 'David Raya', position: 'Goalkeeper', startPrice: 50, apps: 36, goals: 0, assists: 0, avgRating: 7.4, ratingSD: 0.7, cleanSheetRate: 0.50, avgSaves: 3.8, missedMDs: [12, 25] },
  { id: 'b98dda85-af1a-4361-ad73-9178398fcb9d', name: 'Robert Sánchez', position: 'Goalkeeper', startPrice: 42, apps: 31, goals: 0, assists: 0, avgRating: 6.9, ratingSD: 0.9, cleanSheetRate: 0.35, avgSaves: 4.0, missedMDs: [3, 4, 18, 28, 29, 35, 38] },
]

const MATCHDAYS = 38

function generateSeasonData(player) {
  const missedSet = new Set(player.missedMDs || [])
  const playedMDs = []
  for (let md = 1; md <= MATCHDAYS; md++) {
    if (!missedSet.has(md)) playedMDs.push(md)
  }

  // Distribute goals across played matchdays
  const goalsByMD = {}
  let gl = player.goals
  while (gl > 0) {
    const md = pick(playedMDs)
    goalsByMD[md] = (goalsByMD[md] || 0) + 1
    gl--
  }

  const assistsByMD = {}
  let al = player.assists
  const assistPool = [...playedMDs]
  while (al > 0 && assistPool.length > 0) {
    const idx = randInt(0, assistPool.length - 1)
    const md = assistPool[idx]
    assistsByMD[md] = (assistsByMD[md] || 0) + 1
    if (rand() < 0.75) assistPool.splice(idx, 1)
    al--
  }

  const stats = []
  const priceHistory = []
  let currentPrice = player.startPrice

  for (let md = 1; md <= MATCHDAYS; md++) {
    const played = !missedSet.has(md)

    if (played) {
      const goals = goalsByMD[md] || 0
      const assists = assistsByMD[md] || 0
      const isGK = player.position === 'Goalkeeper'
      const isDef = player.position === 'Defender'

      let baseRating = randBetween(
        player.avgRating - player.ratingSD,
        player.avgRating + player.ratingSD
      )
      baseRating = Math.max(5.0, Math.min(9.9, baseRating))
      baseRating = Math.min(9.9, baseRating + goals * 0.4 + assists * 0.25)

      const cleanSheet = rand() < (player.cleanSheetRate || 0)
      if (cleanSheet && (isDef || isGK)) {
        baseRating = Math.min(9.9, baseRating + 0.3)
      }

      const saves = isGK ? randInt(
        Math.max(0, Math.round(player.avgSaves || 0) - 2),
        Math.round(player.avgSaves || 0) + 2
      ) : 0

      const minutes = rand() < 0.85 ? 90 : randInt(60, 89)

      stats.push({
        player_id: player.id,
        matchday: md,
        rating: parseFloat(baseRating.toFixed(1)),
        goals,
        assists,
        saves,
        clean_sheet: cleanSheet,
        minutes,
      })

      let priceMult = 1.0
      if (baseRating >= 8.5) priceMult = 1.035
      else if (baseRating >= 7.5) priceMult = 1.015
      else if (baseRating >= 6.5) priceMult = 1.003
      else if (baseRating >= 5.5) priceMult = 0.990
      else priceMult = 0.975

      currentPrice = parseFloat((currentPrice * priceMult).toFixed(2))
    } else {
      currentPrice = parseFloat((currentPrice * 0.993).toFixed(2))
    }

    priceHistory.push({ player_id: player.id, matchday: md, price: currentPrice })
  }

  return { stats, priceHistory, finalPrice: currentPrice }
}

const allStats = []
const allPrices = []
const finalPrices = {}

for (const player of players) {
  const { stats, priceHistory, finalPrice } = generateSeasonData(player)
  allStats.push(...stats)
  allPrices.push(...priceHistory)
  finalPrices[player.id] = finalPrice
}

const lines = []
lines.push('-- 2025/26 Premier League season data')
lines.push('-- Clear existing season data')
lines.push("DELETE FROM matchday_stats WHERE matchday >= 1;")
lines.push("DELETE FROM price_history WHERE matchday >= 1;")
lines.push('')

// matchday_stats inserts in chunks
lines.push('-- Matchday stats')
for (let i = 0; i < allStats.length; i += 100) {
  const chunk = allStats.slice(i, i + 100)
  const vals = chunk.map(s =>
    `('${s.player_id}', ${s.matchday}, ${s.rating}, ${s.goals}, ${s.assists}, ${s.saves}, ${s.clean_sheet}, ${s.minutes})`
  ).join(',\n  ')
  lines.push(`INSERT INTO matchday_stats (player_id, matchday, rating, goals, assists, saves, clean_sheet, minutes) VALUES\n  ${vals};`)
  lines.push('')
}

// price_history inserts in chunks
lines.push('-- Price history')
for (let i = 0; i < allPrices.length; i += 100) {
  const chunk = allPrices.slice(i, i + 100)
  const vals = chunk.map(p =>
    `('${p.player_id}', ${p.matchday}, ${p.price})`
  ).join(',\n  ')
  lines.push(`INSERT INTO price_history (player_id, matchday, price) VALUES\n  ${vals};`)
  lines.push('')
}

// Update current prices
lines.push('-- Update current player prices')
for (const [id, price] of Object.entries(finalPrices)) {
  lines.push(`UPDATE players SET current_price = ${price} WHERE id = '${id}';`)
}

lines.push('')
lines.push('-- Update matchday tracker to 38')
lines.push("UPDATE matchday_tracker SET current_matchday = 38 WHERE id = 1;")

process.stdout.write(lines.join('\n'))
