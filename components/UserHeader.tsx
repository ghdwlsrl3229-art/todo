"use client";

export function UserHeader({ username, avatarUrl }: { username: string; avatarUrl: string }) {
  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- external GitHub avatar, not worth configuring next/image remote patterns for one small icon */}
      <img src={avatarUrl} alt={username} className="h-8 w-8 rounded-full border border-hairline" />
      <span className="text-[14px] leading-[1.43] text-ink">{username}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="text-[14px] leading-[1.43] text-muted transition-colors hover:text-ink hover:underline"
      >
        로그아웃
      </button>
    </div>
  );
}
