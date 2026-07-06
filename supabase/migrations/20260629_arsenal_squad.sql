-- Add Arsenal squad (David Raya, William Saliba, Martin Ødegaard, Declan Rice, Bukayo Saka already exist)
insert into players (name, club, position, current_price, image_url) values

  -- Goalkeepers (David Raya already exists)
  ('Kepa Arrizabalaga',   'Arsenal', 'Goalkeeper', 32.00, null),
  ('Karl Hein',           'Arsenal', 'Goalkeeper', 18.00, null),

  -- Defenders (William Saliba already exists)
  ('Gabriel Magalhães',   'Arsenal', 'Defender', 52.00, null),
  ('Jurriën Timber',      'Arsenal', 'Defender', 50.00, null),
  ('Riccardo Calafiori',  'Arsenal', 'Defender', 48.00, null),
  ('Ben White',           'Arsenal', 'Defender', 46.00, null),
  ('Myles Lewis-Skelly',  'Arsenal', 'Defender', 42.00, null),
  ('Piero Hincapié',      'Arsenal', 'Defender', 40.00, null),
  ('Cristhian Mosquera',  'Arsenal', 'Defender', 36.00, null),

  -- Midfielders (Martin Ødegaard, Declan Rice already exist)
  ('Martín Zubimendi',    'Arsenal', 'Midfielder', 62.00, null),
  ('Eberechi Eze',        'Arsenal', 'Midfielder', 60.00, null),
  ('Mikel Merino',        'Arsenal', 'Midfielder', 50.00, null),
  ('Christian Nørgaard',  'Arsenal', 'Midfielder', 44.00, null),

  -- Forwards (Bukayo Saka already exists)
  ('Viktor Gyökeres',     'Arsenal', 'Forward', 80.00, null),
  ('Gabriel Martinelli',  'Arsenal', 'Forward', 56.00, null),
  ('Kai Havertz',         'Arsenal', 'Forward', 52.00, null),
  ('Leandro Trossard',    'Arsenal', 'Forward', 48.00, null),
  ('Noni Madueke',        'Arsenal', 'Forward', 46.00, null),
  ('Gabriel Jesus',       'Arsenal', 'Forward', 40.00, null)

on conflict do nothing;

-- Add matchday 0 price history for new players
insert into price_history (player_id, price, matchday)
select id, current_price, 0
from players
where club = 'Arsenal'
  and name not in ('David Raya', 'William Saliba', 'Martin Ødegaard', 'Declan Rice', 'Bukayo Saka')
on conflict do nothing;
