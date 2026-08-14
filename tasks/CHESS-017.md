---
id: CHESS-017
title: 위험 칸 이동은 사람만 — AI 는 정통 규칙
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 판정이 진영마다 달라진다. 잘못되면 AI 차례에 판이 안 끝나고 멈춘다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 요청 — "AI 랑 할 때는 AI 는 기존 규칙으로 유지해 줘."

CHESS-016 에서 킹이 겨눠진 칸으로 나설 수 있게 하면서 AI 에게도 같은 길을 줬다.
그러면 사람이 몰아붙여 만든 체크메이트를 AI 가 빠져나간다 — 이긴 것이 이긴 게 아니다.

## What we are shipping

- 위험 칸 이동은 사람의 킹만
- AI 는 체크메이트·스테일메이트면 그 자리에서 판이 끝난다 (정통 체스 규칙)

## What we are not shipping

- 난이도별로 이 규칙을 다르게 주는 것 (최강만 빠져나갈 수 있다든지)

## Facts

- `escapes()` 가 `game.turn()` 의 킹을 보고 있었다. 진영을 가리지 않았다.
- AI 가 합법수 없이 멈추면 판이 진행되지 않으므로, AI 쪽은 반드시 끝나야 한다.

## Decisions

- **`escapes()` 를 사람 차례로 한정한다.** 한 줄이면 판정 전체(over·result·상태줄)가 따라온다.
- AI 차례의 최후 수단 코드는 지운다 — 이제 도달할 수 없다.

## Assumptions

- 사람만 빠져나갈 수 있는 것이 불공평이 아니라 아케이드의 관용으로 읽힌다.

## Relevant context

- `src/main.ts` — `escapes`, `aiTurn`, `statusText`

## Allowed scope

- 승패 판정의 진영 구분

## Forbidden scope

- 전투 공식, 이동 규칙, 탐색

## Acceptance criteria

- 내가 체크메이트면 판이 안 끝나고 위험 칸으로 나설 수 있다.
- AI 가 체크메이트면 그 자리에서 내 승리로 끝난다.

## Human judgment

- 사람만 빠져나가는 것이 너무 후한지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 화면(Chrome): 양쪽 체크메이트 국면을 각각 올려 상태줄 확인

## Rollback

- 단일 커밋 revert.
