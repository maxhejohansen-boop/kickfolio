import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import PlayerModal from './PlayerModal'

export default function PlayerCard({ player, latestStats: initialStats, appearances = 0 }) {
  const [latestStats, setLatestStats] = useState(initialStats ?? null)
  const [showModal, setShowModal] = useState(false)

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
    Forward: 'text-orange-400 bg-orange-400/10',
    Midfielder: 'text-blue-400 bg-blue-400/10',
    Defender: 'text-purple-400 bg-purple-400/10',
    Goalkeeper: 'text-yellow-400 bg-yellow-400/10',
  }

  return (
    <>
      <div
        className="bg-[#161a21] border border-[#1e2330] rounded-lg p-4 cursor-pointer hover:border-gray-600 transition-all hover:bg-[#1a1f28] group"
        onClick={() => setShowModal(true)}
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
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${positionColors[player.position] ?? 'text-gray-400 bg-gray-400/10'}`}>
            {player.position === 'Goalkeeper' ? 'GK' : player.position.slice(0, 3).toUpperCase()}
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

        <div className="mt-3 pt-3 border-t border-[#1e2330] grid grid-cols-4 gap-1 text-center">
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
      </div>

      {showModal && (
        <PlayerModal player={player} onClose={() => setShowModal(false)} onTrade={fetchLatestStats} />
      )}
    </>
  )
}
