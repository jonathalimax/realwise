import React from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Realwise" className="w-10 h-10 rounded-xl object-contain shadow-lg shadow-emerald-500/20" />
          <span className="font-bold text-lg">Realwise</span>
        </div>
        
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
