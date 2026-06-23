import * as React from "react";

const buttonVariants = {
  default: "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/25 hover:-translate-y-0.5 active:translate-y-0 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 dark:hover:shadow-slate-50/25",
  destructive: "bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25 hover:-translate-y-0.5 active:translate-y-0 dark:bg-red-900 dark:text-red-50 dark:hover:bg-red-900/90",
  outline: "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:hover:border-slate-700",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700",
  ghost: "hover:bg-slate-100 hover:text-slate-900 hover:-translate-y-0.5 active:translate-y-0 dark:hover:bg-slate-800 dark:hover:text-slate-50",
  link: "text-slate-900 underline-offset-4 hover:underline dark:text-slate-50",
  emerald: "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0",
};

const buttonSizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  xl: "h-14 rounded-xl px-10 text-lg",
  icon: "h-10 w-10",
};

const Button = React.forwardRef(
  ({ className = "", variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : "button";
    const variantClasses = buttonVariants[variant] || buttonVariants.default;
    const sizeClasses = buttonSizes[size] || buttonSizes.default;

    const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300";

    return (
      <Comp
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
