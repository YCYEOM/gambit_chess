---
id: CHESS-003
title: 기물과 반상을 3D 캐릭터로 렌더링
status: DONE
type: feature
profile: web

risk:
  level: medium
  reasons:
    - 렌더링 방식을 통째로 바꾸며 2D 유니코드 반상을 버린다 (되돌리려면 커밋 revert)
    - 외부 에셋 4.2MB 를 저장소에 들인다
    - WebGL 이 필수가 되어 동작 환경이 좁아진다

human:
  owner: user
  reviewer_required: true
---

## Problem

기물이 유니코드 글자(♔♕♖)라 "캐릭터가 싸운다"는 결투 모드의 전제와 어긋난다. 사용자가
3D 캐릭터 렌더링을 요청했고, 반상도 이질적이지 않게 함께 바꾸기를 원했다.

`DESIGN.md` 의 "기물을 이미지 스프라이트로 교체하지 않는다. 유니코드로 충분하다" 를
뒤집는 작업이다. 사용자 승인을 받았다.

## What we are shipping

- `board3d.ts` — three.js 반상·기물·표시·전투 연출
- 백 = KayKit Adventurers, 흑 = KayKit Skeletons (CC0). 6역 배역과 장비 구성
- 전투를 반상 위에서 재생 — 카메라 진입, `Attack`/`Hit`/`Death` 모션
- HP 계기판(`#duel`)을 반상을 덮지 않는 띠로 축소
- `tools/strip-anims.mjs` — 쓰는 클립만 남겨 35.6MB → 4.2MB

## What we are not shipping

- 2D 유니코드 반상 (버린다)
- 걷기·도약 등 이동 애니메이션
- 접근성 대체 화면

## Facts

- KayKit 무료분은 모험가 5종(Knight/Barbarian/Mage/Rogue/Rogue_Hooded), 해골 4종
  (Warrior/Rogue/Mage/Minion). 6역에 모자란다.
- 모험가는 무기·투구·망토가 모델 안에 별도 메시 노드로 들어 있다 → 켜고 끄면 다른 기물.
- 해골은 무기가 별도 gltf 파일이고 `handslot.l` / `handslot.r` 빈 본이 있다 → 붙이면 된다.
- 모든 모델에 `Idle`, `Hit_A/B`, `Death_A/B`, `1H/2H_Melee_Attack_*` 이 들어 있다.
- 라이선스 CC0, 출처 표기 의무 없음 (`LICENSE.txt` 확인).

## Decisions

- **렌더러는 하나만 둔다.** 2D 를 남기면 기능 하나 고칠 때마다 양쪽을 고쳐야 한다.
  저사양 대응이 필요해지면 3D 안에서 품질을 낮춘다.
- **기물 색을 진영 색으로 물들이지 않는다.** 처음엔 흑을 38% 어둡게 칠했는데 캐릭터
  고유색이 죽었다. 산 자 / 죽은 자로 군대를 나누니 색 보정이 필요 없어졌다.
- **클릭은 기물이 아니라 바닥 평면을 맞힌다.** 기물에 가려진 칸도 집을 수 있어야 한다.
- **전투는 반상이 갱신되기 전, 두 기물이 원래 서 있던 자리에서 재생한다.** 판정은 이미
  끝났고 화면은 그것을 보여줄 뿐이다.
- 모델은 저장소에 넣는다. CC0 이고 4.2MB 라 외부 의존을 만들 이유가 없다.

## Assumptions

- 대상 브라우저에 WebGL2 가 있다.

## Relevant context

- `src/board3d.ts` (신규), `src/main.ts`, `index.html`
- `public/models/kaykit/` + `CREDITS.md`
- `tools/strip-anims.mjs` (신규)
- `DESIGN.md` — 원칙 2, Components, Do not

## Allowed scope

- 렌더링·입력·연출과 그에 딸린 문서
- 색 토큰 추가 (`--team-light`, `--team-dark`, `--last`)

## Forbidden scope

- 체스 규칙, 전투 판정(`combat.ts`), 반상 반영(`duel.ts`), AI 탐색
- 밸런스 수치

## Acceptance criteria

- 반상과 32개 기물이 3D 로 그려지고 6역이 서로 구분된다.
- 클릭으로 기물을 고르고 둘 수 있으며, 선택·합법수·직전 수·체크가 반상 위에 표시된다.
- 잡기 시 카메라가 두 기물로 들어가 공격·피격·사망 모션이 재생된다.
- 기보의 `✗` 가 전투가 끝난 뒤에 붙는다 (결과를 미리 알리지 않는다).
- 흑을 고르면 카메라가 반대편으로 넘어간다.
- 무르기·모드 전환·새 게임이 3D 상태와 어긋나지 않는다.
- 반상이 화면 안에 다 들어온다 (잘린 칸은 클릭도 안 된다).
- 모델 총량이 5MB 미만이다.

## Human judgment

- 배역과 기물 크기 서열이 원하는 그림인가 (승인 완료).
- 2D 반상을 버리는 것을 받아들이는가 (승인 완료).

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 실제 대국: 수 두기, 결투 재생, 무르기, 정통 모드, 흑 시점

## Rollback

- 커밋 revert. 영속 데이터가 없다. 2D 반상은 이전 커밋에 그대로 남아 있다.
