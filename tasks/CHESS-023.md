---
id: CHESS-023
title: 눕힌 폰은 두 칸으로 — 반상이 높이를 다 쓴다
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 미디어 쿼리 순서가 틀리면 조용히 무시된다 (이번에 실제로 겪었다)

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — 가로 모드가 많이 불편하다, 너무 작다.

CHESS-019 에서 가로는 스크롤만 없앴다. 반상은 365×214 로 작고 좌우 500px 가 빈 채였다.

## What we are shipping

- 눕힌 폰(높이 ≤560px)에서 두 칸 그리드 — 반상 왼쪽, 컨트롤·상태·기보 오른쪽
- 반상은 높이를 다 쓰고, 오른쪽 칸 자리가 모자라면 폭에 맞춘다
- 미디어 쿼리를 스타일시트 맨 뒤로 옮긴다

## What we are not shipping

- 태블릿 가로 전용 배치 (기본 레이아웃이 이미 충분하다)
- 컨트롤을 반상 위에 겹치는 배치

## Facts

- 세로 한 줄에서는 반상이 `82vh`(높이)에 묶여 작아지고 좌우가 빈다.
- `#moves`·`#run`·`#legend` 는 기본 규칙에 `width: min(92vw, 1000px)` 이 있다.
- 미디어 쿼리가 그 규칙보다 **앞에** 있으면 특정도가 같아 나중 규칙이 이긴다 —
  실제로 `width: auto` 가 무시돼 가로로 461px 넘쳤다.

## Decisions

- **가로에서만 두 칸.** 세로는 지금 배치가 맞다.
- **반상 크기는 높이 우선, 폭은 안전장치.** `min(94vh × 1.32, 100vw − 190px)`.
- **미디어 쿼리는 맨 뒤.** 순서로 이기는 규칙은 순서가 곧 계약이다.

## Assumptions

- 오른쪽 칸 150~260px 면 컨트롤이 접혀서 들어간다.

## Relevant context

- `index.html` — 두 미디어 쿼리 (맨 뒤)

## Allowed scope

- 화면 크기별 배치

## Forbidden scope

- 규칙, 렌더링, 카메라

## Acceptance criteria

- 눕힌 폰에서 가로·세로 넘침이 0 이고 반상이 이전보다 뚜렷하게 크다.
- 세로 배치가 그대로다.

## Human judgment

- 오른쪽 칸의 컨트롤 배치가 쓰기 편한지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- iframe 기기 크기 실측 6종 (가로 4 · 세로 2)

## Rollback

- 단일 커밋 revert.
