-- [DEV ONLY] Fix Admin Access RLS
-- 이 정책은 개발 및 테스트 단계에서 관리자(모든 인증된 사용자)가 콘텐츠를 검수할 수 있도록 권한을 허용합니다.
-- 운영 배포 시에는 반드시 'admin' role을 가진 사용자만 접근하도록 정책을 수정해야 합니다.

-- 1. creator_contents: 모든 인증된 사용자가 모든 상태의 콘텐츠를 조회/수정 가능하게 함
create policy "Enable all access for authenticated users (Dev)"
on creator_contents
for all
to authenticated
using (true)
with check (true);

-- 2. creator_episodes: 모든 인증된 사용자가 모든 에피소드를 조회/수정 가능하게 함
create policy "Enable all access for authenticated users (Dev)"
on creator_episodes
for all
to authenticated
using (true)
with check (true);
