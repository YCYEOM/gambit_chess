---
id: CHESS-020
title: 홈 화면에 추가되는 앱으로 만든다 (PWA)
status: DONE
type: feature
profile: web

risk:
  level: medium
  reasons:
    - 서비스워커는 한 번 잘못 캐시하면 배포해도 옛 화면이 남는다
    - 캐시 이름을 안 올리면 사용자가 스스로 지우기 전까지 낡은 파일을 쓴다

human:
  owner: user
  reviewer_required: true
---

## Problem

사용자 질문 — "링크로 접속했을 때 모바일 apk 로 다운받게는 못해?"

APK 는 서명키·안드로이드 SDK·CI 가 필요하고, 받는 쪽도 "출처를 알 수 없는 앱" 경고를
뚫어야 한다. 링크 하나로 앱처럼 쓰는 길은 PWA 다 — 그리고 나중에 APK(TWA)로 감쌀 때도
PWA 가 전제다.

## What we are shipping

- `manifest.webmanifest` — 이름·색·아이콘·standalone
- 아이콘 3종과 그것을 그리는 `tools/make-icons.mjs`
- 서비스워커 — 오프라인 실행, 모델 4.2MB 재다운로드 방지
- iOS 홈 화면 메타(`apple-touch-icon`, `apple-mobile-web-app-*`)
- 주소창 높이에 흔들리지 않는 `100dvh`, 더블탭 확대 제거(`touch-action: manipulation`)

## What we are not shipping

- APK·TWA·스토어 등록
- 빌드 시점 프리캐시 목록 (플러그인이 하나 더 붙는다 — 첫 진입을 온라인으로 하는 것 말고
  차이가 없다)
- 업데이트 알림 UI

## Facts

- `public/` 의 파일은 그대로 배포된다. 서비스워커가 `/gambit_chess/sw.js` 에 놓이므로
  scope 도 `/gambit_chess/` 다.
- `start_url`·`scope` 를 `"."` 로 두면 manifest 위치를 기준으로 풀려 base 가 바뀌어도 따라온다.
- vite 빌드 산출물은 파일 이름에 해시가 붙는다 — 내용이 바뀌면 이름이 바뀐다.
- 아이콘 바이트를 브라우저에서 꺼내올 수 없어(도구가 base64 를 막는다) 생성 스크립트로 만들었다.

## Decisions

- **캐시 규칙은 두 가지로만.** 이름이 곧 버전인 파일은 캐시부터, 나머지는 네트워크부터.
  전부 캐시부터로 두면 배포해도 옛 화면이 남고, 전부 네트워크부터면 오프라인이 깨진다.
- **개발 중에는 서비스워커를 달지 않는다** (`import.meta.env.PROD`). 캐시가 남아 고친 것이
  안 보이는 것만큼 헷갈리는 일이 없다.
- **아이콘은 스크립트로 그린다.** 이미지 라이브러리 대신 픽셀을 직접 찍는다 — PNG 는 압축만
  zlib 이다. 바이너리를 출처 없이 넣지 않는다.

## Assumptions

- 첫 진입은 온라인이다 (프리캐시가 없으므로).

## Relevant context

- `public/manifest.webmanifest`, `public/sw.js`, `public/icon-*.png`
- `tools/make-icons.mjs`
- `index.html` (메타·링크·dvh), `src/main.ts` (등록)

## Allowed scope

- 설치·오프라인·아이콘, 그에 딸린 모바일 메타

## Forbidden scope

- 게임 규칙, 렌더링, 레이아웃 breakpoint

## Acceptance criteria

- 서비스워커가 `/gambit_chess/` scope 로 등록되고 활성화된다.
- 두 번째 진입에서 모델 9개가 캐시에서 나온다.
- manifest 가 이름·192·512·maskable 아이콘을 갖춘다.
- 개발 서버에는 서비스워커가 붙지 않는다.

## Human judgment

- 아이콘(반상 그림)이 마음에 드는지.

## Verification

- `bass evaluate --levels 1,2`, `bass design check`
- `vite preview` 로 빌드본을 띄워 등록·scope·캐시 내용 확인

## Rollback

- 단일 커밋 revert. 다만 이미 설치된 서비스워커는 사용자 쪽에 남는다 — 되돌릴 때는
  `sw.js` 를 빈 워커로 배포해 등록을 풀어야 한다.
