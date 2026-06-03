# Claude Code 프롬프트 — Lumée Maison 비주얼/이펙트 폴리시

> 아래 블록 전체를 복사해서 Claude Code(코드베이스 `lumiere-app` 열린 상태)에 붙여넣으세요.
> **기능 변경 없이 "보이는 것"과 "이펙트"만** 다듬는 작업입니다.

---

너는 Lumée Maison(프리미엄 한국 에스테틱 화장품 B2B 스토어, "A House of Light")의 시니어 프론트엔드 디자이너야.
스택: **Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 (`app/globals.css`의 `@theme`/`@layer components`) · framer-motion · lucide-react**.

## 절대 규칙
- **기능/로직/데이터/라우팅/상태(zustand)/체크아웃 흐름은 절대 건드리지 마.** 순수하게 **CSS·className·트랜지션·이펙트**만 다듬는다.
- 새 의존성 설치 금지. 기존 토큰/유틸만 사용.
- 대부분의 작업은 **`app/globals.css`** 에서 끝나야 한다. 컴포넌트는 className 추가/조정 정도만.
- **성능 최우선(요구사항: 부드럽고, 큰 렉 없이, 빠르게).** 애니메이션은 `transform`/`opacity`/`filter`만 사용하고 `width`,`height`,`top`,`left`,`box-shadow`를 매 프레임 바꾸지 마. `will-change`는 hover 트리거 요소에만 최소로. layout thrash·무한 루프 애니메이션 남발 금지.
- **`prefers-reduced-motion: reduce`** 에서는 모든 무한/장식 애니메이션을 끈다. (이미 globals.css에 블록 있음 — 거기에 추가.)
- 접근성: 모든 인터랙티브 요소에 `:focus-visible` 골드 링 제공.

## 디자인 토큰(이미 정의됨 — 이 값들만 써라)
- gold `#c9a96e`, gold-light `#ddc08e`, gold-dark `#a8874a`, cream `#faf8f5`, obsidian `#0a0a0a`, charcoal `#1a1a1a`, mist `#6b6b6b`, bone `#e8e2d9`
- easing: `cubic-bezier(0.4,0,0.2,1)` / 시간: hover·색상 200ms, 일반 300ms, 이미지 줌·시머 500–600ms

## 다듬을 이펙트 (정확한 스펙)

### 1) 버튼 (`.btn-primary`, `.btn-secondary`, `.btn-gold`)
- 공통: `transition: all 300ms cubic-bezier(0.4,0,0.2,1)`. **press(active) 상태 추가**: `transform: translateY(1px)` + 그림자 살짝 축소 (눌리는 느낌, 과한 scale 금지).
- `.btn-primary`: obsidian → hover 시 gold 채움 + `box-shadow: 0 6px 20px rgba(201,169,110,0.30)`.
- `.btn-gold`: 기존 시머 스윕 유지하되 한 번 더 다듬기 — `::after` 그라디언트가 `translateX(-120%) → translateX(120%)` 600ms로 한 번 지나가고, hover 시 `box-shadow: 0 0 24px rgba(201,169,110,0.35)` 골드 글로우. hover 색은 `--gold-dark`.
- `.btn-secondary`: 투명 → hover 시 골드 보더 + 골드 텍스트 + 아주 옅은 cream 배경.
- 모든 버튼 `:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(201,169,110,0.35) }`.

### 2) 골드 글로우 시스템 (재사용 유틸 추가)
`@layer components`에 유틸 클래스 추가:
- `.glow-gold { box-shadow: 0 0 24px rgba(201,169,110,0.25); }`
- `.glow-gold-strong { box-shadow: 0 0 36px rgba(201,169,110,0.45); }`
- `.hover-glow { transition: box-shadow 300ms ease; } .hover-glow:hover { box-shadow:0 0 28px rgba(201,169,110,0.30); }`
강조 요소(주요 CTA, 카테고리 원형 아이콘, 선택된 결제수단 카드 등)에 적용.

### 3) 상품 카드 (`.product-card`)
- 기본: 반투명 흰색 + 골드 1px 보더 + `0 8px 30px rgba(0,0,0,0.08)`.
- hover: 배경 0.92로 밝아짐 + 보더 solid gold + `0 12px 40px rgba(201,169,110,0.22)` + `transform: translateY(-4px)`.
- 내부 이미지: `transition: transform 500ms ease; .product-card:hover img { transform: scale(1.10) }` (overflow hidden 유지).
- 트랜지션 속성을 명시(`border-color, box-shadow, transform, background-color`)해서 `all` 남용으로 인한 렉 방지.

