import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { TodoApp } from "@/components/TodoApp";
import { UserHeader } from "@/components/UserHeader";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">할 일 관리</h1>
        <UserHeader username={user.username} avatarUrl={user.avatarUrl} />
      </div>
      <TodoApp />
    </main>
  );
}
