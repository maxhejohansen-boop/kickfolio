-- Add users table to realtime publication so balance changes push to clients instantly.
-- RLS on the users table ensures each subscriber only receives their own row.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Full row data needed for UPDATE events (balance column isn't the PK).
ALTER TABLE public.users REPLICA IDENTITY FULL;
