---
id: CHESS-011
title: 스테일메이트를 승리로 친다
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - chess.js 의 isDraw() 가 스테일메이트를 포함하므로 판정 순서가 틀리면 그대로 무승부가 된다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — 흑이 킹만 남은 국면에서 갈 곳을 다 막았더니 무승부가 됐다. "내가 이길 수
있는 거잖아."

체스 규칙대로의 스테일메이트가 맞고 판정도 정확했지만, 압도적으로 이기고 있을 때만 나는
사고라 아케이드 게임으로는 벌처럼 느껴진다.

## What we are shipping

- 스테일메이트를 몰아붙인 쪽의 승리로 판정한다 (내가 갇히면 패배)
- 스테일메이트 표시에 못 두는 쪽과 승패를 적는다
- 무승부 사유에서 스테일메이트를 뺀다 (더 이상 무승부가 아니다)

## What we are not shipping

- 스테일메이트가 될 수를 미리 알려 주는 경고 표시
- 다른 무승부(삼세판·50수·기물 부족)의 판정 변경 — 그대로 무승부이고 런도 안 끊긴다
- AI 가 스테일메이트를 노리거나 피하는 판단 (평가 함수는 그대로)

## Facts

- chess.js 의 `isDraw()` 는 스테일메이트를 포함한다. 판정 순서가 곧 규칙이다.
- 이 게임은 이미 전투 판정·아이템·킹 포획으로 체스 규칙을 벗어나 있다.
- 무승부는 CHESS-010 에서 이미 런을 끊지 않게 해 두었다.

## Decisions

- **스테일메이트는 승리.** "이겼는데 무승부" 를 없애는 가장 싼 방법이고, 이 게임의 정체성과
  어긋나지 않는다. 경고 표시는 규칙을 지키는 대신 코드가 더 들고, 사고 자체는 그대로 남는다.
- **못 두는 쪽을 화면에 적는다.** 내가 갇힐 수도 있는데 "상대가 둘 수가 없다" 로 고정돼
  있었다.

## Assumptions

- 스테일메이트로 이기는 것이 허무하게 느껴지지는 않는다 (어차피 이기고 있던 판이다).

## Relevant context

- `src/main.ts` — `result`, `statusText`, `drawReason`

## Allowed scope

- 판이 끝나는 판정과 그 표시

## Forbidden scope

- 체스 이동 규칙, 전투 공식, AI 평가 함수

## Acceptance criteria

- 상대가 스테일메이트면 승리로 처리되고 보상 화면이 뜬다.
- 내가 스테일메이트면 패배로 처리되고 런이 끝난다.
- 삼세판·50수·기물 부족은 그대로 무승부이며 런을 끊지 않는다.
- 화면에 못 두는 쪽과 승패가 적힌다.

## Human judgment

- 스테일메이트 승리가 너무 쉬운 마무리가 되는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 화면(Chrome): 양쪽 스테일메이트 국면을 각각 올려 승리·패배 처리 확인

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
