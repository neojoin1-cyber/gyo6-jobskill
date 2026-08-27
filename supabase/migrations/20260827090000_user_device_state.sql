-- 공용 PC·휴대폰 간 개인 학습 상태를 저빈도 묶음 동기화한다.
-- 키 단위 타임스탬프를 사용해 서로 다른 과목을 수정한 두 기기가 전체 상태를
-- 덮어쓰지 않게 한다. 클라이언트는 5분/로그아웃/명시적 버튼에서만 호출한다.

create table if not exists public.user_device_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null check (length(storage_key) between 1 and 180),
  value_text text,
  deleted boolean not null default false,
  client_updated_at timestamptz not null,
  source_device_id text,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, storage_key)
);

alter table public.user_device_state enable row level security;
drop policy if exists user_device_state_self on public.user_device_state;
create policy user_device_state_self on public.user_device_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_device_state to authenticated;

create index if not exists user_device_state_recent
  on public.user_device_state(user_id, client_updated_at desc);

create or replace function public.rpc_sync_user_device_state(
  p_changes jsonb default '[]'::jsonb,
  p_since timestamptz default null,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  now_at timestamptz := clock_timestamp();
  incoming_at timestamptz;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if public.is_public_trial_user() then
    return jsonb_build_object('synced_at', now_at, 'items', '[]'::jsonb);
  end if;
  if jsonb_typeof(coalesce(p_changes, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_changes, '[]'::jsonb)) > 250 then
    raise exception '동기화 묶음이 올바르지 않습니다.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    incoming_at := least(nullif(item->>'updated_at', '')::timestamptz, now_at + interval '5 minutes');
    if length(coalesce(item->>'key', '')) not between 1 and 180
       or length(coalesce(item->>'value', '')) > 100000
       or incoming_at is null then
      continue;
    end if;
    insert into public.user_device_state
      (user_id, storage_key, value_text, deleted, client_updated_at, source_device_id, server_updated_at)
    values
      (auth.uid(), item->>'key', item->>'value', coalesce((item->>'deleted')::boolean, false),
       incoming_at, left(coalesce(p_device_id, ''), 100), now_at)
    on conflict (user_id, storage_key) do update set
      value_text = excluded.value_text,
      deleted = excluded.deleted,
      client_updated_at = excluded.client_updated_at,
      source_device_id = excluded.source_device_id,
      server_updated_at = now_at
    where excluded.client_updated_at > user_device_state.client_updated_at;
  end loop;

  return jsonb_build_object(
    'synced_at', now_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', storage_key, 'value', value_text, 'deleted', deleted,
        'updated_at', client_updated_at
      ) order by client_updated_at)
      from public.user_device_state
      where user_id = auth.uid()
        and (p_since is null or client_updated_at > p_since)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.rpc_sync_user_device_state(jsonb, timestamptz, text) from public;
grant execute on function public.rpc_sync_user_device_state(jsonb, timestamptz, text) to authenticated;

-- 이 마이그레이션은 공개 체험 보호 트리거 생성 이후 추가되므로 직접 부착한다.
drop trigger if exists public_trial_read_only on public.user_device_state;
create trigger public_trial_read_only
  before insert or update or delete on public.user_device_state
  for each statement execute function public.reject_public_trial_write();
