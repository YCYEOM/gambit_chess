---
id: CHESS-015
title: 승진 카드에 기물 이름을 함께 적는다
status: DONE
type: bug
profile: web

risk:
  level: low
  reasons:
    - 표시 문구만 바꾼다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — 승진 카드에 역 이름(마법사·야만전사·두건 사수·도적)만 나와서 뭐가 퀸이고
뭐가 비숍인지 헷갈린다.

반상에서 보이는 것은 역이지만 규칙을 정하는 것은 기물이다. 한쪽만 적으면 무엇을 고르는지
알 수 없다.

## What we are shipping

- 카드 제목을 `퀸 · 마법사` 처럼 기물 이름 + 역 이름으로
- 어떻게 움직이는지 한 줄 (직선과 대각선, 어디든 / 직선으로만 / 대각선으로만 / ㄱ 자로)
- 기물 이름표를 `combat.ts` 의 `STATS` 하나로 모은다 (`run.ts` 가 같은 표를 또 갖고 있었다)

## What we are not shipping

- 카드에 기물 그림 넣기
- 다른 화면(보상·승패)의 문구 변경

## Facts

- `STATS[type].name` 이 이미 기물 이름을 들고 있다 (전투 계기판이 쓴다).
- `run.ts` 에 같은 이름표가 하나 더 있었다.

## Decisions

- **기물 이름을 앞에.** 고르는 것은 기물이고, 역은 그 기물이 반상에서 어떻게 보이는지다.
- **이름표는 STATS 하나로.** 같은 표를 두 곳에서 관리하지 않는다.

## Assumptions

- 카드 폭(168px)에서 `비숍 · 두건 사수` 가 두 줄로 접혀도 읽힌다.

## Relevant context

- `src/main.ts` — `choosePromotion`, `HOW_IT_MOVES`
- `src/run.ts` — `NAMES` 제거

## Allowed scope

- 승진 선택 카드의 문구와 기물 이름표의 출처

## Forbidden scope

- 승진 규칙, 전투 수치

## Acceptance criteria

- 카드에 기물 이름과 역 이름이 함께 나온다.
- 보상 카드의 문구(`폰 단련` 등)가 그대로다.

## Human judgment

- 카드가 두 줄로 접히는 것이 거슬리는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 화면(Chrome): 승진 화면에서 네 카드 문구 확인

## Rollback

- 단일 커밋 revert.
