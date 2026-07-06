alter table player_scouts
  add column if not exists focus_id uuid references scouting_focuses(id) on delete set null;
