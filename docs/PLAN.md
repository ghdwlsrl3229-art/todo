# Todo App 구현 계획 (PRD 기반)

status: pending approval
source: docs/PRD.md
generated: 2026-09-13

## 0. 기술 스택 결정

| 영역        | 선택                                   | 비고                                              |
| --------- | ------------------------------------ | ----------------------------------------------- |
| 프레임워크     | Next.js 14+ (App Router, TypeScript) | 풀스택 구조, Route Handler로 백엔드 겸용                   |
| DB / ORM  | MongoDB + Prisma                     | 로컬은 single-node replica set 또는 MongoDB Atlas 사용 |
| 서버 상태 관리  | TanStack Query                       | optimistic update + rollback 처리                 |
| 드래그 앤 드롭  | dnd-kit                              | 상태 이동 및 P1 순서 변경                                |
| 스타일       | Tailwind CSS                         | UI 구축                                           |
| 입력 검증     | Zod                                  | API request validation                          |
| 단위/통합 테스트 | Vitest + React Testing Library       | 도메인 로직/API 중심                                   |
| E2E 테스트   | Playwright                           | **P0 핵심 사용자 플로우는 필수 자동화**                       |

---

## 1. Requirements Summary

PRD(`docs/PRD.md`) 기준 핵심 요구사항:

* **P0**

  * Todo CRUD
  * 상태 관리: `todo` / `doing` / `done`
  * 드래그 앤 드롭 상태 변경
  * optimistic update 및 실패 시 rollback
  * 기간 구조: `daily` / `weekly` / `yearly`
  * 주간 진행률 자동 계산
  * 기본 Todo 데이터 구조

* **P1**

  * 기간 간 목표 연결: yearly → weekly → daily
  * 연간 목표 진행률
  * 동일 상태 내 사용자 지정 순서
  * 완료 시각 기록 및 완료 이력
  * 상태/기간/날짜 필터
  * 입력값 validation

범위 제외:

* 인증
* 멀티유저
* 알림
* 협업 기능

---

## 2. 공통 데이터 표현 규칙

API, TypeScript, Prisma에서 사용하는 enum 표현을 모두 **소문자 문자열 기준으로 통일**한다.

### Status

```text
todo
doing
done
```

### PeriodType

```text
daily
weekly
yearly
```

Prisma schema에서도 `@map`을 사용해 저장 문자열을 API 표현과 동일하게 맞춘다.

```prisma
enum Status {
  TODO  @map("todo")
  DOING @map("doing")
  DONE  @map("done")
}

enum PeriodType {
  DAILY  @map("daily")
  WEEKLY @map("weekly")
  YEARLY @map("yearly")
}
```

애플리케이션 코드에서는 Prisma enum 또는 공통 domain type을 사용하며, API마다 임의의 문자열 변환 로직을 작성하지 않는다.

Zod validation 역시 동일한 값만 허용한다.

---

## 3. 날짜 및 Timezone 정책

날짜 계산은 모든 환경에서 동일한 결과가 나오도록 명시적인 정책을 사용한다.

### 기본 정책

사용자가 입력하는 `targetDate`는 **달력상의 날짜(calendar date)** 로 취급한다.

예:

```text
2026-09-14
```

API 입력은 가능한 한 `YYYY-MM-DD` 형식으로 받고, 서버에서 명시적으로 정규화한다.

### DB 저장 기준

DB의 `targetDate`는 UTC 기준 DateTime으로 저장한다.

```text
daily
2026-09-14
→ 2026-09-14T00:00:00.000Z
```

```text
weekly
2026-09-16 입력
→ 해당 ISO week 월요일
→ 2026-09-14T00:00:00.000Z
```

```text
yearly
2026-09-16 입력
→ 2026-01-01T00:00:00.000Z
```

브라우저의 local timezone이나 서버의 OS timezone에 의존하는 아래 방식은 사용하지 않는다.

```ts
new Date("2026-09-14").setHours(0, 0, 0, 0)
```

날짜 계산은 `lib/period.ts`에서만 수행한다.

```ts
normalizeDailyDate(date: string)
normalizeWeekStart(date: string)
normalizeYearStart(date: string)
```

