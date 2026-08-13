---
id: CHESS-012
title: 백 비숍의 머리를 되살린다
status: DONE
type: bug
profile: web

risk:
  level: low
  reasons:
    - 장비 메시를 이름으로 골라 켜고 끄므로, 판정을 바꾸면 다른 기물의 장비가 함께 바뀔 수 있다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — "비숍은 나이트 모델링에서 머리를 뗀 것 같은데 사람으로 만들어 달라."

정확한 관찰이었다. 백 비숍은 나이트와 같은 도적(Rogue) 몸에 머리만 없는 상태였다.

## What we are shipping

- 머리 메시를 장비 판정에서 뺀다 (`isGear`)
- 그 결과 백 비숍이 두건 쓴 머리를 되찾는다 — README 가 적어 둔 "두건 사수" 가 화면과 맞는다

## What we are not shipping

- 새 모델 추가 (무료 팩에 없다)
- 다른 기물의 장비 구성 변경

## Facts

- 장비는 메시 이름을 정규식으로 걸러 켜고 끈다. 목록에 없으면 숨긴다.
- `Rogue_Hooded.glb` 의 머리 메시 이름은 `Rogue_Head_Hooded` 다 — 두건과 머리가 한 덩어리다.
- 정규식에 `Hood` 가 있어 이 머리가 장비로 걸렸고, 기어 목록에 없으니 숨겨졌다.
- 다른 여덟 모델의 머리(`Knight_Head` 등)는 장비 낱말이 없어 무사했다. 해골 마법사는
  머리 메시 자체가 없다.

## Decisions

- **머리 이름을 기어 목록에 더하는 대신 판정을 고친다.** 그 한 줄로 이번 것만 막으면 같은
  덫이 다음 모델에서 또 걸린다. 머리는 장비가 아니다.

## Assumptions

- 두건 쓴 머리와 맨머리(나이트)가 위에서 봐도 구분된다.

## Relevant context

- `src/board3d.ts` — `OPTIONAL`, `isGear`, `spawn`

## Allowed scope

- 장비 메시 판정과 그 문서

## Forbidden scope

- 역할 배정, 모델 파일, 체스·전투 규칙

## Acceptance criteria

- 백 비숍이 머리를 갖고 서 있고, 나이트와 구분된다.
- 다른 열한 기물의 장비 구성이 그대로다.

## Human judgment

- 두건 사수가 나이트와 충분히 달라 보이는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 화면(Chrome): 백 여덟 기물을 확대해 머리와 장비 확인

## Rollback

- 단일 커밋 revert. 영속 데이터가 없다.
