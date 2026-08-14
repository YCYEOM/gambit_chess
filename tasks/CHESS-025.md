---
id: CHESS-025
title: 가로에서 컨트롤을 접는다
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 접힌 상태에서 컨트롤에 닿을 길이 버튼 하나뿐이다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — 가로에서 우측 패널이 너무 넓다. 한 줄로 붙이거나, 펼침으로 열고 닫는 편이
낫겠다.

CHESS-023 에서 두 칸으로 나눴는데, 오른쪽 칸이 반쯤 빈 채로 화면 삼분의 일을 먹고 있었다.

## What we are shipping

- 가로에서 컨트롤을 접는다. `☰` 를 누르면 반상 위로 떠오른다
- 오른쪽 칸에는 상태·연승·`☰` 만 남는다 (폭 96~150px)
- 반상이 그만큼 커진다 (915×412 기준 484×367 → 522×396)
- 기보는 가로에서 접는다

## What we are not shipping

- 세로·데스크톱의 접기 (컨트롤이 방해되지 않는다)
- 애니메이션 — 열고 닫는 것이 즉시여야 답답하지 않다

## Facts

- 그리드 안에서 펼치면 열 폭이 변해 반상이 줄었다 늘었다 하고, 캔버스가 리사이즈되며
  카메라까지 다시 잡힌다.
- `hidden` 속성은 UA 스타일시트의 `display:none` 이라 저자 규칙이 이긴다 — 보이고 감추는
  주체를 CSS 하나로 두면 JS 에서 벗길 필요가 없다.

## Decisions

- **떠 있는 패널.** 접든 펴든 반상 크기를 건드리지 않는다.
- **버튼 표시는 CSS 가 정한다.** JS 로 `hidden` 을 벗기면 세로·데스크톱에도 버튼이 남는다
  (실제로 그렇게 만들었다가 고쳤다).

## Assumptions

- 가로에서 기보를 안 봐도 불편하지 않다.

## Relevant context

- `index.html` — `#menu`, 가로 미디어 쿼리
- `src/main.ts` — `menuEl` 토글

## Allowed scope

- 가로 배치와 접기

## Forbidden scope

- 세로 배치, 규칙, 렌더링

## Acceptance criteria

- 가로에서 `☰` 가 보이고 눌러 컨트롤을 열고 닫을 수 있다.
- 세로·데스크톱에는 `☰` 가 없다.
- 열고 닫아도 반상 크기가 변하지 않는다.
- 넘침이 없다.

## Human judgment

- 접힌 상태가 답답한지, 첫 진입을 펼친 채로 두는 편이 나은지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- iframe 실측 915×412 · 844×390 · 390×844, 데스크톱 포함

## Rollback

- 단일 커밋 revert.
