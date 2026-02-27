"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

const Switch = React.forwardRef(function Switch(
  { className, checked = false, onCheckedChange, disabled = false, id, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => {
        if (disabled) return;
        onCheckedChange?.(!checked);
      }}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border)] bg-[var(--muted)] p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--primary)]",
        className
      )}
      {...props}
    >
      <span
        data-state={checked ? "checked" : "unchecked"}
        className="block h-5 w-5 rounded-full bg-[var(--card)] shadow transition-transform data-[state=checked]:translate-x-5"
      />
    </button>
  );
});

Switch.displayName = "Switch";

export { Switch };