### 4) 헤더 글래스모피즘
- 스크롤 20px 이상에서 `backdrop-filter: blur(20px)` + `rgba(250,248,245,0.88)` + 하단 골드 헤어라인. **모바일(<768px)에서는 blur 끄고** 반투명 배경만(스크롤 성능). 전환 `300–500ms ease`. (이미 비슷하게 있음 — 타이밍·헤어라인만 정돈.)

### 5) 카테고리 원형 아이콘 (홈)
- hover: `transform: scale(1.05)` + 보더 골드 + `box-shadow: 0 0 20px rgba(201,169,110,0.35)`. 200–300ms.

### 6) 카탈로그 사이드바 카테고리 (`.cat-item`)
- 활성/hover 시 **왼쪽에서 골드 세로 바**가 `scaleY(0)→scaleY(1)` 또는 `translateX(-12px)→0`로 슬라이드 인(200ms). 활성 항목은 골드-다크 텍스트 + 아주 옅은 골드 배경.

### 7) 히어로
- 하단 중앙 **스크롤 큐**: "EXPLORE" 라벨 + 셰브런(lucide `ChevronDown`)이 위아래로 부드럽게 bob(8px, 1.6s, ease-in-out 무한 — reduced-motion에서 정지).
- 골드 더스트 입자(이미 있는 `GoldParticles`/Sparkles) 유지하되 개수·opacity 과하지 않게(18~20개, opacity ≤ 0.75) GPU transform만 사용.
- 제목 텍스트 가독성용 cream 글로우 텍스트섀도 유지.

### 8) 페이지/요소 등장
- framer-motion `whileInView`(once:true)로 fade + 16px up(`duration 0.5–0.6`). 이미 쓰는 패턴과 일치시키고, **첫 화면(above the fold)은 애니메이션 지연 최소화**해서 체감 속도 빠르게.
- 인풋 `:focus`: 골드 보더 + `0 0 0 3px rgba(201,169,110,0.15)` 링.

### 9) 디테일 정리(다듬기)
- 배지(NEW=obsidian, SALE=gold, BESTSELLER=mist, BUNDLE=골드 아웃라인, SOLD OUT=charcoal) radius 6px·tracking 0.1em 통일.
- 섹션 제목 아래 **gold-divider(3rem×1px)** 일관 적용.
- 선택/토스트/뱃지 등 골드 사용을 절제(한 화면에 글로우 남발 금지 — "조용한 럭셔리").
10)그 처음 매인화면에 lumee maison 로고가 조금 빤짝이는 이펙트가 태두리엣 나는 움직이는 이펙트 

## 작업 방식
1. 먼저 `app/globals.css`와 관련 컴포넌트(`components/home/Hero.tsx`, `components/catalogue/ProductCard.tsx`, `components/layout/Header.tsx`, `CategoryGrid.tsx`)를 읽고 현재 이펙트를 파악해.
2. 위 스펙대로 **globals.css의 `@layer components`를 보강/리팩터**하고, 필요한 곳에만 className을 추가해.
3. `prefers-reduced-motion` 블록에 새 무한 애니메이션을 모두 등록해.
4. 변경은 작고 명확한 커밋 단위로. 기능 회귀 없는지 빠르게 확인.

## 완료 기준(체크리스트)
- [ ] 모든 버튼에 hover/active/focus-visible 상태가 일관되게 있음 (골드 글로우 + press)
- [ ] `.btn-gold` 시머 스윕이 hover에서 1회 매끄럽게 지나감
- [ ] 상품 카드 hover: 리프트 + 골드 보더 + 이미지 1.1 줌, 렉 없음
- [ ] 헤더 글래스(데스크탑) / blur 없는 반투명(모바일)
- [ ] 카테고리 원형 hover 글로우, 사이드바 골드 좌측 바 슬라이드
- [ ] 히어로 스크롤 큐 bob 애니메이션 + 입자
- [ ] reduced-motion에서 무한 애니메이션 전부 정지
- [ ] 60fps 체감, 레이아웃 시프트 없음, 기능 동작 그대로
