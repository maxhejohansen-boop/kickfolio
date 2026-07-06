-- Add Tottenham squad (Pedro Porro, Son Heung-min already exist)
insert into players (name, club, position, current_price, image_url) values

  -- Goalkeepers
  ('Guglielmo Vicario',   'Tottenham', 'Goalkeeper', 54.00, null),
  ('Antonín Kinský',      'Tottenham', 'Goalkeeper', 28.00, null),
  ('Brandon Austin',      'Tottenham', 'Goalkeeper', 12.00, null),

  -- Defenders (Pedro Porro already exists)
  ('Micky van de Ven',    'Tottenham', 'Defender', 56.00, null),
  ('Cristian Romero',     'Tottenham', 'Defender', 54.00, null),
  ('Destiny Udogie',      'Tottenham', 'Defender', 48.00, null),
  ('Jan Paul van Hecke',  'Tottenham', 'Defender', 44.00, null),
  ('Kevin Danso',         'Tottenham', 'Defender', 40.00, null),
  ('Radu Drăgușin',       'Tottenham', 'Defender', 36.00, null),
  ('Ben Davies',          'Tottenham', 'Defender', 30.00, null),
  ('Djed Spence',         'Tottenham', 'Defender', 24.00, null),

  -- Midfielders
  ('Xavi Simons',         'Tottenham', 'Midfielder', 70.00, null),
  ('Dejan Kulusevski',    'Tottenham', 'Midfielder', 60.00, null),
  ('James Maddison',      'Tottenham', 'Midfielder', 56.00, null),
  ('Mohammed Kudus',      'Tottenham', 'Midfielder', 54.00, null),
  ('Pape Matar Sarr',     'Tottenham', 'Midfielder', 46.00, null),
  ('João Palhinha',       'Tottenham', 'Midfielder', 44.00, null),
  ('Rodrigo Bentancur',   'Tottenham', 'Midfielder', 40.00, null),
  ('Yves Bissouma',       'Tottenham', 'Midfielder', 38.00, null),
  ('Lucas Bergvall',      'Tottenham', 'Midfielder', 34.00, null),
  ('Archie Gray',         'Tottenham', 'Midfielder', 28.00, null),

  -- Forwards (Son Heung-min already exists)
  ('Dominic Solanke',     'Tottenham', 'Forward', 52.00, null),
  ('Mathys Tel',          'Tottenham', 'Forward', 50.00, null),
  ('Randal Kolo Muani',   'Tottenham', 'Forward', 48.00, null),
  ('Richarlison',         'Tottenham', 'Forward', 46.00, null),
  ('Wilson Odobert',      'Tottenham', 'Forward', 36.00, null)

on conflict do nothing;

-- Add matchday 0 price history for new players
insert into price_history (player_id, price, matchday)
select id, current_price, 0
from players
where club = 'Tottenham'
  and name not in ('Pedro Porro', 'Son Heung-min')
on conflict do nothing;
