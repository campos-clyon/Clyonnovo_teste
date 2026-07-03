import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[18px] text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-cyan-600 text-white shadow-[0_18px_38px_-20px_rgba(6,182,212,0.72)] hover:-translate-y-0.5 hover:bg-cyan-700 [&_svg]:text-white",
        primary:
          "bg-cyan-600 text-white shadow-[0_18px_38px_-20px_rgba(6,182,212,0.72)] hover:-translate-y-0.5 hover:bg-cyan-700 [&_svg]:text-white",
        whatsapp:
          "bg-[#25D366] text-white shadow-[0_18px_38px_-20px_rgba(37,211,102,0.72)] hover:-translate-y-0.5 hover:bg-[#20bd5a] [&_svg]:text-white",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-slate-200 bg-white text-slate-900 shadow-none hover:-translate-y-0.5 hover:bg-slate-50 [&_svg]:text-slate-900",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-6 py-3 has-[>svg]:px-5",
        sm: "min-h-10 gap-1.5 px-4 py-2.5 has-[>svg]:px-3.5",
        lg: "min-h-14 px-8 py-4 has-[>svg]:px-6",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