테스트에는 반드시 다음 경계 조건을 포함한다.

* 일요일 → 다음/현재 ISO week 판정
* 월요일
* 12월 31일
* 1월 1일
* 연도가 바뀌는 ISO week
* 서버 timezone 변경 시에도 동일한 결과

---

## 4. 데이터 모델 설계

### `prisma/schema.prisma`

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Status {
  TODO  @map("todo")
  DOING @map("doing")
  DONE  @map("done")
}

enum PeriodType {
  DAILY  @map("daily")
  WEEKLY @map("weekly")
  YEARLY @map("yearly")
}

model Todo {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  title       String
  status      Status     @default(TODO)
  periodType  PeriodType
  targetDate  DateTime

  order       Int        @default(0)

  parentId    String?    @db.ObjectId
  parent      Todo?      @relation(
    "TodoHierarchy",
    fields: [parentId],
    references: [id],
    onDelete: NoAction,
    onUpdate: NoAction
  )
  children    Todo[]     @relation("TodoHierarchy")

  completedAt DateTime?

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([periodType, targetDate])
  @@index([status])
  @@index([parentId])
  @@index([periodType, targetDate, status])
}
```

### 설계 규칙

`targetDate`는 반드시 `lib/period.ts`를 통해 정규화한 후 저장한다.

* daily → 해당 날짜
* weekly → ISO week 월요일
* yearly → 해당 연도 1월 1일

`order`, `parentId`, `completedAt`은 P1용 필드지만 초기 schema에 포함한다.

MongoDB는 외래키 무결성을 보장하지 않으므로 `parentId` 정리는 애플리케이션에서 수행한다.

상위 Todo 삭제 시:

```text
transaction
1. children parentId → null
2. parent Todo 삭제
```

---

## 5. API Contract

API 외부 표현은 항상 소문자를 사용한다.

### Todo Response

```json
{
  "id": "...",
  "title": "운동하기",
  "status": "todo",
  "periodType": "daily",
  "targetDate": "2026-09-14",
  "order": 0,
  "parentId": null,
  "completedAt": null
}
```

DB의 DateTime을 API에서 그대로 ISO timestamp로 노출하지 않고 `targetDate`는 domain 의미에 맞게 `YYYY-MM-DD`로 직렬화한다.

---

## 6. Acceptance Criteria

### P0

1. `POST /api/todos`

요청:

```json
{
  "title": "운동하기",
  "periodType": "daily",
  "targetDate": "2026-09-14"
}
```

응답:

```text
201 Created
status = "todo"
```

2. 다음 요청은 해당 ISO week의 Todo만 반환한다.

```text
GET /api/todos?periodType=weekly&targetDate=2026-09-14
```

3. 다음 요청은 doing 상태만 반환한다.

```text
GET /api/todos?status=doing
```

4. PATCH로 다음 값들을 변경할 수 있다.

```text
title
status
periodType
targetDate
```

성공 시:

```text
200
updatedAt 갱신
```

5. DELETE 성공 시:

```text
204
```

이후 동일 목록 조회에서 해당 Todo는 존재하지 않는다.

6. 다른 상태 컬럼으로 drag/drop하면 UI가 즉시 변경된다.

```text
UI optimistic update
→ PATCH
→ 성공: 상태 유지
→ 실패: 기존 상태로 rollback
```

7. 주간 진행률:

```text
floor(doneCount / totalCount * 100)
```

전체 Todo가 0개라면:

```text
0%
```

생성/삭제/상태 변경 직후 자동 반영된다.

8. daily / weekly / yearly 화면은 각 기간에 해당하는 Todo만 표시한다.

### P1

9. 다음 관계만 허용한다.

```text
daily → weekly
weekly → yearly
```

다음 관계는 거부한다.

```text
daily → yearly
weekly → daily
yearly → any parent
```

10. yearly 진행률:

```text
완료된 child weekly 수
/
전체 child weekly 수
× 100
```

11. 동일 status column 내 drag/drop 시 `order`가 저장된다.

새로고침 후에도 동일한 순서를 유지해야 한다.

12. 상태가 다음과 같이 변경되면:

```text
todo → done
doing → done
```

서버가 `completedAt`을 기록한다.

`done → todo/doing`으로 변경하면:

```text
completedAt = null
```

13. 아래 filter들을 조합할 수 있다.

```text
status
periodType
targetDate
```

14. 다음 요청은 400을 반환한다.

```text
title = ""
title = "   "
status = invalid value
periodType = invalid value
invalid targetDate
```

---

## 7. Implementation Steps

### Phase 0 — 프로젝트 스캐폴딩

* Next.js App Router + TypeScript + Tailwind 초기화
* 기존 `docs/` 보존
* ESLint / Prettier 설정
* `docs/CLAUDE.md` 작성
* git 초기화

필수 script:

```json
{
  "dev": "...",
  "test": "...",
  "test:e2e": "...",
  "lint": "...",
  "typecheck": "...",
  "build": "..."
}
```

검증:

```bash
npm run dev
npm run lint
npm run typecheck
```

---

### Phase 1 — 데이터 / Domain Layer

MongoDB는 replica set으로 실행한다.

```bash
docker run --rm \
  -p 27017:27017 \
  --name todo-mongo \
  mongo:7 \
  --replSet rs0 \
  --bind_ip_all
