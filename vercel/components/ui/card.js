"use client";

import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn("rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]", className)} {...props} />;
}
