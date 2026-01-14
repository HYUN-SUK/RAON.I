# RAON.I Development Session Templates

이 문서는 RAON.I 프로젝트의 효율적인 개발 사이클을 위한 표준 **세션 시작** 및 **마무리** 템플릿입니다.
AI 어시스턴트나 개발자가 작업을 시작/종료할 때 이 형식을 따르십시오.

---

## 🟢 1. 세션 시작 템플릿 (New Session Template)
**목적:** 작업의 맥락을 빠르게 파악하고, 목표를 명확히 설정합니다.

```markdown
# 🚀 New Session: [작업 주제/목표]

## 1. Context (상황 파악)
- **Current Version**: [예: v4.1]
- **Last Status**: [예: 배포 완료 및 PWA 버튼 구현 됨]
- **Active Branch**: `main` (Default)
- **Deployment**: https://raon-i.vercel.app

## 2. Objectives (금일 목표)
- [ ] **Goal 1**: [예: 예약 결제 PG 연동]
- [ ] **Goal 2**: [예: 카카오맵 SDK 적용]
- [ ] **Goal 3**: [예: 버그 수정 - 로그인 풀림 현상]

## 3. Reference (참고 자료)
- **Roadmap**: `RAON_MASTER_ROADMAP_v3.md` (Check Phase)
- **Handoff**: `handoff.md` (Check Last Session Notes)
- **Task List**: `task.md` (Update status)

## 4. Risks & Constraints (주의사항)
- [예: 프로덕션 배포 중이므로 DB 스키마 변경 시 주의]
- [예: Vercel Free Tier 사용량 체크 필요]
```

---

## 🔴 2. 세션 마무리 템플릿 (Session Wrap-up Template)
**목적:** 작업 내용을 기록하고, 다음 작업을 위한 인수인계를 명확히 합니다. (`handoff.md`로 저장)

```markdown
# Session Handoff: [작업 주제]

**Date:** YYYY-MM-DD
**Author:** [작성자]
**Status:** ✅ Completed / 🚧 In Progress / ⚠️ Blocked

---

## 📝 Executive Summary
[오늘 수행한 작업의 핵심 요약 (3줄 이내)]
예: "결제 모듈 연동을 완료하고 테스트 결제까지 성공했습니다. 다만 모바일에서 간헐적 끊김 현상이 있어 추가 디버깅이 필요합니다."

---

## ✅ Completed Tasks (완료 내역)
### 1. [주요 작업 1]
- **변경 사항**: [파일/로직 변경 내용]
- **결과**: [기능 작동 여부 확인]
- **비고**: [특이사항]

### 2. [주요 작업 2]
- **변경 사항**: ...

---

## 🏗️ Technical Decisions (기술적 의사결정)
- **Decision 1**: [예: 라이브러리 A 대신 B를 선택함]
- **Reason**: [이유: 용량이 더 가볍고 우리 프로젝트 스택과 호환성이 좋음]

---

## 🔮 Next Steps (다음 단계)
1. **High Priority**: [다음 세션에서 바로 해야 할 일]
2. **Backlog**: [나중에 해도 되는 일]

---

## ⚠️ Known Caveats (알려진 문제/주의사항)
- [예: 현재 iOS 15 이하에서 레이아웃 깨짐 현상 있음]
- [예: API 키 만료일이 다가옴 (D-5)]
```
