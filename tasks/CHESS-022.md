---
id: CHESS-022
title: 터치로 칸을 눌러도 판이 선택되지 않게
status: DONE
type: bug
profile: web

risk:
  level: low
  reasons:
    - user-select 를 넓게 끄면 기보를 복사할 수 없게 된다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — 모바일에서 기물을 누를 때마다 판 전체에 파란 막이 한 번씩 올라온다.

브라우저가 캔버스를 "선택" 한 것이다. 터치로 빠르게 두 번 누르면 잘 뜬다. 데스크톱
마우스로는 안 나서 지금까지 안 보였다.

## What we are shipping

- 탭 하이라이트 제거(`-webkit-tap-highlight-color: transparent`)
- 본문 선택 끄기(`user-select: none`), 기보는 예외 — 복사할 수 있어야 한다
- 반상 길게 누르기 메뉴 제거(`-webkit-touch-callout: none`)

## What we are not shipping

- 전역 `user-select: none` — 기보를 못 옮기게 된다

## Facts

- 반상은 `<canvas>` 이고 선택되면 요소 전체에 막이 씌워진다 — 그래서 "판 전체" 로 보인다.
- `touch-action: manipulation` 은 더블탭 확대만 막고 선택은 막지 않는다.

## Decisions

- **본문에서 끄고 기보에서만 되살린다.** 게임 화면에서 고를 것은 칸이지 요소가 아니다.

## Assumptions

- 기보 외에 복사할 텍스트는 없다.

## Relevant context

- `index.html` — `body`, `#board`, `#moves`

## Allowed scope

- 터치 선택·하이라이트

## Forbidden scope

- 조작 로직, 레이아웃

## Acceptance criteria

- 터치로 칸을 눌러도 파란 막이 뜨지 않는다.
- 기보는 여전히 선택·복사된다.

## Human judgment

- 실제 폰에서 사라졌는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 계산된 스타일 확인 (실제 터치 재현은 데스크톱 크롬에서 불가)

## Rollback

- 단일 커밋 revert.
