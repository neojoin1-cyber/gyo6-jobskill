-- 운영 자동검증과 관리자 정리 작업은 service_role로만 수행한다.
-- 초기 스키마의 포괄 grant가 운영 이력에서 유실되어도 개인 자료를
-- 일반 사용자에게 넓히지 않도록 필요한 두 테이블에만 권한을 복구한다.
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.user_device_state to service_role;
