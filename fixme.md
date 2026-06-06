# Lumée Maison — 통합 수정/기능 프롬프트 (fixme 1~21 + Excel)

> 전제: 한 번에 다 작업하되 **그룹 순서대로** 진행. 각 그룹 끝나면 `tsc --noEmit` + dev 확인 + 커밋(그룹명으로). DB 변경은 **SQL 블록 출력**(우리가 Supabase에서 적용, CC가 DB 직접 연결 ❌). UI는 기존 톤(serif heading, charcoal, gold) + 모바일 반응형. 각 항목 끝에 `#번호` = fixme 원본 번호.
> 💡 = Claude 추천(애매한 부분 내가 정함, 틀리면 말해).

---

## 그룹 A — 빠른 버그/UI 수정 (작고 독립적, 먼저)

- **#1** home 페이지 맨 아래(footer)의 **Instagram 링크/아이콘 제거**.
- **#2** user **inbox**의 `← back to my account` 버튼이 작동 안 함 → 고치고, **계정 홈(account)으로** 이동하게. (💡 "home로 바꿔" = account 홈으로 라우팅으로 해석)
- **#3** `admin > orders > 주문상세`에서 **payment method 표시 제거**.
- **#4** `admin > order status`의 **shipped 단계에서 `mark delivered →` 버튼이 두 번** 뜨는 중복 버그 → 하나만.
- **#5** 주문상세의 **`shipped at`** 처리: 아직 배송 전이면 값 대신 **`Pending`** 표시. admin이 status를 **shipped로 바꾸면 `Shipped at` 옆에 작은 빨간 `!` 동그라미**(새 업데이트 표시), **delivered 되면 그 표시 사라지게**. (💡 "방금 배송됨, 아직 미수령" 알림 점으로 해석)
- **#6** `admin > orders > 주문상세`의 **user id를 새 Customer ID(4숫자+4대문자 = `customer_code`)로** 표시 (raw UUID ❌).
- **#7** `admin > users > 유저상세` 분석 기간 토글을 `3m / 1y / all` → **`일 / 주 / 월 / all`** 로 변경.
- **#9** `admin > stock` 목록 **50줄 넘으면 페이지네이션** `< 1 2 [3] 4 … >`.
- **#10** `admin > orders` 목록에서 **행(카드) 전체를 클릭**하면 주문 열리게 (지금은 `SGL #00xxxx` 글자만 클릭 가능).
- **#14** `stock > orders` 탭에서도 **주문 행 클릭 → 주문 열리게**.
- **#17** `stock > stock`의 **reorder hint 제거**.
- **#18** `stock > stock`의 **`edit` 버튼 제거**. (주의: #13의 history `edit`(선택용)은 별개 — 거기엔 추가)
- **#16** `stock > stock` **정렬 추가**: ID순 / 이름 A→Z / 수량 높은→낮은 / 낮은→높은.

---

## 그룹 B — ★ 재고 차감 (CRITICAL, #11)

지금 주문해도 **재고가 안 빠짐**. 고친다:
- admin이 **payment confirm(= `payment_verified`) 누르는 시점**에 → 주문의 각 품목마다 `stock_movements` insert(`reason='order'`, `delta = -qty`, `order_id`) + `product_stock.stock` 차감. (💡 fixme대로 packaging 아니라 **payment confirm 시점** 채택)
- **취소 시 복구:** 이미 confirm된(재고 빠진) 주문을 취소하면 → 이미 만든 **`restore_stock_for_cancel(items jsonb)` 함수 호출**로 `+qty` 복구 + `reason='cancel_restock'` 이동 기록.
- 차감/복구는 **한 트랜잭션(RPC)** 으로. 음수 되면 막거나 경고.
- 이미 적용된 스키마(`stock_movements`, `product_stock`, `restore_stock_for_cancel`) 그대로 사용.

---

## 그룹 C — 입고(Add inbound) 리메이크 + 배치 (#12)

- **여러 제품 동시 선택** 가능하게 (지금 1개만). UI 전면 리메이크(지금 너무 빈약).
- 한 번에 입고한 묶음 = **하나의 배치(batch)** 로 기록. history에 묶음으로:
  `날짜 · N products · company · 총 quantity · memo · [see detailed]`
- **[see detailed]** → 체크아웃 receipt 스타일(가격 없음)로 그 배치의 품목 상세 창.
- history **검색하면 그 배치가** 나오게.
- 이 탭 안에서 **export to .xlsx** (그룹 G 스타일로).
- 💡 DB — 배치 묶음용 (SQL 블록 출력):
```sql
create table if not exists public.inbound_batches (
  id          bigserial primary key,
  company_id  bigint references public.companies(id) on delete set null,
  inbound_date date not null default current_date,
  memo        text,
  created_at  timestamptz not null default now()
);
alter table public.stock_movements
  add column if not exists batch_id bigint references public.inbound_batches(id) on delete set null;
alter table public.inbound_batches enable row level security;
```
입고 ≥1 제품 → batch 1개 생성 + 각 movement에 `batch_id` 연결.

---

## 그룹 D — Receipt / 패킹 리스트 (#15)

