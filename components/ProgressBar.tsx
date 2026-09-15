export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-[14px] leading-[1.43] text-muted">
        <span>{label}</span>
        <span className="font-semibold text-ink">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-strong">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
