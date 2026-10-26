import React from 'react';

// The shared <Button> concatenates its own dark-mode colours, which beat any colour passed in. The landing's call-to-action
// buttons set every state themselves so they look the same in light and dark mode.
const TONES = {
  primary: 'bg-violet-600 text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700 focus-visible:ring-violet-400',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 focus-visible:ring-slate-400',
  white: 'bg-white text-violet-700 hover:bg-violet-50 focus-visible:ring-white',
};

export default function CtaButton({ tone = 'primary', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex h-12 items-center justify-center whitespace-nowrap rounded-xl px-7 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
