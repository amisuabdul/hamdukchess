
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  country text default 'NG',
  rating int not null default 1200,
  games_played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles readable by all" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  final_name text;
  counter int := 0;
begin
  base_name := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'player'
  );
  base_name := regexp_replace(lower(base_name), '[^a-z0-9_]', '', 'g');
  if length(base_name) < 3 then base_name := 'player' || substr(new.id::text, 1, 6); end if;
  final_name := base_name;
  while exists (select 1 from public.profiles where username = final_name) loop
    counter := counter + 1;
    final_name := base_name || counter::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, final_name);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Matchmaking queue
create table public.matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  time_control text not null,
  rating int not null,
  joined_at timestamptz not null default now()
);
alter table public.matchmaking_queue enable row level security;
create policy "Queue readable by authenticated" on public.matchmaking_queue for select to authenticated using (true);
create policy "Users manage own queue entry" on public.matchmaking_queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.matchmaking_queue (time_control, rating, joined_at);

-- Games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references public.profiles(id),
  black_id uuid not null references public.profiles(id),
  time_control text not null,
  status text not null default 'active', -- active | completed | aborted
  result text, -- white | black | draw
  end_reason text, -- checkmate | resignation | stalemate | draw | abandoned
  winner_id uuid references public.profiles(id),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  ply int not null default 0,
  last_move_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.games enable row level security;
create policy "Games readable by all" on public.games for select using (true);
create policy "Participants update games" on public.games for update to authenticated using (auth.uid() = white_id or auth.uid() = black_id);

create index on public.games (status, created_at desc);
create index on public.games (white_id);
create index on public.games (black_id);

-- Moves
create table public.moves (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  ply int not null,
  uci text not null,
  san text not null,
  fen text not null,
  by_user uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (game_id, ply)
);
alter table public.moves enable row level security;
create policy "Moves readable by all" on public.moves for select using (true);
create policy "Players insert own moves" on public.moves for insert to authenticated with check (auth.uid() = by_user);

create index on public.moves (game_id, ply);

-- Realtime
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.moves;
alter publication supabase_realtime add table public.matchmaking_queue;

-- Elo update helper
create or replace function public.apply_elo(p_white uuid, p_black uuid, p_result text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rw int; rb int;
  ew float; eb float;
  sw float; sb float;
  k int := 24;
  new_rw int; new_rb int;
begin
  select rating into rw from public.profiles where id = p_white for update;
  select rating into rb from public.profiles where id = p_black for update;
  ew := 1.0 / (1.0 + power(10, (rb - rw) / 400.0));
  eb := 1.0 - ew;
  if p_result = 'white' then sw := 1.0; sb := 0.0;
  elsif p_result = 'black' then sw := 0.0; sb := 1.0;
  else sw := 0.5; sb := 0.5; end if;
  new_rw := round(rw + k * (sw - ew));
  new_rb := round(rb + k * (sb - eb));
  update public.profiles set
    rating = new_rw,
    games_played = games_played + 1,
    wins = wins + (case when sw = 1 then 1 else 0 end),
    losses = losses + (case when sw = 0 then 1 else 0 end),
    draws = draws + (case when sw = 0.5 then 1 else 0 end)
  where id = p_white;
  update public.profiles set
    rating = new_rb,
    games_played = games_played + 1,
    wins = wins + (case when sb = 1 then 1 else 0 end),
    losses = losses + (case when sb = 0 then 1 else 0 end),
    draws = draws + (case when sb = 0.5 then 1 else 0 end)
  where id = p_black;
end;
$$;

-- Matchmaking RPC: atomically pair or queue
create or replace function public.find_or_join_match(p_time_control text, p_rating_window int default 200)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_rating int;
  opponent uuid;
  new_game_id uuid;
  white uuid; black uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  -- Cancel any existing active game? Skip.
  select rating into my_rating from public.profiles where id = me;
  -- Find an opponent already in queue (not self) within rating window, oldest first.
  select user_id into opponent
  from public.matchmaking_queue
  where time_control = p_time_control
    and user_id <> me
    and abs(rating - my_rating) <= p_rating_window
  order by joined_at asc
  for update skip locked
  limit 1;
  if opponent is null then
    -- Join queue
    insert into public.matchmaking_queue (user_id, time_control, rating)
    values (me, p_time_control, my_rating)
    on conflict (user_id) do update set time_control = excluded.time_control, rating = excluded.rating, joined_at = now();
    return null;
  end if;
  -- Pair: randomize colors
  if random() < 0.5 then white := me; black := opponent;
  else white := opponent; black := me; end if;
  insert into public.games (white_id, black_id, time_control)
  values (white, black, p_time_control)
  returning id into new_game_id;
  delete from public.matchmaking_queue where user_id in (me, opponent);
  return new_game_id;
end;
$$;

grant execute on function public.find_or_join_match(text, int) to authenticated;
grant execute on function public.apply_elo(uuid, uuid, text) to authenticated;
