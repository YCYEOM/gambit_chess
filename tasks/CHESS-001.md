---
id: CHESS-001
title: AI 차례 disabled 상태와 포커스 링 구현
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - CSS와 DOM 속성만 변경하며 체스 규칙·AI 탐색 로직을 건드리지 않는다
    - 되돌리기가 단일 커밋 revert로 끝난다

human:
  owner: user
  reviewer_required: true
---

## Problem

`DESIGN.md`의 Interaction states 조사에서 두 항목이 MISSING으로 나왔다.

- AI가 탐색 중일 때 `main.ts`가 클릭을 무시하지만(`if (thinking) return`), 버튼과
  셀렉트는 여전히 눌리는 것처럼 보인다. 눌러도 반응이 없으니 멈춘 것처럼 읽힌다.
- 포커스 링이 정의되지 않았다. 키보드 Tab 이동 시 현재 위치를 알 수 없다.

## What we are shipping

- AI 탐색 중 컨트롤(`select`, `button`)에 실제 `disabled` 속성 부여 + 흐린 표시
- 컨트롤에 `:focus-visible` 포커스 링 (`--accent` 사용). 보드 칸은 `div`라 tabbable이
  아니므로 제외한다 — 칸 포커스는 키보드 조작 작업과 함께 가야 의미가 있다.

## What we are not shipping

- 키보드만으로 수 두기 (별도 접근성 작업)
- 기물 칸 `aria-label` (별도 접근성 작업)

## Facts

- `src/main.ts`의 `thinking` 플래그가 이미 AI 탐색 구간을 정확히 감싼다
  (`aiTurn` 시작 시 true, 계산 후 false, 각각 `render()` 호출).
- `render()`가 매번 보드를 `replaceChildren`으로 갈아끼우므로 상태 반영 지점은 `render()` 하나뿐이다.
- 컨트롤(`#side`, `#level`, `#undo`, `#new`)은 `render()` 바깥의 정적 DOM이다.
- `index.html`의 `button, select` 규칙에 `:hover`만 있고 `:focus`/`:disabled`가 없다.

## Decisions

- 컨트롤 비활성화는 CSS 흉내가 아니라 `disabled` 속성으로 한다. 클릭 차단이 DOM 수준에서
  보장되고 `main.ts`의 방어 코드와 이중화된다.
- 포커스 링은 `:focus-visible`만 사용한다. 마우스 클릭에도 링이 남으면 반상이 지저분해진다.

## Assumptions

- 대상 브라우저가 `:focus-visible`을 지원한다 (Chrome 86+/Safari 15.4+).

## Relevant context

- `src/main.ts` — `render()`, `aiTurn()`, `thinking`
- `index.html` — `button, select` 및 `.sq` 규칙
- `DESIGN.md` — Interaction states 표

## Allowed scope

- `index.html`의 CSS
- `src/main.ts`의 `render()`
- `DESIGN.md`의 Interaction states 표 갱신

## Forbidden scope

- `src/ai.ts` (탐색 로직)
- 체스 규칙 판정, 승진 처리, 기보 렌더링

## Acceptance criteria

- AI 탐색 중 네 컨트롤이 모두 `disabled`이고 시각적으로 흐리다.
- 탐색이 끝나면 모두 다시 활성화된다.
- Tab으로 컨트롤을 순회할 때 포커스 링이 보인다.
- 마우스 클릭만으로는 포커스 링이 남지 않는다.
- `DESIGN.md`에서 해당 두 항목이 MISSING이 아니게 된다.

## Human judgment

- 포커스 링 색으로 `--accent`(선택된 칸과 같은 색)를 쓰는 것이 혼동을 주는지.

## Verification

- `bass evaluate --levels 1,2` (typecheck / unit / build)
- `bass design check`
- 실제 렌더링: AI 탐색 중 화면과 Tab 포커스 화면을 눈으로 확인

## Rollback

- 단일 커밋 revert. 저장된 게임 상태나 영속 데이터가 없어 마이그레이션이 없다.
