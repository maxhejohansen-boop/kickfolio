import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const TYPE_META = {
  bill:         { icon: '💸', label: 'Bill',         color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  scout_report: { icon: '🔍', label: 'Scout Report', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  tip:          { icon: '💡', label: 'Insider Tip',  color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  news:         { icon: '📰', label: 'News',         color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  interview:    { icon: '🎤', label: 'Interview',    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
}

const CATEGORIES = [
  { key: 'all',          label: 'All mail',      icon: '📬' },
  { key: 'unread',       label: 'Unread',        icon: '●' },
  { key: 'bill',         label: 'Bills',         icon: '💸' },
  { key: 'scout_report', label: 'Scout Reports', icon: '🔍' },
  { key: 'tip',          label: 'Tips',          icon: '💡' },
  { key: 'news',         label: 'News',          icon: '📰' },
]

function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  if (d < 7)  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short' })
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function SenderAvatar({ type }) {
  const meta = TYPE_META[type] ?? TYPE_META.news
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base ${meta.bg} border ${meta.border}`}>
      {meta.icon}
    </div>
  )
}

export default function Inbox() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const detailRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()

    const channel = supabase.channel('inbox-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'inbox_messages',
        filter: `user_id=eq.${user.id}`,
      }, ({ new: row }) => {
        setMessages(prev => [row, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setMessages(data ?? [])
    setLoading(false)
  }

  async function open(msg) {
    setSelected(msg)
    if (!msg.read) {
      await supabase.from('inbox_messages').update({ read: true }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
    }
    setTimeout(() => detailRef.current?.scrollTo({ top: 0 }), 50)
  }

  async function toggleStar(e, id) {
    e.stopPropagation()
    const msg = messages.find(m => m.id === id)
    await supabase.from('inbox_messages').update({ starred: !msg.starred }).eq('id', id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, starred: !m.starred } : m))
    if (selected?.id === id) setSelected(s => ({ ...s, starred: !s.starred }))
  }

  async function deleteMsg(id) {
    await supabase.from('inbox_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function markAllRead() {
    await supabase.from('inbox_messages').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setMessages(prev => prev.map(m => ({ ...m, read: true })))
  }

  const filtered = messages.filter(m => {
    if (category === 'all')    return true
    if (category === 'unread') return !m.read
    return m.type === category
  })

  const unreadCount = messages.filter(m => !m.read).length

  const counts = {}
  for (const c of CATEGORIES) {
    if (c.key === 'all')    counts[c.key] = messages.length
    else if (c.key === 'unread') counts[c.key] = messages.filter(m => !m.read).length
    else counts[c.key] = messages.filter(m => m.type === c.key && !m.read).length
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">
          <Link to="/login" className="text-green-400 hover:underline">Sign in</Link> to view your inbox
        </p>
      </div>
    )
  }

  const meta = selected ? TYPE_META[selected.type] ?? TYPE_META.news : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex gap-4 h-[calc(100vh-8rem)]">

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col w-52 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-white">Inbox</h1>
            {unreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>

          <nav className="space-y-0.5 flex-1">
            {CATEGORIES.map(({ key, label, icon }) => {
              const cnt = counts[key] ?? 0
              return (
                <button
                  key={key}
                  onClick={() => { setCategory(key); setSelected(null) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    category === key
                      ? 'bg-blue-500/15 text-blue-300 font-medium'
                      : 'text-gray-400 hover:bg-[#1a1f28] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base leading-none">{icon}</span>
                    {label}
                  </span>
                  {cnt > 0 && key !== 'all' && (
                    <span className={`text-xs font-bold ${category === key ? 'text-blue-300' : 'text-gray-500'}`}>{cnt}</span>
                  )}
                </button>
              )
            })}
          </nav>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="mt-4 text-xs text-gray-500 hover:text-white transition-colors text-left px-3"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* ── Mobile category bar ────────────────────────────── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111318] border-t border-[#1e2330] flex overflow-x-auto px-2 py-1.5 gap-1">
          {CATEGORIES.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => { setCategory(key); setSelected(null) }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] whitespace-nowrap flex-shrink-0 transition-colors ${
                category === key ? 'bg-blue-500/15 text-blue-300' : 'text-gray-500'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Main area ─────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden rounded-xl border border-[#1e2330] bg-[#111318]">

          {/* Message list — hidden on mobile when a message is selected */}
          <div className={`flex flex-col ${selected ? 'hidden lg:flex lg:w-96 lg:border-r lg:border-[#1e2330]' : 'flex-1'}`}>
            {/* List header */}
            <div className="px-4 py-3 border-b border-[#1e2330] flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                {CATEGORIES.find(c => c.key === category)?.label}
                {filtered.length > 0 && <span className="ml-1.5 text-gray-600">· {filtered.length}</span>}
              </span>
              {/* Mobile title */}
              <h1 className="lg:hidden text-white font-bold flex items-center gap-2">
                Inbox
                {unreadCount > 0 && <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
              </h1>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 bg-[#1a1f28] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                  <div className="text-4xl mb-3 opacity-40">📭</div>
                  <p className="text-gray-500 text-sm">No messages here yet.</p>
                  <p className="text-gray-600 text-xs mt-1">Run a matchday to start receiving scout reports, news, and tips.</p>
                </div>
              ) : (
                filtered.map(msg => {
                  const typeMeta = TYPE_META[msg.type] ?? TYPE_META.news
                  const isSelected = selected?.id === msg.id
                  return (
                    <div
                      key={msg.id}
                      onClick={() => open(msg)}
                      className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer border-b border-[#1a1f28] transition-colors group ${
                        isSelected
                          ? 'bg-blue-500/10'
                          : msg.read
                            ? 'hover:bg-[#161a21]'
                            : 'bg-[#141820] hover:bg-[#171c26]'
                      }`}
                    >
                      {/* Unread dot */}
                      <div className="flex-shrink-0 w-2 flex items-center justify-center mt-1.5">
                        {!msg.read && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                      </div>

                      <SenderAvatar type={msg.type} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span className={`text-sm truncate ${msg.read ? 'text-gray-300 font-normal' : 'text-white font-semibold'}`}>
                            {msg.sender}
                          </span>
                          <span className="text-[11px] text-gray-600 flex-shrink-0">{relTime(msg.created_at)}</span>
                        </div>
                        <div className={`text-sm truncate mb-0.5 ${msg.read ? 'text-gray-500' : 'text-gray-200 font-medium'}`}>
                          {msg.subject}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeMeta.bg} ${typeMeta.color} border ${typeMeta.border}`}>
                            {typeMeta.label}
                          </span>
                          <span className="text-xs text-gray-600 truncate">{msg.preview}</span>
                        </div>
                      </div>

                      {/* Star */}
                      <button
                        onClick={e => toggleStar(e, msg.id)}
                        className={`flex-shrink-0 mt-0.5 text-base opacity-0 group-hover:opacity-100 transition-opacity ${msg.starred ? 'opacity-100 text-amber-400' : 'text-gray-600 hover:text-amber-400'}`}
                      >
                        {msg.starred ? '★' : '☆'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Detail pane ─────────────────────────────────── */}
          {selected ? (
            <div ref={detailRef} className="flex-1 overflow-y-auto flex flex-col">
              {/* Detail header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e2330] flex-shrink-0 sticky top-0 bg-[#111318] z-10">
                <button
                  onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  <span className="hidden sm:inline">Back</span>
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-semibold text-base truncate">{selected.subject}</h2>
                </div>
                <button
                  onClick={e => toggleStar(e, selected.id)}
                  className={`flex-shrink-0 text-xl transition-colors ${selected.starred ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'}`}
                >
                  {selected.starred ? '★' : '☆'}
                </button>
                <button
                  onClick={() => deleteMsg(selected.id)}
                  className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors text-sm ml-1"
                  title="Delete"
                >
                  🗑
                </button>
              </div>

              {/* Message card */}
              <div className="flex-1 p-6">
                <div className="max-w-2xl">
                  {/* Sender row */}
                  <div className="flex items-start gap-4 mb-6">
                    <SenderAvatar type={selected.type} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold">{selected.sender}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color} border ${meta.border}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(selected.created_at).toLocaleString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className={`rounded-xl border p-5 ${meta.bg} ${meta.border}`}>
                    <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line font-mono">
                      {selected.body}
                    </p>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-3 mt-4">
                    {selected.type === 'scout_report' && selected.metadata?.player_id && (
                      <Link
                        to="/scouting"
                        className="text-xs bg-green-500 hover:bg-green-400 text-black font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View in Scouting →
                      </Link>
                    )}
                    {selected.type === 'tip' && (
                      <Link
                        to="/market"
                        className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Open Market →
                      </Link>
                    )}
                    {selected.type === 'news' && (
                      <Link
                        to="/market"
                        className="text-xs bg-blue-500 hover:bg-blue-400 text-white font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Open Market →
                      </Link>
                    )}
                    {selected.type === 'bill' && (
                      <Link
                        to="/portfolio"
                        className="text-xs bg-[#1e2330] hover:bg-[#2a3040] text-gray-300 font-medium px-3 py-1.5 rounded-lg transition-colors border border-[#2a3040]"
                      >
                        View Portfolio →
                      </Link>
                    )}
                    <button
                      onClick={() => deleteMsg(selected.id)}
                      className="text-xs text-red-500/60 hover:text-red-400 transition-colors ml-auto"
                    >
                      Delete message
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-1 items-center justify-center text-center px-8">
              <div>
                <div className="text-5xl mb-4 opacity-20">📬</div>
                <p className="text-gray-600 text-sm">Select a message to read it</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