`admin > orders > 주문상세` 상단에 **`Receipt` 버튼** → customer / ship-to / items / price 가 들어간 **큰 receipt 화면**. 그 아래 버튼 2개:
1. **Export to Excel** — receipt 레이아웃을 엑셀로(테두리·가로세로 라인 디자인, 그룹 G 스타일).
2. **Copy to packaging** — 패킹 직원용 **텍스트 리스트** 생성 + **복사 버튼**. **주소·가격 없음.** 형식:
```
No:   SGL #00XXXX
Name: Edgar Barron

MISADI CO2 Mask
Quantity: 1
CELLEXO Bio-Cellulose Exosome Mask 30 ml X 5 masks
Quantity: 1
...
```

---

## 그룹 E — 분석: user / 제품 Details / Stock Overview (제일 큼)

### E1. user analytics 개선 (#8, #7 토글 연동)
지금 분석이 구리고 작동 불명확 → **정확·디테일하게.** 💡 그 유저의 `orders`+`order_items` 집계로:
- 요약: 총 주문 수 · 총 지출 · 평균 주문액 · 마지막 주문일
- 지출 추이(선) + 주문 수(막대), **`일/주/월/all` 토글**(#7)
- 가장 많이 산 제품 top
- 날짜 클릭 → 그날 주문 상세
- 모두 KST 기준, 데이터 0건 빈 상태 처리

### E2. 제품별 Details 버튼 (#19)
`stock > stock` 각 제품에 **`Details` 큰 버튼(gold glow 이펙트)** → 그 제품 재고 상세:
- 최근 이동(+/−) 피드
- 그래프(💡 recharts): ① 재고 수준 변화(월/주/일/all, 막대+곡선) ② 수요(구매량 추이) ③ **누가 많이 사나(Customer ID top)** ④ 평균 구매량 ⑤ **요일별 구매 패턴**(주중 어느 날 많이 사는지)
- 이 제품 들어간 **최근 주문 목록**
- **버튼/캘린더 날짜 검색**(history처럼 but 이 제품만)
- 이 제품 info **export to excel**(그룹 G 스타일)

### E3. Stock Overview 버튼 (#20)
`export to .xlsx` 옆에 **`Stock Overview` 버튼(glow)** → 전 제품 집계 한 화면:
- most demanded product · 누가 사나(Customer ID) · 평균 구매량 · 평균 일일 재고
- 월/주/일/all 재고 변화(막대+곡선)
- 💡 너 알아서 professional하게 구성 (KPI 카드 + 차트 + 표)

---

## 그룹 F — Excel export 전면 개선 (#13, #21, + 모든 export)

> Claude가 **이 스타일로 레퍼런스 워크북 이미 만들어둠** — 그 .xlsx 열어서 목표 디자인 확인. 아래는 모든 export에 적용할 스펙.

### F0. 공통 스타일 (#21 — 모든 엑셀)
- 라이브러리 **openpyxl**(스타일·수식). 폰트 **Arial**.
- 헤더: **차콜 배경(#1F2430) + 흰 bold 글씨 + 골드(#C9A24B) 하단 라인**, 가운데 정렬, wrap.
- 데이터: 얇은 테두리(#D9D4C8), **줄무늬**(짝수행 #F4F1EA), gridlines off.
- **헤더 freeze + auto_filter**, **컬럼 폭 읽기 좋게**(이름 넓게, ID 좁게 — 텍스트 크기 자동 ❌).
- 숫자 `#,##0`. 날짜 일관.
- **값 하드코딩 ❌ → 수식 사용**(합계 SUM 등). 수식 에러 0.

### F1. Current Stock 시트
- 컬럼: Product ID / Name / Current Stock / **Status**.
- **Status = 수식**: `=IF(stock=0,"Sold Out",IF(stock<=임계값,"Low","OK"))` — 임계값은 **셀 하나로 빼서 조절 가능**(기본 10).
- **조건부서식**: 품절=빨강 / 부족=주황 / 정상=초록.
- 맨 밑 **합계 행(SUM)**.

### F2. Overview / Stock Overview 시트
- **KPI(전부 수식)**: 총 제품 · 총 재고 · 품절 수 · 부족 수 · 정상 수 · 총 주문 · 이동 수.
- **막대 차트**(재고 상태 분포 등).

### F3. History 시트
- **Δ Qty 조건부서식**: `+` 초록 / `−` 빨강. Reason 등 정리.

### F4. 두 가지 export 버튼 (#13)
`stock > history`(및 다른 export 가능한 탭)에 export 버튼 **2개**:
1. **Export all** — 전체 데이터.
2. **Export selected** — `edit` 버튼 누르면 **선택 모드**(체크박스) → 선택한 행만 `.xlsx`. (`edit`는 **export 선택 전용**, 삭제 기능 없음.)

---

## 실행 순서 / 커밋

```
A(빠른수정) → B(★재고차감) → C(입고+batch) → D(receipt/packing) → E(분석) → F(Excel)
```
- 각 그룹 끝 → tsc + dev 확인 + 커밋(그룹명).
- DB SQL은 C(inbound_batches/batch_id) 블록 출력 → 우리가 적용.
- B(#11)·E·F가 무거움. E는 recharts 차트 많음, F는 모든 export 손봄.
