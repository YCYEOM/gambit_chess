---
id: CHESS-014
title: 난이도 고정, 승진 선택, 승진 기물의 강화
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 승진 선택이 수를 두는 흐름 한복판에서 사용자 입력을 기다린다
    - 강화를 빼고 더하는 계산이 틀리면 기물이 조용히 약해지거나 세진다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 요청 세 가지.

- 연승할수록 상대 난이도가 오르는데, 고른 난이도 그대로여야 한다.
- 폰이 끝에 닿으면 무조건 퀸이 되는데, 원래 고를 수 있어야 한다.
- 그렇게 고른 기물에도 런에서 얻은 강화가 적용되어야 한다.

## What we are shipping

- 난이도는 고른 그대로 (`levelIndex` 제거, 런 줄에서 "상대 X" 도 뺀다)
- 승진 기물 선택 — 퀸·룩·비숍·나이트, 결투 모드면 체력·공격력을 함께 보여준다
- AI 도 자기가 고른 기물로 승진한다 (전에는 AI 의 선택을 버리고 퀸으로 덮었다)
- 승진하면 강화가 새 종류를 따라간다 (`repromote`)

## What we are not shipping

- 승진 애니메이션
- 난이도를 다른 방식으로 올리는 장치 — 상대는 이제 고정이다
- 아이템으로 얻은 개인 효과의 재계산 (그건 기물을 따라가는 것이 규칙이다)

## Facts

- 승진은 `chess.js` 의 `promotion` 인자로 정해진다. `apply()` 가 항상 `'q'` 를 넣고 있었다.
- `bestMove` 가 돌려주는 Move 에는 이미 AI 가 고른 `promotion` 이 들어 있었는데 버려졌다.
- 보상 화면(`#reward`)은 (제목·설명·카드 목록) 만 받는 일반 컴포넌트다.
- 강화는 판 시작 때 `grant` 로 심는다. `grant` 는 더하기이므로 음수를 주면 뺄 수 있다.

## Decisions

- **승진 선택은 보상 화면을 그대로 쓴다.** 카드 넷을 내미는 화면이 이미 있다.
- **강화는 지금 종류를 따른다.** 폰으로 받은 몫을 빼고 새 종류 몫을 얹는다. 전군 강화는
  어느 종류든 대상이라 그대로 둔다.
- **난이도 상승을 없앤다.** 이기고 있는데 상대가 저절로 세지면 이긴 값이 아니라 벌이 된다.

## Assumptions

- 연승이 길어질수록 판이 쉬워지는 것을 사용자가 받아들인다 (요청 그대로다).

## Relevant context

- `src/main.ts` — `choosePromotion`, `apply(from, to, promotion)`, `runBar`, `aiTurn`
- `src/run.ts` — `repromote`, `levelIndex` 제거

## Allowed scope

- 난이도 선택, 승진 흐름, 런 강화 계산

## Forbidden scope

- 전투 공식, 체스 규칙, 탐색

## Acceptance criteria

- 난이도가 연승과 무관하게 고른 그대로다.
- 폰이 끝에 닿으면 네 기물 중 고르게 하고, 고른 대로 승진한다 (기보에 `a8=N`).
- 승진한 기물이 새 종류의 강화를 받고 폰 몫은 내려놓는다.
- 전군 강화와 아이템 효과는 승진해도 그대로다.

## Human judgment

- 연승이 길어지면 쉬워지는 것을 그대로 둘지, 나중에 다른 장치로 조일지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- `run.test.ts` 13개 (승진 강화 재계산 2개 추가)
- 실제 화면(Chrome): a7 폰을 승진시켜 도적(나이트)을 고르고 `1. a8=N` 확인

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
