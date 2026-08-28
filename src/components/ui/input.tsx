import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-md bg-elevated px-3.5 text-base text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-subtle",
        "transition-[box-shadow] duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      {...props}
    />
  );
}
