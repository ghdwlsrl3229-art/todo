"use client";

export function UserHeader({ username, avatarUrl }: { username: string; avatarUrl: string }) {
  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- external GitHub avatar, not worth configuring next/image remote patterns for one small icon */}
      <img src={avatarUrl} alt={username} className="h-8 w-8 rounded-full" />
      <span className="text-sm text-slate-700">{username}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
      >
        로그아웃
      </button>
    </div>
  );
}
