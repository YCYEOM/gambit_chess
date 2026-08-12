---
id: CHESS-006
title: AI가 전투 승률을 고려하고, 멀리 있는 기물도 붙어서 싸우게
status: HUMAN_REVIEW
type: feature
profile: web

risk:
  level: low
  reasons:
    - AI 평가와 연출만 바꾸며 체스 규칙·전투 판정·체력 장부를 건드리지 않는다
    - 되돌리기가 단일 커밋 revert 로 끝난다

human:
  owner: user
  reviewer_required: true
---

## Problem

둘 다 사용자가 짚었다.

1. **AI가 체력을 모른다.** 정통 체스 기준으로 둬서 결투 모드에서 잡기를 공짜로 여긴다.
   빈사 상태 기물로 덤비고, 다친 적을 노리지도 않는다.
2. **멀리 있는 기물끼리 싸울 때 누가 싸우는지 안 보인다.** 전투는 반상이 갱신되기 전에
   재생되므로 공격자가 원래 칸에 그대로 서 있다. 룩이 반상 끝에서 잡으면 두 기물이
   화면 양끝으로 벌어지고 카메라는 그 사이 빈 칸을 비춘다.

## What we are shipping

- `winChance()` — 전투 승률 추정. 기억해 두는 몬테카를로 (200회, 체력 2 단위로 버킷)
- `bestMove(game, depth, hpOf?)` — 잡기를 `(1-승률) × (공격자 가치 + 수비 가치)` 만큼 할인
- 공격자가 수비 기물 앞 한 칸까지 걸어간 뒤 전투 시작

## What we are not shipping

- 완전한 기대값 탐색 (모든 노드에서 두 갈래로 갈라 보기)
- AI 가 물러나 쉬는 판단
- 공격자가 실제 경로를 따라 이동하는 연출 (직선으로 붙는다)

## Facts

- 탐색은 `game.move()` 로 "잡기 성공"만 둔다. 그 낙관을 되돌리는 보정이 필요하다.
- 체력 지도는 칸을 키로 한다. 탐색 깊은 곳은 가상의 위치라 조회하면 엉뚱한 값이 나온다.
- 전투 승률의 닫힌 식이 없다. 표를 손으로 관리하면 밸런스 상수를 바꿀 때마다 어긋난다.
- `playDuel` 은 `sync()` 전에 돌기 때문에 두 기물이 원래 칸에 있다.

## Decisions

- **승률은 굴려서 구하고 기억한다.** 표를 박아 두지 않는다 — 기습 배수나 STATS 를 바꾸면
  저절로 따라온다. 한 탐색에서 실제로 굴리는 것은 수십 종류 × 200 회다.
- **체력은 뿌리에서만 정확히 쓴다.** 깊은 노드는 만피 기준. 정확한 척하는 것보다 낫다.
- **보정은 평가가 아니라 수에 붙인다.** `evaluate()` 를 체력 가중으로 바꾸면 잎에서
  같은 조회 문제가 생긴다.
- **공격자가 붙어서 싸운다.** 카메라를 넓히는 방법도 있었지만 그러면 둘이 허공에 칼을
  휘두르는 그림이 된다.

## Assumptions

- 표본 200 회의 오차(±3.5%p)가 수 선택에 충분하다.

## Relevant context

- `src/combat.ts` — `winChance`
- `src/ai.ts` — `captureRisk`, `search`, `bestMove`
- `src/board3d.ts` — `playDuel`, `glide`
- `src/main.ts` — `aiTurn` 이 체력을 넘긴다

## Allowed scope

- AI 평가, 전투 연출과 그 문서

## Forbidden scope

- 체스 규칙, `combat.ts` 의 전투 공식·밸런스 수치, `health.ts` 의 장부 규칙

## Acceptance criteria

- 빈사 상태 기물로는 공짜 잡기도 하지 않는다.
- 같은 값 기물 둘 중 다친 쪽을 노린다.
- 체력을 넘기지 않으면(정통 모드) 예전과 같이 둔다.
- 멀리 있는 기물을 잡을 때 공격자가 수비 기물 앞까지 와서 싸운다.
- 탐색이 반상 상태를 훼손하지 않는다.

## Human judgment

- AI 가 지나치게 소극적으로 보이는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- `ai.test.ts` 의 결투 모드 3개
- 실제 대국: f6 나이트가 e4 를 잡을 때 붙어서 싸우는지

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