```

replica set initialize:

```js
rs.initiate()
```

Prisma:

```bash
npx prisma init --datasource-provider mongodb
npx prisma db push
npx prisma generate
```

구현:

```text
lib/prisma.ts
lib/period.ts
lib/progress.ts
lib/validation.ts
lib/todo-serializer.ts
```

`todo-serializer.ts`는 Prisma 객체를 API response contract로 변환한다.

테스트:

```text
normalizeDailyDate
normalizeWeekStart
normalizeYearStart
```

timezone/연말 경계 테스트를 반드시 포함한다.

---

### Phase 2 — API Routes

구현:

```text
app/api/todos/route.ts
GET
POST
```

```text
app/api/todos/[id]/route.ts
PATCH
DELETE
```

Zod schema:

```text
createTodoSchema
updateTodoSchema
todoFilterSchema
```

API에는 raw Prisma 객체를 바로 반환하지 않고 serializer를 거쳐 반환한다.

테스트:

```text
AC 1
AC 2
AC 3
AC 4
AC 5
AC 14
```

---

### Phase 3 — 기본 UI

기간 탭:

```text
Daily
Weekly
Yearly
```

구현 컴포넌트:

```text
TodoBoard
TodoColumn
TodoCard
TodoForm
PeriodTabs
```

Query hooks:

```text
useTodos
useCreateTodo
useUpdateTodo
useDeleteTodo
```

TanStack Query key는 filter까지 포함한다.

예:

```ts
["todos", { periodType, targetDate, status }]
```

---

### Phase 4 — DnD 상태 변경

dnd-kit 사용:

```text
DndContext
SortableContext
Droppable column
Draggable TodoCard
```

TanStack Query mutation:

```text
onMutate
→ 기존 cache snapshot
→ optimistic update

onError
→ snapshot rollback

onSettled
→ invalidate/refetch
```

서버 실패 시 toast 표시.

---

### Phase 5 — 주간 진행률

```ts
calcWeeklyProgress(todos)
```

규칙:

```ts
if (todos.length === 0) return 0

return Math.floor(
  doneCount / todos.length * 100
)
```

DB에는 진행률을 저장하지 않는다.

Todo 목록으로부터 파생되는 derived state로 취급한다.

---

## 8. P0 E2E 테스트 — 필수

Playwright는 선택 사항이 아니라 **P0 완료 조건**으로 지정한다.

### E2E 1 — CRUD

```text
weekly 화면 진입
→ Todo 생성
→ 화면 표시 확인
→ 제목 수정
→ 삭제
→ 화면에서 제거 확인
```

### E2E 2 — DnD 성공

```text
Todo 생성
→ todo column 확인
→ doing으로 drag
→ UI 즉시 이동
→ network 완료
→ page reload
→ doing 상태 유지 확인
```

### E2E 3 — DnD 실패 rollback

API 실패를 mock한다.

```text
todo
→ doing drag
→ optimistic UI 이동
→ PATCH 실패
→ todo로 rollback
→ 오류 메시지 표시
```

### E2E 4 — 진행률

```text
weekly Todo 2개 생성
→ 0%

