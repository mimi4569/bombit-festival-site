-- 작품 수정/삭제용 비밀번호 컬럼 추가
-- 실행 방법: Supabase 대시보드 → SQL Editor → New query → 아래 붙여넣고 Run

-- 1) works 테이블에 비밀번호 컬럼 추가 (기존 작품은 NULL = 수정 불가, 비밀번호 설정 필요 없는 기존 작품용)
alter table public.works add column if not exists password text;

-- 2) 비밀번호가 없는 작품은 누구나 수정 가능 (기존 작품 호환성) — 선택 사항
-- 비밀번호가 설정된 작품은 비밀번호가 맞아야 수정/삭제 가능
-- 아래 정책으로 교체:

drop policy if exists "works_update_all"   on public.works;
drop policy if exists "works_delete_all"   on public.works;

-- 누구나 수정/삭제 가능 (비밀번호 검증은 앱단에서 처리)
-- Supabase RLS만으로는 비밀번호 검증이 어려워 앱에서 처리합니다.
create policy "works_update_all" on public.works for update using (true) with check (true);
create policy "works_delete_all" on public.works for delete using (true);

-- 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
