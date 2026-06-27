import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Admin() {
  const { user, loading } = useAuth()
  const [matchday, setMatchday] = useState(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMatchday()
  }, [])

  async function fetchMatchday() {
    const { data } = await supabase
      .from('matchday_tracker')
      .select('current_matchday')
      .eq('id', 1)
      .single()
    setMatchday(data?.current_matchday ?? 0)
  }

  async function runSimulation() {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('run-matchday', {
        body: { simulate: true },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setResult(data)
      setMatchday(data.matchday)
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const nextMatchday = matchday != null ? matchday + 1 : '...'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">
          Current matchday: <span className="text-white font-medium">{matchday ?? '...'}</span>
        </p>
      </div>

      <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Simulate Matchday {nextMatchday}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Generates random player performances and updates all prices.
            </p>
          </div>
          <button
            onClick={runSimulation}
            disabled={running || matchday == null}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
          >
            {running ? 'Simulating...' : `Run MD ${nextMatchday}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e2330] flex items-center justify-between">
            <span className="text-sm font-medium text-white">Matchday {result.matchday} results</span>
            <span className="text-xs text-gray-500">{result.simulate ? 'simulated' : 'live'}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2330]">
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Player</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">G</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">A</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Rating</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3 hidden sm:table-cell">Old</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">New</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {[...result.log]
                .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
                .map((row) => (
                  <tr key={row.player} className="border-b border-[#1e2330] last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-sm text-white font-medium">{row.player}</div>
                      <div className="text-xs text-gray-500">{row.position}{!row.played ? ' · DNP' : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">{row.goals}</td>
                    <td className="px-4 py-3 text-right text-sm text-white">{row.assists}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 hidden sm:table-cell">
                      {row.played ? Number(row.rating).toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 hidden sm:table-cell">
                      £{Number(row.oldPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">
                      £{Number(row.newPrice).toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${row.changePct > 0 ? 'text-green-400' : row.changePct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {row.changePct > 0 ? '+' : ''}{row.changePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
