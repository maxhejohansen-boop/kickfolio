-- Seed 20 Premier League players
insert into players (name, club, position, current_price, image_url) values
  -- Forwards
  ('Mohamed Salah', 'Liverpool', 'Forward', 85.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p118748.png'),
  ('Erling Haaland', 'Manchester City', 'Forward', 95.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p223094.png'),
  ('Cole Palmer', 'Chelsea', 'Forward', 72.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p244851.png'),
  ('Bukayo Saka', 'Arsenal', 'Forward', 78.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p223340.png'),
  ('Son Heung-min', 'Tottenham', 'Forward', 65.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p85971.png'),

  -- Midfielders
  ('Kevin De Bruyne', 'Manchester City', 'Midfielder', 82.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p61366.png'),
  ('Martin Ødegaard', 'Arsenal', 'Midfielder', 70.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p184029.png'),
  ('Bruno Fernandes', 'Manchester United', 'Midfielder', 68.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p141746.png'),
  ('Declan Rice', 'Arsenal', 'Midfielder', 66.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p204480.png'),
  ('Phil Foden', 'Manchester City', 'Midfielder', 74.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p209244.png'),
  ('Trent Alexander-Arnold', 'Liverpool', 'Midfielder', 69.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p169187.png'),

  -- Defenders
  ('Virgil van Dijk', 'Liverpool', 'Defender', 60.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p97032.png'),
  ('William Saliba', 'Arsenal', 'Defender', 58.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p223473.png'),
  ('Ruben Dias', 'Manchester City', 'Defender', 57.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p171314.png'),
  ('Reece James', 'Chelsea', 'Defender', 52.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p210951.png'),
  ('Pedro Porro', 'Tottenham', 'Defender', 48.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p214590.png'),

  -- Goalkeepers
  ('Alisson Becker', 'Liverpool', 'Goalkeeper', 55.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p116535.png'),
  ('Ederson', 'Manchester City', 'Goalkeeper', 53.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p121160.png'),
  ('David Raya', 'Arsenal', 'Goalkeeper', 50.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p97268.png'),
  ('Robert Sánchez', 'Chelsea', 'Goalkeeper', 42.00, 'https://resources.premierleague.com/premierleague/photos/players/250x250/p197661.png')
on conflict do nothing;

-- Insert initial price history (matchday 0) for all players
insert into price_history (player_id, price, matchday)
select id, current_price, 0 from players
on conflict do nothing;
