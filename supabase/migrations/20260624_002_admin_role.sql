-- =============================================================================
-- GYO6 — admin role 추가
-- =============================================================================

-- 1. user_role enum에 admin 추가
alter type user_role add value if not exists 'admin';

-- 2. profiles RLS: admin은 모든 데이터 조회 가능
create policy "admin_read_all_profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin_update_profiles" on profiles
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 3. schools RLS: admin이 insert/update/delete 가능
create policy "admin_all_schools" on schools
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 4. admin은 모든 테이블 읽기 가능
create policy "admin_read_all_missions" on missions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin_read_all_submissions" on submissions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin_read_all_classes" on classes
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
