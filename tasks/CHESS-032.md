---
id: CHESS-032
title: 아이템 표식을 낙인 자국으로
status: DONE
type: change
profile: web

risk:
  level: low
  reasons:
    - 표식이 안 보이면 아이템이 있다는 것 자체를 놓친다

human:
  owner: user
  reviewer_required: true
---

## Problem

발밑 표식이 매끈한 `RingGeometry` 에 반투명 색 테였다. 반상이 나무가 되고(CHESS-027)
받침이 통나무 단면이 된(CHESS-028) 뒤로, 이 색 테가 장면에서 유일하게 표면이 없는
물건이 됐다 — 판 위에 얹힌 게임 UI 로 읽혔다.

## What we are shipping

반상에 지진 **낙인 자국**.

- **테두리가 고르지 않다.** 쇠는 고르게 눌리지 않는다 — 낮은 주파수 셋(3·5·8 로브).
  반상·받침과 같은 방법이다.
- **그을음이 바깥으로 번진다.**
- **탄 자국 안에 아이템 색이 남는다.** 색 구분은 그대로 살아야 한다.
- 지질 때 삐져나온 자국 몇 개.
- 아이템 종류당 256px 캔버스 하나. 지오메트리는 `RingGeometry` → `PlaneGeometry` 하나.

## What we are not shipping

- **img2threejs 파이프라인.** 이건 재구성이 아니라 그냥 그린 표식이다. 레퍼런스 사진이
  없고, 문제도 "레퍼런스와 안 닮았다" 가 아니라 "장면에 안 어울린다" 였다.

## Facts

- 첫 시안은 색 선이 4.5px, alpha 0.95 였다. 실제 크기(약 54px)로 놓고 매끈한 색 테와
  나란히 보니 **눈에 띄게 덜 보였다** — 낙인이 어두운 재질이라 그렇다.
- 색 선을 7px, alpha 1, 자기 색 글로우 7 로 올려 시인성을 지금 수준으로 되돌렸다.

## Decisions

- **장면에 어울리게 만들다가 안 보이게 만들면 진 것이다.** 표식의 본래 일은 "여기 뭔가
  있다" 를 알리는 것이고, 어울림은 그다음이다. 굴곡·그을음은 유지하고 색 선만 올렸다.
- 그리는 순서는 그을음 → 탄 테 → 아이템 색. 바꾸면 색이 그을음에 묻힌다.

## Assumptions

- 낙인이 이 게임의 톤에 맞다. 아니면 이 커밋 revert 로 매끈한 색 테로 돌아간다.

## Relevant context

- `src/board3d.ts` — `brandTexture`, `itemBaseGeo`, `itemMaterial`

## Allowed scope

- 아이템 발밑 표식

## Forbidden scope

- 아이템 규칙, 기호(글리프), 스폰 주기

## Acceptance criteria

- 네 종류가 색으로 갈린다.
- 실제 크기에서 매끈한 색 테만큼 눈에 띈다.
- 반상 위에 얹힌 것이 아니라 새겨진 것으로 읽힌다.
- 타입체크·테스트 통과.

## Human judgment

- 낙인이 맞는지. 매끈한 색 테로 되돌리는 것은 단일 커밋 revert 다.

## Verification

- `npx tsc --noEmit`, `npx vitest run` (89 통과)
- 브라우저에서 **실제 셰이딩과 같은 코드로 캔버스를 그려** 반상 나무색 위에 실제 크기
  (54px)와 확대본을 매끈한 색 테와 나란히 놓고 비교했다. 네 색 모두 실제 크기에서 구분되고,
  색 선을 올린 뒤 시인성이 기존과 비슷해졌다.
- **반상에 실제로 아이템을 띄워 확인하지는 못했다.** 아이템은 6수마다 나오는데 그 국면까지
  가는 클릭이 이번 회차에 반상에 닿지 않았다. 지오메트리·재질 배선은 기존 `showItems`
  경로를 그대로 쓰고 텍스처만 바뀌었다.

## Rollback

- 단일 커밋 revert.
