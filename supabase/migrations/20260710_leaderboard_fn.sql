-- Security-definer function so the leaderboard can read all users' portfolio values
-- without exposing individual portfolio rows to RLS-restricted queries.
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE(id uuid, email text, balance numeric, portfolio_value numeric, total_value numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email,
    u.balance,
    COALESCE(SUM(p.shares * pl.current_price), 0) AS portfolio_value,
    u.balance + COALESCE(SUM(p.shares * pl.current_price), 0) AS total_value
  FROM public.users u
  LEFT JOIN public.portfolios p ON p.user_id = u.id AND p.shares > 0
  LEFT JOIN public.players pl ON pl.id = p.player_id
  GROUP BY u.id, u.email, u.balance;
$$;
