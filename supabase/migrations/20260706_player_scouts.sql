create table if not exists player_scouts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  player_id           uuid not null references players(id)   on delete cascade,
  scout_type          text not null check (scout_type in ('instant', 'sent')),
  reveals_at_matchday int,
  created_at          timestamptz default now(),
  unique(user_id, player_id)
);

alter table player_scouts enable row level security;

create policy "Users manage own scouts"
  on player_scouts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
