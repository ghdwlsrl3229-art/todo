# GitHub OAuth 설정 가이드

## 1. GitHub OAuth App 생성

1. GitHub 로그인 후 **Settings > Developer settings > OAuth Apps > New OAuth App** 으로 이동
   (직접 링크: https://github.com/settings/applications/new)
2. 아래 값을 입력:
   - **Application name**: 원하는 이름 (예: `Todo App (dev)`)
   - **Homepage URL**: 앱이 떠 있는 주소 (예: `http://localhost:3000`)
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
     - `npm run dev`가 다른 포트에서 뜨면(예: 3000이 이미 사용 중이면) 그 포트에 맞춰 등록하세요.
       배포 환경에서는 실제 도메인으로 등록합니다 (예: `https://your-app.com/auth/github/callback`).
3. **Register application** 클릭 후, **Client ID**를 복사하고 **Generate a new client secret**으로 시크릿을 생성해 복사

## 2. 환경 변수 설정

`.env.example`을 `.env`로 복사한 뒤 값을 채웁니다:

```bash
GITHUB_CLIENT_ID="<위에서 복사한 Client ID>"
GITHUB_CLIENT_SECRET="<위에서 복사한 Client secret>"
```

`GITHUB_CLIENT_SECRET`은 코드 어디에도 하드코딩되지 않으며, 오직 이 환경 변수를 통해서만 읽힙니다.
`.env`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다.

## 3. 로그인 확인

1. `npm run dev`
2. 브라우저에서 앱 주소로 접속 → 로그인하지 않은 상태이므로 `/login`으로 리다이렉트됨을 확인
3. **GitHub로 로그인** 클릭 → GitHub 인증 화면 → 승인
4. `/`로 리다이렉트되며 우측 상단에 GitHub 프로필(아바타, username)과 로그아웃 버튼이 보이면 성공

## 4. 기존 할 일 데이터가 있는 경우: user_id 마이그레이션

GitHub 로그인을 추가하기 전에 이미 생성된 할 일(Todo) 문서에는 `userId`가 없습니다.
스키마상 `Todo.userId`는 필수 필드이므로, 로그인 기능을 배포하기 전에 기존 데이터를 한 사용자에게 배정해야 합니다.

1. 먼저 GitHub 로그인을 한 번 진행해서 자신의 User 레코드를 생성합니다.
2. 아래 스크립트를 자신의 GitHub username으로 실행합니다:

```bash
npx tsx scripts/migrate-add-user-id.ts <github-username>
```

`userId`가 없는 모든 기존 Todo 문서가 해당 사용자에게 배정됩니다. 이미 `userId`가 있는 문서는 건드리지 않습니다.
