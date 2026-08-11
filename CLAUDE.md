<!-- bass-shim: claude v0.2.1 — 얇은 참조 shim. 규칙 원문을 복사하지 마라. -->
# CLAUDE.md

이 프로젝트의 에이전트 규칙은 `AGENTS.md` 를 따른다. 그 파일을 먼저 읽어라.

- 사용자는 자연어로만 협업한다. BASS CLI와 기록 파일은 에이전트가 내부 관리한다.
- 시작 시 `bass agent guide [task-id]`를 읽고 위험에 비례한 실행 깊이를 선택한다.
- 기존 프로젝트의 지침·검증·디자인·이력을 우선하며 두 번째 원천을 만들지 않는다.
- 작업 게이트: `bass gate pre-task <ID>` / `bass gate pre-review <ID>` / `bass task finalize <ID>`
- UI 작업이 있다면 루트 `DESIGN.md` 를 먼저 읽는다 (존재하는 경우).
- `nan2026.yaml`이 있으면 `nan/AGENT_WORKFLOW.md`를 읽고 concept/runtime/evidence 규칙을 적용한다.
- 규칙 전문이 필요하면 `bass compose --role <role>` 을 실행한다.
