export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 p-8 pt-32 text-center">
      <h1 className="text-[28px] font-bold leading-[1.43] text-ink">할 일 관리</h1>
      <p className="text-body">GitHub 계정으로 로그인하세요.</p>
      <a
        href="/auth/github"
        className="rounded-full bg-primary px-6 py-3 text-[16px] font-medium leading-[1.25] text-white transition-colors hover:bg-primary-active"
      >
        GitHub로 로그인
      </a>
    </main>
  );
}
