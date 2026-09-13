# Todo App 구현 계획 (PRD 기반)

status: pending approval
source: docs/PRD.md
generated: 2026-09-13

## 0. 기술 스택 결정 (사용자 확정)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 14+ (App Router, TypeScript) | 풀스택 구조, API Routes로 백엔드 겸용 |
| DB / ORM | MongoDB + Prisma (mongodb connector) | Prisma Client API/타입 안전성은 유지하면서 MongoDB 사용. 로컬은 Docker MongoDB(단일 노드 replica set) 또는 MongoDB Atlas 무료 티어, 테스트는 `mongodb-memory-server` 권장 |
| 서버 상태 관리 | TanStack Query (React Query) | 낙관적 업데이트(optimistic update) + 실패 시 롤백에 적합 — DnD 요구사항(P0)과 직결 |
| 드래그 앤 드롭 | dnd-kit (사용자 확정) | 접근성, P1 순서 변경 확장성 고려 |
| 스타일 | Tailwind CSS | 빠른 UI 구축 |
| 테스트 | Vitest + React Testing Library (unit), Playwright (선택적 e2e) | 진행률 계산 로직, API 유효성 검증에 집중 |

## 1. Requirements Summary

PRD(`docs/PRD.md`) 기준 핵심 요구사항:

- **P0**: 할 일 CRUD, 상태(`todo`/`doing`/`done`) 관리, 드래그 앤 드롭 상태 변경(실패 시 롤백), 기간 구조(`daily`/`weekly`/`yearly`), 주간 진행률 자동 계산(`done / 전체 × 100`, 0건이면 0%), 기본 데이터 구조(Todo 엔티티).
- **P1**: 기간 간 목표 연결(연↔주↔일), 1년 목표 진행률 확장, 상태 내부 순서 변경(사용자 지정 순서 저장), 완료 이력(완료 시각 저장 및 조회), 필터(상태/기간/날짜), 기본 유효성 검증(제목 필수, 기간/상태 값 검증).
- 명시적 범위 제외(PRD에 없음): 인증/멀티유저, 알림, 협업 기능 — 이번 계획에 포함하지 않음.

## 2. 데이터 모델 설계

### Prisma Schema (초안) — `prisma/schema.prisma`

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

enum Status {
  TODO
  DOING
  DONE
}

enum PeriodType {
  DAILY
  WEEKLY
  YEARLY
}

