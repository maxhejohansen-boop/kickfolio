import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else {
      navigate('/market')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">⚽</div>
          <h1 className="text-2xl font-bold text-white">Kickfolio</h1>
          <p className="text-gray-500 text-sm mt-1">Start with £100,000 virtual cash</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0a0b0e] border border-[#1e2330] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-[#0a0b0e] border border-[#1e2330] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500"
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            You'll receive £100,000 virtual cash to invest
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-green-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
