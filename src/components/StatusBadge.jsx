import { cn } from "@/lib/utils";
import { statusConfig } from "@/lib/statusConfig";

export default function StatusBadge({ status, config = statusConfig, className }) {
  const cfg = config[status] || { label: (status || "").replace(/_/g, " "), className: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.className, className)}>
      {cfg.label}
    </span>
  );
}