1개 done 이동
→ 50%

2개 done 이동
→ 100%

1개 삭제
→ 100%
```

### E2E 5 — 기간 isolation

```text
daily Todo 생성
weekly Todo 생성
yearly Todo 생성

각 tab에서 해당 Todo만 표시되는지 확인
```

P0 완료 시 다음 테스트를 모두 통과해야 한다.

```bash
npm run test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

---

## 9. Phase 6 — P1 목표 연결

생성/수정 화면에서 parent 선택 기능 추가.

허용 규칙:

```text
daily parent = weekly only
weekly parent = yearly only
yearly parent = null
```

이 규칙은 UI뿐 아니라 서버에서도 검증한다.

상위 Todo 조회 시 children을 함께 조회할 수 있도록 API 확장.

---

## 10. Phase 7 — P1 정렬 / 완료 이력 / 필터

### Reorder API

```text
PATCH /api/todos/reorder
```

예:

```json
{
  "items": [
    {
      "id": "...",
      "order": 0
    },
    {
      "id": "...",
      "order": 1
    }
  ]
}
```

다중 문서 변경은 transaction 사용.

### completedAt

서버에서 상태 transition을 감지한다.

```text
non-done → done
completedAt = now()

done → non-done
completedAt = null
```

클라이언트는 `completedAt`을 직접 수정할 수 없다.

---

## 11. Phase 8 — 최종 회귀 검증

실행:

```bash
npm run test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

추가 확인:

```text
CRUD
DnD
rollback
progress
period filtering
timezone boundary
parent hierarchy
reorder persistence
completedAt
filter combination
```

---

## 12. Risks and Mitigations

| 리스크                              | 영향                     | 대응                                               |
| -------------------------------- | ---------------------- | ------------------------------------------------ |
| API와 Prisma enum 표현 불일치          | 조건문·validation·테스트 불일치 | 외부 표현을 lowercase로 통일하고 Prisma `@map` 적용          |
| timezone에 따른 targetDate 변경       | 잘못된 날짜/주차 조회           | `YYYY-MM-DD` domain input + UTC normalization 강제 |
| 연말 ISO week 계산 오류                | weekly 조회 오류           | 연말/연초 unit test 필수                               |
| optimistic update rollback 오류    | UI/DB 불일치              | TanStack Query snapshot rollback + E2E 실패 테스트    |
| MongoDB FK 미지원                   | orphan parentId        | 삭제 transaction에서 child 정리                        |
| multi-document update            | reorder 부분 반영          | MongoDB replica set + transaction                |
| Prisma MongoDB schema history 없음 | schema drift           | `schema.prisma`를 git 기준 source of truth로 사용      |
| P0 회귀 테스트 부족                     | DnD 등 핵심 기능 재발         | Playwright 핵심 E2E를 P0 Definition of Done에 포함     |

---

## 13. Definition of Done

### P0 완료 조건

아래 조건을 **모두 충족해야 P0 완료**로 판단한다.

```text
[ ] CRUD 동작
[ ] daily/weekly/yearly 기간 분리
[ ] 상태 변경 동작
[ ] DnD 동작
[ ] optimistic update 동작
[ ] API 실패 시 rollback 동작
[ ] weekly progress 자동 계산
[ ] validation 동작
[ ] timezone 경계 테스트 통과
[ ] unit/integration test 통과
[ ] Playwright 핵심 E2E 통과
[ ] TypeScript 오류 없음
[ ] lint 오류 없음
[ ] production build 성공
```

---

## 14. 실행 순서

권장 실행 순서:

```text
Phase 0
↓
Phase 1
↓
Phase 2
↓
Phase 3
↓
Phase 4
↓
Phase 5
↓
P0 E2E + 회귀 테스트
↓
P0 승인
↓
Phase 6
↓
Phase 7
↓
Phase 8
```

P0와 P1은 한 번에 구현하지 않는다.

먼저 P0를 독립적으로 완료하고 E2E 검증까지 통과시킨 뒤 P1로 진행한다.