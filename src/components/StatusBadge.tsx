import { cn } from "@/lib/utils";

export function StatusBadge({ status, statuses }: { status: string; statuses: string[] }) {
  const i = statuses.indexOf(status);
  const last = i === statuses.length - 1;
  const bad = /reject|short|hold|issue|inactive|disabled|paused|due/i.test(status);
  const tone = bad
    ? "bg-danger-soft text-destructive"
    : last
      ? "bg-success-soft text-success"
      : i === 0
        ? "bg-warning-soft text-warning"
        : "bg-info-soft text-info";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
