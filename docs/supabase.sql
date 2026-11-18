-- Supabase > SQL Editor ga yopishtirib "Run" bosing (bir marta).
create table if not exists public.bases (
  code text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Jadvalga to'g'ridan-to'g'ri kirish yopiq (qoida yo'q = hech kim ko'ra olmaydi).
alter table public.bases enable row level security;

create or replace function public.get_base(p_code text)
returns jsonb language sql security definer set search_path = public as $$
  select data from public.bases where code = p_code
$$;

create or replace function public.put_base(p_code text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(p_code) < 8 then raise exception 'code too short'; end if;
  insert into public.bases (code, data, updated_at) values (p_code, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now();
end $$;

grant execute on function public.get_base(text) to anon;
grant execute on function public.put_base(text, jsonb) to anon;
