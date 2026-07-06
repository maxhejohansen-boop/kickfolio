// Mirrors the calcChangePct logic in run-matchday/index.ts
export function calcChangePct(stat) {
  if (!stat.minutes || stat.minutes === 0) return -1
  let pct = 0
  pct += (stat.goals  ?? 0) * 5
  pct += (stat.assists ?? 0) * 3
  const rating = Number(stat.rating ?? 0)
  if (rating >= 8.0)      pct += 3
  else if (rating >= 7.0) pct += 1
  else if (rating < 6.0)  pct -= 3
  if (stat.clean_sheet)         pct += 4
  if ((stat.saves ?? 0) >= 5)   pct += 2
  return Math.max(-15, Math.min(15, pct))
}

// priceHistoryArr = [{price, matchday}] sorted ascending
export function calcGrade(player, last5, priceHistoryArr, balance) {
  if (!last5 || last5.length === 0) return null

  const sorted = [...last5].sort((a, b) => a.matchday - b.matchday)

  const priceMap = {}
  for (const h of (priceHistoryArr ?? [])) priceMap[h.matchday] = h.price

  // Price just before the first matchday in the window
  const firstMD    = sorted[0].matchday
  const startPrice = priceMap[firstMD - 1] ?? priceMap[0] ?? Number(player.current_price)

  let expectedPrice = startPrice
  for (const s of sorted) {
    expectedPrice = Math.max(1, expectedPrice * (1 + calcChangePct(s) / 100))
  }

  const totalMinutes = sorted.reduce((sum, s) => sum + Math.min(s.minutes ?? 0, 90), 0)
  const minutesPct   = sorted.length > 0 ? totalMinutes / (sorted.length * 90) : 0
  const priceDiff    = ((expectedPrice - Number(player.current_price)) / Number(player.current_price)) * 100

  let grade
  if      (priceDiff >= 15 && minutesPct >= 0.8) grade = 'A'
  else if (priceDiff >= 8)                        grade = 'B'
  else if (priceDiff <= -8 || minutesPct < 0.3)   grade = 'D'
  else                                             grade = 'C'

  const STAKE_PCT = { A: 0.05, B: 0.03, C: 0.01, D: 0 }
  const suggested  = grade !== 'D' && (balance ?? 0) > 0
    ? (balance ?? 0) * STAKE_PCT[grade]
    : 0

  return { grade, expectedPrice, priceDiff, minutesPct, matchdays: sorted.length, suggested, stats: sorted }
}

export const GRADE_META = {
  A: { label: 'Strong Buy', pillClass: 'bg-green-500 text-black',        textClass: 'text-green-400' },
  B: { label: 'Buy',        pillClass: 'bg-green-500/20 text-green-400', textClass: 'text-green-400' },
  C: { label: 'Fair Value', pillClass: 'bg-[#252b38] text-gray-400',     textClass: 'text-gray-400'  },
  D: { label: 'Overvalued', pillClass: 'bg-red-500/10 text-red-400',     textClass: 'text-red-400'   },
}

export const STAKE_PCT = { A: 0.05, B: 0.03, C: 0.01, D: 0 }
