-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Players table
create table if not exists players (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  club text not null,
  position text not null check (position in ('Forward', 'Midfielder', 'Defender', 'Goalkeeper')),
  current_price numeric(10,2) not null default 10.00,
  image_url text,
  created_at timestamptz default now()
);

-- Price history table
create table if not exists price_history (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references players(id) on delete cascade,
  price numeric(10,2) not null,
  matchday integer not null,
  created_at timestamptz default now()
);

-- Users table (extends Supabase auth.users)
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  balance numeric(12,2) not null default 100000.00,
  created_at timestamptz default now()
);

-- Portfolios table
create table if not exists portfolios (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  shares integer not null default 0 check (shares >= 0),
  avg_buy_price numeric(10,2) not null default 0.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, player_id)
);

-- Matchday stats table
create table if not exists matchday_stats (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references players(id) on delete cascade,
  matchday integer not null,
  goals integer default 0,
  assists integer default 0,
  rating numeric(3,1) default 6.0,
  minutes integer default 0,
  saves integer default 0,
  clean_sheet boolean default false,
  price_change_pct numeric(5,2) default 0,
  created_at timestamptz default now()
);

-- Current matchday tracker
create table if not exists matchday_tracker (
  id integer primary key default 1 check (id = 1),
  current_matchday integer not null default 0
);

insert into matchday_tracker (id, current_matchday) values (1, 0) on conflict do nothing;

-- Limit orders table
create table if not exists limit_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  order_type text not null check (order_type in ('buy', 'sell')),
  shares integer not null check (shares > 0),
  target_price numeric(10,2) not null check (target_price > 0),
  status text not null default 'pending' check (status in ('pending', 'filled', 'cancelled')),
  created_at timestamptz default now(),
  filled_at timestamptz
);

-- Indexes
create index if not exists idx_price_history_player_id on price_history(player_id);
create index if not exists idx_price_history_matchday on price_history(matchday);
create index if not exists idx_portfolios_user_id on portfolios(user_id);
create index if not exists idx_matchday_stats_player_id on matchday_stats(player_id);
create index if not exists idx_limit_orders_user_id on limit_orders(user_id);
create index if not exists idx_limit_orders_player_id on limit_orders(player_id);
create index if not exists idx_limit_orders_status on limit_orders(status);

-- RLS Policies
alter table players enable row level security;
alter table price_history enable row level security;
alter table users enable row level security;
alter table portfolios enable row level security;
alter table matchday_stats enable row level security;
alter table matchday_tracker enable row level security;

-- Players: anyone can read
create policy "players_public_read" on players for select using (true);

-- Price history: anyone can read
create policy "price_history_public_read" on price_history for select using (true);

-- Users: users can read all (for leaderboard), but only update own
create policy "users_public_read" on users for select using (true);
create policy "users_own_insert" on users for insert with check (auth.uid() = id);
create policy "users_own_update" on users for update using (auth.uid() = id);

-- Portfolios: users can only access their own
create policy "portfolios_own" on portfolios for all using (auth.uid() = user_id);

-- Limit orders: users can only access their own
alter table limit_orders enable row level security;
create policy "limit_orders_own" on limit_orders for all using (auth.uid() = user_id);

-- Matchday stats: anyone can read
create policy "matchday_stats_public_read" on matchday_stats for select using (true);

-- Matchday tracker: anyone can read
create policy "matchday_tracker_public_read" on matchday_tracker for select using (true);

-- Function to auto-create user record on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, balance)
  values (new.id, new.email, 100000.00)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
