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
