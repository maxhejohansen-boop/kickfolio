-- Add Manchester City squad (Ederson, Ruben Dias, Haaland, De Bruyne, Phil Foden already exist)
insert into players (name, club, position, current_price, image_url) values

  -- Goalkeepers
  ('Gianluigi Donnarumma', 'Manchester City', 'Goalkeeper', 62.00, null),
  ('James Trafford',       'Manchester City', 'Goalkeeper', 28.00, null),
  ('Marcus Bettinelli',    'Manchester City', 'Goalkeeper', 12.00, null),

  -- Defenders (Ruben Dias already exists)
  ('John Stones',          'Manchester City', 'Defender', 48.00, null),
  ('Nathan Aké',           'Manchester City', 'Defender', 44.00, null),
  ('Marc Guéhi',           'Manchester City', 'Defender', 46.00, null),
  ('Rayan Aït-Nouri',      'Manchester City', 'Defender', 40.00, null),
  ('Joško Gvardiol',       'Manchester City', 'Defender', 58.00, null),
  ('Abdukodir Khusanov',   'Manchester City', 'Defender', 36.00, null),
  ('Rico Lewis',           'Manchester City', 'Defender', 34.00, null),

  -- Midfielders (Kevin De Bruyne, Phil Foden already exist)
  ('Rodri',                'Manchester City', 'Midfielder', 74.00, null),
  ('Bernardo Silva',       'Manchester City', 'Midfielder', 66.00, null),
  ('Tijjani Reijnders',    'Manchester City', 'Midfielder', 62.00, null),
  ('Rayan Cherki',         'Manchester City', 'Midfielder', 54.00, null),
  ('Mateo Kovačić',        'Manchester City', 'Midfielder', 44.00, null),
  ('Nico González',        'Manchester City', 'Midfielder', 38.00, null),
  ('Matheus Nunes',        'Manchester City', 'Midfielder', 40.00, null),
  ('Nico O''Reilly',       'Manchester City', 'Midfielder', 22.00, null),

  -- Forwards (Erling Haaland already exists)
  ('Omar Marmoush',        'Manchester City', 'Forward', 60.00, null),
  ('Jérémy Doku',          'Manchester City', 'Forward', 56.00, null),
  ('Savinho',              'Manchester City', 'Forward', 50.00, null),
  ('Antoine Semenyo',      'Manchester City', 'Forward', 44.00, null)

on conflict do nothing;

-- Add matchday 0 price history for new players
insert into price_history (player_id, price, matchday)
select id, current_price, 0
from players
where club = 'Manchester City'
  and name not in ('Ederson', 'Ruben Dias', 'Erling Haaland', 'Kevin De Bruyne', 'Phil Foden')
on conflict do nothing;
