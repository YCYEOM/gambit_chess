---
id: CHESS-013
title: 캐슬링에서 룩의 화살표도 그린다
status: DONE
type: bug
profile: web

risk:
  level: low
  reasons:
    - 직전 수 표시는 무르기·새 게임과 함께 지워져야 한다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — "상대 왕이 룩을 띄워 넘어서 움직일 수 있는 것 같다."

캐슬링이었다. 규칙 판정도 이동도 정확했지만, 화살표를 킹만 그려서 킹이 룩을 뛰어넘은
것처럼 보였다. 룩은 소리 없이 반대편에 가 있다.

CHESS-007 에서 "캐슬링은 킹의 이동만 그린다" 를 알려진 한계로 남겨 뒀는데, 그 한계가
실제로 규칙 위반처럼 읽혔다.

## What we are shipping

- 캐슬링이면 룩의 화살표도 그린다 (킹은 밝게, 룩은 흐리게)
- 룩이 지나온 두 칸도 직전 수 색으로 물들인다

## What we are not shipping

- 캐슬링 애니메이션 (룩은 지금도 순간이동한다)
- 앙파상처럼 다른 특수 수의 추가 표시 — 잡힌 폰 자리는 이미 비어서 읽힌다

## Facts

- 캐슬링에서 함께 움직이는 룩은 `pieceState.castlingRook(move)` 이 이미 계산한다.
  체력 장부를 옮기려고 쓰던 것이라 새로 짤 필요가 없었다.
- `highlight()` 의 `last` 는 칸 두 개와 화살표 하나만 받는다.

## Decisions

- **이미 있는 `castlingRook` 을 export 해서 쓴다.** 같은 규칙을 두 번 적지 않는다.
- **룩은 흐리게.** 주인공은 킹이고, 룩은 딸려 온 움직임으로 읽혀야 한다.

## Assumptions

- 룩 화살표의 일부가 킹 모델에 가려도 (같은 줄에 서므로) 두 칸의 색만으로 읽힌다.

## Relevant context

- `src/pieceState.ts` — `castlingRook`
- `src/board3d.ts` — `addArrow`, `highlight`, `MARKER.arrowRook`
- `src/main.ts` — `log` 항목의 `rook`

## Allowed scope

- 직전 수 표시

## Forbidden scope

- 체스 규칙, 전투, 애니메이션

## Acceptance criteria

- 캐슬링을 두면 킹과 룩의 화살표가 함께 뜬다.
- 캐슬링이 아닌 수는 화살표가 하나 그대로다.
- 무르기·새 게임 뒤에 이전 화살표가 남지 않는다.

## Human judgment

- 룩 화살표가 킹에 가려 잘 안 보이는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 화면(Chrome): 양쪽 캐슬링을 두어 화살표 두 개 확인, 무르기 후 사라지는 것 확인

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
