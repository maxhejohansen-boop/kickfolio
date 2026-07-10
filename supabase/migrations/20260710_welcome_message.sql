-- Sends a "Bobby's starter picks" inbox message whenever a new user row is created.
-- Runs with SECURITY DEFINER so it can insert regardless of RLS.
CREATE OR REPLACE FUNCTION send_welcome_inbox_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  fwd_name  text;
  fwd_price numeric;
  mid_name  text;
  mid_price numeric;
  def_name  text;
  def_price numeric;
  msg_body  text;
  nl        text := chr(10);
BEGIN
  SELECT name, current_price INTO fwd_name, fwd_price
    FROM players WHERE position = 'Forward'  ORDER BY current_price DESC LIMIT 1;

  SELECT name, current_price INTO mid_name, mid_price
    FROM players WHERE position = 'Midfielder' ORDER BY current_price DESC LIMIT 1;

  SELECT name, current_price INTO def_name, def_price
    FROM players WHERE position = 'Defender'  ORDER BY current_price DESC LIMIT 1;

  msg_body :=
    'Welcome, Gaffer!' || nl || nl ||
    'You''ve got £100,000 to build your portfolio from scratch. ' ||
    'Here are three players I''d look at before the first matchday:' || nl || nl ||
    '  ' || chr(8226) || ' ' || COALESCE(fwd_name, 'a top striker') ||
      ' (Forward) — £' || to_char(COALESCE(fwd_price, 0), 'FM990.00') || nl ||
    '  ' || chr(8226) || ' ' || COALESCE(mid_name, 'a top midfielder') ||
      ' (Midfielder) — £' || to_char(COALESCE(mid_price, 0), 'FM990.00') || nl ||
    '  ' || chr(8226) || ' ' || COALESCE(def_name, 'a top defender') ||
      ' (Defender) — £' || to_char(COALESCE(def_price, 0), 'FM990.00') || nl || nl ||
    'These are the highest-priced players at each position right now — high price usually means ' ||
    'consistent performers. Head to the Market, scout one to reveal my grade, then decide.' || nl || nl ||
    'Tip: spread your money across at least 3 players to manage risk.' || nl || nl ||
    'Good luck,' || nl || 'Bobby';

  INSERT INTO inbox_messages (user_id, type, sender, subject, preview, body, metadata)
  VALUES (
    NEW.id,
    'tip',
    'Bobby',
    'Your starter picks — welcome to Kickfolio',
    'Three players to kick off your portfolio',
    msg_body,
    jsonb_build_object('welcome', true)
  );

  RETURN NEW;
END;
$func$;

-- Drop first to allow re-running this migration cleanly
DROP TRIGGER IF EXISTS on_user_created_send_welcome ON public.users;

CREATE TRIGGER on_user_created_send_welcome
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_inbox_message();