model Todo {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  title       String
  status      Status     @default(TODO)
  periodType  PeriodType
  targetDate  DateTime   // daily: 해당 날짜(자정 기준) / weekly: 해당 주의 월요일(ISO week start) / yearly: 해당 연도 1/1
  order       Int        @default(0)        // P1: 상태 영역 내 정렬 순서
  parentId    String?    @db.ObjectId       // P1: 상위 목표 연결 (yearly→weekly→daily)
  parent      Todo?      @relation("TodoHierarchy", fields: [parentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  children    Todo[]     @relation("TodoHierarchy")
  completedAt DateTime?                     // P1: 완료 이력 (done 전환 시각)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([periodType, targetDate])
  @@index([status])
  @@index([parentId])
}
```

**설계 노트**
- `targetDate`는 기간 유형에 따라 의미가 다름: `daily`는 해당 날짜 자정, `weekly`는 ISO 주의 월요일로 정규화, `yearly`는 해당 연도 1월 1일로 정규화. 정규화 로직은 `lib/period.ts`에 순수 함수로 구현(테스트 대상 1순위).
- `order`, `parentId`, `completedAt`은 P1 요구사항이지만 스키마에 미리 포함 — 재구현을 두 번 하지 않기 위함(P0 구현 시에는 사용하지 않고 기본값만 채움).
- id는 MongoDB의 `_id`(ObjectId)를 Prisma가 문자열로 매핑. enum은 문자열로 저장되며, DB 레벨 CHECK 제약이 없으므로 값 검증은 전적으로 애플리케이션(zod, Phase 2)에서 담당해야 함.
- **MongoDB는 관계형 DB가 아니므로 참조 무결성을 DB가 강제하지 않음.** 자기참조(`parentId`)는 Prisma가 애플리케이션 레벨에서 흉내만 내며, 특히 self-relation에서는 `onDelete: SetNull`/`Cascade`가 지원되지 않아 `NoAction`으로 설정 — 상위 Todo 삭제 시 하위 항목의 `parentId` 정리는 API route에서 직접 처리해야 함(Phase 6 구현 시 명시적으로 처리).

## 3. Acceptance Criteria (테스트 가능한 기준)

### P0
1. `POST /api/todos`에 title, periodType, targetDate를 보내면 status=`todo`인 Todo가 생성되고 201과 생성된 레코드를 반환한다.
2. `GET /api/todos?periodType=weekly&targetDate=2026-09-14`는 해당 주에 속한 Todo만 반환한다.
3. `GET /api/todos?status=doing`는 상태가 `doing`인 Todo만 반환한다.
4. `PATCH /api/todos/:id`로 title/periodType/status 변경 시 `updatedAt`이 갱신되고 200을 반환한다.
5. `DELETE /api/todos/:id` 호출 시 204를 반환하고, 이후 목록 조회 시 해당 항목이 즉시 사라진다.
6. 드래그로 다른 상태 컬럼에 드롭하면 UI가 즉시 반영(낙관적 업데이트)되고, 서버 저장이 성공하면 유지, 실패(예: 네트워크 오류 mock)하면 원래 컬럼으로 자동 복구된다.
7. 주간 진행률은 `done 개수 / 전체 개수 × 100`(반올림 없이 정수 %)로 계산되며, 생성/삭제/상태변경 시 자동 재계산되어 UI에 반영된다. 전체 0건이면 0%.
8. daily/weekly/yearly 각 화면에서 해당 기간의 목록만 필터링되어 보인다.

### P1
9. 일일 Todo가 특정 주간 Todo에 `parentId`로 연결되고, 주간 Todo가 특정 연간 Todo에 연결될 때 상위 화면에서 하위 항목 목록을 확인할 수 있다.
10. 연간 목표 진행률은 연결된 주간 목표들의 완료 기준(예: 완료된 주간 목표 수 / 전체 연결된 주간 목표 수)으로 자동 계산된다.
11. 같은 상태 컬럼 내에서 드래그로 순서를 바꾸면 `order` 값이 저장되고 새로고침 후에도 유지된다.
12. `done`으로 전환 시 `completedAt`이 기록되고, 기간별 완료 이력 조회 API/화면에서 확인 가능하다.
13. 상태/기간/날짜 필터를 조합해 목록을 좁힐 수 있다.
14. 제목이 빈 문자열이면 생성/수정 API가 400을 반환한다. periodType/status에 enum 외 값이 들어오면 400을 반환한다.

## 4. Implementation Steps

### Phase 0 — 프로젝트 스캐폴딩
- `create-next-app`으로 TypeScript + App Router + Tailwind 초기화 (`todo/` 루트에 생성, 기존 `docs/` 폴더 보존)
- ESLint/Prettier 설정, `docs/CLAUDE.md`에 프로젝트 규칙 기본 문서화(현재 비어있음 — 빌드/테스트 명령어, 폴더 구조 기록)
- git 저장소 초기화 (`git init`) — 현재 git repo 아님
- 검증: `npm run dev`로 기본 페이지 렌더 확인

### Phase 1 — 데이터 레이어
- 로컬 MongoDB 준비: Docker로 단일 노드 replica set 실행(`docker run --rm -p 27017:27017 mongo:7 --replSet rs0` 후 `rs.initiate()`) 또는 MongoDB Atlas 무료 클러스터 생성 — Prisma 트랜잭션(Phase 7 reorder batch)이 replica set을 요구하므로 단일 노드도 반드시 replica set으로 구동
- `prisma init --datasource-provider mongodb`, 위 스키마 작성, `.env`에 `DATABASE_URL` 설정
- MongoDB는 SQL 마이그레이션 개념이 없으므로 `prisma migrate dev` 대신 **`prisma db push`**로 스키마 반영(마이그레이션 히스토리 파일 생성 안 됨 — 스키마 변경 시마다 재실행)
- `lib/prisma.ts`에 PrismaClient 싱글톤(Next.js dev 핫리로드 대응)
- `lib/period.ts`: `normalizeDailyDate`, `normalizeWeekStart(date)`(ISO 월요일 기준), `normalizeYearStart(date)` 순수 함수 + 단위 테스트
- 테스트 환경: `mongodb-memory-server`로 격리된 인메모리 Mongo 인스턴스 사용(단, replica set 모드로 기동해야 트랜잭션 테스트 가능)
- 검증: `npx prisma studio`로 스키마/연결 확인, period 함수 단위 테스트 통과

### Phase 2 — API Routes (P0)
- `app/api/todos/route.ts`: `GET`(쿼리 파라미터로 periodType/status/targetDate 필터), `POST`(생성, 유효성 검증)
- `app/api/todos/[id]/route.ts`: `PATCH`(부분 수정), `DELETE`
- 공통 유효성 검증 스키마: `lib/validation.ts` (zod 사용 — title 필수/공백 불가, periodType/status enum 체크) → P1 항목 14 겸 구현(선제 적용해도 무리 없음)
- 검증: API 단위/통합 테스트(Vitest + supertest 또는 Next.js route handler 직접 호출) — Acceptance Criteria 1~5, 14 커버

### Phase 3 — 핵심 UI: 목록/생성/수정/삭제
- `app/(daily|weekly|yearly)/page.tsx` 또는 단일 페이지 + 기간 탭 전환 UI(구현 단순성 위해 탭 방식 권장)
- Todo 카드 컴포넌트, 생성 폼(모달 또는 인라인), 수정 폼, 삭제 확인
- TanStack Query 훅: `useTodos(filter)`, `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo` (`hooks/` 폴더)
- 검증: 브라우저에서 생성→조회→수정→삭제 플로우 수동 확인 (Acceptance Criteria 1~5, 8)

### Phase 4 — 드래그 앤 드롭 상태 변경 (P0 핵심)
- dnd-kit `DndContext` + 3개 `Droppable` 컬럼(todo/doing/done) + `Draggable` 카드
- 드롭 시: 로컬 상태 즉시 변경(낙관적 업데이트) → `PATCH` 호출 → 실패 시 TanStack Query `onError`에서 이전 캐시로 롤백 + 사용자에게 실패 토스트
- 검증: 정상 드롭 시 즉시 반영 + 새로고침 후 유지, API 강제 실패(mock) 시 자동 복구 — Acceptance Criteria 6

### Phase 5 — 주간 진행률 자동 계산
- 계산 로직은 서버에서(API 응답에 포함) 또는 클라이언트에서 목록 기반 파생 상태로 계산 — **권장: 클라이언트 파생 계산**(별도 API 불필요, 목록 쿼리 캐시가 이미 최신 상태를 가지고 있으므로 생성/삭제/상태변경 후 자동 재계산됨)
- `lib/progress.ts`: `calcWeeklyProgress(todos: Todo[]): number` 순수 함수 + 0건 시 0% 처리 + 단위 테스트
- 주간 화면에 진행률 바/퍼센트 표시 컴포넌트
- 검증: 단위 테스트로 0건/일부완료/전체완료 케이스, 생성·삭제·상태변경 후 UI 값 갱신 확인 — Acceptance Criteria 7

### Phase 6 — P1: 기간 연결 및 연간 진행률
- 생성/수정 폼에 상위 목표 선택 UI(daily → weekly 선택, weekly → yearly 선택) 추가
- `parentId` 저장, 상위 화면에서 하위 목록 표시(`children` relation)
- `lib/progress.ts`에 `calcYearlyProgress` 추가(연결된 weekly 완료 기준)
- 검증: Acceptance Criteria 9~10

### Phase 7 — P1: 정렬 순서, 완료 이력, 필터
- dnd-kit 같은 컬럼 내 순서 변경 → `order` 필드 batch 업데이트 API(`PATCH /api/todos/reorder`)
- `done` 전환 시 `completedAt` 서버에서 자동 세팅(클라이언트가 직접 안 보냄)
- 완료 이력 조회 UI/필터(상태/기간/날짜) — 기존 `GET /api/todos` 쿼리 파라미터 확장
- 검증: Acceptance Criteria 11~13

### Phase 8 — 유효성 검증 마감 및 회귀 테스트
- Phase 2에서 선제 구현한 zod 검증이 모든 CRUD 경로에 적용됐는지 재확인
- 전체 테스트 스위트 실행, 타입체크(`tsc --noEmit`), lint
- 검증: Acceptance Criteria 14 최종 확인, `npm run build` 성공

## 5. Risks and Mitigations

| 리스크 | 영향 | 완화 방안 |
|---|---|---|
| `targetDate` 하나로 daily/weekly/yearly 의미를 겸용 → 필터링 버그 가능성 | 기간별 목록 조회 오동작 | `lib/period.ts` 정규화 함수를 단일 진입점으로 강제, 저장 전 항상 정규화 후 저장. 단위 테스트로 경계값(연말/연초, 월요일 경계) 검증 |
| DnD 낙관적 업데이트 롤백 미흡 | 저장 실패 시 UI가 실제 상태와 불일치 | TanStack Query의 `onMutate`(스냅샷 저장) + `onError`(롤백) 패턴 명시적 구현, 실패 케이스 통합 테스트 작성 |
| MongoDB는 참조 무결성/외래키를 DB 레벨에서 강제하지 않음 | `parentId`가 삭제된 Todo를 가리키는 고아 참조 발생 가능 | 상위 Todo 삭제 API에서 하위 항목의 `parentId`를 null로 정리하는 로직을 트랜잭션으로 명시적 처리(Phase 6), 통합 테스트로 고아 참조 미발생 검증 |
| 순서 변경(reorder) batch 업데이트, 연결 삭제 등 다중 문서 트랜잭션은 MongoDB replica set 필요 | 단일 노드(non-replica set) 환경에서 트랜잭션 API 호출 시 런타임 오류 | 로컬 개발 환경도 반드시 단일 노드 replica set으로 구동(Phase 1), CI/테스트도 `mongodb-memory-server`의 replica set 모드 사용 |
| Prisma의 MongoDB 커넥터는 SQL 마이그레이션 히스토리가 없어 스키마 변경 추적이 어려움 | 팀 협업/배포 시 스키마 drift 발생 가능 | `prisma db push` 실행 시점을 커밋 단위로 관리, `prisma/schema.prisma` 변경 이력을 git으로 추적(연습 프로젝트 규모에서는 충분) |
| P1 스키마(parentId, order, completedAt) 선반영으로 인한 초기 복잡도 증가 | Phase 0~5 개발 속도 저하 우려 | P0 단계에서는 해당 필드를 기본값만 채우고 로직 미사용 — 스키마 변경 없이 Phase 6~7에서 활성화 |
| 주간 진행률 계산 기준(연결 없이 단순 전체/완료 비율) vs P1 연결 구조 도입 후 계산 기준 변경 | 계산식 일관성 혼란 | `lib/progress.ts`에 계산 로직을 한 곳에 모으고, P0/P1 각각 별도 함수로 분리해 회귀 방지 |
| 인증 없는 단일 사용자 가정 | 다중 사용자 환경에서 데이터 공유 문제 | PRD 범위에 인증 없음 — 로컬/개인 사용 전제로 명시, 향후 확장 시 별도 계획 필요 |

## 6. Verification Steps

1. 로컬 MongoDB(replica set) 기동 확인 후 `npx prisma db push` 실행 → `npx prisma studio`로 스키마/연결 반영 확인
2. `npm run test` (Vitest) — `lib/period.ts`, `lib/progress.ts`, API route 단위 테스트 전부 통과
3. `npx tsc --noEmit` — 타입 오류 없음
4. `npm run lint` — 오류 없음
5. `npm run build` — 프로덕션 빌드 성공
6. 수동 브라우저 검증: 생성 → daily/weekly/yearly 각 화면 표시 확인 → 드래그로 todo→doing→done 이동 → 주간 진행률 갱신 확인 → 수정/삭제 → 진행률 재계산 확인
7. (P1 완료 시) 상위-하위 목표 연결 화면에서 계층 표시 확인, 순서 변경 새로고침 후 유지 확인, 필터 조합 동작 확인

## 7. Open Items / 다음 단계

- 본 계획은 `pending approval` 상태입니다. 실행을 승인하시면 다음 중 하나로 진행합니다:
  - **team**으로 실행 (권장, 병렬 처리로 빠름)
  - **ralph**로 실행 (지속 루프 + 검증)
- P1 범위를 이번 실행에 포함할지, P0만 우선 완료 후 별도 승인받을지 결정이 필요합니다(권장: P0 완료 후 중간 검증 → P1 진행).
