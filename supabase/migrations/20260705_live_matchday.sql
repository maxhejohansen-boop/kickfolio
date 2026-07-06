-- Live matchday status (single row)
CREATE TABLE IF NOT EXISTS matchday_status (
  id         integer PRIMARY KEY DEFAULT 1,
  status     text NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  ends_at    timestamptz,
  matchday_number integer DEFAULT 0,
  CONSTRAINT matchday_status_single_row CHECK (id = 1)
);

INSERT INTO matchday_status (id, status, matchday_number)
VALUES (1, 'scheduled', 0)
ON CONFLICT (id) DO NOTHING;

-- Live price-tick log (reset each matchday)
CREATE TABLE IF NOT EXISTS live_ticks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid REFERENCES players(id) ON DELETE CASCADE,
  price           numeric(10,2) NOT NULL,
  price_change_pct numeric(6,2) NOT NULL DEFAULT 0,
  event_text      text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE matchday_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_ticks      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read matchday_status" ON matchday_status FOR SELECT TO public USING (true);
CREATE POLICY "Public read live_ticks"      ON live_ticks      FOR SELECT TO public USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE matchday_status;
ALTER PUBLICATION supabase_realtime ADD TABLE live_ticks;
-- players is likely already in publication; guard against error
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE players;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- CRON JOB SETUP (run manually in SQL editor after filling in values)
-- Requires pg_cron + pg_net (both enabled by default on Supabase)
--
-- SELECT cron.schedule(
--   'matchday-14utc',   -- 15:00 Lisbon in summer (UTC+1)
--   '0 14 * * *',
--   $cron$
--   SELECT net.http_post(
--     url     := 'https://ryqblsomhtwyietvyqzy.supabase.co/functions/v1/start-live-matchday',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $cron$
-- );
-- SELECT cron.schedule(
--   'matchday-15utc',   -- 15:00 Lisbon in winter (UTC+0)
--   '0 15 * * *',
--   $cron$
--   SELECT net.http_post(
--     url     := 'https://ryqblsomhtwyietvyqzy.supabase.co/functions/v1/start-live-matchday',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $cron$
-- );
-- ============================================================
