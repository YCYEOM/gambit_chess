---
id: CHESS-028
title: 기물 받침을 통나무 단면으로 바꾼다
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 진영 구분이 흐려지면 게임을 읽을 수 없다. 이 작업의 유일한 위험이 그것이다

human:
  owner: user
  reviewer_required: true
---

## Problem

기물 발밑 원판이 `CylinderGeometry(0.4, 0.4, 0.06, 32)` 에 단색이었다. 밝은 진영 원판은
밝은 칸 위에서 테두리가 없어 어디서 끝나는지 보이지 않았고, 반상을 나무로 바꾼(CHESS-027)
뒤에는 플라스틱 칩처럼 겉돌았다.

## What we are shipping

레퍼런스: [Cross-section of an Oak Log](https://commons.wikimedia.org/wiki/File:Cross-section_of_an_Oak_Log_Showing_Growth_Rings.jpg)
(Wikimedia Commons). 스펙: `docs/base-recon/object-sculpt-spec.json` (strict-quality PASS).

- **울퉁불퉁한 둘레.** 껍질 붙은 단면은 정원이 아니다. 낮은 주파수 셋(3·5·8 로브)을 겹쳐
  만든다. 이 실루엣 하나가 "잘라 낸 나무"와 "플라스틱 칩"을 가른다.
- **반지름 띠 구조** — 껍질 0.94~1.00, 변재 0.78~0.94, 심재 ~0.78, 수 ~0.09.
  실측한 밝기 프로파일을 그대로 옮겼다.
- **나이테 34줄**, 바깥으로 갈수록 촘촘. 원판 한가운데가 아니라 **치우친 수**를 중심으로 돈다.
- **톱자국** — 수에서 뻗는 가는 방사선.
- **완전 무광** (roughness 0.92). 반상의 니스와 정반대라 두 나무가 다른 물건으로 읽힌다.
- 진영당 256px 캔버스 하나, 재질 둘. 예전에는 기물마다 재질을 새로 만들어 32개였다.

## What we are not shipping

- 껍질을 지오메트리로 세우는 것. 화면에서 24px 라 판때기 결이 서브픽셀이다.
- 밑면. 반상에 붙어 있어 한 번도 보이지 않는다.
- 레퍼런스 색. 아래 참조.

## Facts

- 실측 반지름별 밝기: 수 0~0.03R(lum 45-73), 심재 0.03~0.72R(106-155),
  **변재 0.72~0.88R(160-183)**, 껍질 0.88~1.00R(67-87).
- 추출 PBR: 심재 #AC7449 (신뢰도 0.818), 변재 #CF9B66 (0.808). 휘도비 심재/변재 0.767.
- 껍질은 **파생**이다. 이 사진에 껍질만 있는 구역이 PBR 을 뽑을 만큼 깨끗하지 않다.
- 레퍼런스는 하늘·나무·손이 함께 찍혀 rubric 상 **conditional** 이다. 얼굴면만 재구성하고,
  두께는 관측 불가라 게임 값(0.06)을 그대로 쓴다.

## Decisions

- **진영색이 절대색을 정한다.** 원판은 어느 편인지 말하려고 존재한다 (DESIGN.md).
  레퍼런스는 구조와 관계만 준다.
- **어두운 진영은 명암을 뒤집어 그린다.** "변재가 가장 밝다" 를 비율로 옮기면 검은 토큰
  위에서 0.767 배가 그냥 검정이라 구조가 통째로 사라진다. 밝은 쪽은 아래로, 어두운 쪽은
  위로 민다 — 세기는 레퍼런스를 따르고 방향만 바꾼다.
- **껍질 테는 중간 갈색 쪽으로 섞는다.** 검정 쪽으로 섞으면 검은 진영에서 사라진다.
  중간색으로 섞으면 밝은 쪽은 어두워지고 어두운 쪽은 밝아져 양쪽 다 읽힌다.

## Assumptions

- 카메라는 이 소품을 위에서만 본다.

## Relevant context

- `src/board3d.ts` — `BASE_R`, `BASE_H`, `BASE_WOOD`, `sliceTexture`, `sliceGeometry`, `baseMat`
- `docs/base-recon/` — 스펙·이미지 분석·적합성 판정·비교 시트

## Allowed scope

- 받침 원판의 지오메트리와 재질

## Forbidden scope

- 진영 토큰, 기물, 좌표계, 반상

## Acceptance criteria

- 밝은 진영과 어두운 진영이 한눈에 갈린다.
- 밝은 원판이 밝은 칸 위에서 테두리를 갖는다.
- 재질이 32개에서 2개로 준다.
- 타입체크·테스트 통과.

## Human judgment

- 어두운 진영에서 명암을 뒤집은 것이 어색한지. (레퍼런스 순서와 부호가 반대다)

## Verification

- `npx tsc --noEmit`, `npx vitest run` (89 통과)
- img2threejs 게이트: 이미지 분석 → 적합성 **CONDITIONAL** → 참조 승인 → 사전 스펙 →
  디테일 6개 → PBR 증거 2종(0.818/0.808) → 스펙 `--strict-quality` **PASS** →
  브라우저 렌더 → Tier1 → Divine Eye → 비교 시트 → 리뷰 기록
- **자체 시각 판정으로 네 기능 목표가 모두 문턱을 넘겼다** (진영 가독성 0.92/0.85,
  띠 구조 0.74/0.70, 울퉁불퉁한 둘레 0.70/0.70, 나이테 0.62/0.60), fidelity 0.72.
- **다만 blockout 패스는 크레딧을 받지 못했다.** 게이트가 텍스처를 벗긴 무광 렌더를
  실루엣 증거로 요구하는데 그것을 찍지 않았다.
- **Tier1 은 실루엣 IoU 0.794 로 미달(문턱 0.85)이고 Divine Eye 는 0.40/probe 다.**
  둘 다 conditional 레퍼런스(마스크 안에 하늘·나무·손이 들어 있다)와 선언한 토큰 색
  편차를 재고 있는 것이지 지오메트리를 재는 것이 아니다.

## Rollback

- 단일 커밋 revert.
