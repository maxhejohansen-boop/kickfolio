-- Add full Manchester United squad (Bruno Fernandes already exists)
insert into players (name, club, position, current_price, image_url) values

  -- Goalkeepers
  ('Altay Bayindir',    'Manchester United', 'Goalkeeper', 24.00, 'https://media.api-sports.io/football/players/50810.png'),
  ('Tom Heaton',        'Manchester United', 'Goalkeeper', 12.00, null),
  ('Senne Lammens',     'Manchester United', 'Goalkeeper', 14.00, null),

  -- Defenders
  ('Diogo Dalot',       'Manchester United', 'Defender', 42.00, 'https://media.api-sports.io/football/players/2935.png'),
  ('Noussair Mazraoui', 'Manchester United', 'Defender', 38.00, null),
  ('Matthijs de Ligt',  'Manchester United', 'Defender', 44.00, null),
  ('Harry Maguire',     'Manchester United', 'Defender', 28.00, 'https://media.api-sports.io/football/players/19518.png'),
  ('Lisandro Martínez', 'Manchester United', 'Defender', 48.00, null),
  ('Tyrell Malacia',    'Manchester United', 'Defender', 22.00, null),
  ('Patrick Dorgu',     'Manchester United', 'Defender', 35.00, null),
  ('Leny Yoro',         'Manchester United', 'Defender', 42.00, null),
  ('Luke Shaw',         'Manchester United', 'Defender', 30.00, 'https://media.api-sports.io/football/players/765.png'),
  ('Ayden Heaven',      'Manchester United', 'Defender', 16.00, null),

  -- Midfielders (Bruno Fernandes already in DB)
  ('Mason Mount',       'Manchester United', 'Midfielder', 28.00, null),
  ('Casemiro',          'Manchester United', 'Midfielder', 36.00, 'https://media.api-sports.io/football/players/762.png'),
  ('Manuel Ugarte',     'Manchester United', 'Midfielder', 44.00, null),
  ('Kobbie Mainoo',     'Manchester United', 'Midfielder', 52.00, null),

  -- Forwards
  ('Jadon Sancho',      'Manchester United', 'Forward', 44.00, null),
  ('Rasmus Højlund',    'Manchester United', 'Forward', 54.00, null),
  ('Matheus Cunha',     'Manchester United', 'Forward', 62.00, null),
  ('Joshua Zirkzee',    'Manchester United', 'Forward', 42.00, null),
  ('Amad Diallo',       'Manchester United', 'Forward', 56.00, null),
  ('Bryan Mbeumo',      'Manchester United', 'Forward', 64.00, null),
  ('Benjamin Sesko',    'Manchester United', 'Forward', 68.00, null),
  ('Chido Obi',         'Manchester United', 'Forward', 18.00, null)

on conflict do nothing;

-- Add matchday 0 price history for all new players
insert into price_history (player_id, price, matchday)
select id, current_price, 0
from players
where club = 'Manchester United'
  and name != 'Bruno Fernandes'
on conflict do nothing;
