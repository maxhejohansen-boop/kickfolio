import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">⚽</div>
      <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
        Kickfolio
      </h1>
      <p className="text-gray-400 text-lg max-w-md mb-2">
        Premier League players as stocks.
      </p>
      <p className="text-gray-500 text-base max-w-md mb-10">
        Buy and sell shares in real players. Prices move based on simulated match performance every matchday.
      </p>

      <div className="flex gap-3">
        {user ? (
          <Link
            to="/market"
            className="bg-green-500 hover:bg-green-400 text-black font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
          >
            Go to Market →
          </Link>
        ) : (
          <>
            <Link
              to="/signup"
              className="bg-green-500 hover:bg-green-400 text-black font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="border border-[#1e2330] hover:border-gray-600 text-white rounded-lg px-6 py-3 text-sm transition-colors"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      <div className="mt-16 grid grid-cols-3 gap-6 sm:gap-10 text-center">
        {[
          { value: '20', label: 'PL Players' },
          { value: '£100k', label: 'Starting Cash' },
          { value: '24h', label: 'Matchday Cycle' },
        ].map(({ value, label }) => (
          <div key={label}>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-gray-600">
        Starting prices and stats based on the 2024/25 Premier League season.
      </p>
    </div>
  )
}
