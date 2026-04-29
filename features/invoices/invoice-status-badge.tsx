import { InvoiceStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

type InvoiceStatusBadgeProps = {
  status: InvoiceStatus;
  isOverdue?: boolean;
};

export function InvoiceStatusBadge({
  status,
  isOverdue = false,
}: InvoiceStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        isOverdue
          ? "border-risk/40 bg-risk/10 text-risk"
          : "border-border bg-secondary text-muted-foreground",
      )}
    >
      {isOverdue ? "overdue" : status}
    </span>
  );
}
