-- Seed 20 Premier League players
-- Starting prices derived from 2024/25 Premier League season stats (API-Football)
insert into players (name, club, position, current_price, image_url) values
  -- Forwards
  ('Mohamed Salah', 'Liverpool', 'Forward', 95.00, 'https://media.api-sports.io/football/players/306.png'),
  ('Erling Haaland', 'Manchester City', 'Forward', 85.00, 'https://media.api-sports.io/football/players/1100.png'),
  ('Cole Palmer', 'Chelsea', 'Forward', 82.00, 'https://media.api-sports.io/football/players/152982.png'),
  ('Bukayo Saka', 'Arsenal', 'Forward', 68.00, 'https://media.api-sports.io/football/players/1460.png'),
  ('Son Heung-min', 'Tottenham', 'Forward', 64.00, 'https://media.api-sports.io/football/players/186.png'),

  -- Midfielders
  ('Kevin De Bruyne', 'Manchester City', 'Midfielder', 62.00, 'https://media.api-sports.io/football/players/629.png'),
  ('Martin Ødegaard', 'Arsenal', 'Midfielder', 60.00, 'https://media.api-sports.io/football/players/37127.png'),
  ('Bruno Fernandes', 'Manchester United', 'Midfielder', 74.00, 'https://media.api-sports.io/football/players/1485.png'),
  ('Declan Rice', 'Arsenal', 'Midfielder', 64.00, 'https://media.api-sports.io/football/players/2937.png'),
  ('Phil Foden', 'Manchester City', 'Midfielder', 62.00, 'https://media.api-sports.io/football/players/631.png'),
  ('Trent Alexander-Arnold', 'Liverpool', 'Midfielder', 60.00, 'https://media.api-sports.io/football/players/283.png'),

  -- Defenders
  ('Virgil van Dijk', 'Liverpool', 'Defender', 56.00, 'https://media.api-sports.io/football/players/290.png'),
  ('William Saliba', 'Arsenal', 'Defender', 50.00, 'https://media.api-sports.io/football/players/22090.png'),
  ('Ruben Dias', 'Manchester City', 'Defender', 46.00, 'https://media.api-sports.io/football/players/567.png'),
  ('Reece James', 'Chelsea', 'Defender', 38.00, 'https://media.api-sports.io/football/players/19545.png'),
  ('Pedro Porro', 'Tottenham', 'Defender', 52.00, 'https://media.api-sports.io/football/players/47519.png'),

  -- Goalkeepers
  ('Alisson Becker', 'Liverpool', 'Goalkeeper', 54.00, 'https://media.api-sports.io/football/players/280.png'),
  ('Ederson', 'Manchester City', 'Goalkeeper', 48.00, 'https://media.api-sports.io/football/players/617.png'),
  ('David Raya', 'Arsenal', 'Goalkeeper', 58.00, 'https://media.api-sports.io/football/players/19465.png'),
  ('Robert Sánchez', 'Chelsea', 'Goalkeeper', 54.00, 'https://media.api-sports.io/football/players/18959.png')
on conflict do nothing;

-- Insert initial price history (matchday 0) for all players
insert into price_history (player_id, price, matchday)
select id, current_price, 0 from players
on conflict do nothing;
