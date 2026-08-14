---
id: CHESS-021
title: 타격이 반상 위에서 터진다
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 매 타격마다 메시와 재질을 만든다. 정리하지 않으면 GPU 버퍼가 쌓인다

human:
  observer: user
  owner: user
  reviewer_required: true
---

## Problem

사용자 요청 — 공격 이펙트.

지금 전투는 공격 모션과 계기판 숫자뿐이다. 때린 순간이 화면에서 그냥 지나가서, 무엇이
일어났는지 숫자를 읽어야 안다.

## What we are shipping

- 맞은 자리에 퍼지는 고리, 튀는 파편, 때린 방향으로 눕는 초승달
- 치명타는 `--crit` 색으로 더 크게 (계기판 숫자 색과 같은 뜻)
- 무르기·새 게임에서 남은 이펙트를 지운다

## What we are not shipping

- 카메라 흔들림 — `glide`·`flyCamera` 가 카메라를 직접 옮기고 있어 서로 싸운다
- 파티클 시스템·셰이더 — 고리 하나와 구 몇 개면 읽힌다
- 이동·줍기 이펙트 (전투만)

## Facts

- `playDuel` 의 타격 루프가 `play(victim, 'Hit')` 로 피격 모션을 재생하는 지점이 곧 타격 순간이다.
- `strike` 에는 `crit`·`ambush` 가 이미 들어 있다 — 판정은 `combat.ts` 가 끝냈다.
- `tick()` 이 매 프레임 `dt` 를 갖고 있다 (아이템 회전에 쓰던 것).
- 재질은 인스턴스마다 투명도를 따로 애니메이션하므로 공유할 수 없다 — 끝나면 dispose 한다.

## Decisions

- **화면에서 판정하지 않는다.** `strike.crit` 하나만 읽는다 (DESIGN 원칙).
- **색은 계기판과 같은 뜻으로.** 보통 `--danger`, 치명타 `--crit`.
- **초승달은 때린 쪽을 향해 눕힌다.** 누가 누구를 쳤는지가 숫자보다 먼저 읽혀야 한다.
- **정리는 두 곳에서.** 수명이 끝나면 dispose, 반상이 갈아엎히면(`sync`) 통째로.

## Assumptions

- 고리·파편·초승달 셋이면 충분하고, 그 이상은 반상을 어지럽힌다.

## Relevant context

- `src/board3d.ts` — `Effect`, `emit`, `playStrike`, `stepEffects`, `clearEffects`, `playDuel`, `tick`

## Allowed scope

- 전투 재생의 시각 효과

## Forbidden scope

- 전투 판정, 데미지 수치, 계기판 규칙

## Acceptance criteria

- 타격마다 맞은 자리에서 효과가 터지고 0.5초 안에 사라진다.
- 치명타가 눈에 띄게 다르다.
- 무르기·새 게임 뒤 잔여 효과가 없다.
- 프레임이 눈에 띄게 떨어지지 않는다.

## Human judgment

- 세기와 색이 과한지 (반상을 가리면 안 된다).

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 전투 화면 확인 — **이번 회차에서는 못 했다** (아래 Rollback 위 기록 참고)

## Rollback

- 단일 커밋 revert.
