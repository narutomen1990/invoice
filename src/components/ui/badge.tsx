import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "warning" | "danger" | "outline";

const VARIANTS: Record<Variant, string> = {
  default: "bg-zinc-900 text-white",
  secondary: "bg-zinc-100 text-zinc-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-700",
  outline: "border border-zinc-300 text-zinc-700",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
