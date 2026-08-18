---
id: CHESS-027
title: 반상을 나무 체스판 사진에서 다시 세운다
status: DONE
type: feature
profile: web

risk:
  level: medium
  reasons:
    - 반상 폭이 8.7 에서 9.24 로 바뀌어 카메라 맞춤 상수(HALF)가 따라 움직인다
    - 칸을 집는 평면(y=0)을 건드리면 게임이 통째로 멈춘다

human:
  owner: user
  reviewer_required: true
---

## Problem

반상이 `BoxGeometry` 두 줄이었다 — 칸 64개와 8.7 짜리 테두리 상자 하나. 기물은 KayKit
모델인데 판만 색칠한 상자라 화면에서 겉돌았다.

사용자 요청: img2threejs 로 정적인 소품을 만들어 달라. 이 작업은 그중 반상 하나다.

## What we are shipping

레퍼런스: [Empty wooden chessboard.jpg](https://commons.wikimedia.org/wiki/File:Empty_wooden_chessboard.jpg)
(Wikimedia Commons). 스펙: `docs/board-recon/object-sculpt-spec.json` (strict-quality PASS).

- **연귀 테두리** — 네 변이 45도로 맞물리고, 결이 각 변의 길이를 따라 흐른다. 모서리에서
  결이 꺾이는 것이 연귀로 읽힌다.
- **모따기** — 바깥 윗모서리에 좁은 띠 하나. 빛을 따로 받는다.
- **두꺼운 슬랩** — 두께 0.62 칸. 판이 종이가 아니라 상자로 보이게.
- **나무-대-나무 칸** — 흑백이 아니다. 칸마다 결 창을 다른 자리에서 떠서 64칸이 같은
  무늬로 반복되지 않고, 밝은 칸과 어두운 칸은 결 방향이 90도 엇갈린다.
- **결 텍스처 두 장** (색 1024, 거칠기 512). 씨 고정이라 새로고침해도 같은 판이다.
  내려받는 것은 없다.
- **니스 = 클리어코트.** 테두리·슬랩만 `MeshPhysicalMaterial`. 칸 64개는 `MeshStandard` 다.
- 드로우콜 5개 (밝은 칸 / 어두운 칸 / 테두리 3겹 / 슬랩).

## What we are not shipping

- **모서리 스플라인 홈.** 만들고, 띄우고, 재고, 지웠다. 옆면이 이 카메라에서 4px 라
  0.014 폭 홈은 서브픽셀이다 — 한 프레임도 안 보이는 메시 24개였다.
- **접이식 경첩 이음매.** 우리 반상은 한 장이다. 그 줄이 a~h 파일을 가로지르면
  판이 갈라진 렌더링 사고로 보인다.
- **레퍼런스 색.** 아래 참조.

## Facts

- `pick()` 은 `THREE.Plane(0,1,0)` 을 0 에서 레이캐스트해 칸을 정한다. **반상 윗면은
  반드시 y=0** 이고, 이 값이 움직이면 칸을 못 집는다.
- 레퍼런스 실측: 테두리 폭 0.11W, 두께 0.075W, 밝은/어두운 칸 휘도비 0.694
  (검증한 단일 칸 크롭 두 장에서 잰 값), 어두운 톤 색상각이 약 7도 더 붉다.
- 사다리꼴 띠에 직사각형 UV 를 씌우면 두 삼각형이 만나는 대각선에서 결이 꺾여, 모서리도
  아닌 자리에 **가짜 연귀가 하나 더** 생긴다. u 를 실제 좌표에 비례시켜야 사라진다.
- 결 캔버스는 선을 v 방향으로 긋는다. 띠의 길이 방향을 u 에 실으면 결이 레일을
  **가로지른다**. 길이 방향을 v 에 실어야 레퍼런스처럼 레일을 따라 흐른다.
- 칸 윗면을 시계 방향으로 감으면 법선이 아래를 봐서 64칸이 통째로 사라진다.

## Decisions

- **색은 프로젝트 토큰이 정한다.** DESIGN.md 가 `index.html` 의 `:root` 를 색의 단일
  원천으로 못박고 있다. 레퍼런스는 **구조와 관계**(휘도비·색상각 차이)만 준다.
  새 토큰은 `--board-frame` 하나뿐이고 두 칸 색 사이 값이다.
- **테두리 폭은 0.067W.** 레퍼런스대로 0.11W 를 쓰면 판이 10.26 칸이 되고 카메라가
  물러나 반상이 화면에서 18% 작아진다. "반상이 화면을 지배한다"(DESIGN.md)와 정면으로
  부딪힌다.
- **생성기 대신 손으로 썼다.** `generate_threejs_factory.py` 는 blockout 패스만 내놓고
  `EffectComposer`·`Bloom`·`Bokeh`·`OrbitControls` 를 끌고 오며 메시마다 스펙 JSON 전체를
  `userData` 에 박는다. 4.4MB PWA 에 넣을 물건이 아니다. 스킬이 허용하는 `refine-code`
  경로로 갔고, 결정의 원본은 코드가 아니라 스펙(`docs/board-recon/`)에 남는다.

## Assumptions

- 카메라는 언제나 반상 위에 있다. 밑면은 닫아 두되 결은 입히지 않는다.

## Relevant context

- `src/board3d.ts` — `BOARD`, `BOARD_HALF`, `seeded`, `grainCanvas`, `mitredRing`, `buildBoard`, `HALF`
- `index.html` — `--board-frame`
- `docs/board-recon/` — 스펙·이미지 분석·비교 시트

## Allowed scope

- 반상 지오메트리와 재질, 카메라 맞춤 상수

## Forbidden scope

- 칸 좌표계(`squareToWorld`/`worldToSquare`), 픽 평면, 기물, 규칙

## Acceptance criteria

- 칸을 누르면 예전과 똑같이 집힌다 (윗면 y=0 유지).
- 반상이 나무판으로 읽힌다 — 연귀 테두리·모따기·두께·결.
- 드로우콜이 늘지 않는다 (64 → 5).
- 넘침 없음, 타입체크·테스트 통과.

## Human judgment

- **팔레트.** 레퍼런스는 채도 높은 오렌지 오크(색상 32도, 채도 0.78)이고 지금 토큰은
  크림/토프(`--light` 채도 0.19)다. Divine Eye 의 `hueZoneParity 0.0` 이 이 차이를
  그대로 재고 있다. 판을 레퍼런스 쪽으로 데려가려면 `--light`/`--dark` 를 바꿔야 하고,
  그러면 게임 전체 톤이 바뀐다. 사용자 결정 사항.
- 두께가 위에서 안 읽히는 문제를 시점으로 풀지, 두께로 풀지.

## Verification

- `npx tsc --noEmit`, `npx vitest run` (89 통과)
- img2threejs 게이트: 이미지 분석 → 적합성 PASS → 참조 승인 → 사전 스펙 →
  디테일 인벤토리(8개) → PBR 증거 3종(신뢰도 0.751/0.763/0.764) → 스펙 작성 →
  `--strict-quality` **PASS** → 브라우저 렌더 → Tier1 통과 → Divine Eye → 비교 시트 → 리뷰 기록
- **리뷰 결과는 통과가 아니다.** fidelity 0.67, 다섯 기능 목표 중 셋이 문턱 미달:
  `low-contrast-field` 0.62/0.75 (색), `mitred-frame` 0.75/0.80 (테두리 폭),
  `overall-silhouette` 0.72/0.80 (두께가 위에서 안 읽힘). 앞의 둘은 선언한 편차이고
  셋째는 남은 진짜 구멍이다. `spline-kerfs` 는 미제작(0.0).

## Rollback

- 단일 커밋 revert. 반상 밖 코드는 건드리지 않았다.
