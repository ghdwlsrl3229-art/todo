export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
