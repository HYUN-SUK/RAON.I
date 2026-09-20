# 📋 [RAON.I] 대규모 예약 오픈 사전 점검 및 시뮬레이션 표준 가이드 (SOP)

본 문서는 매월 20일 오전 9시 대규모 월간 예약 오픈(또는 특정 시즌 오픈)을 앞두고, **실제 운영 데이터 오염 없이(0.00% 무위험)** 실시간 시스템 건전성과 동시성 트랜잭션을 철저히 사전 점검하기 위한 **표준 운영 절차서(SOP, Standard Operating Procedure)**입니다.

---

## 🛡️ 절대 점검 원칙 (Ground Rules)

1. **임의 코딩 및 비즈니스 로직 수정 금지**:
   * 점검 및 시뮬레이션 과정에서 프로덕션 비즈니스 로직을 임의로 변경하지 않습니다.
2. **선택 A (완전 무위험 가상 시간 격리) 엄수**:
   * 오픈 대상 월(예: 11월)의 실제 운영 DB를 테스트 목적으로 임의로 개방하거나 데이터를 삽입하지 않습니다.
   * **2099년 격리 연도**와 **가상 시간(simulatedNow) 주입 방식**을 사용하여 실제 운영 환경에 0.01%의 영향도 주지 않습니다.
3. **사전/사후 2중 자동 클린업**:
   * 시뮬레이션 시작 전 및 종료 후 2099년 테스트 데이터를 100% 완전 삭제합니다.

---

## 🚀 1. 원클릭 점검 및 시뮬레이션 실행 방법

터미널(PowerShell 또는 CMD)에서 아래 명령어를 1회 실행하는 것만으로 **16개 전 실전 엣지 케이스 시뮬레이션 및 실시간 DB 무결성 진단이 약 7~10초 만에 완결**됩니다.

```powershell
cmd.exe /c "node scripts/simulate-master-edge-cases.mjs"
```

> [!TIP]
> Windows PowerShell 환경에서는 보안 정책(`ExecutionPolicy`) 제한이 있을 수 있으므로 항상 `cmd.exe /c` 접두사를 붙여 실행합니다.

---

## 📊 2. 16개 실전 시뮬레이션 케이스 명세 및 판정 기준

시뮬레이션 스크립트(`scripts/simulate-master-edge-cases.mjs`)는 다음 6개 핵심 영역, 총 16개 시나리오를 전수 검증합니다.

