---
id: CHESS-007
title: 직전 수를 화살표로 보여주기
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 표시 계층만 바꾼다. 규칙·전투·AI 를 건드리지 않는다
    - 되돌리기가 단일 커밋 revert 로 끝난다

human:
  owner: user
  reviewer_required: true
---

## Problem

직전 수 표시가 출발 칸과 도착 칸의 옅은 노란 틴트뿐이었다. 사용자가 "마지막에 움직였던
말이 어떤 말인지, 어떻게 움직였는지" 를 알고 싶다고 했다.

칸 두 개만 물들이면 방향이 안 읽히고, 기물이 빽빽한 초반에는 두 칸 중 어느 쪽이 도착
칸인지도 모른다. AI 가 둔 수를 놓치면 다음 수를 생각할 근거가 사라진다.

## What we are shipping

- 출발 칸에서 도착 칸으로 향하는 화살표 (자루 + 촉)
- 무산된 공격은 빨간 화살표
- 기존 노란 칸 틴트는 유지

## What we are not shipping

- 나이트의 L 자 경로 (직선으로 긋는다)
- 이전 수들의 이력 표시

## Facts

- 화살표는 길이가 매번 다르다. 매번 geometry 를 만들면 GPU 버퍼가 쌓인다.
- 도착 칸 한가운데까지 그리면 그 자리에 선 기물이 화살촉을 가린다.
- `rotation.y = atan2(dx, dz)` 면 로컬 +z 가 목표 방향을 가리킨다 (전투에서 마주 보게
  할 때 쓴 것과 같은 식).
- `ConeGeometry` 는 +y 를 본다. +z 로 눕히려면 x 축으로 90도.

## Decisions

- **단위 상자를 늘려 쓴다.** 길이별 geometry 대신 scale 로 처리해 매 수마다 새로 만들지
  않는다.
- **화살표를 도착 칸 앞에서 끊는다** (0.45 만큼). 촉이 기물 뒤로 숨지 않는다.
- **무산된 공격은 빨간색.** 기보의 `✗` 와 같은 사실을 반상에서도 말한다.
- 나이트도 직선으로 긋는다. L 자는 코드가 늘고 읽기 이득이 없다.

## Assumptions

- 화살표 하나면 충분하고, 이전 수까지 겹쳐 그릴 필요는 없다.

## Relevant context

- `src/board3d.ts` — `addArrow`, `Highlights.last`
- `src/main.ts` — `render` 가 `log.at(-1)` 을 넘긴다
- `DESIGN.md` — Components / 반상

## Allowed scope

- 표시 계층과 그 문서

## Forbidden scope

- 체스 규칙, 전투 판정, 체력 장부, AI

## Acceptance criteria

- 직전 수가 출발 칸에서 도착 칸 방향으로 화살표로 그려진다.
- 도착 칸에 선 기물이 화살촉을 가리지 않는다.
- 무산된 공격은 빨간 화살표다.
- 새 게임·무르기 후에는 이전 화살표가 남지 않는다.

## Human judgment

- 화살표가 반상을 어지럽히는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 대국: 1. e4 Nf6 에서 g8→f6 화살표가 나이트를 가리키는지

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
