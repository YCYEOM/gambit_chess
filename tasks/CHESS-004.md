---
id: CHESS-004
title: 갈 수 없는 칸과 그 이유를 반상에 표시
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 표시 계층만 바꾸며 체스 규칙·전투 판정·AI 를 건드리지 않는다
    - 되돌리기가 단일 커밋 revert 로 끝난다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자가 물었다 — "스스로 체크에 들어갈 수는 없지만, 왜 갈 수 없는지는 표시해줘."

지금은 규칙이 막는 칸을 누르면 아무 일도 일어나지 않는다. 원칙 4("잘못 클릭해도 아무
일도 일어나지 않는다")를 그대로 지킨 결과인데, 3D 로 바뀌면서 이게 고장처럼 읽힌다.
2D 시절에는 반상이 한눈에 들어와 스스로 추론할 수 있었지만 지금은 그렇지 않다.

## What we are shipping

- `blockedSquares()` — 형태상 갈 수 있는데 규칙이 막는 칸 (킹이 겨눠지는 자리, 핀,
  체크를 못 푸는 수)
- 반상 표시: 갈 수 있으면 초록 칸, 막히면 빨간 칸 + X
- 막힌 칸을 누르면 상태줄에 이유 한 줄

## What we are not shipping

- 캐슬링이 막힌 이유 (킹에서 두 칸 떨어져 있어 인접 칸 표시에 안 잡힌다)
- 어떤 기물이 그 칸을 겨누는지까지 짚어 주기

## Facts

- `chess.js` 는 합법수만 준다. 의사합법수(pseudo-legal) API 가 없다.
- **자기 킹을 잠시 치우면** 체크 제약이 사라진 수 목록이 나온다. 거기서 합법수를 빼면
  막힌 칸이다. 이동 규칙을 다시 짤 필요가 없다.
- 킹 자신은 치울 수 없으므로 인접 8칸을 직접 본다.
- 킹을 치우면 킹이 서 있던 칸이 비어 보인다 — 결과에서 빼야 한다.
- 3D 원근에서 기물은 **자기 바로 뒤 칸의 화면 자리**를 통째로 덮는다. 키가 가장 큰 킹이
  가장 심하다. 가운데 점 표시는 이 상황에서 투구 위에 찍힌다.

## Decisions

- **이동 규칙을 다시 짜지 않는다.** 킹을 치우는 우회로가 유일하게 chess.js 를 단일
  원천으로 유지하는 방법이다.
- **표시를 점에서 칸 전체로 바꾼다.** `depthTest` 를 꺼서 기물 위에 그리는 것도 해 봤지만,
  마커가 기물 머리에 붙어 더 헷갈렸다. 칸을 칠하면 좌우로 삐져나온 부분이 남는다.
- **선택 고리만 바닥에 남긴다.** 관통시키면 후광처럼 떠서 어색하고, 어느 기물을 골랐는지는
  방금 누른 사람이 이미 안다.
- 카메라를 조금 세운다 (y 9.4→11.2, z 10.4→9.4). 가림 자체를 줄인다.

## Assumptions

- 막힌 칸을 보여 주는 것이 초보자에게 도움이 되고, 숙련자에게는 방해가 되지 않는다.

## Relevant context

- `src/duel.ts` — `blockedSquares`, `findKing`
- `src/board3d.ts` — `MARKER`, `addCross`, `highlight`, `BOARD_VIEW`
- `src/main.ts` — `render`, `onSquare`, `hint`
- `DESIGN.md` — Components / 반상

## Allowed scope

- 표시 계층과 그 문서

## Forbidden scope

- 체스 규칙 판정, `combat.ts`, `playMove`, AI 탐색

## Acceptance criteria

- 핀에 걸린 기물, 체크 중 못 두는 수, 킹이 겨눠지는 인접 칸이 모두 빨갛게 나온다.
- 합법수와 막힌 칸이 겹치지 않는다.
- 자기 킹이 선 칸은 막힌 칸으로 세지 않는다.
- 키 큰 기물 뒤 칸의 표시도 화면에서 읽힌다.
- 막힌 칸을 누르면 이유가 상태줄에 뜬다.

## Human judgment

- 초록/빨강 칸 표시가 과한지 (기존 점 표시를 그리워할지).

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- `duel.test.ts` 의 `blockedSquares` 5개
- 실제 대국: 킹을 e3 까지 걸어 나가 d5 폰이 지키는 e4 가 빨갛게 나오는지

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
