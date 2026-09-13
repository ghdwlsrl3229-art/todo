import { TodoApp } from "@/components/TodoApp";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold">할 일 관리</h1>
      <TodoApp />
    </main>
  );
}
