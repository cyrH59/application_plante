create extension if not exists "pgcrypto";

create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mon jardin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  name text not null,
  category text not null default 'interieur',
  profile text not null default 'standard',
  placement text not null default 'inside',
  exposure text not null default 'partial',
  birth_date date,
  health_score int not null default 7 check (health_score between 1 and 10),
  status text not null default 'active' check (status in ('active', 'cemetery')),
  cemetery_date date,
  cemetery_reason text,
  notes text,
  water_level numeric not null default 100 check (water_level between 0 and 100),
  last_watered_at timestamptz not null default now(),
  last_fertilized_at timestamptz not null default now(),
  fertilization jsonb not null default '{"mode":"auto","manualSchedule":{}}'::jsonb,
  watering_override jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plant_photos (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  is_primary boolean not null default false,
  taken_at date not null default current_date,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.plant_actions (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  type text not null check (type in ('watering', 'fertilization', 'photo', 'health', 'cemetery', 'note', 'repotting', 'pruning')),
  value jsonb not null default '{}'::jsonb,
  happened_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  source text not null default 'open-meteo',
  payload jsonb not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists plants_garden_status_idx on public.plants(garden_id, status);
create index if not exists plant_photos_plant_idx on public.plant_photos(plant_id, created_at desc);
create index if not exists plant_actions_plant_idx on public.plant_actions(plant_id, happened_at desc);
create index if not exists weather_snapshots_garden_idx on public.weather_snapshots(garden_id, observed_at desc);

alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.plants enable row level security;
alter table public.plant_photos enable row level security;
alter table public.plant_actions enable row level security;
alter table public.weather_snapshots enable row level security;

create or replace function public.is_garden_member(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.garden_members gm
    where gm.garden_id = target_garden_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.create_default_garden()
returns public.gardens
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_garden public.gardens;
  new_garden public.gardens;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select g.*
  into existing_garden
  from public.gardens g
  join public.garden_members gm on gm.garden_id = g.id
  where gm.user_id = auth.uid()
  order by g.created_at asc
  limit 1;

  if found then
    return existing_garden;
  end if;

  insert into public.gardens (owner_id, name)
  values (auth.uid(), 'Mon jardin')
  returning * into new_garden;

  insert into public.garden_members (garden_id, user_id, role)
  values (new_garden.id, auth.uid(), 'owner');

  return new_garden;
end;
$$;

grant execute on function public.create_default_garden() to authenticated;

create policy "garden members can read gardens"
on public.gardens for select
using (public.is_garden_member(id));

create policy "users can create own gardens"
on public.gardens for insert
with check (owner_id = auth.uid());

create policy "owners can update gardens"
on public.gardens for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "members can read memberships"
on public.garden_members for select
using (public.is_garden_member(garden_id));

create policy "owners can add members"
on public.garden_members for insert
with check (
  exists (
    select 1 from public.gardens
    where gardens.id = garden_id
      and gardens.owner_id = auth.uid()
  )
);

create policy "members can read plants"
on public.plants for select
using (public.is_garden_member(garden_id));

create policy "members can create plants"
on public.plants for insert
with check (public.is_garden_member(garden_id));

create policy "members can update plants"
on public.plants for update
using (public.is_garden_member(garden_id))
with check (public.is_garden_member(garden_id));

create policy "members can delete plants"
on public.plants for delete
using (public.is_garden_member(garden_id));

create policy "members can read photos"
on public.plant_photos for select
using (
  exists (
    select 1 from public.plants
    where plants.id = plant_photos.plant_id
      and public.is_garden_member(plants.garden_id)
  )
);

create policy "members can manage photos"
on public.plant_photos for all
using (
  exists (
    select 1 from public.plants
    where plants.id = plant_photos.plant_id
      and public.is_garden_member(plants.garden_id)
  )
)
with check (
  exists (
    select 1 from public.plants
    where plants.id = plant_photos.plant_id
      and public.is_garden_member(plants.garden_id)
  )
);

create policy "members can read actions"
on public.plant_actions for select
using (
  exists (
    select 1 from public.plants
    where plants.id = plant_actions.plant_id
      and public.is_garden_member(plants.garden_id)
  )
);

create policy "members can create actions"
on public.plant_actions for insert
with check (
  exists (
    select 1 from public.plants
    where plants.id = plant_actions.plant_id
      and public.is_garden_member(plants.garden_id)
  )
);

create policy "members can read weather"
on public.weather_snapshots for select
using (public.is_garden_member(garden_id));

create policy "members can create weather"
on public.weather_snapshots for insert
with check (public.is_garden_member(garden_id));

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

create policy "members can read plant photo files"
on storage.objects for select
using (
  bucket_id = 'plant-photos'
  and exists (
    select 1
    from public.plant_photos pp
    join public.plants p on p.id = pp.plant_id
    where pp.storage_path = storage.objects.name
      and public.is_garden_member(p.garden_id)
  )
);

create policy "authenticated users can upload plant photo files"
on storage.objects for insert
with check (
  bucket_id = 'plant-photos'
  and auth.role() = 'authenticated'
);
