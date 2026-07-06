-- Add Chelsea squad (Robert Sánchez, Reece James, Cole Palmer already exist)
insert into players (name, club, position, current_price, image_url) values

  -- Goalkeepers (Robert Sánchez already exists)
  ('Filip Jörgensen',      'Chelsea', 'Goalkeeper', 38.00, null),

  -- Defenders (Reece James already exists)
  ('Wesley Fofana',        'Chelsea', 'Defender', 52.00, null),
  ('Levi Colwill',         'Chelsea', 'Defender', 50.00, null),
  ('Jorrel Hato',          'Chelsea', 'Defender', 46.00, null),
  ('Malo Gusto',           'Chelsea', 'Defender', 44.00, null),
  ('Marc Cucurella',       'Chelsea', 'Defender', 42.00, null),
  ('Tosin Adarabioyo',     'Chelsea', 'Defender', 38.00, null),
  ('Benoît Badiashile',    'Chelsea', 'Defender', 36.00, null),
  ('Josh Acheampong',      'Chelsea', 'Defender', 26.00, null),
  ('Trevoh Chalobah',      'Chelsea', 'Defender', 24.00, null),
  ('Mamadou Sarr',         'Chelsea', 'Defender', 20.00, null),

  -- Midfielders (Cole Palmer already exists)
  ('Moisés Caicedo',       'Chelsea', 'Midfielder', 70.00, null),
  ('Enzo Fernández',       'Chelsea', 'Midfielder', 64.00, null),
  ('Roméo Lavia',          'Chelsea', 'Midfielder', 54.00, null),
  ('Mykhailo Mudryk',      'Chelsea', 'Midfielder', 48.00, null),
  ('Andrey Santos',        'Chelsea', 'Midfielder', 32.00, null),
  ('Dário Essugo',         'Chelsea', 'Midfielder', 28.00, null),

  -- Forwards
  ('Estêvão',              'Chelsea', 'Forward', 72.00, null),
  ('Alejandro Garnacho',   'Chelsea', 'Forward', 64.00, null),
  ('Liam Delap',           'Chelsea', 'Forward', 60.00, null),
  ('Jamie Gittens',        'Chelsea', 'Forward', 56.00, null),
  ('Pedro Neto',           'Chelsea', 'Forward', 54.00, null),
  ('João Pedro',           'Chelsea', 'Forward', 48.00, null),
  ('Marc Guiu',            'Chelsea', 'Forward', 30.00, null)

on conflict do nothing;

-- Add matchday 0 price history for new players
insert into price_history (player_id, price, matchday)
select id, current_price, 0
from players
where club = 'Chelsea'
  and name not in ('Robert Sánchez', 'Reece James', 'Cole Palmer')
on conflict do nothing;
