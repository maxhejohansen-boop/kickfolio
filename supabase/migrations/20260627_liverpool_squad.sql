-- Add Liverpool squad (Alisson Becker, Virgil van Dijk, Mohamed Salah, Trent Alexander-Arnold already exist)
insert into players (name, club, position, current_price, image_url) values

  -- Goalkeepers (Alisson already exists)
  ('Giorgi Mamardashvili', 'Liverpool', 'Goalkeeper', 42.00, null),
  ('Freddie Woodman',      'Liverpool', 'Goalkeeper', 14.00, null),

  -- Defenders (Virgil van Dijk already exists)
  ('Joe Gomez',            'Liverpool', 'Defender', 32.00, null),
  ('Ibrahima Konaté',      'Liverpool', 'Defender', 50.00, null),
  ('Miloš Kerkez',         'Liverpool', 'Defender', 38.00, null),
  ('Conor Bradley',        'Liverpool', 'Defender', 40.00, null),
  ('Giovanni Leoni',       'Liverpool', 'Defender', 22.00, null),
  ('Andy Robertson',       'Liverpool', 'Defender', 44.00, null),
  ('Jeremie Frimpong',     'Liverpool', 'Defender', 48.00, null),

  -- Midfielders
  ('Florian Wirtz',        'Liverpool', 'Midfielder', 78.00, null),
  ('Alexis Mac Allister',  'Liverpool', 'Midfielder', 56.00, null),
  ('Dominik Szoboszlai',   'Liverpool', 'Midfielder', 54.00, null),
  ('Ryan Gravenberch',     'Liverpool', 'Midfielder', 52.00, null),
  ('Wataru Endo',          'Liverpool', 'Midfielder', 38.00, null),
  ('Curtis Jones',         'Liverpool', 'Midfielder', 36.00, null),

  -- Forwards (Mohamed Salah already exists)
  ('Alexander Isak',       'Liverpool', 'Forward', 72.00, null),
  ('Cody Gakpo',           'Liverpool', 'Forward', 48.00, null),
  ('Hugo Ekitiké',         'Liverpool', 'Forward', 44.00, null),
  ('Federico Chiesa',      'Liverpool', 'Forward', 40.00, null)

on conflict do nothing;

-- Add matchday 0 price history for new players
insert into price_history (player_id, price, matchday)
select id, current_price, 0
from players
where club = 'Liverpool'
  and name not in ('Alisson Becker', 'Virgil van Dijk', 'Mohamed Salah', 'Trent Alexander-Arnold')
on conflict do nothing;
