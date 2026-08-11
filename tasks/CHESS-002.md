---
id: CHESS-002
title: '결투 모드: 기물을 잡을 때 실제 전투로 승패를 가린다'
status: DONE
type: feature
profile: web

risk:
  level: medium
  reasons:
    - chess.js 가 확정한 반상을 사후에 수정하므로 규칙 무결성이 깨질 여지가 있다
    - 승패 규칙이 바뀌므로 기존 정통 체스 경험을 되돌릴 수 있어야 한다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자가 "체스라는 기본틀을 벗어나지 않는 새로운 게임"을, 구체적으로는 "캐릭터가 진짜
싸워서 이기는 것처럼" 만들기를 원했다. 정통 체스에서 잡기는 결정적이다 — 도착하면 무조건
먹는다. 그래서 기물은 계산의 단위일 뿐 싸우는 주체로 읽히지 않는다.

## What we are shipping

- `combat.ts` — 기물별 HP/공격력과 턴제 전투 판정 (순수 함수, 주입 가능한 rng)
- `duel.ts` — 전투 결과를 반상에 반영. 공격 실패 시 공격자를 지우고 수비 기물 복구
- 결투 오버레이 — 타격·피해량·HP 바·치명타를 순서대로 재생
- 모드 선택 (`결투 모드` / `정통 체스`), 기본값은 결투 모드
- 기보에 무산된 수 `✗` 표시

## What we are not shipping

- HP 이어가기(부상 누적)
- AI 의 전투 확률 인식
- 전투 재생 건너뛰기

## Facts

- `chess.js` 는 `move()` 뒤 `remove()` + `put()` 으로 반상을 고쳐도 턴·캐슬링 권리·앙파상
  칸이 유효하게 남고, `undo()` 도 정확히 복원한다. 일반 잡기·앙파상·승진 잡기 세 경우 모두
  확인했다.
- `game.history()` / `game.pgn()` 은 초기 위치부터 수를 재생해 SAN 을 만들면서 **현재
  반상을 덮어쓴다.** 즉 위 수정이 조용히 사라진다.
- `isAttacked(square, color)` 로 수를 둔 쪽의 킹이 노출됐는지 확인할 수 있다.
- 기존 `render()` 는 `game.history()` 를 두 번 호출하고 있었다.

## Decisions

- **합법수 판정은 chess.js 그대로 둔다.** 전투가 뒤집는 것은 잡기의 결과뿐이다. 체크·
  체크메이트·캐슬링·앙파상이 모두 정통 체스와 같아야 "체스의 기본틀"이 유지된다.
- 공격자가 선공한다. 잡으러 가는 행위의 보상이자, 같은 기물끼리 붙었을 때 승부를 가르는 축.
- 전투 실패로 킹이 죽거나 노출되면 즉시 패배. 그대로 두면 chess.js 가 표현할 수 없는
  반상(킹이 잡히는 자리에 있는)이 남는다.
- 기보는 UI 가 직접 쌓는다. `history()` 를 쓰지 않는 것이 유일한 안전한 선택이다.
- 밸런스는 감이 아니라 시뮬레이션으로 정한다 (`scripts/balance.ts`, 20000회).

## Assumptions

- 사용자가 원한 것은 잡기의 **결과**가 바뀌는 것이지, 기물의 이동 규칙이 바뀌는 것은 아니다.
- 결투 모드가 기본이고 정통 체스는 남겨 두는 편이 낫다 (되돌릴 수 있어야 하므로).

## Relevant context

- `src/main.ts` — `render()`, `apply()`, `showDuel()`
- `src/ai.ts` — 전투를 모르는 채로 남는다
- `index.html` — `#duel` 오버레이, `#mode` 셀렉트
- `DESIGN.md` — 원칙 6·7, Components

## Allowed scope

- 새 파일 `src/combat.ts`, `src/duel.ts`, `scripts/balance.ts` 와 각 테스트
- `src/main.ts`, `index.html`, `README.md`, `DESIGN.md`

## Forbidden scope

- 기물 이동 규칙, 캐슬링·앙파상·승진의 합법성 판정
- `src/ai.ts` 탐색 알고리즘

## Acceptance criteria

- 잡기가 발생하면 전투가 화면에 재생되고, 결과가 반상과 일치한다.
- 공격 실패 시 공격자가 사라지고 수비 기물이 제자리에 남으며, **다시 그려도 유지된다.**
- 무산된 수가 기보에 `✗`로 표시된다.
- 정통 체스 모드에서는 전투 없이 기존과 동일하게 동작한다.
- 모든 기물 조합에서 최소 한쪽 방향의 역전이 가능하다. (약한 쪽이 공격할 때는 항상 가능.
  강한 쪽이 압도적인 조합 — 퀸이 폰을 칠 때 등 — 은 수학적으로 100% 이며 이는 의도된 것이다.)
- `undo` 로 전투 결과까지 되돌아간다.

## Human judgment

- 밸런스 표가 원하는 게임 느낌인가 (특히 같은 기물끼리 선공 승률 ~70%).
- 결투 모드를 기본값으로 두는 것이 맞는가.
- 킹 즉사 규칙 두 개가 납득 가능한가.

## Verification

- `bass evaluate --levels 1,2`
- `combat.test.ts` (7) / `duel.test.ts` (9) — 앙파상·승진·킹 노출·undo·history() 함정 포함
- 실제 렌더링: 전투 재생, 무산된 공격의 반상 유지, 기보 `✗`

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다. 되돌리지 않고 끄기만 하려면 모드 셀렉트에서
  `정통 체스`를 고르면 된다.
