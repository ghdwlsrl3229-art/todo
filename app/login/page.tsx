export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 p-8 pt-32 text-center">
      <h1 className="text-2xl font-bold">할 일 관리</h1>
      <p className="text-slate-600">GitHub 계정으로 로그인하세요.</p>
      <a
        href="/auth/github"
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
      >
        GitHub로 로그인
      </a>
    </main>
  );
}
