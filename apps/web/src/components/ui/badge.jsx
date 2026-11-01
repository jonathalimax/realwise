import * as React from "react";

const badgeVariants = {
  default: "bg-slate-900 text-slate-50 hover:bg-slate-900/80 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/80",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800/80",
  destructive: "bg-red-500 text-slate-50 hover:bg-red-500/80 dark:bg-red-900 dark:text-slate-50 dark:hover:bg-red-900/80",
  outline: "text-slate-950 dark:text-slate-50 border border-[var(--rw-border)]",
};

function Badge({ className = "", variant = "default", children, ...props }) {
  const variantClasses = badgeVariants[variant] || badgeVariants.default;

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 dark:focus:ring-slate-300 ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
