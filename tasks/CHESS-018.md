---
id: CHESS-018
title: 빨간 칸은 경고다 — 결투 모드에서만
status: DONE
type: feature
profile: web

risk:
  level: medium
  reasons:
    - 두 모드의 규칙이 갈라진다. 한쪽에만 적용해야 할 것이 양쪽에 새면 정통 모드가 정통이 아니게 된다
    - 모든 기물의 유사합법수를 직접 두므로 앙파상·승진 같은 예외가 함께 걸린다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 요청·질문 두 가지.

1. "표시를 했는데도 옮기고 싶은 거면 그렇게 할 수 있게 해 줘." — 킹뿐 아니라 핀에 걸린
   기물도 빨간 칸으로 갈 수 있어야 한다.
2. "지금 바꾸는 룰들은 결투 모드에만 해당하는 거야? 기본 모드는 안 바꾸고 있는 거지?"

2번의 답은 **아니오** 였다. CHESS-011(스테일메이트=승리)과 CHESS-016(킹의 위험 칸·승패
판정)이 모드를 가리지 않고 들어가 있었다. 정통 체스 모드가 정통이 아니었다.

## What we are shipping

- 위험을 무릅쓴 수를 모든 기물로 넓힌다 (핀·체크 미해소 포함)
- 그 모든 규칙을 **결투 모드 안으로** 가둔다
- 정통 체스 모드 복구: 빨강은 금지, 체크메이트는 그 자리에서 끝, 스테일메이트는 무승부
- 모드 판정을 `isDuel()` 한 곳으로 모은다 (같은 조건이 여덟 군데 흩어져 있었다)

## What we are not shipping

- AI 에게 같은 자유를 주는 것 (CHESS-017 에서 정한 대로 사람만)
- 위험한 수를 두기 전 한 번 더 확인받는 창

## Facts

- `blockedSquares` 는 킹이면 "겨눠진 인접 칸", 그 외에는 "핀·체크 미해소로 막힌 칸" 을 준다.
  둘 다 유사합법수다.
- chess.js 의 `_moves({legal:false})` 는 그 수들을 만들어 준다. 내부 플래그는 비트라
  `Move.flags` 글자로 옮겨야 앙파상·승진이 뒤 단계에서 제대로 처리된다.
- 체크메이트에서도 유사합법수는 거의 항상 남는다 — 그래서 "완전히 갇힘" 은 드물다.

## Decisions

- **표시를 보고도 가겠다면 간다.** 금지와 경고를 색으로 나누지 않는다 (사용자가 빨강 유지를
  요청했다). 대신 모드로 나눈다 — 정통 체스에서는 같은 빨강이 금지다.
- **정통 모드는 `game.move()` 만 쓴다.** 억지로 두는 경로 자체를 주지 않는다.
- **`isDuel()` 하나로 모은다.** 모드 조건이 흩어져 있으면 다음에 또 샌다.

## Assumptions

- 핀이 사라져도 결투 모드는 여전히 재미있다 (전투 확률이 긴장을 대신한다).

## Relevant context

- `src/duel.ts` — `forceMove`(킹 전용에서 일반화), `plainMove`
- `src/main.ts` — `isDuel`, `canRisk`, `hasRisky`, `cornered`, `result`, `statusText`, `onSquare`

## Allowed scope

- 두 모드의 규칙 경계, 위험을 무릅쓴 수

## Forbidden scope

- 전투 공식, 탐색, 아이템·런 규칙

## Acceptance criteria

- 결투 모드에서 핀에 걸린 기물이 빨간 칸으로 움직인다.
- 정통 체스 모드에서는 같은 수가 막히고 이유가 상태줄에 뜬다.
- 정통 체스 모드의 체크메이트는 그 자리에서 끝나고, 스테일메이트는 무승부다.
- 결투 모드의 판정(킹은 죽어야 진다)은 그대로다.

## Human judgment

- 핀이 사라진 결투 모드가 너무 헐거운지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- `duel.test.ts` 2개 추가 (핀 기물 강행, 정통 모드 거부)
- 실제 화면(Chrome): 핀에 걸린 비숍을 눌러 빨간 칸으로 보내고 안내줄 확인

## Rollback

- 단일 커밋 revert.
