import * as React from "react";

const TabsContext = React.createContext(null);

function Tabs({ defaultValue, value, onValueChange, className = "", children, ...props }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;

  const handleValueChange = (newValue) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className = "", children, ...props }) {
  return (
    <div
      className={`inline-flex h-12 items-center justify-center rounded-full bg-slate-100 p-1.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${className}`}
      role="tablist"
      {...props}
    >
      {children}
    </div>
  );
}

function TabsTrigger({ value, className = "", children, ...props }) {
  const context = React.useContext(TabsContext);
  const isSelected = context?.value === value;

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      data-state={isSelected ? "active" : "inactive"}
      onClick={() => context?.onValueChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isSelected
          ? "bg-white text-slate-900 shadow-md dark:bg-slate-700 dark:text-white"
          : "text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, className = "", children, ...props }) {
  const context = React.useContext(TabsContext);
  const isSelected = context?.value === value;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300 animate-in fade-in-0 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
