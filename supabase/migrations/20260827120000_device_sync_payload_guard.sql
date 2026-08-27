-- 사용자 작성물은 충분히 담되, 캐시나 손상된 클라이언트가 거대한 JSON을
-- 한 번에 보내 데이터베이스를 점유하지 못하게 동기화 묶음의 상한을 둔다.
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
     or jsonb_array_length(coalesce(p_changes, '[]'::jsonb)) > 250
     or octet_length(coalesce(p_changes, '[]'::jsonb)::text) > 1500000 then
    raise exception '동기화 묶음이 올바르지 않습니다.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    incoming_at := least(nullif(item->>'updated_at', '')::timestamptz, now_at + interval '5 minutes');
    if length(coalesce(item->>'key', '')) not between 1 and 180
       or octet_length(coalesce(item->>'value', '')) > 400000
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
