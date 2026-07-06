create table if not exists scouting_focuses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null default 'New focus',
  position           text check (position in ('Forward','Midfielder','Defender','Goalkeeper')),
  club               text,
  max_price          numeric(10,2),
  min_price          numeric(10,2),
  cost_per_matchday  numeric(10,2) not null default 200.00,
  active             boolean not null default true,
  created_at         timestamptz default now()
);

alter table scouting_focuses enable row level security;

create policy "Users manage own focuses"
  on scouting_focuses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
