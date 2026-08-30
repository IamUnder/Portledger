import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", {
  variants: {
    variant: {
      neutral: "bg-slate-700/30 text-slate-400 ring-slate-700/40",
      info: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/25",
      success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25",
      warning: "bg-amber-500/10 text-amber-400 ring-amber-500/25",
      danger: "bg-red-500/10 text-red-400 ring-red-500/25",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
