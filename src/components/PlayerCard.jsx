import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import PlayerModal from './PlayerModal'
import { GRADE_META } from '../lib/gradeCalc'
import { useTutorial } from '../lib/TutorialContext'

function Sparkline({ data }) {
  if (!data || data.length < 2) return null

  const W = 200, H = 36
  const prices = data.map(d => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const pts = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * W,
    y: H - ((p - min) / range) * (H - 4) - 2,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillPath = `${linePath} L ${W} ${H} L 0 ${H} Z`
  const isUp = prices[prices.length - 1] >= prices[0]
  const color = isUp ? '#4ade80' : '#f87171'
  const id = `spark-${data[0]?.matchday}-${prices.length}`

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PlayerCard({ player, latestStats: initialStats, appearances = 0, priceHistory = [], gradeData = null, tutorialTarget, scoutInfo = null, currentMatchday = 0, onScoutUpdate }) {
  const [latestStats, setLatestStats] = useState(initialStats ?? null)
  const [showModal, setShowModal] = useState(false)
  const tutorial = useTutorial()

  useEffect(() => {
    if (initialStats !== undefined) { setLatestStats(initialStats); return }
    fetchLatestStats()
  }, [player.id, initialStats])

  async function fetchLatestStats() {
    const { data } = await supabase
      .from('matchday_stats')
      .select('*')
      .eq('player_id', player.id)
      .order('matchday', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLatestStats(data)
  }

  const changePct = latestStats?.price_change_pct ?? 0
  const isUp = changePct > 0
  const isDown = changePct < 0

  const positionColors = {
    Forward:    'text-orange-400',
    Midfielder: 'text-blue-400',
    Defender:   'text-purple-400',
    Goalkeeper: 'text-yellow-400',
  }

  function handleClick() {
    setShowModal(true)
    // Notify tutorial that a player was clicked during step 7
    if (tutorial?.step === 7 && tutorial?.subStep === 0) tutorial.onPlayerModalOpen()
  }

  return (
    <>
      <div
        data-tutorial={tutorialTarget}
        className="bg-[#161a21] border border-[#1e2330] rounded-lg p-4 cursor-pointer hover:border-gray-600 transition-all hover:bg-[#1a1f28] group"
        onClick={handleClick}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1e2330] overflow-hidden flex-shrink-0">
              {player.image_url ? (
                <img
                  src={player.image_url}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg">
                  {player.name[0]}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold text-white text-sm leading-tight">{player.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{player.club}</div>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded bg-[#1e2330] ${positionColors[player.position] ?? 'text-gray-400'}`}>
            {player.position === 'Goalkeeper' ? 'GK' : (player.position ?? '').slice(0, 3).toUpperCase()}
          </span>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-xl font-bold text-white">
              £{Number(player.current_price).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">per share</div>
          </div>
          <div className={`text-sm font-semibold ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-500'}`}>
            {changePct === 0 ? '—' : `${isUp ? '+' : ''}${changePct.toFixed(1)}%`}
          </div>
        </div>

        {priceHistory.length >= 2 && (
          <div className="mt-3 -mx-1 overflow-hidden">
            <Sparkline data={priceHistory} />
          </div>
        )}

        <div className={`${priceHistory.length >= 2 ? 'mt-2 pt-2' : 'mt-3 pt-3'} border-t border-[#1e2330] grid grid-cols-4 gap-1 text-center`}>
          <div>
            <div className="text-xs text-gray-500">Apps</div>
            <div className="text-sm font-semibold text-white">{appearances}</div>
          </div>
          {latestStats ? (
            player.position !== 'Goalkeeper' ? (
              <>
                <div>
                  <div className="text-xs text-gray-500">Goals</div>
                  <div className="text-sm font-semibold text-white">{latestStats.goals}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Assists</div>
                  <div className="text-sm font-semibold text-white">{latestStats.assists}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Rating</div>
                  <div className="text-sm font-semibold text-white">{latestStats.rating}</div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-xs text-gray-500">Saves</div>
                  <div className="text-sm font-semibold text-white">{latestStats.saves}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Clean</div>
                  <div className="text-sm font-semibold text-white">{latestStats.clean_sheet ? '✓' : '✗'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Rating</div>
                  <div className="text-sm font-semibold text-white">{latestStats.rating}</div>
                </div>
              </>
            )
          ) : (
            <div className="col-span-3 flex items-center justify-center text-xs text-gray-600">No match data</div>
          )}
        </div>

        {gradeData && (() => {
          const scoutRevealed = scoutInfo?.scout_type === 'instant' ||
            (scoutInfo?.scout_type === 'sent' && scoutInfo.reveals_at_matchday != null && scoutInfo.reveals_at_matchday <= currentMatchday)
          const scoutPending  = scoutInfo?.scout_type === 'sent' && !scoutRevealed

          if (scoutRevealed) {
            const meta = GRADE_META[gradeData.grade]
            return (
              <div data-tutorial={tutorialTarget === 'player-card' ? 'grade-badge' : undefined} className="mt-2 pt-2 border-t border-[#1e2330] flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${meta.pillClass}`}>{gradeData.grade}</span>
                <span className={`text-xs ${meta.textClass}`}>{meta.label}</span>
                {gradeData.suggested >= 1 && (
                  <span className="text-xs text-gray-600 ml-auto">Sug. £{gradeData.suggested.toFixed(0)}</span>
                )}
              </div>
            )
          }
          if (scoutPending) {
            return (
              <div className="mt-2 pt-2 border-t border-[#1e2330] flex items-center gap-1.5">
                <span className="text-[10px] text-amber-500/80">⏱</span>
                <span className="text-[10px] text-gray-600">Scouts en route · MD {scoutInfo.reveals_at_matchday}</span>
              </div>
            )
          }
          return (
            <div className="mt-2 pt-2 border-t border-[#1e2330] flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#1e2330] text-gray-600">?</span>
              <span className="text-xs text-gray-600">Scout to reveal grade</span>
            </div>
          )
        })()}
      </div>

      {showModal && (
        <PlayerModal
          player={player}
          onClose={() => setShowModal(false)}
          onTrade={fetchLatestStats}
          gradeData={gradeData}
          onScoutUpdate={onScoutUpdate}
        />
      )}
    </>
  )
}
