---
id: CHESS-024
title: 아이폰에는 설치 배너가 없다 — 길을 알려 준다
status: DONE
type: feature
profile: web

risk:
  level: low
  reasons:
    - 기기 판정을 userAgent 로 한다. 틀리면 엉뚱한 기기에 안내가 뜬다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 제보 — 갤럭시에서는 다운로드(설치)가 되는데 아이폰에서는 안 나온다.

버그가 아니다. iOS 는 설치 배너(`beforeinstallprompt`)를 지원하지 않는다 — 사파리 공유
시트의 "홈 화면에 추가" 가 유일한 길이다. 그런데 그 길을 모르면 없는 기능과 같다.

## What we are shipping

- 아이폰에서, 아직 설치 전일 때만 뜨는 한 줄 안내 (`#install`)
- 닫으면 다시 안 뜬다 (`localStorage`)
- `apple-touch-icon.png` 180×180 추가 — iOS 는 매니페스트 아이콘을 쓰지 않는다

## What we are not shipping

- 안드로이드용 자체 설치 버튼 (`beforeinstallprompt` 가로채기) — 브라우저가 이미 띄운다
- 모달·배너 — 첫 화면에서 게임을 못 시작하게 막지 않는다

## Facts

- iOS 는 `beforeinstallprompt` 를 구현하지 않는다.
- iOS 홈 화면 아이콘은 매니페스트가 아니라 `apple-touch-icon` 을 본다 (권장 180×180).
- 아이패드 사파리는 userAgent 에서 자기를 맥이라고 말한다 — `maxTouchPoints` 로 가른다.
- 이미 설치된 경우 `display-mode: standalone` 또는 `navigator.standalone` 이 참이다.

## Decisions

- **아이폰에만, 설치 전에만.** 안드로이드는 브라우저가 말해 주므로 우리가 겹쳐 말하지 않는다.
- **한 줄, 닫으면 끝.** 게임을 가리지 않는다.

## Assumptions

- userAgent 판정이 충분하다 (iOS 는 사파리 엔진 하나뿐이라 변형이 적다).

## Relevant context

- `index.html` — `#install`
- `src/main.ts` — `installHint`
- `tools/make-icons.mjs` — 180×180 추가

## Allowed scope

- 설치 안내와 iOS 아이콘

## Forbidden scope

- 게임 규칙, 레이아웃 breakpoint

## Acceptance criteria

- 아이폰에서만 안내가 뜬다. 데스크톱·안드로이드에서는 안 뜬다.
- 설치된 상태(standalone)에서는 안 뜬다.
- 닫으면 다시 안 뜬다.
- `apple-touch-icon.png` 가 배포된다.

## Human judgment

- 문구가 충분히 알아들을 만한지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- 데스크톱에서 숨김 확인, 문구·모양 렌더 확인, 아이콘 응답 확인
- 실제 아이폰 확인은 사용자 몫

## Rollback

- 단일 커밋 revert.
