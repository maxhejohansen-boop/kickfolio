create table if not exists dividend_payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  player_id         uuid not null references players(id)   on delete cascade,
  matchday          int  not null,
  shares            int  not null,
  dividend_per_share numeric(10,4) not null,
  total_payment     numeric(10,2) not null,
  paid_at           timestamptz default now()
);

alter table dividend_payments enable row level security;

create policy "Users read own dividends"
  on dividend_payments for select
  using (auth.uid() = user_id);