| 영역 | 케이스 ID | 시나리오 명칭 | 정상 통과(PASS) 판정 기준 |
| :--- | :---: | :--- | :--- |
| **[영역 A]<br>오픈 시간 경계** | **Case A-1** | 08:59 vs 09:00 경계 동적 계산 | 08:59:59 시점에는 오픈 대상 월(11/03 이후)이 잠겨있고, 09:00:00 도달 시 자동으로 전체 개방되는지 검증 |
| | **Case A-2** | 09:00 전 조기 요청 가드 차단 | 08:59 이전에 API 또는 조작된 요청으로 오픈 대상 날짜 신청 시 `OUT_OF_BOUNDS`로 정상 차단되는지 검증 |
| **[영역 B]<br>모바일/인증 안전망** | **Case B-1** | 0.05초 모바일 더블 탭 동기 락 | 모바일 연타(50ms 간격 2회 터치) 시 1번째만 통과되고 2번째는 0.0001초 만에 클라이언트에서 완전 차단 (서버 호출 1회) |
| | **Case B-2** | 비로그인 DB 외래키 위반 0% 방어 | 세션 만료 또는 비로그인(`userId=null`) 신청 시 PostgreSQL FK 에러 없이 `create_reservation_safe`가 안전 처리 |
| **[영역 C]<br>수백 명 동시 폭격 & 경합** | **Case C-1** | 단일 명당 사이트 100:1 동시 광클 | 100명이 1개 사이트에 동시 신청 시 정확히 1명 당첨 / 99명 정상 거절 (`ALREADY_BOOKED`), DB 적재 1건, 데드락 0건 |
| | **Case C-2** | 10개 사이트 분산 50명 동시 폭격 | 10개 사이트에 트래픽 분산 시 각 사이트당 1명씩 총 10명 당첨, 40명 정상 거절 |
| | **Case C-3** | 에어컨 기기 동시 경합 및 연쇄 배정 | air-1 기기 10명 경합 탈락자가 air-2 기기로 즉시 재시도하여 성공하는지 확인 |
| | **Case C-4** | 에어컨 대표카드(`air-group`) 차단 연동 | 관리자가 air-group 차단 시 개별 기기(air-1~8) 직접 침투 시도가 DB 레벨에서 100% 차단되는지 확인 |
| **[영역 D]<br>가용성 & 취소 즉시 오픈** | **Case D-1** | 환불 대기(`REFUND_PENDING`) 즉시 오픈 | 취소 신청된 사이트는 관리자 송금 대기 상태라도 즉시 타인에게 오픈되어 공실률 0% 달성 여부 확인 |
| | **Case D-2** | 퇴실 당일 입실(Turnover) & 체류 침범 차단 | 11/01~03 예약 시 11/03 입실은 허용되고 11/02 체류일 침범은 차단되는지 확인 |
| | **Case D-3** | 주말 1박/2박 및 End-cap 잔여석 허용 | 토요일 공실 시 금요일 1박 차단, 토요일 점유 시 금요일 1박 잔여석 정상 허용 확인 |
| | **Case D-4** | 주말 취소 건 실시간 연동 (1박 즉시 차단) | 토요일 예약자가 취소하는 즉시 단독 1박 방지 규칙이 재작동하여 금요일 1박이 즉시 차단되는지 확인 |
| **[영역 E]<br>트래픽 부하 & 알림** | **Case E-1** | Realtime 500ms 디바운스 부하 절감 | 20회 연속 웹소켓 이벤트 수신 시 500ms 디바운스로 단 1회 렌더링 (화면 멈춤 방지, 부하 95% 절감) |
| | **Case E-2** | 미입금 자동 취소 후 즉시 재예약 환원 | 입금 기한 경과로 취소된 자리가 실시간 빈자리로 환원되어 즉시 타인 재예약 성공 확인 |
| | **Case E-3** | 대량 예약 시 FCM 알림 비동기 격리 | 알림 발송이 백그라운드 비동기로 분리되어 예약 트랜잭션 지연 0ms (30~40ms 이내 완료) 확인 |
| **[영역 F]<br>운영 데이터 무결성** | **Case F-1** | 운영 DB 무오염 및 백지 상태 무결성 | 2099년 잔여 데이터 0건(클린업 완료), 실제 오픈 월 일반 예약 0건(백지 상태), 기존 관리자 차단일 보존 확인 |

---

## 🔍 3. 실시간 운영 DB 상태 단독 점검 명령어 (Read-Only)

시뮬레이션 외에 순수하게 현재 운영 DB 상태만을 즉시 확인하고 싶을 때는 아래의 Node.js 일회성 명령어를 실행합니다.

### 1) 시스템 설정 및 09:00 오픈 규칙 확인
```powershell
node -e "
import('@supabase/supabase-js').then(async ({ createClient }) => {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: config } = await supabase.from('system_config').select('*').eq('id', 1).single();
  const { data: rules } = await supabase.from('open_day_rules').select('*').eq('is_active', true);
  console.log('SYSTEM CONFIG:', config);
  console.log('ACTIVE RULES:', rules);
});
"
```
* **정상 기준**: `maintenance_mode: false`, `reservation_enabled: true`, `automation_config: { triggerDay: 20, monthsToAdd: 3 }`

