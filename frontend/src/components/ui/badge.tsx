import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/20 text-primary",
        muted: "border-border bg-muted/40 text-muted-foreground",
        positive:
          "border-transparent bg-[var(--positive)]/15 text-[var(--positive)]",
        human: "border-transparent bg-[var(--human)]/15 text-[var(--human)]",
        low: "border-transparent bg-[var(--risk-low)]/15 text-[var(--risk-low)]",
        medium:
          "border-transparent bg-[var(--risk-medium)]/15 text-[var(--risk-medium)]",
        high: "border-transparent bg-[var(--risk-high)]/18 text-[var(--risk-high)]",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
