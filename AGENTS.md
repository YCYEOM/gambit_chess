<!-- bass-shim: agents v0.2.1 — 이 파일은 얇은 참조 shim 이다. 규칙 원문을 여기에 복사하지 마라. -->
# AGENTS.md — gambit_chess

이 프로젝트는 BASS를 AI 에이전트의 내부 실행 런타임으로 사용한다.
사용자 인터페이스는 자연어 대화이며, 사용자가 BASS 명령이나 기록 파일을 직접 관리하게 하지 마라.

## 에이전트 실행 계약

1. 작업 시작 시 `bass agent guide [task-id]`를 내부적으로 실행하고 현재 계약을 읽는다.
2. 저장소에서 확인할 수 있는 사실은 직접 조사한다. 사람에게는 제품·가치·위험 결정을 한 번에 하나씩 묻는다.
3. task·상태·검증·critic·record는 에이전트가 관리한다. 내부 상태 전환을 승인 질문으로 노출하지 마라.
4. 위험 승인 조건이 있으면 선택지·권장안·영향을 제시하고, 사용자의 명시적 결정만 `bass approval risk`로 기록한다.
5. 구현 후 `bass gate pre-review`로 근거를 준비하고 결과를 한 번에 보여준다. 최종 승인을 기록한 뒤 `bass task finalize`를 실행한다.
6. 재실행 시 이미 완료된 단계·결정·부작용을 재사용하고 중복 생성하지 마라.
7. 기존 프로젝트의 지침·검증·디자인·이력을 원천으로 보존하고, BASS와 겹치는 부분만 최소 변경으로 통합한다.
8. 파일 생성만으로 연결 완료를 주장하지 말고 실제 사용자 작업 하나로 검증·피드백 루프를 확인한다.
9. UI 작업은 `DESIGN.md`와 실제 렌더링을 조사하고, 기계 검사와 독립 Design Critic을 거친다.

프로젝트에 `nan2026.yaml`이 있으면 `nan/AGENT_WORKFLOW.md`도 읽는다.
NAN의 concept/runtime 승인과 evidence gate는 대회 의사결정에만 적용하며 일반 상태 전환 승인으로 확대하지 마라.
## 원천

- 동적 실행 안내: `bass agent guide --json`
- 전체 행동 규칙: `bass compose --role <role>`
- 프로젝트 설정: `bass.yaml` / 유효 설정: `bass config explain`
