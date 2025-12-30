# RAON Deletion Strategy Template
> "삭제가 안 되는 문제는 없다. 무언가가 잡고 있을 뿐."

이 문서는 RAON 프로젝트에서 **복잡한 관계를 가진 데이터(미션, 게시물 등)를 삭제할 때 발생하는 문제**를 예방하고 해결하기 위한 표준 가이드입니다.

---

## 1. The "Clean Sweep" Principle (완전 소멸의 원칙)
가장 흔한 실패 원인은 **"외래 키(Foreign Key) 제약 조건"**입니다. 메인 데이터를 지우기 전에, **반드시** 연결된 하위 데이터를 먼저 지워야 합니다.

**[체크리스트]**
- [ ] **보상 내역 (Point History)**: 이 활동으로 얻은 포인트/경험치 내역이 있는가? -> **삭제 대상 1순위**
- [ ] **좋아요/상호작용 (Likes/Interactions)**: 이 활동에 연결된 좋아요, 공유 등의 테이블이 별도로 있는가?
- [ ] **댓글 (Comments)**: 이 활동으로 생성된 댓글이 있는가?

**[해결 패턴: Explicit DELETE RPC]**
DB의 `ON DELETE CASCADE`에만 의존하지 마세요. RPC에서 명시적으로 지우는 것이 가장 안전합니다.

```sql
-- 예시: withdraw_mission RPC 내부
BEGIN
  -- 1. 자식/부속 데이터 먼저 삭제
  DELETE FROM point_history WHERE related_id = p_id;
  DELETE FROM mission_likes WHERE related_id = p_id;
  DELETE FROM comments WHERE post_id = (SELECT relations...);

  -- 2. 본체 삭제
  DELETE FROM main_table WHERE id = p_id;
END;
```

---

## 2. The "Zombie Count" Fix (숫자 동기화)
데이터는 지워졌는데 **UI의 숫자(댓글 수, 좋아요 수)**가 그대로라면?
삭제 시 반드시 **부모 테이블의 카운터**를 감소시켜야 합니다.

**[해결 패턴]**
1.  **RPC/Trigger에서 처리**: 삭제 로직 안에 `UPDATE parent SET count = count - 1` 포함.
2.  **Self-Healing (자동 복구)**: 만약 숫자가 이미 꼬였다면, 실제 `count(*)`로 덮어쓰는 쿼리를 마이그레이션에 포함.

---

## 3. The "Reverse Cascade" (역방향 삭제)
사용자가 **"결과물(예: 댓글)"**만 삭제했을 때, **"원인(예: 미션 참여)"**도 같이 취소되어야 하는가?
이걸 놓치면 "댓글은 없는데 미션은 완료됨" 같은 불일치가 발생합니다.

**[해결 패턴: DB Trigger]**
앱 로직보다 DB 트리거가 확실합니다.
```sql
CREATE TRIGGER on_comment_delete
AFTER DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION handle_mission_withdraw_on_comment_delete();
```

---

## 4. UI Feedback (사라지지 않는 팝업 해결)
브라우저의 `window.confirm`은 모바일 환경이나 비동기 로직에서 자주 씹힙니다.
**무조건 커스텀 Dialog 컴포넌트**를 사용하세요.

**[표준 UX 패턴]**
1.  사용자 클릭 -> UI 다이얼로그 `IsOpen(true)`
2.  "확인" 클릭 -> 다이얼로그 `IsOpen(false)` -> 삭제 API 호출
3.  **Optimistic Update**: API 응답 기다리지 말고 UI 리스트에서 즉시 제거 (`filter` 사용).
4.  실패 시에만 `toast.error` + 리스트 원복(Refetch).

---

## 요약: 삭제 기능 구현 5단계
1.  **Dependency Check**: 무엇이 이 데이터를 잡고 있는가? (`point_history` 등)
2.  **RPC Creation**: `SECURITY DEFINER`로 RLS 우회하여 자식->부모 순서로 `DELETE`.
3.  **Counter Logic**: 삭제 시 `count - 1` 로직 추가.
4.  **Reverse Logic**: 결과물 삭제 시 원본도 취소할지 결정.
5.  **UI Setup**: `window.confirm` 금지. `Dialog` + `Optimistic Update` 적용.
