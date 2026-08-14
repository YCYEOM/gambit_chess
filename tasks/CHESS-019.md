---
id: CHESS-019
title: 폰 화면에 맞춰 반상과 시점을 세운다
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 카메라 위치를 화면 비율로 계산한다. 잘못되면 반상 양옆이 잘리고 잘린 칸은 클릭도 안 된다

human:
  owner: user
  reviewer_required: true
---

## Problem

모바일 점검에서 두 가지가 나왔다.

- **세로**: 스크롤은 없지만 반상이 화면 높이의 3분의 1만 쓰고 아래로 280~320px 가 빈다.
  "반상이 화면을 지배한다" 는 첫 원칙과 정반대다.
- **가로**: 68~95px 넘쳐 스크롤이 생기고, 반상은 199~353px 로 쪼그라든 채 좌우 500px 를 버린다.

## What we are shipping

- 세로 폰: 캔버스 비율 0.92 + 카메라를 더 위에서 내려다보게 (`viewFor`)
- 가로 폰: 제목 숨김·여백 축소·캔버스 비율 1.7 — 스크롤 제거
- 화면을 돌리면 시점을 다시 잡는다 (`resize` 에서 `resetCamera`)

## What we are not shipping

- 가로에서 2단(반상 | 컨트롤) 레이아웃 — DOM 을 바꿔야 하고, 폰 체스는 세로가 기본이다
- 태블릿 전용 breakpoint

## Facts

- 비스듬히 본 8×8 반상은 약 1.32:1 로 투영된다. 캔버스만 키우면 위아래가 검게 빌 뿐이다.
- 캔버스를 세우면 가로 시야가 좁아져 양옆이 잘린다 — 시점을 세우거나 물러서야 한다.
- 실측(390×844): 반상 272px, 아래 292px 빔. 눕힌 폰(844×390): 84px 넘침.

## Decisions

- **비율과 시점을 함께 바꾼다.** 둘 중 하나만 바꾸면 검은 여백이 늘거나 반상이 잘린다.
- **가로는 넘침만 없앤다.** 2단 레이아웃은 DOM 수술이고, 얻는 것보다 비싸다.
- **물러서는 정도는 계산한다.** 반상 반폭(4.6)이 가로 시야에 들어오도록 거리에서 역산한다 —
  값을 손으로 넣으면 다음 기기에서 또 잘린다.

## Assumptions

- 위에서 내려다보는 시점이 캐릭터의 개성을 해치지 않는다 (원칙 2 가 이미 "위에서 봐도
  구분되어야 한다" 를 요구한다).

## Relevant context

- `index.html` — `#board` 와 두 개의 미디어 쿼리
- `src/board3d.ts` — `viewFor`, `resetCamera`, `resize`, 결투 복귀 카메라

## Allowed scope

- 반상 크기·시점·모바일 여백

## Forbidden scope

- 규칙, 전투, 색 토큰

## Acceptance criteria

- 세로 폰에서 반상이 이전보다 뚜렷하게 커지고 스크롤이 없다.
- 눕힌 폰에서 스크롤이 없다.
- 어느 비율에서도 반상 양옆이 잘리지 않는다.
- 화면을 돌리면 시점이 다시 잡힌다. 전투 중에는 카메라를 빼앗지 않는다.

## Human judgment

- 세로에서 위에서 내려다보는 시점이 마음에 드는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- iframe 을 폰 크기로 만들어 실측 (크롬 창은 macOS 최소 폭 500px 아래로 못 줄인다)
- 360×800 · 390×844 · 412×915 · 800×360 · 844×390

## Rollback

- 단일 커밋 revert.
