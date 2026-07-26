import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  isOrderStatus,
} from "@/features/orders/lib/status";

export function OrderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const known = isOrderStatus(status);
  const label = known ? ORDER_STATUS_LABELS[status] : status;
  const color = known
    ? ORDER_STATUS_COLORS[status]
    : {
        badge:
          "bg-muted text-muted-foreground ring-border",
        dot: "bg-muted-foreground",
      };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        color.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", color.dot)} />
      {label}
    </span>
  );
}
