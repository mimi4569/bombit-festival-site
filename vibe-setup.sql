-- 바이브코딩 학생 작품 전시 사이트용 Supabase 테이블 설정
-- 실행 방법: Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣고 Run
-- 각 단계가 독립적으로 실행되어 일부 실패해도 다음 단계가 진행됩니다.

-- ============ 1단계: 작품 테이블 생성 ============
create table if not exists public.works (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  creator_name    text not null,
  description     text,
  site_url        text,
  github_url      text,
  exhibition_year int  not null,
  grade           text not null,
  category        text not null,
  thumbnail_url   text,
  created_at      timestamptz not null default now()
);

-- ============ 2단계: 인덱스 생성 ============
create index if not exists works_year_idx   on public.works (exhibition_year);
create index if not exists works_grade_idx   on public.works (grade);
create index if not exists works_created_idx on public.works (created_at desc);

-- ============ 3단계: 평가 테이블 생성 ============
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  work_id       uuid not null references public.works(id) on delete cascade,
  reviewer_name text not null,
  rating        int  not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);

create index if not exists reviews_work_idx on public.reviews (work_id, created_at desc);

-- ============ 4단계: RLS(행 보안) 활성화 ============
alter table public.works   enable row level security;
alter table public.reviews enable row level security;

-- ============ 5단계: RLS 정책 (기존 정책이 있으면 먼저 삭제 후 생성) ============
drop policy if exists "works_select_all"   on public.works;
drop policy if exists "works_insert_all"   on public.works;
drop policy if exists "reviews_select_all" on public.reviews;
drop policy if exists "reviews_insert_all" on public.reviews;

create policy "works_select_all"   on public.works   for select using (true);
create policy "works_insert_all"   on public.works   for insert with check (true);
create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_all" on public.reviews for insert with check (true);

-- ============ 6단계: 스키마 캐시 새로고침 (중요!) ============
-- 테이블을 만든 직후 REST API가 인식하도록 캐시를 갱신합니다.
NOTIFY pgrst, 'reload schema';

-- ============ 7단계: Realtime 활성화 (선택사항) ============
-- 이 단계가 실패해도 작품 등록/조회에는 영향 없습니다.
-- 대시보드 → Database → Replication 에서 수동으로 활성화할 수도 있습니다.
DO $$
BEGIN
  BEGIN
    alter publication supabase_realtime add table public.works;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    alter publication supabase_realtime add table public.reviews;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
