---
id: CHESS-029
title: 반상을 널판 바닥 위에 앉힌다
status: DONE
type: feature
profile: web

risk:
  level: medium
  reasons:
    - 소품 하나가 아니라 화면 전체의 인상이 바뀐다
    - 바닥이 밝아지면 반상에서 시선을 뺏는다

human:
  owner: user
  reviewer_required: true
---

## Problem

반상이 검은 허공에 떠 있었다. 그림자가 떨어질 자리가 없으니 놓인 물건이 아니라 잘라 붙인
그림처럼 보였고, 실제로 `castShadow` 는 켜져 있지도 않았다 — 받을 것이 없었으니까.

## What we are shipping

레퍼런스: [Weatherworn top of wooden table](https://commons.wikimedia.org/wiki/Category:Wood_planks)
(Wikimedia Commons, 풍화된 널판). 스펙: `docs/table-recon/object-sculpt-spec.json`
(strict-quality PASS).

- **널판 바닥** 60×60, 반상 밑면 높이(y = -0.62)에. 삼각형 둘, 드로우콜 하나.
- **널 폭 2.2칸** — 반상의 1칸보다 굵어야 바닥이 아래로 물러난다.
- **이음매**는 선이 아니라 어두운 틈이다 (실측 밝기비 0.211).
- **널 폭이 고르지 않다** (±18% 로 걸어간다), 널마다 바탕 톤도 다르다.
- **도드라진 결**과 **옹이**.
- **반상이 그림자를 던진다.** 이게 이 작업의 실제 목적이다.

## What we are not shipping

- 다리·모서리 같은 테이블 형태. 레퍼런스는 표면이지 물건이 아니다.
- 레퍼런스의 절대 밝기. 아래 참조.

## Facts

- 널 median **#838386, 채도 0.022** — 풍화가 나무색을 완전히 걷어 갔다.
- 이음매/널 밝기비 **0.211**, 결 하이라이트/널 **1.404**.
- **탈조명 알베도는 #4A494C** 로 사진값보다 훨씬 어둡다 (PBR 신뢰도 0.86).
  사진의 밝기는 한낮 직사광이지 색이 아니다.
- 승인 게이트가 독립적으로 같은 판정을 냈다 — "foreground coverage 1.000, 분리할 실루엣이
  없다". 이 레퍼런스는 물건이 아니라 **재질** 레퍼런스다.

## Decisions

- **재질만 재구성한다.** 지오메트리는 게임이 정하고(카메라를 덮는 평면), 레퍼런스는 색·
  이음매 구조·널 리듬·결 요철만 준다. 실루엣 게이트는 돌리지 않았고 통과했다고 주장하지도
  않는다.
- **바닥색은 알베도 숫자가 아니라 보이는 결과에 맞춘다.** 탈조명 #4A494C 는 물리적으로
  맞지만 이 장면 조명에서는 숯색으로 착지한다 — 레퍼런스는 한낮 직사광이고 여기 조명은
  훨씬 약하다. 탈조명값과 사진값 사이인 #5F5E61 로 깔았다.

## Facts — 색공간 버그 (이 작업에서 발견)

`token()` 이 돌려주는 `THREE.Color` 는 **선형** 공간이다. three 가 재질 색을 그렇게 받기
때문인데, 캔버스에 칠할 값은 sRGB 라 되돌려야 한다. 그냥 `.r` 을 쓰면 어두운 색일수록
크게 어긋난다 — `#211d1a` (sRGB 0.129) 가 캔버스에서 0.015 로 칠해진다.

**CHESS-028 의 어두운 진영 받침이 뭉개져 보이던 것이 이 버그였다.** `srgbOf()` 를 넣어
받침과 바닥 양쪽을 고쳤다.

## Assumptions

- 카메라는 반상 위에서만 본다. 바닥은 지평선 밖까지 갈 필요가 없다.

## Relevant context

- `src/board3d.ts` — `srgbOf`, `PLANK`, `plankTexture`, `buildGround`, `body.castShadow`
- `index.html` — `--table`
- `docs/table-recon/`

## Allowed scope

- 바닥면과 그 재질, 반상의 그림자 캐스팅

## Forbidden scope

- 조명 값, 카메라, 반상, 기물

## Acceptance criteria

- 반상이 바닥에 놓인 것으로 읽히고 그림자가 보인다.
- 바닥이 반상에서 시선을 뺏지 않는다.
- 드로우콜 하나, 삼각형 둘.
- 타입체크·테스트 통과.

## Human judgment

- 바닥이 생긴 쪽이 나은지. 이건 소품 하나가 아니라 화면 전체 인상을 바꾸는 변경이라
  단일 커밋으로 묶어 통째로 되돌릴 수 있게 해 뒀다.

## Verification

- `npx tsc --noEmit`, `npx vitest run` (89 통과)
- img2threejs 게이트: 이미지 분석 → 적합성 **CONDITIONAL, 재질 전용** → 참조 승인(실루엣
  분리 불가로 경고) → 사전 스펙 → 디테일 6개 → PBR 증거 1종(**0.86**, 지금까지 최고) →
  스펙 `--strict-quality` **PASS** → 브라우저 렌더 → 비교 → 리뷰 기록
- 네 목표 중 셋 통과 (반상 우위 0.90/0.85, 이음매 리듬 0.78/0.70, 결 요철 0.66/0.60),
  fidelity 0.76.
- **`desaturated-ground` 0.72/0.75 미달.** 풍화된 회색으로 읽히고 색기는 없지만 레퍼런스의
  은색보다 어둡다. 더 밝히면 반상과 경쟁하기 시작해 거기서 멈췄다.
- **blockout 패스는 크레딧을 받지 못했다** — 텍스처 벗긴 무광 렌더를 찍지 않았다.
- **Tier1·다각도·투영은 이유를 적고 건너뛰었다** (실루엣이 없는 대상, 고정 카메라,
  투영하면 레퍼런스의 직사광이 알베도에 구워진다).

## Rollback

- 단일 커밋 revert. 색공간 수정(`srgbOf`)만 따로 남기고 싶으면 그 부분만 체리픽할 것.
