# RAONAI v11.0 스마트 캠핑 플랜 정밀 감사 표준 SOP 템플릿

본 문서는 세션 간 데이터 정합성 혼선을 방지하고, 모든 AI 어시스턴트가 사용자에게 일관된 감사 결과를 보고하기 위한 **표준 점검 가이드**입니다.

---

## 🛡️ 핵심 점검 원칙 (Core Principles)

> [!IMPORTANT]
> **실질적 작동 중심 (No Workarounds)**:
> 모든 점검은 **주간 배치(Weekly Master Sync)**와 **D-3 캐싱(1부/2부)** 파이프라인이 실제 원본 코드대로 원활하게 작동하는지 확인하는 것에 핵심을 둡니다. 데이터 수집이 어렵거나 오류가 발생한다고 해서 임의로 데이터를 수동 주입하거나 **상황에 따른 우회 방법(Workaround)을 선택하지 마십시오.** 원인을 파악하여 시스템 자체를 복구하는 것이 본 SOP의 철저한 준수 방향입니다.

---

## 📅 1. 주간 배치 (Weekly Master Sync) 점검

**목적**: 전국 규모의 정적 데이터(식당, 마트, 명소)가 각 API 출처별로 누락 없이 `master_places`에 적재되었는지 확인.

### API별 지표 대조 (Static Data)
| 카테고리 | API 출처 (api_source) | Fetch 성공 | Inserted | Updated | 비고 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **식당** | `SMBA_BAEK` (백년가게) | | | | |
| | `MOIS_GOOD` (모범음식점) | | | | |
| | `SAFE_REST` (안심식당) | | | | |
| **마트** | `LOCALDATA_MART_SSM` | | | | |
| | `LOCALDATA_MART_LARGE` | | | | |
| | `LOCALDATA_MART_SUPER` | | | | |
| **명소** | `TOUR_SPOT` (관광공사) | | | | |

---

## 🎯 2. D-3 캐싱 1부 (Cluster & Raw Extraction) 점검

**목적**: 사용자의 예약 지역을 타겟팅하여 동적 데이터(병원, 주유소, 축제)가 최신 API 원천에서 수집되었는지 확인.

### API별 지표 대조 (Dynamic Data)
| 카테고리 | API 출처 (api_source) | 수집 목표량 | 실제 수집량 | 상태 |
| :--- | :--- | :---: | :---: | :--- |
| **병원** | `NMC_HOSPITAL` (응급실) | | | |
| | `KAKAO_HP8` (종합병원) | | | |
| **주유소** | `OPINET` (실내등유) | | | |
| **축제** | `TOUR_FESTIVAL` | | | |

### 클러스터링 지표 (Template)
- **타겟 예약 수**: (예: 3/31 타겟 예약 건수)
- **지리적 클러스터 수**: (예: 예산군 연합 1개 노드)
- **마스터 DB 원시 로드(Raw Pool)**: 권역 내 텍스트 검색(`address LIKE '%OO%'`) 결과 수.

---

## 🔍 3. D-3 캐싱 2부 (Quota & Verification) 점밀 점검

**목적**: 1차 선별(Quota 300)과 카카오 정밀 검증을 거쳐 최종 `smart_plan_facts`에 고품질 데이터가 적재되었는지 확인.

### 점검 지표 (Template)
| 카테고리 | 마스터DB(Raw) | 1차선별(RPC) | 쿼터적용 후 | 카카오검증 | 최종적재 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| RESTAURANT | | | | | |
| SPOT | | | | | |
| MART | | | | | |
| HOSPITAL | | | | | |
| GAS_STATION | | | | | |
| FESTIVAL | | | | | |

> [!WARNING]
> **RPC 호출 주의**: 파라미터명은 반드시 **`p_category`**를 사용하며, 좌표/반경 데이터는 **`NUMERIC`** 타입으로 전달해야 에러를 방지할 수 있습니다. (Postgres Overloading 방어)

---

## 📄 4. 보고서 양식 (Standard Report)

모든 리스트 출력 요청 시 반드시 다음 경로에 **마스터 DB 1차 선별 완료본(Quota 300)**을 포함한 전수 리스트를 생성합니다.
*   **파일 경로**: `C:\Users\USER\Desktop\RAON.I\spot_final_audit.md`
*   **포함 항목**: [번호], [카테고리], [이름], [신뢰점수], [주소], [거리(m)]

---
*Last Updated: 2026-03-28 (v11.0 Precision Audit SOP)*
