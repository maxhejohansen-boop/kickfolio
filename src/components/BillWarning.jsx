import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function BillWarning() {
  const { user } = useAuth()
  const [warning, setWarning] = useState(null) // { id, subject, shortfall, totalCost, matchday }
  const [dismissed, setDismissed] = useState(new Set())

  function showIfUnread(msg) {
    if (!msg?.metadata?.insufficient_funds) return
    if (msg.read) return
    setWarning({
      id: msg.id,
      subject: msg.subject,
      shortfall: Number(msg.metadata.shortfall ?? 0),
      totalCost: Number(msg.metadata.totalCost ?? 0),
      matchday: msg.metadata.matchday,
    })
  }

  // On mount, check for any existing unread insufficient-funds bills
  useEffect(() => {
    if (!user) return
    supabase
      .from('inbox_messages')
      .select('id, subject, metadata, read')
      .eq('user_id', user.id)
      .eq('type', 'bill')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const msg = data?.[0]
        if (msg) showIfUnread(msg)
      })
  }, [user?.id])

  // Subscribe to new bill messages in real-time
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel('bill-warning')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'inbox_messages',
        filter: `user_id=eq.${user.id}`,
      }, ({ new: row }) => {
        if (row.type === 'bill') showIfUnread(row)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

  function dismiss() {
    if (warning) setDismissed(prev => new Set([...prev, warning.id]))
    setWarning(null)
  }

  if (!warning || dismissed.has(warning.id)) return null

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[#111318] border border-red-500/50 rounded-2xl w-full max-w-md shadow-2xl shadow-red-900/30">
        {/* Red top bar */}
        <div className="h-1.5 bg-red-500 rounded-t-2xl" />

        <div className="p-6">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Payment Failed</h2>
              <p className="text-gray-400 text-sm mt-1">
                Your scout fees couldn't be fully covered this matchday.
              </p>
            </div>
          </div>

          {/* Amount breakdown */}
          <div className="bg-[#1a1f28] border border-[#1e2330] rounded-xl p-4 mb-5 space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Amount due</span>
              <span className="text-white font-semibold">£{warning.totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-[#1e2330]">
              <span className="text-gray-500">Amount paid</span>
              <span className="text-gray-300">£{(warning.totalCost - warning.shortfall).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-400 font-medium">Shortfall</span>
              <span className="text-red-400 font-bold">£{warning.shortfall.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Top up your cash balance to keep your scouting network active. Scout focuses may be cancelled if fees remain unpaid.
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-[#1e2330] text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              Dismiss
            </button>
            <Link
              to="/inbox"
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-400 text-white text-center transition-colors"
            >
              View in Inbox
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
