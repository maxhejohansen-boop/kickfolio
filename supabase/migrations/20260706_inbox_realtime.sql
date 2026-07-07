-- inbox_messages needs REPLICA IDENTITY FULL so UPDATE events (marking as read)
-- include all columns in the WAL, letting Supabase apply the user_id filter correctly.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.inbox_messages REPLICA IDENTITY FULL;
