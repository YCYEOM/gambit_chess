---
id: CHESS-008
title: '아이템: 랜덤 칸에 나타나 기물에게 능력을 준다'
status: DONE
type: feature
profile: web

risk:
  level: medium
  reasons:
    - 재행동이 턴 순서를 건드린다 — chess.js 에 API 가 없어 FEN 을 갈아 끼운다
    - 그 때문에 무르기를 game.undo() 에서 FEN 스냅샷 방식으로 교체했다
    - 새 상태(아이템 배치)가 무르기·새 게임과 어긋날 여지가 있다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 요청 — 일정 시간마다 빈 칸에 아이템이 나타나고, 먹으면 추가 이동이나 치명타 확률
같은 특별한 능력이 생겼으면 좋겠다.

지금은 매 수가 "무엇을 잡을까"뿐이다. 반상에 잡는 것 말고 다른 목표가 없다.

## What we are shipping

- `items.ts` — 6수마다 빈 칸에 하나(최대 2개), 줍기, 스냅샷/복원
- 아이템 넷: 재행동 · 예리함(치명타 +15%p) · 분노(공격력 +3) · 응급처치(체력 만피)
- 효과는 기물에 붙어 따라다닌다 (`pieceState` 를 체력 전용에서 상태 전반으로 확장)
- 반상 표시: 떠서 도는 결정체 + 바닥 고리, 능력 지닌 기물 발밑 보라 고리, 안내줄
- 무르기를 FEN 스냅샷 방식으로 교체

## What we are not shipping

- AI 가 아이템을 주우러 가는 판단
- 효과의 만료 (얻으면 그 기물이 죽을 때까지 유지)
- 아이템끼리의 상호작용

## Facts

- 아이템은 빈 칸에만 놓이므로 잡는 수로는 닿지 않는다. 조용한 수로만 줍는다.
- `chess.js` 에 차례를 바꾸는 API 가 없다. `load(fen)` 이 유일한 길인데 내부 이력을 지운다.
- `load()` 로 이력이 지워지면 `game.undo()` 가 쓸모없어진다.
- 효과가 기물을 따라다니려면 체력 장부와 같은 이동 규칙(캐슬링·앙파상·승진)이 필요하다.

## Decisions

- **`pieceState` 의 값 타입을 숫자에서 레코드로 바꾼다.** 이미 검증된 이동 규칙을 그대로
  물려받는다 — 두 번째 장부를 만들지 않는다.
- **재행동은 FEN 으로 차례를 뒤집는다.** 앙파상 칸은 지운다 (같은 쪽이 한 번 더 두면
  그 권리는 사라진 것이다).
- **무르기를 FEN 스냅샷으로 바꾼다.** 재행동 때문에 "두 수 되돌리기"가 항상 내 차례로
  오지 않는다. 마지막으로 내가 두기 직전 상태를 찾아 통째로 되돌린다.
- **색은 CSS 토큰으로.** 아이템 색을 소스에 박으면 색 정의가 두 곳이 된다.
- **안내줄을 둔다.** 색만으로는 효과를 알 수 없다.

## Assumptions

- 6수마다 최대 2개면 "가끔 나오는 기회"로 느껴진다.
- 영구 효과가 누적돼도 한 기물이 지나치게 강해지지는 않는다 (그 기물이 죽으면 사라지므로).

## Relevant context

- `src/items.ts` (신규), `src/pieceState.ts` (health.ts 에서 이름 변경)
- `src/combat.ts` — `Bonus`, `duel(..., bonus)`, `winChance(..., bonus)`
- `src/duel.ts` — `stateOf` 콜백
- `src/main.ts` — `pickUp`, 재행동, FEN 무르기
- `src/board3d.ts` — `showItems`, `showBuffed`

## Allowed scope

- 아이템 시스템과 그에 딸린 상태·표시·문서
- 무르기 방식 교체

## Forbidden scope

- 체스 규칙, 전투 공식의 기존 상수, 밸런스 승률표

## Acceptance criteria

- 6수마다 빈 칸에 아이템이 나타나고 반상에 2개를 넘지 않는다.
- 기물이 그 칸으로 가면 줍고, 효과가 기물을 따라다닌다.
- 재행동을 먹으면 같은 쪽이 한 번 더 둔다.
- 무르기가 아이템 배치와 기물 상태까지 되돌린다.
- 정통 체스 모드에는 아이템이 나오지 않는다.
- 반상 아래 안내줄이 놓인 아이템의 이름과 효과를 알려준다.

## Human judgment

- 6수마다 최대 2개가 적당한지.
- 영구 효과가 게임을 망가뜨리지 않는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- `items.test.ts` 12개
- 실제 대국: 6수째 아이템 출현, 안내줄, 반상 표시
- FEN 차례 뒤집기와 복원은 node 로 따로 확인

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