### 2) 오픈 대상 월(예: 11월) 백지 상태 및 차단일 확인
```powershell
node -e "
import('@supabase/supabase-js').then(async ({ createClient }) => {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { count: resCount } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).gte('check_in_date', '2026-11-01').lte('check_in_date', '2026-11-30');
  const { data: blocks } = await supabase.from('blocked_dates').select('*').lte('start_date', '2026-11-30').gte('end_date', '2026-11-01');
  console.log('11월 일반 예약 건수 (0건이어야 정상):', resCount);
  console.log('11월 관리자 차단일 건수 및 내역:', blocks?.length, blocks?.map(b => ({ site: b.site_id, date: b.start_date + '~' + b.end_date, guest: b.guest_name })));
});
"
```
* **정상 기준**:
  * 일반 예약 건수: **0건 (완전 백지 상태)**
  * 차단일 건수: 기존 관리자 합법적 차단일(10월 연박 퇴실건 및 사전 협의 수동 등록건)만 정상 존재

---

## ⚡ 4. 인프라 및 빌드 무결성 점검

### 1) Supabase Edge Function (`camping-reminder`) 헬스체크
```powershell
node -e "
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/camping-reminder';
fetch(url, {
  headers: { 'Authorization': 'Bearer ' + (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) }
}).then(async res => {
  console.log('Edge Function Status:', res.status, await res.text());
});
"
```
* **정상 기준**: `Status: 200` (`{"success":true,"mode":"dispatch","count":0}`)

### 2) TypeScript 컴파일 무결성 검증
```powershell
cmd.exe /c "npx tsc --noEmit"
```
* **정상 기준**: 에러 0건 (출력 메시지 없이 종료 코드 0)

---

## ⏰ 5. 오픈 당일 타임라인별 운영자 체크리스트 (SOP)

| 시점 | 권장 액션 | 상세 내용 |
| :--- | :--- | :--- |
| **T-30<br>(08:30)** | **종합 점검 및 시뮬레이션** | 본 문서의 원클릭 시뮬레이션 명령어를 실행하여 16/16 전수 통과 확인 |
| **T-10<br>(08:50)** | **사용자 사전 유입 공지** | • **"오픈 10분 전 카카오 사전 로그인 완료"** 안내 (입력 중 세션 이동 및 폼 리셋 방지)<br>• **"09:00 정각 새로고침(F5)"** 안내 (08:55 접속자의 브라우저 달력 즉시 갱신용) |
| **T-00<br>(09:00)** | **정각 자동 오픈 모니터링** | `09:00:00` 도달 시 시스템 규칙에 의해 11월 전체가 사람 개입 없이 자동 개방됨.<br>Supabase 대시보드 또는 Unified Calendar에서 실시간 예약 인입 확인 |
| **T+05<br>(09:05)** | **결제/입금 대기 전이 확인** | 광클 유입된 예약들이 `CONFIRM_PENDING`(입금 대기) 상태로 정상 저장되고 만료 타이머(예: 3시간)가 올바르게 작동하는지 확인 |
| **비상 상황** | **긴급 킬스위치 가동** | 서버 이상 또는 예상치 못한 사태 발생 시 관리자 운영 페이지(`/admin/operations`)에서 **[RESERVATION_STOP]** 버튼 클릭 또는 `system_config`의 `maintenance_mode: true` 전환 |

---

## 💡 6. DB 컬럼 구조 주의사항 (개발/점검자 필독)

* **`blocked_dates` 테이블 컬럼 주의**:
  * 메모 컬럼: `reason`이 아니며 **`memo`**입니다.
  * 유료/결제 여부 컬럼: **`is_paid`** (boolean) 필수.
  * 날짜 검색 시: `date` 컬럼이 없으므로 항상 **`start_date`** 및 **`end_date`**로 기간 검색을 수행해야 합니다.
* **에어컨 대여 구조 (`air-group`)**:
  * 관리자 캘린더에서는 개별 기기(`air-1`~`air-8`) 대신 통합 카드인 **`air-group`**을 차단합니다.
  * DB RPC `create_reservation_safe` 내부에 `OR (p_site_id LIKE 'air-%' AND site_id = 'air-group')` 조건이 내장되어 있어 대표카드 차단 시 개별 기기도 함께 원천 차단됩니다.
